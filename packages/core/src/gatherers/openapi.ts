import { cacheOwner } from "./cache-owner";
import type { CheckContext } from "../check-context";
import type { FetchResult } from "../fetcher";
import { isSafeUrl } from "../fetcher";

/** An OpenAPI document as served: an untyped object, walked key by key. */
export type OpenApiSpec = Record<string, unknown>;

/** One operation object — the value under a path item's method key. */
export type OpenApiOperation = Record<string, unknown>;

/** The method keys a Path Item Object may carry, per OpenAPI 3.1 §4.8.9. */
const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
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
  // States what the read observed, not what the site did. `readOpenApiSpec`
  // also returns nothing for a 200 whose body will not parse, and for JSON
  // that is not an object — a site that does publish a document, badly. Saying
  // "no document is published" there would claim something never observed.
  message:
    "No readable OpenAPI document at /openapi.json, so there is nothing to check.",
  found: "No readable OpenAPI document",
} as const;

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
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
  const jsonResult = ctx.rootFiles["/openapi.json"];
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
 * The three cases exist because absent, broken and readable are three different
 * findings, and the line between them is *what survives the read*, not whether
 * anything was broken:
 *
 * - `empty` — no `paths` key, an empty Paths Object, or path items that declare
 *   no method. Nothing is broken and nothing is declared. `{"/x": {}}` is legal
 *   OpenAPI. An audit about an operation's contents has read nothing and
 *   declines.
 * - `malformed` — nothing is readable and something is broken: `paths` is not a
 *   Paths Object at all, or every entry under it is defective. The author wrote
 *   the thing that blocks the agent, so the audit fails and names it.
 * - `operations` — at least one operation is readable. `defects` may still be
 *   non-empty, and a caller grades what it read while naming what it could not.
 *   One broken entry beside twenty good ones does not erase the twenty.
 *
 * A defect is a defect at either level. A non-object where a Path Item Object
 * belongs and a non-object where an Operation Object belongs are the same
 * error one level apart, so `{"/x": {"get": "yes"}}` is malformed — zero
 * readable operations and one defect — while `{"/x": {}}` still declines.
 */
export type OpenApiPathsReading =
  | { kind: "empty" }
  | { kind: "malformed"; found: string; defects: string[] }
  | { kind: "operations"; operations: LocatedOperation[]; defects: string[] };

/** Names a JSON value's shape for a `found` line, e.g. "an array", "a string". */
function describeShape(val: unknown): string {
  if (val === null) return "null";
  if (Array.isArray(val)) return "an array";
  if (typeof val === "string") return "a string";
  if (typeof val === "number") return "a number";
  if (typeof val === "boolean") return "a boolean";
  return "not an object";
}

/**
 * The defect list as one line.
 *
 * `found` and `message` are scalar strings — the result schema drops a number
 * array and `toCheckResult` throws on an array of objects — so the first defect
 * is named in full and the rest are counted.
 */
function describeDefects(defects: string[]): string {
  const [first, ...rest] = defects;
  if (first === undefined) return "";
  return rest.length > 0 ? `${first} (+${rest.length} more)` : first;
}

/**
 * The sentence an audit appends when it graded what it could read.
 *
 * Shared so the three content audits name the same defect the same way; empty
 * when there is nothing to name, so a caller can append it unconditionally.
 */
export function defectNote(defects: string[]): string {
  if (defects.length === 0) return "";
  const entry = defects.length === 1 ? "entry" : "entries";
  return ` Skipped ${defects.length} unreadable ${entry}: ${describeDefects(defects)}.`;
}

/** The matching `found` suffix: a count, because `found` stays short. */
export function defectCount(defects: string[]): string {
  return defects.length > 0 ? `; ${defects.length} unreadable` : "";
}

/**
 * The document's `paths` member, classified so callers can tell absent from
 * broken, and broken-and-unreadable from broken-but-partly-readable.
 *
 * `x-` keys are skipped rather than judged: OpenAPI 3.1 §4.8.8 lets a Paths
 * Object carry specification extensions alongside its path items, and an
 * extension may legally hold any JSON value. Inside a path item only the eight
 * method keys are judged, because `summary`, `parameters`, `servers` and `$ref`
 * are legal members that are not Operation Objects.
 */
export function readOpenApiPaths(spec: OpenApiSpec): OpenApiPathsReading {
  const paths = spec["paths"];
  // Only an absent key is an absent `paths`. `"paths": null` is a value the
  // author wrote, and it is not a Paths Object.
  if (paths === undefined) return { kind: "empty" };
  if (!isObject(paths)) {
    const defects = [`paths is ${describeShape(paths)}, not an object`];
    return { kind: "malformed", found: describeDefects(defects), defects };
  }

  const entries = Object.entries(paths).filter(
    ([key]) => !key.startsWith("x-"),
  );
  if (entries.length === 0) return { kind: "empty" };

  const operations: LocatedOperation[] = [];
  const defects: string[] = [];

  for (const [path, pathItem] of entries) {
    if (!isObject(pathItem)) {
      defects.push(
        `paths entry "${path}" is ${describeShape(pathItem)}, not a path item object`,
      );
      continue;
    }
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      // An absent method is not a defect: no path item declares all eight.
      if (op === undefined) continue;
      if (isObject(op)) {
        operations.push({ path, method, op });
      } else {
        defects.push(
          `paths entry "${path}" declares ${method} as ${describeShape(op)}, not an operation object`,
        );
      }
    }
  }

  // Something is readable. Report it *and* the defects: discarding twenty
  // working operations to name one broken sibling states something false about
  // the document, and it is a verdict this family used to get wrong.
  if (operations.length > 0) return { kind: "operations", operations, defects };
  // Nothing readable, and the author wrote what blocks it.
  if (defects.length > 0)
    return { kind: "malformed", found: describeDefects(defects), defects };
  // Well-formed path items that declare no method are legal and announce
  // nothing, so they land with the other empties.
  return { kind: "empty" };
}

/**
 * Every operation the document declares, flattened to path + method + object.
 *
 * For callers that judge a site whether or not it publishes a document —
 * `agent-interfaces/search-endpoint`, `operability-safety/contact-form`. They
 * are looking for one endpoint, not grading the document, so a broken sibling
 * entry is skipped rather than discarding the entries beside it. A site with a
 * `POST /contact` and one malformed path item does have a contact endpoint, and
 * saying otherwise is the wrong claim this module exists to prevent.
 *
 * A caller whose verdict is *about* the document's contents wants
 * `readOpenApiPaths` instead, so it can fail the malformed case.
 */
export function openApiOperations(spec: OpenApiSpec): LocatedOperation[] {
  const paths = spec["paths"];
  if (!isObject(paths)) return [];

  const operations: LocatedOperation[] = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    if (path.startsWith("x-") || !isObject(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (isObject(op)) operations.push({ path, method, op });
    }
  }
  return operations;
}

const openApiServerCache = new WeakMap<
  object,
  Map<string, Promise<FetchResult | undefined>>
>();

export function probeOpenApiServer(
  ctx: { fetch: CheckContext["fetch"] },
  url: string,
  options: {
    method?: "GET" | "OPTIONS";
    headers?: Record<string, string>;
  } = {},
): Promise<FetchResult | undefined> {
  let cache = openApiServerCache.get(cacheOwner(ctx));
  if (!cache) {
    cache = new Map();
    openApiServerCache.set(cacheOwner(ctx), cache);
  }
  const key = `${options.method ?? "OPTIONS"}|${url}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => {
      if (!(await isSafeUrl(url))) return undefined;
      try {
        return await ctx.fetch({
          url,
          method: options.method ?? "OPTIONS",
          ...(options.headers ? { headers: options.headers } : {}),
        });
      } catch {
        return undefined;
      }
    })();
    cache.set(key, hit);
  }
  return hit;
}
