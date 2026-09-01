import { describe, it, expect, vi } from "vitest";
import { McpModernEraReachabilityAudit } from "./mcp-modern-era-reachability";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";
import type { FetchOptions, FetchResult } from "../../fetcher";

// isSafeUrl resolves DNS before the client POSTs to a URL read out of a
// site-controlled root file. Offline stand-in, still blocking loopback and
// private ranges.
vi.mock("../../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fetcher")>();
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

const ENDPOINT = "https://api.example.com/mcp";

function servers(url = ENDPOINT): Record<string, FetchResult> {
  return {
    "/.well-known/mcp/servers.json": mockFetchResult(
      JSON.stringify({ servers: [{ url }] }),
      200,
      "application/json",
    ),
  };
}

function json(payload: unknown, status = 200): FetchResult {
  return mockFetchResult(JSON.stringify(payload), status, "application/json");
}

/** Run the audit against a wire handler. Unhandled methods answer 405. */
function run(
  handler: (o: FetchOptions) => FetchResult,
  files = servers(),
): Promise<unknown> {
  const ctx: CheckContext = mockCheckContext([], files);
  ctx.fetch = async (o: FetchOptions) => handler(o);
  return new McpModernEraReachabilityAudit().audit(ctx) as Promise<unknown>;
}

const DISCOVER_OK = {
  jsonrpc: "2.0",
  id: "al-1",
  result: {
    supportedVersions: ["2025-11-25", "2026-07-28"],
    capabilities: {
      tools: {},
      resources: {},
      extensions: { "io.example/search": {} },
    },
    instructions: "Use searchProducts before addToCart.",
    serverInfo: { name: "example-shop", version: "2.1.0" },
  },
};

/** A modern server: discover succeeds, GET and DELETE are 405 as the spec says. */
function modernWire(o: FetchOptions): FetchResult {
  if (o.method === "POST") return json(DISCOVER_OK);
  return mockFetchResult("", 405);
}

type Result = { status: string; message: string; found: string };

describe("McpModernEraReachabilityAudit", () => {
  const audit = new McpModernEraReachabilityAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when the site declares no MCP endpoint", async () => {
    const result = (await run(modernWire, {})) as Result;
    expect(result.status).toBe("na");
  });

  it("passes a modern server and records capabilities, extensions, instructions and serverInfo", async () => {
    const result = (await run(modernWire)) as Result;
    expect(result.status).toBe("pass");
    expect(result.found).toContain("tools");
    expect(result.found).toContain("resources");
    expect(result.found).toContain("io.example/search");
    expect(result.found).toContain("instructions");
    expect(result.found).toContain("example-shop");
  });

  it("parses an SSE-framed success exactly like the JSON one", async () => {
    const sse = `event: message\ndata: {"jsonrpc":"2.0","id":"al-1","result":{"supportedVersions":["2026-07-28"],"capabilities":{"tools":{}},"serverInfo":{"name":"example-shop","version":"2.1.0"}}}\n\n`;
    const result = (await run((o) =>
      o.method === "POST"
        ? mockFetchResult(sse, 200, "text/event-stream")
        : mockFetchResult("", 405),
    )) as Result;
    expect(result.status).toBe("pass");
    expect(result.found).toContain("example-shop");
  });

  // A ternary audit has no "pass at a lower score": the dual-era classification
  // is a warn, and the message must name the newest revision the server takes.
  it("warns on a -32022 version rejection and names the newest supported revision", async () => {
    const result = (await run((o) =>
      o.method === "POST"
        ? json(
            {
              jsonrpc: "2.0",
              id: "al-1",
              error: {
                code: -32022,
                message: "unsupported protocol version",
                data: {
                  supported: ["2025-03-26", "2025-11-25"],
                  requested: "2026-07-28",
                },
              },
            },
            400,
          )
        : mockFetchResult("", 405),
    )) as Result;
    expect(result.status).toBe("warn");
    expect(result.message).toContain("2025-11-25");
  });

  it("warns on a 401 challenge and hands off to the OAuth chain audit by name", async () => {
    const result = (await run((o) => {
      if (o.method !== "POST") return mockFetchResult("", 405);
      const res = mockFetchResult("", 401, "text/plain");
      res.headers["www-authenticate"] =
        'Bearer resource_metadata="https://api.example.com/.well-known/oauth-protected-resource"';
      return res;
    })) as Result;
    expect(result.status).toBe("warn");
    expect(result.message).toContain(
      "agent-interfaces/mcp-oauth-discovery-chain",
    );
  });

  it("fails a -32601 on server/discover as a MUST violation", async () => {
    const result = (await run((o) =>
      o.method === "POST"
        ? json(
            {
              jsonrpc: "2.0",
              id: "al-1",
              error: { code: -32601, message: "Method not found" },
            },
            404,
          )
        : mockFetchResult("", 405),
    )) as Result;
    expect(result.status).toBe("fail");
    expect(result.message).toContain("MUST");
  });

  it("classifies a server that demands initialize and mints a session id as LEGACY-ONLY", async () => {
    const result = (await run((o) => {
      if (o.method !== "POST") return mockFetchResult("", 405);
      const body = o.body ?? "";
      if (body.includes('"initialize"')) {
        const res = json({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            serverInfo: { name: "old" },
          },
        });
        res.headers["mcp-session-id"] = "1868a90c-0e2f";
        return res;
      }
      return mockFetchResult(
        "Bad Request: expected initialize as the first request",
        400,
        "text/plain",
      );
    })) as Result;
    expect(result.status).toBe("fail");
    expect(result.message).toContain("LEGACY-ONLY");
    expect(result.message).toContain("Mcp-Session-Id");
  });

  it("fails a GET whose first SSE event is endpoint as the deprecated 2024-11-05 transport", async () => {
    const result = (await run((o) => {
      if (o.method === "GET") {
        return mockFetchResult(
          "event: endpoint\ndata: /messages?sessionId=abc\n\n",
          200,
          "text/event-stream",
        );
      }
      return mockFetchResult("Not Found", 404, "text/plain");
    })) as Result;
    expect(result.status).toBe("fail");
    expect(result.message).toContain("2024-11-05");
  });

  it("reports legacy residue when a modern server answers GET with something other than 405", async () => {
    const result = (await run((o) => {
      if (o.method === "POST") return json(DISCOVER_OK);
      if (o.method === "GET")
        return mockFetchResult("", 200, "text/event-stream");
      return mockFetchResult("", 405);
    })) as Result;
    expect(result.status).toBe("warn");
    expect(result.message).toContain("GET");
    expect(result.message).toContain("405");
  });

  it("reports legacy residue when DELETE is not 405 either", async () => {
    const result = (await run((o) => {
      if (o.method === "POST") return json(DISCOVER_OK);
      if (o.method === "DELETE") return mockFetchResult("", 204);
      return mockFetchResult("", 405);
    })) as Result;
    expect(result.status).toBe("warn");
    expect(result.message).toContain("DELETE");
  });

  it("fails a declared endpoint that does not answer at all", async () => {
    const ctx: CheckContext = mockCheckContext([], servers());
    ctx.fetch = async () => {
      throw new Error("socket hang up");
    };
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe("fail");
    expect(result.message).toContain("did not answer");
  });

  it("fails a declared endpoint on a private address without probing it", async () => {
    const seen: FetchOptions[] = [];
    const ctx: CheckContext = mockCheckContext(
      [],
      servers("http://10.0.0.4/mcp"),
    );
    ctx.fetch = async (o: FetchOptions) => {
      seen.push(o);
      return mockFetchResult("", 200);
    };
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe("fail");
    expect(seen).toEqual([]);
  });
});
