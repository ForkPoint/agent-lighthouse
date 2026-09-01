/**
 * Shared reader for the ARD capability manifest at
 * `/.well-known/ai-catalog.json`.
 *
 * Three audits (`ai-catalog-exists`, `ai-catalog-metadata`, `ai-catalog-urls`)
 * all read the same file, so the shape lives here once rather than being
 * re-derived — and re-invented — in each of them.
 *
 * Schema source: Agentic Resource Discovery (ARD) specification v0.9 §4.1-4.3
 * (Junjie Bu/Google, R.V. Guha/Microsoft, Shaun Smith/Hugging Face).
 *   - Required top level: `specVersion`, `host`, `entries`.
 *   - `host` describes the catalog operator; `displayName` is required,
 *     `identifier` (a DID), `documentationUrl`, `logoUrl` and `trustManifest`
 *     are optional.
 *   - Each entry requires `identifier` (a domain-anchored URN), `displayName`
 *     and `type` (an IANA media type), plus **exactly one** of `url` (remote
 *     reference) or `data` (inline artifact). `description`, `tags`,
 *     `capabilities`, `representativeQueries`, `version`, `updatedAt`,
 *     `metadata` and `trustManifest` are optional.
 *
 * The framework previously asserted a top-level `services` array, which appears
 * in no revision of the spec and in no live manifest — see
 * docs/evidence/deletions/agent-tools/ai-catalog-exists.md.
 */

import type { CheckContext } from "../../check-context";

/** The only location a documented consumer (hf-discover) resolves. */
export const AI_CATALOG_PATH = "/.well-known/ai-catalog.json";

/** Media type the spec says the manifest SHOULD be served with (§3.3). */
export const AI_CATALOG_MEDIA_TYPE = "application/ai-catalog+json";

/** The three top-level fields ARD §4.1 makes mandatory. */
export const ARD_REQUIRED_TOP_LEVEL = [
  "specVersion",
  "host",
  "entries",
] as const;

export interface ArdEntry {
  identifier?: string;
  displayName?: string;
  /** IANA media type of the referenced artifact. */
  type?: string;
  /** Remote reference. Mutually exclusive with inline `data`. */
  url?: string;
  /** True when the entry embeds the artifact inline instead of linking it. */
  hasData: boolean;
  description?: string;
  capabilities: string[];
  representativeQueries: string[];
  tags: string[];
  /**
   * Optional ISO 8601 freshness marker. §4.2 defines this on the **entry**;
   * there is no root-level `updatedAt` in the schema.
   */
  updatedAt?: string;
  /** Optional per-entry attestation extension (§4.2). Never a pass condition. */
  hasTrustManifest: boolean;
  /** Position in `entries`, used to label entries that name themselves poorly. */
  index: number;
}

export interface ArdManifest {
  specVersion: string;
  host: Record<string, unknown>;
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
  /** No 200 response at the well-known path. */
  | { ok: false; reason: "absent"; found: string }
  /** HTTP 200 but an HTML body — a SPA catch-all, not a manifest. */
  | { ok: false; reason: "html"; found: string }
  | { ok: false; reason: "not-json"; found: string }
  /** Valid JSON object, but not an ARD manifest. */
  | { ok: false; reason: "shape"; missing: string[]; found: string };

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

/**
 * Read and validate the ARD manifest out of the scan context.
 *
 * Every failure mode is named so callers can report the real diagnosis: the
 * old audits reported "not valid JSON" for an HTML soft-404 and "no services
 * array" for a perfectly conformant manifest.
 */
export function readAiCatalog(ctx: CheckContext): ArdRead {
  const result = ctx.rootFiles[AI_CATALOG_PATH];
  if (!result) return { ok: false, reason: "absent", found: "Not fetched" };
  if (result.status !== 200 || !result.body) {
    return { ok: false, reason: "absent", found: `HTTP ${result.status}` };
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
      reason: "html",
      found: `HTTP 200 but ${contentType || "an HTML body"} — no manifest is served there`,
    };
  }

  const parsed = tryParseJson(result.body);
  if (!isObject(parsed)) {
    return {
      ok: false,
      reason: "not-json",
      found: "HTTP 200 but the body is not a JSON object",
    };
  }

  const specVersion = nonEmptyString(parsed["specVersion"]);
  const host = isObject(parsed["host"]) ? parsed["host"] : undefined;
  const entries = Array.isArray(parsed["entries"])
    ? parsed["entries"]
    : undefined;

  const missing: string[] = [];
  if (!specVersion) missing.push("specVersion");
  if (!host) missing.push("host");
  if (!entries) missing.push("entries");
  if (!specVersion || !host || !entries) {
    return {
      ok: false,
      reason: "shape",
      missing,
      found: `JSON without ARD §4.1 required field(s): ${missing.join(", ")}`,
    };
  }

  return {
    ok: true,
    manifest: {
      specVersion,
      host,
      entries: entries.map(parseEntry),
      hostHasTrustManifest: isObject(host["trustManifest"]),
      contentType,
    },
  };
}

/**
 * A single sentence explaining why the manifest could not be read, reusable in
 * every consuming audit's message.
 */
export function describeFailure(read: Exclude<ArdRead, { ok: true }>): string {
  switch (read.reason) {
    case "absent":
      return `${AI_CATALOG_PATH} is not served (${read.found}).`;
    case "html":
      return `${AI_CATALOG_PATH} returns HTML, not a manifest — the request is being answered by a catch-all route.`;
    case "not-json":
      return `${AI_CATALOG_PATH} is served but is not valid JSON.`;
    case "shape":
      return `${AI_CATALOG_PATH} is not an ARD manifest: it is missing the required field(s) ${read.missing.join(", ")} (ARD §4.1).`;
  }
}
