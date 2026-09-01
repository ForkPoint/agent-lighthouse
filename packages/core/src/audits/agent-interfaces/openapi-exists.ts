import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext, PageContext } from "../../check-context";
import type { FetchResult } from "../../fetcher";
import { probeOpenApiServer } from "../../gatherers/openapi";
import { isSafeUrl } from "../../url-utils";

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/** Strip the parameters off a media type: `application/json; charset=utf-8`. */
function mediaType(contentType: string | undefined): string {
  return (contentType ?? "").split(";")[0]!.trim().toLowerCase();
}

function isHtml(result: FetchResult): boolean {
  return mediaType(result.contentType) === "text/html";
}

/**
 * The single most important validation rule in this domain: a 200 with an HTML
 * body at a well-known path lies, and lying is worse than a 404. The May 2026
 * API Evangelist survey found 68 of 74 providers answering `/.well-known/
 * api-catalog` with an HTML 200 — every one of them a false positive for any
 * audit that only looked at the status code.
 */
function servedAsData(result: FetchResult | undefined): result is FetchResult {
  return (
    !!result && result.status === 200 && !!result.body.trim() && !isHtml(result)
  );
}

/** An OpenAPI 3.x or Swagger 2.0 document: a version key plus a `paths` object. */
function isOpenApiDocument(parsed: unknown): boolean {
  if (!isObject(parsed)) return false;
  const versioned =
    typeof parsed["openapi"] === "string" ||
    typeof parsed["swagger"] === "string";
  return versioned && isObject(parsed["paths"]);
}

/**
 * YAML without a YAML parser: require the version and `paths` keys at the start
 * of a line, which an HTML page mentioning `openapi:` in prose cannot produce.
 * Paired with the non-HTML content-type gate above, this replaces the old
 * `body.includes('openapi:')` sniff that any Swagger-UI shell satisfied.
 */
function isOpenApiYaml(body: string): boolean {
  return /^(openapi|swagger)\s*:/m.test(body) && /^paths\s*:/m.test(body);
}

const SPEC_HREF_RE = /(openapi|swagger)[^/?#]*\.(json|ya?ml)(\?|#|$)/i;
/** Serialization types a spec is legitimately served as — none of them exclusive to OpenAPI. */
const SPEC_MEDIA_TYPES = new Set([
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-yaml",
]);
/** The registered OpenAPI media type: unambiguous on its own, whatever the href. */
const OPENAPI_MEDIA_TYPE_RE = /^application\/vnd\.oai\.openapi/;

/**
 * A head link advertising an API description.
 *
 * `rel="service-desc"` is the standards-track relation (RFC 8631) and is
 * accepted on its own; `alternate` is accepted when the href or the media type
 * says "spec". The old audit keyed on `title.includes('openapi')`, making an
 * optional, English, human-authored attribute the sole discriminator.
 */
function findSpecLink(
  pages: readonly PageContext[],
): { href: string; pageUrl: string } | undefined {
  for (const page of pages) {
    for (const link of page.headLinks ?? []) {
      const rels = link.rel.toLowerCase().split(/\s+/);
      const type = mediaType(link.type);
      const hrefLooksLikeSpec = SPEC_HREF_RE.test(link.href);
      if (!link.href) continue;

      if (rels.includes("service-desc"))
        return { href: link.href, pageUrl: page.url };
      if (!rels.includes("alternate")) continue;
      if (OPENAPI_MEDIA_TYPE_RE.test(type))
        return { href: link.href, pageUrl: page.url };
      if (hrefLooksLikeSpec && (type === "" || SPEC_MEDIA_TYPES.has(type))) {
        return { href: link.href, pageUrl: page.url };
      }
    }
  }
  return undefined;
}

/** RFC 9727: an `application/linkset+json` document with a `linkset` array. */
function readApiCatalog(ctx: CheckContext): { count: number } | undefined {
  const result = ctx.rootFiles["/.well-known/api-catalog"];
  if (!servedAsData(result)) return undefined;
  const parsed = tryParseJson(result.body);
  if (!isObject(parsed)) return undefined;
  const linkset = parsed["linkset"];
  if (!Array.isArray(linkset) || linkset.length === 0) return undefined;
  return { count: linkset.length };
}

const EXPECTED =
  'An RFC 9727 /.well-known/api-catalog linkset, a valid OpenAPI document at /openapi.json or /openapi.yaml, or a <link rel="service-desc"> pointing at one';

const SAMPLE = `// /.well-known/api-catalog — RFC 9727, Content-Type: application/linkset+json
{
  "linkset": [{
    "anchor": "https://yoursite.com/api",
    "service-desc": [{ "href": "https://yoursite.com/openapi.json",
                       "type": "application/vnd.oai.openapi+json" }],
    "service-doc":  [{ "href": "https://yoursite.com/docs" }]
  }]
}

<!-- or advertise the document from any page -->
<link rel="service-desc" type="application/json" href="/openapi.json">`;

export class OpenApiExistsAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/openapi-exists",
    category: "agent-interfaces",
    title: "API description discoverable",
    failureTitle: "API description discoverable",
    description:
      'One discovery audit over the mechanisms that actually exist: the RFC 9727 /.well-known/api-catalog linkset, an OpenAPI document at a probed root path, and a <link rel="service-desc"> advertising one. A site with no API surface is not applicable rather than failing.',
    scoreDisplayMode: "informative",
    weight: weightForGrade("B", "informative"),
    evidenceGrade: "B",
    tier: "informative",
    dossier: "docs/evidence/audits/agent-interfaces/openapi-exists.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "medium",
    guidance: {
      impact:
        "An agent that cannot find your API description cannot call it. Note that every documented consumer today (GPT Actions, Microsoft 365 Copilot API plugins) receives the document from a developer rather than fetching it from your site, so this check is informative and unscored.",
      fix: 'Publish an RFC 9727 linkset at /.well-known/api-catalog with a Content-Type of application/linkset+json — the only ratified, IANA-registered domain-level API discovery mechanism. Serve the OpenAPI document itself at /openapi.json or /openapi.yaml, and advertise it with <link rel="service-desc">. Never answer a well-known path with an HTML 200.',
      code: SAMPLE,
      effort: "moderate",
      docsUrl: "https://www.rfc-editor.org/rfc/rfc9727.html",
      tags: ["openapi", "api", "discovery", "rfc9727", "well-known"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    // 1. RFC 9727 api-catalog — the ratified, standards-track path.
    const catalog = readApiCatalog(ctx);
    if (catalog) {
      return this.pass(
        `RFC 9727 api-catalog found at /.well-known/api-catalog (${catalog.count} linkset ${catalog.count === 1 ? "entry" : "entries"}).`,
        EXPECTED,
        `/.well-known/api-catalog -> application/linkset+json, ${catalog.count} entries`,
      );
    }

    // 2. The OpenAPI document itself at a probed root path.
    const jsonResult = ctx.rootFiles["/openapi.json"];
    if (servedAsData(jsonResult)) {
      const parsed = tryParseJson(jsonResult.body);
      if (isOpenApiDocument(parsed)) {
        return this.pass(
          "Valid OpenAPI document found at /openapi.json.",
          EXPECTED,
          `/openapi.json -> OpenAPI ${(parsed as Record<string, unknown>)["openapi"] ?? (parsed as Record<string, unknown>)["swagger"]}`,
        );
      }
      // Something is served there, so the site does have an API surface —
      // it is just not a spec. `{"hello":1}` used to pass as "valid OpenAPI".
      return this.warn(
        "/openapi.json is served but the body is not a valid OpenAPI document (no openapi/swagger version key with a paths object).",
        EXPECTED,
        "/openapi.json -> 200, not an OpenAPI document",
        {
          priority: "medium",
          description: OpenApiExistsAudit.meta.description,
          code: SAMPLE,
        },
      );
    }

    const yamlResult = ctx.rootFiles["/openapi.yaml"];
    if (servedAsData(yamlResult) && isOpenApiYaml(yamlResult.body)) {
      return this.pass(
        "Valid OpenAPI document found at /openapi.yaml.",
        EXPECTED,
        "/openapi.yaml -> YAML with openapi/swagger and paths keys",
      );
    }

    // 3. Absorbed from openapi-link (4.18): the head link is a discovery hint
    // to follow, never a requirement on its own.
    const link = findSpecLink(ctx.pages);
    if (link) {
      const url = new URL(link.href, ctx.baseUrl).toString();
      // The href is site-controlled and may be absolute, so it can point at a
      // private address or a non-HTTP scheme. Validate before fetching, the
      // same way llms-txt-links-valid, no-broken-ai-endpoints and mcp-endpoint
      // gate the URLs they harvest from scanned content.
      if (!(await isSafeUrl(url))) {
        return this.warn(
          `An API description is advertised at ${link.href} but it is not safe to probe (non-HTTP scheme or private address).`,
          EXPECTED,
          `<link> -> ${url} -> refused`,
          {
            priority: "medium",
            description: OpenApiExistsAudit.meta.description,
            code: SAMPLE,
          },
          link.pageUrl,
        );
      }
      const result = await probeOpenApiServer(ctx, url, { method: "GET" });
      if (result) {
        const valid =
          servedAsData(result) &&
          (isOpenApiDocument(tryParseJson(result.body)) ||
            isOpenApiYaml(result.body));
        if (valid) {
          return this.pass(
            `API description advertised in <link> and verified at ${link.href}.`,
            EXPECTED,
            `<link> -> ${url} -> valid OpenAPI document`,
            link.pageUrl,
          );
        }
      }
      return this.warn(
        `An API description is advertised at ${link.href} but it could not be verified.`,
        EXPECTED,
        `<link> -> ${url} -> no valid OpenAPI document`,
        {
          priority: "medium",
          description: OpenApiExistsAudit.meta.description,
          code: SAMPLE,
        },
        link.pageUrl,
      );
    }

    // 4. A blocked scan is not evidence of absence.
    if (ctx.wafProtection?.isBlocked) {
      return this.warn(
        `API discovery could not be verified — the scan was blocked by ${ctx.wafProtection.name}.`,
        EXPECTED,
        `Blocked by ${ctx.wafProtection.name}`,
        {
          priority: "medium",
          description: OpenApiExistsAudit.meta.description,
          code: SAMPLE,
        },
      );
    }

    // 5. No API surface anywhere: a brochure site has nothing to fix, and a
    // scored failure told it its agentic workflows were blocked.
    return this.notApplicable(
      "No API surface detected, so API discovery does not apply to this site.",
      EXPECTED,
      "No api-catalog, no OpenAPI document, no service-desc link",
    );
  }
}
