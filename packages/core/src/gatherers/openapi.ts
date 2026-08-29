/**
 * The site's OpenAPI document, read once and shared.
 *
 * Seven audits used to carry a byte-identical private `getOpenApiSpec`, and
 * three of them also carried a byte-identical `getOperations`. One copy drifted
 * from the others every time the family was touched. This module is the single
 * read, plus the precondition that governs what an audit may say when the read
 * comes back empty.
 *
 * No fetch happens here: the orchestrator already asks for `/openapi.json` with
 * the rest of the root files, so this is a parse over bytes the scan holds.
 * `gatherers/sitemap.ts` reads `ctx.rootFiles` the same way.
 */

/** An OpenAPI document as served: an untyped object, walked key by key. */
export type OpenApiSpec = Record<string, unknown>;

/** One operation object — the value under a path item's method key. */
export type OpenApiOperation = Record<string, unknown>;

/** The method keys a Path Item Object may carry, per OpenAPI 3.1 §4.8.9. */
export const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
  'trace',
] as const;

/**
 * What an audit must say when the site publishes no OpenAPI document.
 *
 * **Absent artifact, absent verdict.** An audit about a document's contents has
 * observed nothing about a site that publishes no document, so it returns
 * `notApplicable`. Only a present-and-defective document may `fail`. Four of
 * these audits used to `fail` at `priority: 'high'` on the absence, which told
 * every bakery, blog and law firm to add a `servers` array to a spec it had
 * never written — 2.4 combined weight against a site no source says is worse
 * off. `openapi-exists` already declines the identical absence.
 *
 * The precondition lives beside the read, and the two places it must not live:
 *
 * - **Not a runner precondition.** `planAudits` knows page types and
 *   `EvidenceKey`s, both scan-level and domain-neutral. Teaching it one
 *   artifact type invites api-catalog, MCP manifest, RSL and feeds to follow,
 *   and the runner becomes a registry of artifact predicates.
 * - **Never an `EvidenceKey`.** `gatedMassShare` counts only skipped-for-no-
 *   evidence mass toward the 0.35 unscored threshold. An `openapi-spec-present`
 *   key would push that 2.4 into the numerator for every site without an API
 *   and move a perfectly judgeable site toward `overallScore: null`.
 */
export const NO_OPENAPI_SPEC = {
  message: 'No OpenAPI document is published at /openapi.json, so there is nothing to check.',
  found: 'No OpenAPI document',
} as const;

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * The slice of context this read needs.
 *
 * Structural rather than `CheckContext`, both to avoid an import cycle through
 * the audit layer and because it is the shape the seven private copies already
 * agreed on.
 */
interface OpenApiContext {
  rootFiles: Record<string, { status: number; body: string }>;
}

/**
 * The OpenAPI document served at `/openapi.json`, or `undefined`.
 *
 * Deliberately narrow, and known to be so: `openapi-exists` discovers specs at
 * `/openapi.yaml`, `/.well-known/api-catalog` and `<link rel="service-desc">`
 * as well, so a YAML-only site is invisible here. Widening this read changes
 * every caller's verdict, so it is a separate change from collapsing the
 * copies. The family's dossiers record it as the standing YAML blind spot.
 */
export function readOpenApiSpec(ctx: OpenApiContext): OpenApiSpec | undefined {
  const jsonResult = ctx.rootFiles['/openapi.json'];
  if (jsonResult && jsonResult.status === 200 && jsonResult.body) {
    try {
      const parsed: unknown = JSON.parse(jsonResult.body);
      if (isObject(parsed)) return parsed;
    } catch {
      // A body that is not JSON is not a document this read can offer.
    }
  }
  return undefined;
}

/** Every operation the document declares, flattened to path + method + object. */
export function openApiOperations(
  spec: OpenApiSpec,
): Array<{ path: string; method: string; op: OpenApiOperation }> {
  const paths = spec['paths'];
  if (!isObject(paths)) return [];

  const ops: Array<{ path: string; method: string; op: OpenApiOperation }> = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isObject(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (isObject(op)) ops.push({ path, method, op });
    }
  }
  return ops;
}
