import { describe, it, expect, vi } from "vitest";
import {
  discoverMcpEndpoint,
  rpcRequest,
  parseRpcResponse,
  postRpc,
  mcpFetch,
  discoverProbe,
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
const UCP = JSON.stringify({
  services: {
    commerce: [{ transport: "mcp", endpoint: "https://a.test/ucp-mcp" }],
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
