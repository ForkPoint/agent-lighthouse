// Graduated from proposal 2026-08-22 (Plan 5, Task 29).
// Evidence dossier: docs/evidence/audits/agent-interfaces/mcp-tools-list-determinism.md
//
// Tool definitions sit near the front of the model's prompt. If their bytes
// move between turns, the provider-side prefix cache misses and the whole tool
// block is re-billed at uncached rates, every turn. Three identical requests
// make that visible.
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";
import {
  discoverMcpEndpoint,
  discoverProbe,
  parseRpcResponse,
  postRpcRaw,
  discoverParams,
  isObject,
  MCP_PROTOCOL_VERSION,
} from "../../gatherers/mcp";

/** How many identical tools/list calls the audit compares. */
const CALLS = 3;
/** How many `nextCursor` pages are followed per call. */
const MAX_PAGES = 4;
/** Valid `cacheScope` values. */
const SCOPES = ["public", "private"];

interface Page {
  tools: Record<string, unknown>[];
  ttlMs: unknown;
  cacheScope: unknown;
  resultType: unknown;
}

interface Call {
  pages: Page[];
  names: string[];
  /** Hash of the tools array exactly as it arrived, key order included. */
  raw: string;
  /** Hash of the same array with every object key sorted. */
  canonical: string;
}

/** FNV-1a, 32-bit. Enough to tell two serializations apart. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Re-serialize with every object key sorted, so only content differences show. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort())
    out[key] = canonicalize(value[key]);
  return out;
}

/** A caching hint, read from the result or from its `_meta` block. */
function hint(result: Record<string, unknown>, key: string): unknown {
  if (result[key] !== undefined) return result[key];
  const meta = result["_meta"];
  return isObject(meta) ? meta[key] : undefined;
}

/** One complete tools/list call, following `nextCursor`. */
async function listOnce(
  ctx: CheckContext,
  url: string,
  attempt: number,
): Promise<Call | undefined> {
  const pages: Page[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await postRpcRaw(
      ctx,
      url,
      `al-det-${attempt}-${page}`,
      "tools/list",
      { ...discoverParams(), ...(cursor ? { cursor } : {}) },
      { "MCP-Protocol-Version": MCP_PROTOCOL_VERSION },
    );
    if (!res || res.status !== 200) break;
    const parsed = parseRpcResponse(res);
    if (!parsed.ok) break;
    const list = parsed.value["tools"];
    if (!Array.isArray(list)) break;
    pages.push({
      tools: list.filter(isObject),
      ttlMs: hint(parsed.value, "ttlMs"),
      cacheScope: hint(parsed.value, "cacheScope"),
      resultType: hint(parsed.value, "resultType"),
    });
    const next = parsed.value["nextCursor"];
    if (typeof next !== "string" || !next) break;
    cursor = next;
  }

  if (pages.length === 0) return undefined;
  const tools = pages.flatMap((p) => p.tools);
  return {
    pages,
    names: tools.map((t) => (typeof t["name"] === "string" ? t["name"] : "")),
    raw: hash(JSON.stringify(tools)),
    canonical: hash(JSON.stringify(canonicalize(tools))),
  };
}

function sameSet(a: string[], b: string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((name) => right.has(name));
}

/** Names in one list and not the other, both directions. */
function setDiff(a: string[], b: string[]): string[] {
  const left = new Set(a);
  const right = new Set(b);
  return [
    ...[...left].filter((n) => !right.has(n)).map((n) => `+${n}`),
    ...[...right].filter((n) => !left.has(n)).map((n) => `-${n}`),
  ];
}

/** Recorded in the message wherever the timing deviation changes the verdict. */
const TIMING_NOTE =
  "the three calls are issued back to back rather than seconds apart on separate connections, so connection reuse is not controlled and this is reported as a review item rather than the per-connection MUST violation a timed probe would prove";

const EXPECTED =
  'Every complete tools/list result carries `ttlMs` above zero and a `cacheScope` of "public" or "private", and three identical calls return the same tools, in the same order, serialized the same way';

const SAMPLE = `{"jsonrpc":"2.0","id":2,"result":{
  "tools":[ /* stable order, stable key order, every call */ ],
  "resultType":"complete",
  "ttlMs": 300000,
  "cacheScope": "private"
}}

// ttlMs absent means "assume 0" to a client: every access becomes a round-trip.
// cacheScope "public" means the result may be shared across access tokens —
// only correct when the tool list does not depend on who is asking.
// Serialize tools deterministically: same order, same key order, no timestamps,
// no per-request ids inside inputSchema.`;

export class McpToolsListDeterminismAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/mcp-tools-list-determinism",
    category: "agent-interfaces",
    title: "tools/list Determinism and Cache-Hint Compliance",
    failureTitle: "tools/list Determinism and Cache-Hint Compliance",
    description:
      "Repeatedly fetches tools/list and asserts three things the spec ties directly to agent cost and latency: caching hints are present and well-formed (ttlMs >= 0, cacheScope in {public, private}), tool ordering is stable across calls, and the tool set does not vary per connection.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier:
      "docs/evidence/audits/agent-interfaces/mcp-tools-list-determinism.md",
    requires: ["origin-reachable"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "The spec states its own causal rationale verbatim: deterministic ordering 'enables clients to reliably cache the tool list and improves LLM prompt cache hit rates when tools are included in model context.' Tool definitions sit near the front of the model's prompt; if their serialized bytes change between turns, the provider-side prefix cache misses and the full tool block is re-billed at uncached rates on every single turn. Separately, servers MUST include caching hints on complete results, and when ttlMs is absent clients SHOULD assume 0 — immediately stale — so an omitted hint converts one cheap cached read into a network round-trip on every access. Both defects are invisible in functional testing and both are measurable with three identical requests.",
      fix: 'Return `ttlMs` and `cacheScope` on every complete tools/list result, on every page of a paginated one, with the same `cacheScope` across all pages of a request. Set `ttlMs` to a real refetch cadence — zero, or omitting it, tells clients the list is stale on arrival. Use `cacheScope: "private"` whenever the tool list depends on who is asking; `"public"` allows the result to be shared across access tokens. Then make the serialization deterministic: build the array in a fixed order rather than from a map or a database scan without ORDER BY, keep object key order stable, and keep timestamps, request ids and counters out of tool definitions.',
      code: SAMPLE,
      effort: "moderate",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-tools-list-determinism/",
      tags: [
        "mcp",
        "tools",
        "caching",
        "determinism",
        "prompt-cache",
        "agent-protocol",
      ],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const endpoint = discoverMcpEndpoint(ctx);
    if (!endpoint || !endpoint.url) {
      return this.notApplicable(
        "This site declares no MCP endpoint, so there is no tool list to fetch.",
        EXPECTED,
        endpoint
          ? `Malformed declaration (${endpoint.source})`
          : "No declared MCP endpoint",
      );
    }

    const url = endpoint.url;
    const calls: Call[] = [];
    for (let attempt = 0; attempt < CALLS; attempt += 1) {
      const call = await listOnce(ctx, url, attempt);
      if (!call) break;
      calls.push(call);
    }

    if (calls.length === 0 || calls[0]!.names.length === 0) {
      return this.notApplicable(
        `${url} returned no tool list, so there is nothing to compare. Whether the endpoint answers at all is scored by agent-interfaces/mcp-modern-era-reachability.`,
        EXPECTED,
        `${url}; ${calls.length} of ${CALLS} call(s) answered; 0 tools`,
      );
    }

    const first = calls[0]!;
    const musts: string[] = [];
    const shoulds: string[] = [];

    // Caching hints, per page of the first call.
    const complete = first.pages.filter((p) => p.resultType !== "partial");
    for (const [index, page] of complete.entries()) {
      const where = complete.length > 1 ? ` on page ${index + 1}` : "";
      const ttl = page.ttlMs;
      if (ttl === undefined || ttl === null) {
        musts.push(
          `no \`ttlMs\`${where}, and a client told nothing assumes 0 — every access becomes a round-trip`,
        );
      } else if (typeof ttl !== "number" || !Number.isInteger(ttl) || ttl < 0) {
        musts.push(
          `\`ttlMs\`${where} is ${JSON.stringify(ttl)} rather than a non-negative integer`,
        );
      } else if (ttl === 0) {
        musts.push(
          `\`ttlMs: 0\`${where} declares the list stale on arrival, so no client can cache it`,
        );
      }

      const scope = page.cacheScope;
      if (typeof scope !== "string" || !SCOPES.includes(scope)) {
        musts.push(
          `\`cacheScope\`${where} is ${JSON.stringify(scope ?? null)} rather than "public" or "private"`,
        );
      }
    }

    const scopes = new Set(complete.map((p) => String(p.cacheScope)));
    if (complete.length > 1 && scopes.size > 1) {
      musts.push(
        `\`cacheScope\` differs across the pages of one request (${[...scopes].join(", ")}), and the spec requires one value for the whole result`,
      );
    }

    // "public" on a server that challenges means one user's list can be served
    // to another. Legitimate for a truly public list, worth a look otherwise.
    if (complete.some((p) => p.cacheScope === "public")) {
      const discover = await discoverProbe(ctx, url);
      if (
        discover &&
        discover.status === 401 &&
        discover.headers["www-authenticate"]
      ) {
        shoulds.push(
          '`cacheScope: "public"` on an endpoint that also issues a 401 challenge — a public result may be shared across access tokens, so confirm the tool list really is the same for every caller',
        );
      }
    }

    // Determinism across the calls.
    for (const [index, call] of calls.slice(1).entries()) {
      const label = `call ${index + 2}`;
      if (!sameSet(first.names, call.names)) {
        shoulds.push(
          `${label} returned a different tool set (${setDiff(first.names, call.names).join(", ")}), and the spec says the list MUST NOT vary per connection — ${TIMING_NOTE}`,
        );
        continue;
      }
      if (first.names.join(" ") !== call.names.join(" ")) {
        shoulds.push(
          `${label} returned the same tools in a different order, which the spec says SHOULD be stable because it drives client caching and LLM prompt-cache hit rates`,
        );
        continue;
      }
      if (first.canonical !== call.canonical) {
        shoulds.push(
          `${label} returned the same tools in the same order with different definitions (content hash ${first.canonical} then ${call.canonical}), which breaks byte-level prompt caching on every turn`,
        );
        continue;
      }
      if (first.raw !== call.raw) {
        shoulds.push(
          `${label} serialized the same definitions with a different key order (${first.raw} then ${call.raw}), which breaks byte-level prompt caching even though the content is identical`,
        );
      }
    }

    const ttls = complete.map((p) =>
      typeof p.ttlMs === "number" ? `${p.ttlMs}` : "absent",
    );
    const found = [
      url,
      `${calls.length} of ${CALLS} call(s) answered`,
      `${first.names.length} tool(s) across ${first.pages.length} page(s)`,
      `ttlMs ${ttls.join("/")}`,
      `cacheScope ${[...scopes].join("/") || "absent"}`,
      `content hash ${first.canonical}`,
    ].join("; ");

    if (musts.length > 0) {
      return this.fail(
        `${musts.join("; ")}.${shoulds.length > 0 ? ` Also: ${shoulds.join("; ")}.` : ""}`,
        EXPECTED,
        found,
        "high",
      );
    }
    if (shoulds.length > 0) {
      return this.warn(`${shoulds.join("; ")}.`, EXPECTED, found, "medium");
    }
    return this.pass(
      `${CALLS} identical tools/list calls returned the same ${first.names.length} tool(s), in the same order, byte-identical, with ttlMs ${ttls[0]} and cacheScope ${[...scopes][0]}.`,
      EXPECTED,
      found,
    );
  }
}
