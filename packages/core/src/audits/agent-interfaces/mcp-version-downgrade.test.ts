import { describe, it, expect, vi } from "vitest";
import { McpVersionDowngradeAudit } from "./mcp-version-downgrade";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { CheckContext } from "#core/check-context";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import { CheckStatus } from "#core/types";

// isSafeUrl resolves DNS before the client POSTs to a URL read out of a
// site-controlled root file. Offline stand-in, still blocking private ranges.
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
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("is notApplicable when the endpoint does not answer", async () => {
    const ctx: CheckContext = mockCheckContext([], servers());
    ctx.fetch = async () => {
      throw new Error("socket hang up");
    };
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it.each([401, 403])(
    "is notApplicable when the server answers the probe with HTTP %i (login required)",
    async (status) => {
      const refused = mockFetchResult("", status);
      if (status === 401)
        refused.headers["www-authenticate"] = 'Bearer resource_metadata="x"';
      const result = await run({ a: refused, b: refused, c: refused });
      expect(result.status).toBe(CheckStatus.NotApplicable);
      expect(result.message).toContain("requires sign-in");
    },
  );

  it("passes a server that rejects an unsupported revision recoverably", async () => {
    const result = await run();
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("2025-11-25");
    expect(result.message).toContain("2025-03-26");
  });

  it("fails at critical when the impossible revision is accepted with 200", async () => {
    const result = await run({
      a: json({ jsonrpc: "2.0", id: "x", result: {} }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("validates no protocol version");
  });

  it("fails when the rejection carries no -32022", async () => {
    const result = await run({ a: rpcError(-32600) });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("-32022");
  });

  it("fails when data.supported is empty", async () => {
    const result = await run({
      a: rpcError(-32022, { supported: [], requested: "1900-01-01" }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("never told which one is right");
  });

  it("warns when data.requested does not echo what was sent", async () => {
    const result = await run({
      a: rpcError(-32022, { supported: [CURRENT], requested: "2020-01-01" }),
    });
    expect(result.status).toBe(CheckStatus.Warn);
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
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("2025-03-26");
    expect(result.message).toContain("server/discover advertises");
  });

  it("fails at high when a header/body version disagreement is answered with 200", async () => {
    const result = await run({
      b: json({ jsonrpc: "2.0", id: "x", result: {} }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain(
      "never validates the header against the body",
    );
  });

  it("warns when the disagreement is rejected with a code other than -32020", async () => {
    const result = await run({ b: rpcError(-32602) });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("-32020");
  });

  it("warns when a headerless request is answered as the current revision", async () => {
    const result = await run({
      c: json({ jsonrpc: "2.0", id: "x", result: { capabilities: {} } }),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("validation gap");
  });

  it("records a rejected headerless request without a finding", async () => {
    const result = await run({ c: rpcError(-32020) });
    expect(result.status).toBe(CheckStatus.Pass);
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

  it("is notApplicable on a malformed declaration and names the defect", async () => {
    const ctx: CheckContext = mockCheckContext([], {
      "/.well-known/mcp/servers.json": json({ servers: [{ url: "" }] }),
    });
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.found).toBe("Malformed declaration (no-url)");
  });

  it("fails a rejection that carries no JSON-RPC error at all", async () => {
    const result = await run({
      a: mockFetchResult("Bad Request", 400, "text/plain"),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain(
      "with HTTP 400 and no JSON-RPC error rather than -32022",
    );
    expect(result.found).toContain("probe A HTTP 400;");
    expect(result.found).toContain("supported not advertised in the rejection");
  });

  it("fails a -32022 whose error carries no data object", async () => {
    const result = await run({ a: rpcError(-32022) });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("`error.data.supported` is missing");
    expect(result.found).toContain("probe A HTTP 400 / -32022");
  });

  it("fails a -32022 whose data.supported is not a list", async () => {
    const result = await run({
      a: rpcError(-32022, { supported: CURRENT, requested: "1900-01-01" }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("`error.data.supported` is missing");
  });

  it("warns on a -32022 that arrives on a status other than 400", async () => {
    const result = await run({
      a: rpcError(
        -32022,
        { supported: ["2025-11-25", CURRENT], requested: "1900-01-01" },
        422,
      ),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain(
      "the -32022 rejection arrived as HTTP 422 rather than 400",
    );
  });

  it("warns on supported entries that are not YYYY-MM-DD revisions", async () => {
    const result = await run({
      a: rpcError(-32022, {
        supported: ["2025-11-25", CURRENT, "latest"],
        requested: "1900-01-01",
      }),
      discover: json({
        jsonrpc: "2.0",
        id: "al-1",
        result: { supportedVersions: ["2025-11-25", CURRENT, "latest"] },
      }),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain(
      '`error.data.supported` lists "latest", which is not a YYYY-MM-DD revision',
    );
  });

  it("warns when data.requested is absent and reports it as null", async () => {
    const result = await run({
      a: rpcError(-32022, { supported: ["2025-11-25", CURRENT] }),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("`error.data.requested` is null");
  });

  // With no list from server/discover there is nothing to compare against, so
  // the rejection's own list stands.
  it("skips the list comparison when server/discover does not answer with a result", async () => {
    for (const discover of [
      mockFetchResult("", 401, "text/plain"),
      mockFetchResult("not json", 200, "text/plain"),
    ]) {
      const result = await run({
        a: rpcError(-32022, {
          supported: ["2020-01-01"],
          requested: "1900-01-01",
        }),
        discover,
      });
      expect(result.status).toBe(CheckStatus.Pass);
      expect(result.message).not.toContain("server/discover advertises");
    }
  });

  it("warns when the disagreement is rejected without a JSON-RPC error", async () => {
    const result = await run({
      b: mockFetchResult("Bad Request", 400, "text/plain"),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain(
      "rejected with HTTP 400 rather than -32020",
    );
  });

  it("reports both the critical break and the header/body gap together", async () => {
    const ok = json({ jsonrpc: "2.0", id: "x", result: {} });
    const result = await run({ a: ok, b: ok });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("validates no protocol version");
    expect(result.message).toContain(
      "Additionally, it answered a request whose header said",
    );
  });

  it("records probes B and C that get no answer without a finding", async () => {
    const ctx: CheckContext = mockCheckContext([], servers());
    ctx.fetch = async (o: FetchOptions) => {
      const probe = probeOf(o);
      if (probe.header === "1900-01-01") return REJECTION;
      if (probe.header === CURRENT && probe.body === CURRENT)
        return DISCOVER_OK;
      throw new Error("socket hang up");
    };
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("probe B HTTP no answer");
    expect(result.found).toContain("probe C HTTP no answer");
    expect(result.message).not.toContain("Also:");
  });
});
