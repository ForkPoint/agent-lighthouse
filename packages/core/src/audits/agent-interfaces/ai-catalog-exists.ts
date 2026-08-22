// TODO(redeem): this audit survives only if rewritten (approved 2026-08-21).
// Evidence dossier: docs/evidence/deletions/agent-tools/ai-catalog-exists.md
// Required rework:
//   Grade A evidence: a named vendor tool (Hugging Face hf-discover) documents and implements
//   fetching exactly https://{domain}/.well-known/ai-catalog.json, the path is normative in the ARD
//   draft spec co-authored by Google/Microsoft/Hugging Face, and there is verifiable production
//   adoption (Neon, Weaviate, Shopware core, specification.website). Keep the audit, but it MUST be
//   rewritten: pass condition should be specVersion + host + entries[] per ARD §4.1, not a
//   `services` array; and guidance/code samples must be replaced with the real schema, otherwise
//   the audit penalizes spec-conformant sites.
//   NOTE (Plan 4, Task 7): the rel="ai-catalog" advertisement from 4.19 is folded in below. The
//   ARD §4.1 pass-condition rewrite above is still open and is Task 10's job.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';

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

/** `<link ...; rel="ai-catalog">` in an HTTP Link header (RFC 8288). */
const LINK_HEADER_RE = /<([^>]+)>\s*;[^,]*?\brel\s*=\s*"?([^",;]+)"?/gi;

/**
 * Where a site says its AI catalog lives — ARD §6.1's `rel="ai-catalog"`.
 *
 * The absorbed audit keyed on `rel="alternate"` + `type="application/json"` +
 * an English `title` containing the exact phrase "ai catalog", which no site on
 * the public web emits. The real token is `ai-catalog`, matched here as a rel
 * token (case-insensitive, any position in a multi-token rel, any media type)
 * and also accepted from the HTTP `Link` header, across every crawled page.
 */
function findCatalogAdvertisement(
  pages: readonly PageContext[],
): { href: string; source: 'link-tag' | 'link-header'; pageUrl: string } | undefined {
  for (const page of pages) {
    for (const link of page.headLinks ?? []) {
      if (!link.href) continue;
      const rels = link.rel.toLowerCase().split(/\s+/);
      if (rels.includes('ai-catalog')) {
        return { href: link.href, source: 'link-tag', pageUrl: page.url };
      }
    }

    const header = page.fetchResult?.headers?.['link'];
    if (!header) continue;
    for (const match of header.matchAll(LINK_HEADER_RE)) {
      if (match[2]!.toLowerCase().split(/\s+/).includes('ai-catalog')) {
        return { href: match[1]!, source: 'link-header', pageUrl: page.url };
      }
    }
  }
  return undefined;
}

const EXPECTED =
  '/.well-known/ai-catalog.json returns 200 with valid JSON containing services array';

const SAMPLE = `// /.well-known/ai-catalog.json
{
  "version": "1.0",
  "name": "Your Site",
  "description": "What your site does",
  "capabilities": ["search", "contact", "product-info"],
  "owner": "Your Company",
  "contact": "hello@yoursite.com",
  "lastUpdated": "2026-01-01",
  "services": [
    {
      "name": "Search",
      "description": "Search our content",
      "url": "https://yoursite.com/api/search",
      "type": "rest"
    }
  ]
}

<!-- Optional: advertise it (ARD §6.1). The one documented consumer still
     resolves only the well-known path, so this never replaces the file. -->
<link rel="ai-catalog" type="application/ai-catalog+json" href="/.well-known/ai-catalog.json">`;

export class AiCatalogExistsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/ai-catalog-exists',
    category: 'agent-interfaces',
    title: 'AI Catalog exists',
    failureTitle: 'AI Catalog exists',
    description:
      'The AI catalog is the central discovery file that tells AI agents what capabilities your site offers. Think of it as a table of contents for your APIs, tools, and services. Without it, agents must probe multiple endpoints to understand what your site can do.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agent-interfaces/ai-catalog-exists.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without an AI catalog, agents must probe multiple endpoints to discover your services. This wastes time, increases error rates, and often results in agents skipping your site entirely in favor of competitors with clear service listings.',
      fix: "Create a /.well-known/ai-catalog.json file listing your site name, description, capabilities, and a services array with each service's name, description, URL, and type. Optionally advertise it with <link rel=\"ai-catalog\"> or the equivalent HTTP Link header — but serve it at the well-known path, which is the only location a documented consumer resolves.",
      code: SAMPLE,
      effort: 'easy',
      tags: ['ai-catalog', 'discovery', 'agent-protocol', 'ard'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Absorbed from ai-catalog-link (4.19). The advertisement is a
    // nice-to-have relative to the well-known file: the one known consumer
    // (Hugging Face hf-discover) resolves only /.well-known/ai-catalog.json,
    // so a rel="ai-catalog" link never passes this audit on its own — it turns
    // "no catalog" into "a catalog is advertised but not served there".
    const ad = findCatalogAdvertisement(ctx.pages);
    const miss = (message: string, found: string): AuditResult => {
      const recommendation = {
        priority: 'medium' as const,
        description: AiCatalogExistsAudit.meta.description,
        code: SAMPLE,
      };
      if (ad) {
        return this.warn(
          `${message} A catalog is advertised as ${ad.href} via rel="ai-catalog" (${ad.source}), but the one documented consumer resolves only /.well-known/ai-catalog.json.`,
          EXPECTED,
          `${found}; advertised at ${ad.href}`,
          recommendation,
          ad.pageUrl,
        );
      }
      return this.fail(message, EXPECTED, found, recommendation);
    };

    const result = ctx.rootFiles['/.well-known/ai-catalog.json'];
    if (!result || result.status !== 200 || !result.body) {
      return miss(
        '/.well-known/ai-catalog.json not found or not accessible.',
        result ? `HTTP ${result.status}` : 'Not fetched',
      );
    }

    const parsed = tryParseJson(result.body);
    if (!isObject(parsed)) {
      return miss('ai-catalog.json is not valid JSON.', 'Invalid JSON');
    }

    if (!Array.isArray(parsed['services'])) {
      return miss('ai-catalog.json does not contain a services array.', 'No services array');
    }

    const count = (parsed['services'] as unknown[]).length;
    return this.pass(
      `AI catalog found with ${count} service(s).`,
      EXPECTED,
      ad
        ? `Valid JSON with ${count} service(s); also advertised via rel="ai-catalog" (${ad.source})`
        : `Valid JSON with ${count} service(s)`,
    );
  }
}
