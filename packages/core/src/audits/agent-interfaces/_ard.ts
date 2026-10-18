/**
 * Shared reader for the ARD capability manifest at `/.well-known/ard.json`
 * or `/.well-known/ai-catalog.json`.
 *
 * Three audits (`ai-catalog-exists`, `ai-catalog-metadata`, `ai-catalog-urls`)
 * all read the same file, so the shape lives here once rather than being
 * re-derived — and re-invented — in each of them.
 *
 * Schema source: Agentic Resource Discovery (ARD) specification v0.91 §4-5
 * (Junjie Bu/Google, R.V. Guha/Microsoft, Shaun Smith/Hugging Face).
 *   - Required top level: `entries` only. The `ArdManifest` JSON schema leaves
 *     `additionalProperties` open; `specVersion` and `host` come from the Linux
 *     Foundation AI Catalog spec and are read when present, never required.
 *     hf-discover, the one documented consumer, reads only `entries`.
 *   - `host` describes the catalog operator; `displayName` is expected,
 *     `identifier` (a DID), `documentationUrl`, `logoUrl` and `trustManifest`
 *     are optional.
 *   - Each entry requires `identifier` (a domain-anchored URN), `displayName`
 *     and `type` (an IANA media type), plus **exactly one** of `url` (remote
 *     reference) or `data` (inline artifact). `description`, `tags`,
 *     `capabilities`, `representativeQueries`, `version`, `updatedAt`,
 *     `metadata` and `trustManifest` are optional.
 *
 * The framework previously asserted a top-level `services` array, which appears
 * in no revision of the spec and in no live manifest.
 */

import type { CheckContext } from "#core/check-context";

/** ARD v0.91 §5.1 normative path: consumers MUST fetch it. */
export const ARD_PATH = "/.well-known/ard.json";

/**
 * ARD's predecessor path. hf-discover resolves only this one, and the MCP
 * Server Card extension (SEP-2127) still names it, so it stays a first-class
 * location rather than a legacy fallback.
 */
export const AI_CATALOG_PATH = "/.well-known/ai-catalog.json";

/** Read order: the current ARD path first, then the predecessor. */
export const CATALOG_PATHS = [ARD_PATH, AI_CATALOG_PATH] as const;

/** Both well-known paths, for messages that name where the audit looked. */
export const CATALOG_PATHS_LABEL = `${ARD_PATH} or ${AI_CATALOG_PATH}`;

/** Optional fields are undefined when the manifest entry omits them or leaves them blank. */
export interface ArdEntry {
  identifier?: string | undefined;
  displayName?: string | undefined;
  /** IANA media type of the referenced artifact. */
  type?: string | undefined;
  /** Remote reference. Mutually exclusive with inline `data`. */
  url?: string | undefined;
  /** True when the entry embeds the artifact inline instead of linking it. */
  hasData: boolean;
  description?: string | undefined;
  capabilities: string[];
  representativeQueries: string[];
  tags: string[];
  /**
   * Optional ISO 8601 freshness marker. §4.2 defines this on the **entry**;
   * there is no root-level `updatedAt` in the schema.
   */
  updatedAt?: string | undefined;
  /** Optional per-entry attestation extension (§4.2). Never a pass condition. */
  hasTrustManifest: boolean;
  /** Position in `entries`, used to label entries that name themselves poorly. */
  index: number;
}

export interface ArdManifest {
  /** Well-known path the manifest was read from. */
  path: string;
  /** AI Catalog spec field; optional under ARD v0.91. */
  specVersion?: string | undefined;
  /** Empty when the manifest carries no `host` object (optional under ARD v0.91). */
  host: Record<string, unknown>;
  /** True when the manifest carries a `host` object at all. */
  hasHost: boolean;
  entries: ArdEntry[];
  /**
   * Optional attestation extension on the **host** object (§4.3, "Trust
   * metadata for the host"). The spec defines `trustManifest` at host and
   * entry scope only — a root-level copy is not part of the schema and is
   * deliberately not read.
   */
  hostHasTrustManifest: boolean;
  /** Content-Type the manifest was served with, lower-cased. */
  contentType: string;
}

export type ArdRead =
  | { ok: true; manifest: ArdManifest }
  /**
   * No manifest at either well-known path: no 200 response, or an HTML page
   * answering for the file. A catch-all route serving the site's HTML is not a
   * manifest the site published, the same line `isRootArtifact` draws.
   */
  | { ok: false; reason: "absent"; path: string; found: string }
  | { ok: false; reason: "not-json"; path: string; found: string }
  /** Valid JSON object, but not an ARD manifest. */
  | {
      ok: false;
      reason: "shape";
      path: string;
      missing: string[];
      found: string;
    };

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

/** A string that carries information — whitespace-only is not a value. */
export function nonEmptyString(val: unknown): string | undefined {
  return typeof val === "string" && val.trim() !== "" ? val : undefined;
}

/** Array-of-strings field, with blank members dropped. */
export function stringList(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((v) => nonEmptyString(v))
    .filter((v): v is string => v !== undefined);
}

/** Human-usable label for an entry, for audit messages. */
export function entryLabel(entry: ArdEntry): string {
  return entry.displayName ?? entry.identifier ?? `entry #${entry.index + 1}`;
}

function parseEntry(raw: unknown, index: number): ArdEntry {
  if (!isObject(raw)) {
    return {
      hasData: false,
      capabilities: [],
      representativeQueries: [],
      tags: [],
      hasTrustManifest: false,
      index,
    };
  }
  return {
    identifier: nonEmptyString(raw["identifier"]),
    displayName: nonEmptyString(raw["displayName"]),
    type: nonEmptyString(raw["type"]),
    url: nonEmptyString(raw["url"]),
    hasData: raw["data"] !== undefined && raw["data"] !== null,
    description: nonEmptyString(raw["description"]),
    capabilities: stringList(raw["capabilities"]),
    representativeQueries: stringList(raw["representativeQueries"]),
    tags: stringList(raw["tags"]),
    updatedAt: nonEmptyString(raw["updatedAt"]),
    hasTrustManifest: isObject(raw["trustManifest"]),
    index,
  };
}

/** Read and validate the manifest at one well-known path. */
function readAt(ctx: CheckContext, path: string): ArdRead {
  const result = ctx.rootFiles[path];
  if (!result)
    return { ok: false, reason: "absent", path, found: "Not fetched" };
  if (result.status !== 200 || !result.body) {
    return {
      ok: false,
      reason: "absent",
      path,
      found: `HTTP ${result.status}`,
    };
  }

  const contentType = (
    result.contentType ??
    result.headers?.["content-type"] ??
    ""
  ).toLowerCase();
  if (
    contentType.includes("html") ||
    /^\s*<(!doctype|html)/i.test(result.body)
  ) {
    return {
      ok: false,
      reason: "absent",
      path,
      found: `HTTP 200 with an HTML page (${contentType || "HTML body"}), not the file`,
    };
  }

  const parsed = tryParseJson(result.body);
  if (!isObject(parsed)) {
    return {
      ok: false,
      reason: "not-json",
      path,
      found: "HTTP 200 but the body is not a JSON object",
    };
  }

  const entries = Array.isArray(parsed["entries"])
    ? parsed["entries"]
    : undefined;
  if (!entries) {
    return {
      ok: false,
      reason: "shape",
      path,
      missing: ["entries"],
      found: "JSON without the ARD required field entries",
    };
  }

  const host = isObject(parsed["host"]) ? parsed["host"] : undefined;
  return {
    ok: true,
    manifest: {
      path,
      specVersion: nonEmptyString(parsed["specVersion"]),
      host: host ?? {},
      hasHost: host !== undefined,
      entries: entries.map(parseEntry),
      hostHasTrustManifest: isObject(host?.["trustManifest"]),
      contentType,
    },
  };
}

/**
 * Read and validate the ARD manifest out of the scan context.
 *
 * Both well-known paths are read. A valid manifest at either one wins, and
 * one that lists entries wins over an empty one; ard.json wins a tie. When
 * neither is valid, a present-but-broken file is reported ahead of an absent
 * one, so the site hears about the breakage instead of a 404 at the other
 * path. Every failure mode is named so callers can report the real diagnosis.
 */
/**
 * Every valid manifest, in read order (ard.json first). A site may publish
 * both files with different entries; a caller looking for one kind of entry,
 * such as an MCP Server Card, searches all of them rather than the one
 * `readAiCatalog` picks.
 */
export function readAiCatalogs(ctx: CheckContext): ArdManifest[] {
  return CATALOG_PATHS.map((path) => readAt(ctx, path)).flatMap((read) =>
    read.ok ? [read.manifest] : [],
  );
}

export function readAiCatalog(ctx: CheckContext): ArdRead {
  const reads = CATALOG_PATHS.map((path) => readAt(ctx, path));
  // A manifest that lists entries beats an empty one at the other path.
  const valid =
    reads.find((r) => r.ok && r.manifest.entries.length > 0) ??
    reads.find((r) => r.ok);
  if (valid) return valid;

  const failures = reads.filter(
    (r): r is Exclude<ArdRead, { ok: true }> => !r.ok,
  );
  const broken = failures.find((r) => r.reason !== "absent");
  if (broken) return broken;
  return {
    ok: false,
    reason: "absent",
    path: CATALOG_PATHS_LABEL,
    found: failures.map((r) => `${r.path}: ${r.found}`).join("; "),
  };
}

/**
 * A single sentence explaining why the manifest could not be read, reusable in
 * every consuming audit's message.
 */
// The switch is exhaustive over ArdRead; tsc (noImplicitReturns) proves every path returns.
// oxlint-disable-next-line typescript/consistent-return
export function describeFailure(read: Exclude<ArdRead, { ok: true }>): string {
  switch (read.reason) {
    case "absent":
      return `Neither ${ARD_PATH} nor ${AI_CATALOG_PATH} is served (${read.found}).`;
    case "not-json":
      return `${read.path} is served but is not valid JSON.`;
    case "shape":
      return `${read.path} is not an ARD manifest: it is missing the required field(s) ${read.missing.join(", ")}.`;
  }
}
