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
const HTTP_METHODS = [
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
 * these audits used to `fail` at high or medium priority on the absence, which
 * told every bakery, blog and law firm to add a `servers` array to a spec it
 * had never written — 2.4 combined weight against a site no source says is
 * worse off. `openapi-exists` already declines the identical absence.
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

/** One operation, located: the path it hangs under and the method key it used. */
export interface LocatedOperation {
  path: string;
  method: string;
  op: OpenApiOperation;
}

/**
 * What the document's `paths` member turned out to be.
 *
 * The three cases exist because absent and broken are not the same finding:
 *
 * - `empty` — no `paths` key, an empty Paths Object, or path items that declare
 *   no method. The document announces no operations. An audit about an
 *   operation's contents has read nothing and declines.
 * - `malformed` — `paths` is present and is not a Paths Object. `"paths":
 *   ["get","post"]` puts a string where a Path Item Object belongs. That is a
 *   defective document, not an absent one, and a defective document is exactly
 *   what these audits are for. It fails.
 * - `operations` — a well-formed Paths Object declaring at least one operation.
 */
export type OpenApiPathsReading =
  | { kind: 'empty' }
  | { kind: 'malformed'; found: string }
  | { kind: 'operations'; operations: LocatedOperation[] };

/** Names a JSON value's shape for a `found` line, e.g. "an array", "a string". */
function describeShape(val: unknown): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'an array';
  if (typeof val === 'string') return 'a string';
  if (typeof val === 'number') return 'a number';
  if (typeof val === 'boolean') return 'a boolean';
  return 'not an object';
}

/**
 * The document's `paths` member, classified so callers can tell absent from
 * broken.
 *
 * `x-` keys are skipped rather than judged: OpenAPI 3.1 §4.8.8 lets a Paths
 * Object carry specification extensions alongside its path items, and an
 * extension may legally hold any JSON value.
 */
export function readOpenApiPaths(spec: OpenApiSpec): OpenApiPathsReading {
  const paths = spec['paths'];
  // Only an absent key is an absent `paths`. `"paths": null` is a value the
  // author wrote, and it is not a Paths Object.
  if (paths === undefined) return { kind: 'empty' };
  if (!isObject(paths)) {
    return { kind: 'malformed', found: `paths is ${describeShape(paths)}, not an object` };
  }

  const entries = Object.entries(paths).filter(([key]) => !key.startsWith('x-'));
  if (entries.length === 0) return { kind: 'empty' };

  const broken = entries.find(([, pathItem]) => !isObject(pathItem));
  if (broken) {
    return {
      kind: 'malformed',
      found: `paths entry "${broken[0]}" is ${describeShape(broken[1])}, not a path item object`,
    };
  }

  const operations: LocatedOperation[] = [];
  for (const [path, pathItem] of entries) {
    for (const method of HTTP_METHODS) {
      const op = (pathItem as Record<string, unknown>)[method];
      if (isObject(op)) operations.push({ path, method, op });
    }
  }
  // Well-formed path items that declare no method are legal and announce
  // nothing, so they land with the other empties.
  if (operations.length === 0) return { kind: 'empty' };
  return { kind: 'operations', operations };
}

/**
 * Every operation the document declares, flattened to path + method + object.
 *
 * For callers that judge a site whether or not it publishes a document —
 * `agent-interfaces/search-endpoint`, `operability-safety/contact-form` — where
 * a malformed `paths` and an absent one are equally "no operation found".
 * A caller whose verdict is *about* the document's contents wants
 * `readOpenApiPaths` instead, so it can fail the malformed case.
 */
export function openApiOperations(spec: OpenApiSpec): LocatedOperation[] {
  const paths = readOpenApiPaths(spec);
  return paths.kind === 'operations' ? paths.operations : [];
}
