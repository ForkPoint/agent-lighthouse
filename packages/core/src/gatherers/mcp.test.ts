import { describe, it, expect, vi } from "vitest";
import {
  discoverMcpEndpoint,
  rpcRequest,
  parseRpcResponse,
  postRpc,
  mcpFetch,
  discoverProbe,
  listTools,
  MCP_PROTOCOL_VERSION,
  MCP_ACCEPT,
} from "./mcp";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import type { CheckContext } from "#core/check-context";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import { HttpMethod } from "#core/types";

// isSafeUrl performs a real DNS lookup before the client POSTs to a URL it read
// out of a site-controlled root file. Stub it with an offline stand-in that
// still blocks loopback and private ranges, so the refusal test proves the gate
// rather than the mock.
vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== "http:" && protocol !== "https:") return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

function ctxWith(rootFiles: Record<string, string>): CheckContext {
  const files: Record<string, FetchResult> = {};
  for (const [path, body] of Object.entries(rootFiles)) {
    files[path] = mockFetchResult(body, 200, "application/json");
  }
  return mockCheckContext([], files);
}

const SERVERS_JSON = JSON.stringify({
  servers: [{ url: "https://a.test/mcp" }],
});
// Google's Merchant UCP profile shape: services inside a `ucp` object.
const UCP = JSON.stringify({
  ucp: {
    version: "2026-04-08",
    services: {
      commerce: [{ transport: "mcp", endpoint: "https://a.test/ucp-mcp" }],
    },
  },
});
const CARD_URL = "https://example.com/card.json";
const CATALOG = JSON.stringify({
  entries: [{ type: "application/mcp-server-card+json", url: CARD_URL }],
});
const CARD = JSON.stringify({
  name: "io.example/server",
  remotes: [{ type: "streamable-http", url: "https://a.test/mcp" }],
});

describe("discoverMcpEndpoint", () => {
  // A homepage redirect answers each well-known path with HTML. None of them
  // declares anything, so discovery moves on to the next source.
  it("skips an HTML page at servers.json and reads the UCP service", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({
        "/.well-known/mcp/servers.json":
          '<!DOCTYPE html>\n<html lang="fr"><head><title>Home</title></head><body>Shop</body></html>',
        "/.well-known/ucp": UCP,
      }),
    );
    expect(found).toEqual({ url: "https://a.test/ucp-mcp", source: "ucp" });
  });

  it("skips HTML pages at servers.json and ucp and reads the ai-catalog", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({
        "/.well-known/mcp/servers.json":
          '<!DOCTYPE html>\n<html lang="fr"><head><title>Home</title></head><body>Shop</body></html>',
        "/.well-known/ucp":
          '<!DOCTYPE html>\n<html lang="fr"><head><title>Home</title></head><body>Shop</body></html>',
        "/.well-known/ai-catalog.json": CATALOG,
        "/card.json": CARD,
      }),
    );
    expect(found?.source).toBe("ai-catalog");
  });

  it("finds nothing when every source is an HTML page", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({
        "/.well-known/mcp/servers.json":
          '<!DOCTYPE html>\n<html lang="fr"><head><title>Home</title></head><body>Shop</body></html>',
        "/.well-known/ucp":
          '<!DOCTYPE html>\n<html lang="fr"><head><title>Home</title></head><body>Shop</body></html>',
        "/.well-known/ai-catalog.json":
          '<!DOCTYPE html>\n<html lang="fr"><head><title>Home</title></head><body>Shop</body></html>',
      }),
    );
    expect(found).toBeUndefined();
  });

  it("reads the endpoint out of /.well-known/mcp/servers.json", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({ "/.well-known/mcp/servers.json": SERVERS_JSON }),
    );
    expect(found).toEqual({
      url: "https://a.test/mcp",
      source: "servers.json",
    });
  });

  it("reads an mcp-transport service out of /.well-known/ucp", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({ "/.well-known/ucp": UCP }),
    );
    expect(found).toEqual({ url: "https://a.test/ucp-mcp", source: "ucp" });
  });

  // UCP 2026-01-11 nests one object per transport under each service.
  it("reads the mcp endpoint of a 2026-01-11 UCP profile", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({
        "/.well-known/ucp": JSON.stringify({
          ucp: {
            version: "2026-01-11",
            services: {
              "dev.ucp.shopping": {
                version: "2026-01-11",
                rest: { endpoint: "https://a.test/ucp/v1" },
                mcp: { endpoint: "https://a.test/ucp/mcp" },
              },
            },
          },
        }),
      }),
    );
    expect(found).toEqual({ url: "https://a.test/ucp/mcp", source: "ucp" });
  });

  it("resolves a relative UCP mcp endpoint against the profile URL", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({
        "/.well-known/ucp": JSON.stringify({
          ucp: {
            services: {
              commerce: [{ transport: "mcp", endpoint: "/ucp/mcp" }],
            },
          },
        }),
      }),
    );
    expect(found).toEqual({
      url: "https://example.com/ucp/mcp",
      source: "ucp",
    });
  });

  it("ignores JSON at /.well-known/ucp that has no ucp key", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({
        "/.well-known/ucp": JSON.stringify({
          services: {
            commerce: [{ transport: "mcp", endpoint: "https://a.test/x" }],
          },
        }),
      }),
    );
    expect(found).toBeUndefined();
  });

  // SEP-2127: a catalog entry's `url` addresses the Server Card. The endpoint
  // is inside the card, at `remotes[].url`.
  it("resolves an ai-catalog entry through its Server Card to remotes[].url", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({ "/.well-known/ai-catalog.json": CATALOG, "/card.json": CARD }),
    );
    expect(found).toEqual({
      url: "https://a.test/mcp",
      source: "ai-catalog",
      cardUrl: CARD_URL,
    });
  });

  // ARD v0.91 moved the catalog to ard.json; the same Server Card entry there
  // declares the same server.
  it("finds the Server Card through /.well-known/ard.json too", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({ "/.well-known/ard.json": CATALOG, "/card.json": CARD }),
    );
    expect(found).toEqual({
      url: "https://a.test/mcp",
      source: "ai-catalog",
      cardUrl: CARD_URL,
    });
  });

  // An ARD catalog lists other artifacts too. A card listed only in the
  // second catalog still declares the server.
  it("finds a Server Card in ai-catalog.json when ard.json lists no card", async () => {
    const otherCatalog = JSON.stringify({
      entries: [
        {
          type: "application/openapi+json",
          url: "https://example.com/api.json",
        },
      ],
    });
    const found = await discoverMcpEndpoint(
      ctxWith({
        "/.well-known/ard.json": otherCatalog,
        "/.well-known/ai-catalog.json": CATALOG,
        "/card.json": CARD,
      }),
    );
    expect(found).toEqual({
      url: "https://a.test/mcp",
      source: "ai-catalog",
      cardUrl: CARD_URL,
    });
  });

  // Entry and remote urls SHOULD be absolute; a relative one still names a
  // reachable resource, resolved against the file that carries it.
  it("resolves a relative card url against the catalog and a relative remote against the card", async () => {
    const catalog = JSON.stringify({
      entries: [
        { type: "application/mcp-server-card+json", url: "/card.json" },
      ],
    });
    const card = JSON.stringify({
      remotes: [{ type: "streamable-http", url: "/mcp" }],
    });
    const found = await discoverMcpEndpoint(
      ctxWith({ "/.well-known/ai-catalog.json": catalog, "/card.json": card }),
    );
    expect(found).toEqual({
      url: "https://example.com/mcp",
      source: "ai-catalog",
      cardUrl: "https://example.com/card.json",
    });
  });

  it("prefers a streamable-http remote over an earlier one of another type", async () => {
    const card = JSON.stringify({
      remotes: [
        { type: "sse", url: "https://a.test/sse" },
        { type: "streamable-http", url: "https://a.test/mcp" },
      ],
    });
    const found = await discoverMcpEndpoint(
      ctxWith({ "/.well-known/ai-catalog.json": CATALOG, "/card.json": card }),
    );
    expect(found?.url).toBe("https://a.test/mcp");
  });

  // Absent, unreadable and remote-less are three different findings: the
  // catalog declared a card, so a card that is not there is a broken
  // declaration, not an absent one.
  it("reports a Server Card that cannot be read", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({ "/.well-known/ai-catalog.json": CATALOG }),
    );
    expect(found).toMatchObject({
      url: "",
      source: "card-unreadable",
      cardUrl: CARD_URL,
    });
  });

  it("reports a Server Card that is not JSON", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({
        "/.well-known/ai-catalog.json": CATALOG,
        "/card.json": "<!doctype html><p>Home</p>",
      }),
    );
    expect(found).toMatchObject({ url: "", source: "card-unreadable" });
  });

  it("reports a Server Card with no remotes[].url", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({
        "/.well-known/ai-catalog.json": CATALOG,
        "/card.json": JSON.stringify({ name: "x", remotes: [{ type: "sse" }] }),
      }),
    );
    expect(found).toMatchObject({
      url: "",
      source: "card-no-remote",
      cardUrl: CARD_URL,
    });
  });

  it("reports a Server Card whose remotes is not an array as having no remote", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({
        "/.well-known/ai-catalog.json": CATALOG,
        "/card.json": JSON.stringify({
          remotes: { type: "streamable-http", url: "https://a.test/mcp" },
        }),
      }),
    );
    expect(found).toEqual({
      url: "",
      source: "card-no-remote",
      cardUrl: CARD_URL,
      found: `${CARD_URL} -> no remotes[].url`,
    });
  });

  it("reports a Server Card whose fetch dies as unreachable", async () => {
    const ctx = ctxWith({ "/.well-known/ai-catalog.json": CATALOG });
    ctx.fetch = async () => {
      throw new Error("socket hang up");
    };
    const found = await discoverMcpEndpoint(ctx);
    expect(found).toEqual({
      url: "",
      source: "card-unreadable",
      cardUrl: CARD_URL,
      found: `${CARD_URL} -> unreachable`,
    });
  });

  // A UCP profile that binds no service to MCP declares no MCP server, so the
  // catalogs are still consulted.
  it("falls through to the catalog when the UCP profile has no mcp binding", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({
        "/.well-known/ucp": JSON.stringify({
          ucp: {
            version: "2026-04-08",
            services: {
              commerce: [
                { transport: "rest", endpoint: "https://a.test/rest" },
              ],
            },
          },
        }),
        "/.well-known/ai-catalog.json": CATALOG,
        "/card.json": CARD,
      }),
    );
    expect(found).toEqual({
      url: "https://a.test/mcp",
      source: "ai-catalog",
      cardUrl: CARD_URL,
    });
  });

  it("refuses to fetch a Server Card on a private address", async () => {
    const catalog = JSON.stringify({
      entries: [
        {
          type: "application/mcp-server-card+json",
          url: "http://127.0.0.1/card.json",
        },
      ],
    });
    const ctx = ctxWith({ "/.well-known/ai-catalog.json": catalog });
    let fetched = false;
    ctx.fetch = async () => {
      fetched = true;
      return mockFetchResult("", 404);
    };
    const found = await discoverMcpEndpoint(ctx);
    expect(fetched).toBe(false);
    expect(found).toMatchObject({ url: "", source: "card-unreadable" });
  });

  it("reads the Server Card once per scan", async () => {
    const ctx = ctxWith({
      "/.well-known/ai-catalog.json": CATALOG,
      "/card.json": CARD,
    });
    const inner = ctx.fetch;
    let calls = 0;
    ctx.fetch = async (options) => {
      calls += 1;
      return inner(options);
    };
    await discoverMcpEndpoint(ctx);
    await discoverMcpEndpoint(ctx);
    expect(calls).toBe(1);
  });

  // servers.json is the MCP-native declaration, so it decides even when the
  // other two files also name an endpoint.
  it("prefers servers.json, then ucp, then the catalog", async () => {
    const all = ctxWith({
      "/.well-known/mcp/servers.json": SERVERS_JSON,
      "/.well-known/ucp": UCP,
      "/.well-known/ai-catalog.json": CATALOG,
    });
    expect((await discoverMcpEndpoint(all))?.source).toBe("servers.json");
    const twoLeft = ctxWith({
      "/.well-known/ucp": UCP,
      "/.well-known/ai-catalog.json": CATALOG,
      "/card.json": CARD,
    });
    expect((await discoverMcpEndpoint(twoLeft))?.source).toBe("ucp");
  });

  it("returns undefined when no root file declares one", async () => {
    expect(await discoverMcpEndpoint(ctxWith({}))).toBeUndefined();
  });

  // A malformed declaration is not the same as no declaration: the site said it
  // has a server and got the shape wrong, which an audit must report.
  it("reports a servers.json with no servers array", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({ "/.well-known/mcp/servers.json": JSON.stringify({ mcp: [] }) }),
    );
    expect(found).toEqual({ url: "", source: "no-array" });
  });

  it("reports a servers array with no usable url", async () => {
    const found = await discoverMcpEndpoint(
      ctxWith({
        "/.well-known/mcp/servers.json": JSON.stringify({
          servers: [{ name: "x" }],
        }),
      }),
    );
    expect(found).toEqual({ url: "", source: "no-url" });
  });
});

describe("rpcRequest", () => {
  it("frames a JSON-RPC 2.0 request with params", () => {
    expect(
      JSON.parse(
        rpcRequest(1, "initialize", { protocolVersion: MCP_PROTOCOL_VERSION }),
      ),
    ).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: MCP_PROTOCOL_VERSION },
    });
  });

  it("omits params entirely when there are none", () => {
    expect(rpcRequest(2, "tools/list")).toBe(
      '{"jsonrpc":"2.0","id":2,"method":"tools/list"}',
    );
  });

  it("pins the current MCP specification revision", () => {
    expect(MCP_PROTOCOL_VERSION).toBe("2026-07-28");
  });
});

describe("parseRpcResponse", () => {
  const json = (body: string) => mockFetchResult(body, 200, "application/json");

  it("returns the result object of a successful response", () => {
    const out = parseRpcResponse(
      json('{"jsonrpc":"2.0","id":1,"result":{"tools":[]}}'),
    );
    expect(out).toEqual({ ok: true, value: { tools: [] } });
  });

  it("returns the JSON-RPC error object when the server reports one", () => {
    const out = parseRpcResponse(
      json(
        '{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"Method not found"}}',
      ),
    );
    expect(out).toEqual({
      ok: false,
      error: { code: -32601, message: "Method not found" },
      reason: "JSON-RPC error -32601: Method not found",
    });
  });

  // Streamable HTTP may answer with an SSE stream. The final data frame carries
  // the response; earlier frames are progress notifications.
  it("reads the last data frame of an SSE stream", () => {
    const sse = mockFetchResult(
      'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\n' +
        'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2026-07-28"}}\n\n',
      200,
      "text/event-stream",
    );
    expect(parseRpcResponse(sse)).toEqual({
      ok: true,
      value: { protocolVersion: "2026-07-28" },
    });
  });

  it("rejects a body that is not JSON", () => {
    const out = parseRpcResponse(
      mockFetchResult("<html>nope</html>", 200, "text/html"),
    );
    expect(out).toMatchObject({ ok: false });
    expect((out as { reason: string }).reason).toContain("not valid JSON-RPC");
  });

  it("rejects an empty body", () => {
    const out = parseRpcResponse(json(""));
    expect(out).toMatchObject({ ok: false, reason: "empty response body" });
  });

  it("rejects a JSON object that is not JSON-RPC 2.0", () => {
    const out = parseRpcResponse(json('{"result":{"tools":[]}}'));
    expect(out).toMatchObject({ ok: false });
  });

  // An SSE stream that carries only notifications has no response frame. The
  // last frame is read, and its missing result is reported as such.
  it("falls back to the last SSE frame when no frame carries a result or error", () => {
    const sse = mockFetchResult(
      'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\n',
      200,
      "text/event-stream",
    );
    expect(parseRpcResponse(sse)).toEqual({
      ok: false,
      reason: "response carries no result object",
    });
  });

  it("defaults a JSON-RPC error with no numeric code or string message", () => {
    const out = parseRpcResponse(
      json('{"jsonrpc":"2.0","id":1,"error":{"code":"x","data":{"hint":1}}}'),
    );
    expect(out).toEqual({
      ok: false,
      error: { code: 0, message: "unknown error", data: { hint: 1 } },
      reason: "JSON-RPC error 0: unknown error",
    });
  });

  it("rejects an error member that is not an object", () => {
    const out = parseRpcResponse(
      json('{"jsonrpc":"2.0","id":1,"error":"boom","result":{}}'),
    );
    expect(out).toEqual({
      ok: false,
      reason: "response is not valid JSON-RPC",
    });
  });

  it("rejects a response whose result is not an object", () => {
    const out = parseRpcResponse(
      json('{"jsonrpc":"2.0","id":1,"result":"ok"}'),
    );
    expect(out).toMatchObject({ ok: false });
  });
});

describe("postRpc", () => {
  function recorder(answer: FetchResult) {
    const seen: FetchOptions[] = [];
    const ctx = mockCheckContext([]);
    ctx.fetch = async (o: FetchOptions) => {
      seen.push(o);
      return answer;
    };
    return { seen, ctx };
  }

  it("POSTs the framed request with both Streamable HTTP Accept types", async () => {
    const r = recorder(
      mockFetchResult(
        '{"jsonrpc":"2.0","id":1,"result":{}}',
        200,
        "application/json",
      ),
    );
    const out = await postRpc(r.ctx, "https://a.test/mcp", 1, "initialize", {
      capabilities: {},
    });
    expect(out).toEqual({ ok: true, value: {} });
    expect(r.seen[0]).toMatchObject({
      url: "https://a.test/mcp",
      method: "POST",
      acceptHeader: MCP_ACCEPT,
      contentType: "application/json",
    });
    expect(JSON.parse(r.seen[0]!.body!)).toMatchObject({
      method: "initialize",
    });
  });

  it("forwards extra request headers", async () => {
    const r = recorder(
      mockFetchResult('{"jsonrpc":"2.0","id":1,"result":{}}', 200),
    );
    await postRpc(r.ctx, "https://a.test/mcp", 1, "tools/list", undefined, {
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    });
    expect(r.seen[0]!.headers).toEqual({
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    });
  });

  it("refuses a loopback URL without fetching it", async () => {
    const r = recorder(mockFetchResult("{}", 200));
    const out = await postRpc(r.ctx, "http://127.0.0.1/mcp", 1, "initialize");
    expect(out).toMatchObject({
      ok: false,
      reason: expect.stringContaining("refused"),
    });
    expect(r.seen).toEqual([]);
  });

  it("reports a non-200 status rather than parsing the body", async () => {
    const r = recorder(mockFetchResult("nope", 503, "text/html"));
    const out = await postRpc(r.ctx, "https://a.test/mcp", 1, "initialize");
    expect(out).toMatchObject({ ok: false, reason: "HTTP 503" });
  });

  it("reports an unreachable endpoint rather than throwing", async () => {
    const ctx = mockCheckContext([]);
    ctx.fetch = async () => {
      throw new Error("socket hang up");
    };
    const out = await postRpc(ctx, "https://a.test/mcp", 1, "initialize");
    expect(out).toMatchObject({ ok: false, reason: "unreachable" });
  });
});

describe("mcpFetch and the shared probe cache", () => {
  function recorder2(...responses: FetchResult[]) {
    const seen: FetchOptions[] = [];
    const ctx = mockCheckContext([]);
    let i = 0;
    ctx.fetch = async (o: FetchOptions) => {
      seen.push(o);
      const r = responses[Math.min(i, responses.length - 1)]!;
      i += 1;
      return r;
    };
    return { ctx, seen };
  }

  it("returns the whole response, including a non-200 status and its headers", async () => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32022, message: "old" },
    });
    const res = mockFetchResult(body, 400, "application/json");
    res.headers["www-authenticate"] = "Bearer";
    const r = recorder2(res);
    const out = await mcpFetch(r.ctx, "https://a.test/mcp", {
      method: HttpMethod.Post,
      body: "{}",
    });
    expect(out?.status).toBe(400);
    expect(out?.headers["www-authenticate"]).toBe("Bearer");
  });

  it("sends a GET with no JSON content type", async () => {
    const r = recorder2(mockFetchResult("", 405));
    await mcpFetch(r.ctx, "https://a.test/mcp", { method: HttpMethod.Get });
    expect(r.seen[0]).toMatchObject({
      method: "GET",
      acceptHeader: MCP_ACCEPT,
    });
    expect(r.seen[0]!.contentType).toBeUndefined();
  });

  it("passes an abort signal through to the fetch", async () => {
    const r = recorder2(mockFetchResult("", 405));
    const controller = new AbortController();
    await mcpFetch(r.ctx, "https://a.test/mcp", { signal: controller.signal });
    expect(r.seen[0]!.signal).toBe(controller.signal);
    expect(r.seen[0]!.contentType).toBe("application/json");
  });

  it("refuses a private-range URL without fetching it", async () => {
    const r = recorder2(mockFetchResult("{}", 200));
    expect(await mcpFetch(r.ctx, "http://10.0.0.1/mcp")).toBeUndefined();
    expect(r.seen).toEqual([]);
  });

  it("returns undefined rather than throwing when the socket dies", async () => {
    const ctx = mockCheckContext([]);
    ctx.fetch = async () => {
      throw new Error("socket hang up");
    };
    expect(await mcpFetch(ctx, "https://a.test/mcp")).toBeUndefined();
  });

  it("issues one discover probe per endpoint per scan", async () => {
    const r = recorder2(
      mockFetchResult('{"jsonrpc":"2.0","id":1,"result":{}}', 200),
    );
    await discoverProbe(r.ctx, "https://a.test/mcp");
    await discoverProbe(r.ctx, "https://a.test/mcp");
    expect(r.seen).toHaveLength(1);
    expect(r.seen[0]!.headers).toMatchObject({
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    });
    expect(JSON.parse(r.seen[0]!.body!)).toMatchObject({
      method: "server/discover",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
        },
      },
    });
  });

  it("keeps two scans apart", async () => {
    const a = recorder2(mockFetchResult("{}", 200));
    const b = recorder2(mockFetchResult("{}", 200));
    await discoverProbe(a.ctx, "https://a.test/mcp");
    await discoverProbe(b.ctx, "https://a.test/mcp");
    expect(a.seen).toHaveLength(1);
    expect(b.seen).toHaveLength(1);
  });
});

describe("listTools", () => {
  const ENDPOINT = "https://a.test/mcp";

  function page(result: unknown, status = 200): FetchResult {
    return mockFetchResult(
      JSON.stringify({ jsonrpc: "2.0", id: 1, result }),
      status,
      "application/json",
    );
  }

  /** Answer each tools/list call by the cursor it carries. */
  function byCursor(pages: Record<string, FetchResult>) {
    const seen: FetchOptions[] = [];
    const ctx = mockCheckContext([]);
    ctx.fetch = async (o: FetchOptions) => {
      seen.push(o);
      const body = JSON.parse(o.body!) as { params: { cursor?: string } };
      return pages[body.params.cursor ?? ""]!;
    };
    return { ctx, seen };
  }

  it("follows nextCursor across pages and keeps only object tools", async () => {
    const r = byCursor({
      "": page({ tools: [{ name: "a" }, "junk", null], nextCursor: "p2" }),
      p2: page({ tools: [{ name: "b" }], nextCursor: "" }),
    });
    const out = await listTools(r.ctx, ENDPOINT, 5);
    expect(out.tools).toEqual([{ name: "a" }, { name: "b" }]);
    expect(out.truncated).toBe(false);
    expect(r.seen).toHaveLength(2);
    expect(JSON.parse(r.seen[1]!.body!).params.cursor).toBe("p2");
  });

  it("reports truncation when the page budget runs out with a cursor pending", async () => {
    const r = byCursor({
      "": page({ tools: [{ name: "a" }], nextCursor: "p2" }),
      p2: page({ tools: [{ name: "b" }], nextCursor: "p3" }),
    });
    const out = await listTools(r.ctx, ENDPOINT, 2);
    expect(out.tools.map((t) => t["name"])).toEqual(["a", "b"]);
    expect(out.truncated).toBe(true);
    expect(out.pages).toBe(2);
  });

  it("stops on a non-200 page that is not a sign-in refusal", async () => {
    const r = byCursor({ "": page({ tools: [{ name: "a" }] }, 503) });
    const out = await listTools(r.ctx, ENDPOINT, 3);
    expect(out).toEqual({ tools: [], truncated: false, pages: 0 });
  });

  it("records a 401 or 403 on the first page as the sign-in status", async () => {
    for (const status of [401, 403]) {
      const r = byCursor({ "": page({ tools: [{ name: "a" }] }, status) });
      const out = await listTools(r.ctx, ENDPOINT, 3);
      expect(out).toEqual({
        tools: [],
        truncated: false,
        pages: 0,
        signInStatus: status,
      });
    }
  });

  // Only the first page decides sign-in: a refusal mid-listing is a broken
  // pagination, not an endpoint that requires credentials.
  it("does not report sign-in when a later page is refused", async () => {
    const r = byCursor({
      "": page({ tools: [{ name: "a" }], nextCursor: "p2" }),
      p2: page({ tools: [] }, 401),
    });
    const out = await listTools(r.ctx, ENDPOINT, 3);
    expect(out.tools).toEqual([{ name: "a" }]);
    expect(out.signInStatus).toBeUndefined();
  });

  it("stops on a JSON-RPC error and keeps what earlier pages returned", async () => {
    const r = byCursor({
      "": page({ tools: [{ name: "a" }], nextCursor: "p2" }),
      p2: mockFetchResult(
        '{"jsonrpc":"2.0","id":1,"error":{"code":-32602,"message":"bad cursor"}}',
        200,
        "application/json",
      ),
    });
    const out = await listTools(r.ctx, ENDPOINT, 3);
    expect(out.tools).toEqual([{ name: "a" }]);
    expect(out.truncated).toBe(true);
  });

  it("stops when a result carries no tools array", async () => {
    const r = byCursor({ "": page({ tools: { name: "a" } }) });
    const out = await listTools(r.ctx, ENDPOINT, 3);
    expect(out).toEqual({ tools: [], truncated: false, pages: 0 });
  });

  it("stops without fetching when the endpoint is refused", async () => {
    const r = byCursor({});
    const out = await listTools(r.ctx, "http://127.0.0.1/mcp", 3);
    expect(out).toEqual({ tools: [], truncated: false, pages: 0 });
    expect(r.seen).toEqual([]);
  });
});
