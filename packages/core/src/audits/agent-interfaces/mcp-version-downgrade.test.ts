import { describe, it, expect, vi } from "vitest";
import { McpVersionDowngradeAudit } from "./mcp-version-downgrade";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";
import type { FetchOptions, FetchResult } from "../../fetcher";

// isSafeUrl resolves DNS before the client POSTs to a URL read out of a
// site-controlled root file. Offline stand-in, still blocking private ranges.
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
const CURRENT = "2026-07-28";

function servers(): Record<string, FetchResult> {
  return {
    "/.well-known/mcp/servers.json": mockFetchResult(
      JSON.stringify({ servers: [{ url: ENDPOINT }] }),
      200,
      "application/json",
    ),
  };
}

function json(payload: unknown, status = 200): FetchResult {
  return mockFetchResult(JSON.stringify(payload), status, "application/json");
}

function rpcError(code: number, data?: unknown, status = 400): FetchResult {
  return json(
    {
      jsonrpc: "2.0",
      id: "x",
      error: { code, message: "nope", ...(data ? { data } : {}) },
    },
    status,
  );
}

/** Which probe a request is, read off the header and the body. */
interface Probe {
  header?: string;
  body: string;
}

function probeOf(o: FetchOptions): Probe {
  const parsed = JSON.parse(o.body ?? "{}") as {
    params?: { _meta?: Record<string, string> };
  };
  const header = o.headers?.["MCP-Protocol-Version"];
  return {
    ...(header ? { header } : {}),
    body:
      parsed.params?._meta?.["io.modelcontextprotocol/protocolVersion"] ?? "",
  };
}

const DISCOVER_OK = json({
  jsonrpc: "2.0",
  id: "al-1",
  result: { supportedVersions: ["2025-11-25", CURRENT], capabilities: {} },
});

const REJECTION = rpcError(-32022, {
  supported: ["2025-11-25", CURRENT],
  requested: "1900-01-01",
});
const MISMATCH = rpcError(-32020);
/** A headerless request answered as 2025-03-26, which the spec allows. */
const HEADERLESS = json({
  jsonrpc: "2.0",
  id: "al-v-c",
  result: { protocolVersion: "2025-03-26", capabilities: {} },
});

type Result = { status: string; message: string; found: string };

/** Wire the three probes plus server/discover, with per-probe overrides. */
function run(
  over: Partial<Record<"a" | "b" | "c" | "discover", FetchResult>> = {},
): Promise<Result> {
  const ctx: CheckContext = mockCheckContext([], servers());
  ctx.fetch = async (o: FetchOptions) => {
    const probe = probeOf(o);
    if (probe.header === "1900-01-01") return over.a ?? REJECTION;
    if (probe.header === CURRENT && probe.body === "2025-11-25")
      return over.b ?? MISMATCH;
    if (!probe.header) return over.c ?? HEADERLESS;
    return over.discover ?? DISCOVER_OK;
  };
  return new McpVersionDowngradeAudit().audit(ctx) as Promise<Result>;
}

describe("McpVersionDowngradeAudit", () => {
  const audit = new McpVersionDowngradeAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when the site declares no MCP endpoint", async () => {
    const ctx: CheckContext = mockCheckContext([]);
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe("na");
  });

  it("is notApplicable when the endpoint does not answer", async () => {
    const ctx: CheckContext = mockCheckContext([], servers());
    ctx.fetch = async () => {
      throw new Error("socket hang up");
    };
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe("na");
  });

  it("passes a server that rejects an unsupported revision recoverably", async () => {
    const result = await run();
    expect(result.status).toBe("pass");
    expect(result.found).toContain("2025-11-25");
    expect(result.message).toContain("2025-03-26");
  });

  it("fails at critical when the impossible revision is accepted with 200", async () => {
    const result = await run({
      a: json({ jsonrpc: "2.0", id: "x", result: {} }),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("validates no protocol version");
  });

  it("fails when the rejection carries no -32022", async () => {
    const result = await run({ a: rpcError(-32600) });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("-32022");
  });

  it("fails when data.supported is empty", async () => {
    const result = await run({
      a: rpcError(-32022, { supported: [], requested: "1900-01-01" }),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("never told which one is right");
  });

  it("warns when data.requested does not echo what was sent", async () => {
    const result = await run({
      a: rpcError(-32022, { supported: [CURRENT], requested: "2020-01-01" }),
    });
    expect(result.status).toBe("warn");
    expect(result.message).toContain("requested");
  });

  // Two lists of supported revisions that disagree send the client in circles.
  it("warns when data.supported disagrees with supportedVersions from server/discover", async () => {
    const result = await run({
      a: rpcError(-32022, {
        supported: ["2025-03-26"],
        requested: "1900-01-01",
      }),
    });
    expect(result.status).toBe("warn");
    expect(result.message).toContain("2025-03-26");
    expect(result.message).toContain("server/discover advertises");
  });

  it("fails at high when a header/body version disagreement is answered with 200", async () => {
    const result = await run({
      b: json({ jsonrpc: "2.0", id: "x", result: {} }),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain(
      "never validates the header against the body",
    );
  });

  it("warns when the disagreement is rejected with a code other than -32020", async () => {
    const result = await run({ b: rpcError(-32602) });
    expect(result.status).toBe("warn");
    expect(result.message).toContain("-32020");
  });

  it("warns when a headerless request is answered as the current revision", async () => {
    const result = await run({
      c: json({ jsonrpc: "2.0", id: "x", result: { capabilities: {} } }),
    });
    expect(result.status).toBe("warn");
    expect(result.message).toContain("validation gap");
  });

  it("records a rejected headerless request without a finding", async () => {
    const result = await run({ c: rpcError(-32020) });
    expect(result.status).toBe("pass");
    expect(result.message).toContain(
      "no `MCP-Protocol-Version` header is rejected",
    );
  });

  it("sends the impossible revision in both the header and _meta", async () => {
    const seen: Probe[] = [];
    const ctx: CheckContext = mockCheckContext([], servers());
    ctx.fetch = async (o: FetchOptions) => {
      const probe = probeOf(o);
      seen.push(probe);
      if (probe.header === "1900-01-01") return REJECTION;
      if (probe.header === CURRENT && probe.body === "2025-11-25")
        return MISMATCH;
      if (!probe.header) return HEADERLESS;
      return DISCOVER_OK;
    };
    await audit.audit(ctx);
    expect(seen).toContainEqual({ header: "1900-01-01", body: "1900-01-01" });
  });
});
