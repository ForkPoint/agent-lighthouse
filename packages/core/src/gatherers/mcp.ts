import { cacheOwner } from "./cache-owner";
import type { CheckContext } from "#core/check-context";
import type { FetchResult } from "#core/fetcher";
import { isSafeUrl } from "#core/fetcher";
import { HttpMethod } from "#core/types";
import { LogField, withLogContext } from "#core/logger";
import { isRootArtifact } from "./root-files";
import { readAiCatalogs } from "#core/audits/agent-interfaces/_ard";

/**
 * MCP's current specification revision. Pinning an older one makes servers that
 * reject unsupported versions answer with a JSON-RPC error, which reads as a
 * broken server when it is a stale client.
 */
export const MCP_PROTOCOL_VERSION = "2026-07-28";

/**
 * Streamable HTTP requires both media types. The official TypeScript SDK
 * transport answers 406 Not Acceptable when either is missing.
 */
export const MCP_ACCEPT = "application/json, text/event-stream";

export function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

export function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * Either a usable endpoint, or the reason the site's own declaration is
 * malformed — both come out of the same pass over the declared sources. A
 * malformed declaration is not the same as no declaration: the site said it has
 * a server and got the shape wrong, and an audit must be able to say so.
 *
 * `cardUrl` is set when the endpoint came through an ai-catalog Server Card.
 */
export type McpEndpoint =
  | {
      url: string;
      source: "servers.json" | "ucp" | "ai-catalog";
      cardUrl?: string;
    }
  | { url: ""; source: "no-array" | "no-url" }
  | {
      url: "";
      source: "card-unreadable" | "card-no-remote";
      cardUrl: string;
      found: string;
    };

/**
 * Where the site says its MCP server is. Every path here is an *explicit*
 * declaration; see the mcp-endpoint dossier for why `/mcp` is not probed
 * speculatively.
 */
export async function discoverMcpEndpoint(
  ctx: CheckContext,
): Promise<McpEndpoint | undefined> {
  const servers = ctx.rootFiles["/.well-known/mcp/servers.json"];
  if (isRootArtifact(servers) && servers.body) {
    const parsed = tryParseJson(servers.body);
    if (!isObject(parsed) || !Array.isArray(parsed["servers"]))
      return { url: "", source: "no-array" };
    const entry = (parsed["servers"] as unknown[]).find(
      (s) => isObject(s) && typeof s["url"] === "string" && s["url"],
    );
    if (!entry) return { url: "", source: "no-url" };
    return {
      url: (entry as Record<string, unknown>)["url"] as string,
      source: "servers.json",
    };
  }

  const ucp = ctx.rootFiles["/.well-known/ucp"];
  if (isRootArtifact(ucp) && ucp.body) {
    const parsed = tryParseJson(ucp.body);
    if (isObject(parsed)) {
      const root = (parsed["ucp"] ?? parsed) as Record<string, unknown>;
      const services = (parsed["services"] ?? root["services"]) as
        Record<string, unknown> | undefined;
      if (isObject(services)) {
        for (const list of Object.values(services)) {
          if (!Array.isArray(list)) continue;
          for (const svc of list) {
            if (
              isObject(svc) &&
              svc["transport"] === "mcp" &&
              typeof svc["endpoint"] === "string"
            ) {
              return { url: svc["endpoint"], source: "ucp" };
            }
          }
        }
      }
    }
  }

  // The ARD reader owns both catalog paths (ard.json first, then
  // ai-catalog.json) and the manifest shape; discovery only picks the entry.
  // Both catalogs are searched: a site may list its Server Card in
  // ai-catalog.json (the path SEP-2127 names) and other artifacts in ard.json.
  for (const manifest of readAiCatalogs(ctx)) {
    const card = manifest.entries.find(
      (entry) => entry.type?.includes("mcp-server-card") && entry.url,
    );
    if (!card?.url) continue;
    // Entry urls SHOULD be absolute; a relative one resolves against the
    // catalog that carries it, as ai-catalog-urls resolves it.
    let cardUrl: string;
    try {
      cardUrl = new URL(card.url, new URL(manifest.path, ctx.baseUrl)).href;
    } catch {
      return {
        url: "",
        source: "card-unreadable",
        cardUrl: card.url,
        found: `${card.url} -> not a valid URL`,
      };
    }
    return resolveServerCard(ctx, cardUrl);
  }

  return undefined;
}

/**
 * Follow an ARD catalog MCP entry to the endpoint it names.
 *
 * In SEP-2127 discovery, an `application/mcp-server-card+json` entry's `url`
 * addresses the Server Card, not the server. The endpoint sits inside the card
 * at `remotes[].url`. Posting `initialize` to the card URL failed every site
 * that published a correct catalog.
 *
 * Absent, broken and readable are three findings, and the line sits here,
 * beside the read, so no caller has to guess:
 *
 * - no catalog entry — no declaration; the caller sees `undefined`;
 * - `card-unreadable` — the catalog names a card that is refused, unreachable,
 *   not HTTP 200, or not a JSON object. The site declared a server and the
 *   declaration is broken;
 * - `card-no-remote` — the card reads, but no `remotes[]` entry carries a
 *   `url`. Also broken: the card names no endpoint to connect to.
 *
 * A `streamable-http` remote wins over an earlier remote of another type,
 * because Streamable HTTP is the transport the current revision defines.
 */
async function resolveServerCard(
  ctx: CheckContext,
  cardUrl: string,
): Promise<McpEndpoint> {
  const unreadable = (found: string): McpEndpoint => ({
    url: "",
    source: "card-unreadable",
    cardUrl,
    found,
  });
  // The card URL comes out of a site-controlled file. mcpFetch also gates it,
  // but checking here keeps "refused" apart from "unreachable".
  if (!(await isSafeUrl(cardUrl))) return unreadable(`${cardUrl} -> refused`);
  const card = await sharedProbe(ctx, `card|${cardUrl}`, () =>
    mcpFetch(ctx, cardUrl, { method: HttpMethod.Get }),
  );
  if (!card) return unreadable(`${cardUrl} -> unreachable`);
  if (card.status !== 200)
    return unreadable(`${cardUrl} -> HTTP ${card.status}`);
  const parsed = tryParseJson(card.body);
  if (!isObject(parsed)) return unreadable(`${cardUrl} -> not a JSON object`);

  const remotes = Array.isArray(parsed["remotes"])
    ? (parsed["remotes"] as unknown[]).filter(
        (r): r is Record<string, unknown> =>
          isObject(r) && typeof r["url"] === "string" && r["url"] !== "",
      )
    : [];
  const remote =
    remotes.find((r) => r["type"] === "streamable-http") ?? remotes[0];
  if (!remote) {
    return {
      url: "",
      source: "card-no-remote",
      cardUrl,
      found: `${cardUrl} -> no remotes[].url`,
    };
  }
  // A relative remote url names an endpoint on the card's own host.
  let url: string;
  try {
    url = new URL(remote["url"] as string, cardUrl).href;
  } catch {
    return unreadable(`${cardUrl} -> remotes[].url is not a valid URL`);
  }
  return { url, source: "ai-catalog", cardUrl };
}

/** Frame a JSON-RPC 2.0 request. `params` is omitted entirely when absent. */
export function rpcRequest(
  id: number | string,
  method: string,
  params?: unknown,
): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    ...(params ? { params } : {}),
  });
}

export type RpcOutcome =
  | { ok: true; value: Record<string, unknown> }
  | {
      ok: false;
      error?: { code: number; message: string; data?: unknown };
      reason: string;
    };

/**
 * Pull the JSON-RPC payload out of a response body.
 */
function rpcPayload(body: string): unknown {
  const direct = tryParseJson(body);
  if (direct !== undefined) return direct;

  const frames = [...body.matchAll(/^data:\s*(.*)$/gm)]
    .map((m) => tryParseJson(m[1]!.trim()))
    .filter((v) => v !== undefined);
  if (frames.length === 0) return undefined;
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const frame = frames[i];
    if (isObject(frame) && ("result" in frame || "error" in frame))
      return frame;
  }
  return frames[frames.length - 1];
}

/** Read a JSON-RPC 2.0 response out of a fetch result, JSON or SSE. */
export function parseRpcResponse(result: FetchResult): RpcOutcome {
  if (!result.body || !result.body.trim()) {
    return { ok: false, reason: "empty response body" };
  }
  const parsed = rpcPayload(result.body);
  if (!isObject(parsed) || parsed["jsonrpc"] !== "2.0") {
    return { ok: false, reason: "response is not valid JSON-RPC" };
  }
  const error = parsed["error"];
  if (isObject(error)) {
    const code = typeof error["code"] === "number" ? error["code"] : 0;
    const message =
      typeof error["message"] === "string" ? error["message"] : "unknown error";
    return {
      ok: false,
      error: {
        code,
        message,
        ...(error["data"] !== undefined ? { data: error["data"] } : {}),
      },
      reason: `JSON-RPC error ${code}: ${message}`,
    };
  }
  if ("error" in parsed) {
    return { ok: false, reason: "response is not valid JSON-RPC" };
  }
  const value = parsed["result"];
  if (!isObject(value)) {
    return { ok: false, reason: "response carries no result object" };
  }
  return { ok: true, value };
}

/**
 * POST one JSON-RPC call to a declared MCP endpoint.
 */
export async function postRpc(
  ctx: CheckContext,
  url: string,
  id: number | string,
  method: string,
  params?: unknown,
  headers?: Record<string, string>,
): Promise<RpcOutcome> {
  if (!(await isSafeUrl(url))) {
    return {
      ok: false,
      reason: `${url} refused (non-HTTP scheme or private address)`,
    };
  }
  let response: FetchResult;
  try {
    response = await ctx.fetch({
      url,
      method: HttpMethod.Post,
      acceptHeader: MCP_ACCEPT,
      contentType: "application/json",
      body: rpcRequest(id, method, params),
      ...(headers ? { headers } : {}),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (response.status !== 200) {
    return { ok: false, reason: `HTTP ${response.status}` };
  }
  return parseRpcResponse(response);
}

/**
 * One request to a declared MCP endpoint, returning the whole response.
 */
export async function mcpFetch(
  ctx: CheckContext,
  url: string,
  init: {
    method?: HttpMethod;
    body?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  } = {},
): Promise<FetchResult | undefined> {
  if (!(await isSafeUrl(url))) return undefined;
  try {
    return await ctx.fetch({
      url,
      method: init.method ?? HttpMethod.Post,
      acceptHeader: MCP_ACCEPT,
      ...(init.method === undefined || init.method === HttpMethod.Post
        ? { contentType: "application/json" }
        : {}),
      ...(init.body !== undefined ? { body: init.body } : {}),
      ...(init.headers ? { headers: init.headers } : {}),
      ...(init.signal ? { signal: init.signal } : {}),
    });
  } catch {
    return undefined;
  }
}

/** Frame and POST one JSON-RPC call, returning the whole response. */
export function postRpcRaw(
  ctx: CheckContext,
  url: string,
  id: number | string,
  method: string,
  params?: unknown,
  headers?: Record<string, string>,
): Promise<FetchResult | undefined> {
  return mcpFetch(ctx, url, {
    method: HttpMethod.Post,
    body: rpcRequest(id, method, params),
    ...(headers ? { headers } : {}),
  });
}

const probeCache = new WeakMap<
  object,
  Map<string, Promise<FetchResult | undefined>>
>();

export function sharedProbe(
  ctx: CheckContext,
  key: string,
  run: () => Promise<FetchResult | undefined>,
): Promise<FetchResult | undefined> {
  let byKey = probeCache.get(cacheOwner(ctx));
  if (!byKey) {
    byKey = new Map();
    probeCache.set(cacheOwner(ctx), byKey);
  }
  const hit = byKey.get(key);
  if (hit) return hit;
  const pending = withLogContext({ [LogField.Gatherer]: "mcp" }, run);
  byKey.set(key, pending);
  return pending;
}

export function discoverProbe(
  ctx: CheckContext,
  url: string,
): Promise<FetchResult | undefined> {
  return sharedProbe(ctx, `discover|${url}`, () =>
    postRpcRaw(ctx, url, "al-1", "server/discover", discoverParams(), {
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    }),
  );
}

export function discoverParams(
  version: string = MCP_PROTOCOL_VERSION,
): Record<string, unknown> {
  return {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": version,
      "io.modelcontextprotocol/clientInfo": {
        name: "AgentLighthouse",
        version: "1.0.0",
      },
      "io.modelcontextprotocol/clientCapabilities": {},
    },
  };
}

export interface ToolListing {
  tools: Record<string, unknown>[];
  truncated: boolean;
  pages: number;
}

export async function listTools(
  ctx: CheckContext,
  url: string,
  maxPages: number,
): Promise<ToolListing> {
  const tools: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  let pages = 0;

  for (; pages < maxPages; pages += 1) {
    const key = `tools|${url}|${cursor ?? ""}`;
    const page = await sharedProbe(ctx, key, () =>
      postRpcRaw(
        ctx,
        url,
        `al-tools-${pages}`,
        "tools/list",
        { ...discoverParams(), ...(cursor ? { cursor } : {}) },
        { "MCP-Protocol-Version": MCP_PROTOCOL_VERSION },
      ),
    );
    if (!page || page.status !== 200) break;
    const parsed = parseRpcResponse(page);
    if (!parsed.ok) break;
    const list = parsed.value["tools"];
    if (!Array.isArray(list)) break;
    for (const tool of list) if (isObject(tool)) tools.push(tool);
    const next = parsed.value["nextCursor"];
    if (typeof next !== "string" || !next) {
      cursor = undefined;
      break;
    }
    cursor = next;
  }

  return { tools, truncated: cursor !== undefined, pages };
}
