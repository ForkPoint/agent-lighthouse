import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { flattenJsonLd } from '../../parser';
import { readOpenApiSpec } from '../../gatherers/openapi';

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/** `@type` is legally a string or an array of strings; compare against both. */
function hasType(node: Record<string, unknown>, type: string): boolean {
  const t = node['@type'];
  if (typeof t === 'string') return t === type;
  if (Array.isArray(t)) return t.includes(type);
  return false;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

type OpenApiPaths = Record<string, Record<string, unknown>>;

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];

/**
 * A search operation is one whose path carries `search` as its own word —
 * `/search`, `/api/product-search`. A substring match also fired on
 * `/research/papers` and `/searchindex/status`, which are not search APIs.
 */
const SEARCH_PATH_RE = /\bsearch\b/i;

/** Statuses that mean "the endpoint exists but we were not allowed to see it". */
const GATED_STATUSES = new Set([401, 403, 407, 451]);

function findSearchOperation(spec: Record<string, unknown>): string | undefined {
  const paths = spec['paths'] as OpenApiPaths | undefined;
  if (!isObject(paths)) return undefined;

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isObject(pathItem)) continue;
    if (!SEARCH_PATH_RE.test(path)) continue;
    for (const method of HTTP_METHODS) {
      if (method === 'get' && isObject(pathItem[method])) return path;
    }
  }
  return undefined;
}

type SearchActionState =
  /** A `SearchAction` with a resolvable URL template carrying a query placeholder. */
  | { kind: 'template'; urlTemplate: string; pageUrl: string }
  /** A `SearchAction` whose target is unusable — no template, or no placeholder in it. */
  | { kind: 'unresolvable'; detail: string; pageUrl: string }
  /** A `WebSite` node that declares no `SearchAction` at all. */
  | { kind: 'no-action'; pageUrl: string }
  | { kind: 'none' };

/**
 * Pull the best SearchAction state out of the crawled pages.
 *
 * Reads `structuredData` (JSON-LD + Microdata + RDFa) when the gatherer
 * produced it and falls back to raw JSON-LD, then runs the blocks through the
 * shared deep flattener so a SearchAction nested under `mainEntity`, inside a
 * top-level array or behind `@graph` is found the same way.
 */
function readSearchActions(pages: readonly PageContext[]): SearchActionState {
  let fallback: SearchActionState = { kind: 'none' };

  for (const page of pages) {
    const nodes = flattenJsonLd(page.structuredData ?? page.jsonLd) as Record<string, unknown>[];
    let sawWebSite = false;

    for (const node of nodes) {
      if (hasType(node, 'WebSite')) sawWebSite = true;
      if (!hasType(node, 'SearchAction')) continue;

      for (const target of asArray(node['target'])) {
        const urlTemplate = isObject(target)
          ? typeof target['urlTemplate'] === 'string'
            ? target['urlTemplate']
            : undefined
          : typeof target === 'string'
            ? target
            : undefined;

        if (urlTemplate === undefined) {
          if (fallback.kind === 'none' || fallback.kind === 'no-action') {
            fallback = {
              kind: 'unresolvable',
              detail: 'SearchAction target has no urlTemplate',
              pageUrl: page.url,
            };
          }
          continue;
        }
        // A template without a `{placeholder}` cannot carry the query term, so
        // an agent has nothing to substitute — the markup is decorative.
        if (!/\{[^}]*\}/.test(urlTemplate)) {
          if (fallback.kind === 'none' || fallback.kind === 'no-action') {
            fallback = {
              kind: 'unresolvable',
              detail: `SearchAction target has no query placeholder: ${urlTemplate}`,
              pageUrl: page.url,
            };
          }
          continue;
        }
        return { kind: 'template', urlTemplate, pageUrl: page.url };
      }
    }

    if (sawWebSite && fallback.kind === 'none') fallback = { kind: 'no-action', pageUrl: page.url };
  }

  return fallback;
}

/**
 * Does a 200 response actually carry search results?
 *
 * A bare `status === 200` proved nothing: every SPA search route answers 200
 * with an empty shell. For JSON we require a non-empty array (or a positive
 * result count); for markup we require some visible text once scripts, styles
 * and tags are stripped. A soft-404 "no results" page that still renders prose
 * is not distinguishable this way and remains a known limitation.
 */
function carriesResults(body: string, contentType: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;

  const looksJson = /json/i.test(contentType) || trimmed.startsWith('{') || trimmed.startsWith('[');
  if (looksJson) {
    const parsed = tryParseJson(trimmed);
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (isObject(parsed)) {
      for (const value of Object.values(parsed)) {
        if (Array.isArray(value) && value.length > 0) return true;
      }
      for (const key of ['total', 'totalResults', 'count', 'numFound']) {
        const value = parsed[key];
        if (typeof value === 'number' && value > 0) return true;
      }
      return false;
    }
    // Unparseable but non-empty body: fall through to the text check.
  }

  const text = trimmed
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0;
}

const EXPECTED =
  'A SearchAction URL template that returns results, or a GET search operation in the OpenAPI spec';

const SAMPLE = `<!-- Schema.org SearchAction in JSON-LD -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://yoursite.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://yoursite.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
</script>`;

export class SearchEndpointAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/search-endpoint',
    category: 'agent-interfaces',
    title: 'Site search reachable by agents',
    failureTitle: 'Site search reachable by agents',
    description:
      'A declared search endpoint lets an AI agent find specific content on your site without crawling every page. This audit covers both halves of that declaration: the Schema.org SearchAction URL template, and a GET search operation in your OpenAPI spec — and it probes the template rather than trusting it.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/agent-interfaces/search-endpoint.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'low',
    guidance: {
      impact:
        'Without a declared search endpoint, an agent asked to "find pricing info on Example.com" has to crawl the site to answer. Note that no vendor documents an agent that reads SearchAction today — Google retired its only documented consumer in 2024 — so this check is informative and unscored.',
      fix: 'Add a WebSite SearchAction to your homepage JSON-LD whose target URL template carries a {search_term_string} placeholder, or expose a GET search operation in your OpenAPI spec. Make sure the template actually returns results when the placeholder is substituted.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl: 'https://schema.org/SearchAction',
      tags: ['search', 'schema-org', 'openapi', 'api'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const state = readSearchActions(ctx.pages);
    const openApiPath = (() => {
      const spec = readOpenApiSpec(ctx);
      return spec ? findSearchOperation(spec) : undefined;
    })();

    if (state.kind === 'template') {
      // Every placeholder is substituted; the first miss left a literal `{lang}`
      // in the URL and turned a working endpoint into a false warn.
      const testUrl = state.urlTemplate.replace(/\{[^}]*\}/g, 'test');
      try {
        const result = await ctx.fetch({ url: testUrl });
        if (result.status === 200) {
          if (carriesResults(result.body, result.contentType ?? '')) {
            return this.pass(
              `SearchAction endpoint is functional: ${testUrl} returned results.`,
              EXPECTED,
              `SearchAction template: ${state.urlTemplate} -> HTTP 200 with results`,
              state.pageUrl,
            );
          }
          return this.warn(
            `SearchAction endpoint returned HTTP 200 but no results — an empty shell or an empty result set.`,
            EXPECTED,
            `SearchAction template: ${state.urlTemplate} -> HTTP 200, empty payload`,
            { priority: 'low', description: SearchEndpointAudit.meta.description, code: SAMPLE },
            state.pageUrl,
          );
        }
        if (GATED_STATUSES.has(result.status)) {
          return this.warn(
            `SearchAction endpoint is gated: ${testUrl} returned HTTP ${result.status}, so it could not be verified.`,
            EXPECTED,
            `SearchAction template: ${state.urlTemplate} -> HTTP ${result.status} (gated)`,
            { priority: 'low', description: SearchEndpointAudit.meta.description, code: SAMPLE },
            state.pageUrl,
          );
        }
        return this.warn(
          `SearchAction URL found but returned HTTP ${result.status}.`,
          EXPECTED,
          `SearchAction template: ${state.urlTemplate} -> HTTP ${result.status}`,
          { priority: 'low', description: SearchEndpointAudit.meta.description, code: SAMPLE },
          state.pageUrl,
        );
      } catch {
        return this.warn(
          `SearchAction URL found but could not be reached: ${state.urlTemplate}.`,
          EXPECTED,
          `SearchAction template: ${state.urlTemplate} -> unreachable`,
          { priority: 'low', description: SearchEndpointAudit.meta.description, code: SAMPLE },
          state.pageUrl,
        );
      }
    }

    if (openApiPath) {
      return this.pass(
        `OpenAPI has GET search endpoint: ${openApiPath}.`,
        EXPECTED,
        `GET ${openApiPath}`,
      );
    }

    // Absorbed from website-search-action (3.4): declared-but-incomplete
    // markup is a warn, not the same verdict as declaring nothing at all.
    if (state.kind === 'unresolvable') {
      return this.warn(
        `SearchAction found but it is not resolvable: ${state.detail}.`,
        EXPECTED,
        state.detail,
        { priority: 'low', description: SearchEndpointAudit.meta.description, code: SAMPLE },
        state.pageUrl,
      );
    }

    if (state.kind === 'no-action') {
      return this.warn(
        'WebSite schema found but it declares no SearchAction.',
        EXPECTED,
        'WebSite schema without a potentialAction SearchAction',
        { priority: 'low', description: SearchEndpointAudit.meta.description, code: SAMPLE },
        state.pageUrl,
      );
    }

    return this.fail(
      'No search endpoint declared (no SearchAction and no OpenAPI search operation).',
      EXPECTED,
      'No search endpoint detected',
      { priority: 'low', description: SearchEndpointAudit.meta.description, code: SAMPLE },
    );
  }
}
