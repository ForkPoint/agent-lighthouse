import { describe, it, expect, vi } from "vitest";
import { McpToolContractValidityAudit } from "./mcp-tool-contract-validity";
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

function servers(): Record<string, FetchResult> {
  return {
    "/.well-known/mcp/servers.json": mockFetchResult(
      JSON.stringify({ servers: [{ url: ENDPOINT }] }),
      200,
      "application/json",
    ),
  };
}

const CLEAN = {
  name: "searchProducts",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      locale: { type: "string", "x-mcp-header": "Accept-Language" },
    },
    required: ["query"],
  },
};

type Result = { status: string; message: string; found: string };

/** Run the audit against one tools/list page. */
function run(
  tools: unknown[],
  pages?: Record<string, unknown[]>,
): Promise<Result> {
  const ctx: CheckContext = mockCheckContext([], servers());
  ctx.fetch = async (o: FetchOptions) => {
    const body = JSON.parse(o.body ?? "{}") as {
      method?: string;
      params?: { cursor?: string };
    };
    if (body.method !== "tools/list") return mockFetchResult("{}", 404);
    const cursor = body.params?.cursor;
    if (cursor && pages) {
      return mockFetchResult(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { tools: pages[cursor] ?? [] },
        }),
        200,
        "application/json",
      );
    }
    const result: Record<string, unknown> = { tools };
    if (pages) result["nextCursor"] = Object.keys(pages)[0];
    return mockFetchResult(
      JSON.stringify({ jsonrpc: "2.0", id: 1, result }),
      200,
      "application/json",
    );
  };
  return new McpToolContractValidityAudit().audit(ctx) as Promise<Result>;
}

/** A tool whose only defect is the given inputSchema. */
function withSchema(inputSchema: unknown, name = "probeTool") {
  return { name, inputSchema };
}

describe("McpToolContractValidityAudit", () => {
  const audit = new McpToolContractValidityAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when the site declares no MCP endpoint", async () => {
    const ctx: CheckContext = mockCheckContext([]);
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe("na");
  });

  it("is notApplicable when the server lists no tools", async () => {
    const result = await run([]);
    expect(result.status).toBe("na");
  });

  it("passes a well-formed tool set", async () => {
    const result = await run([CLEAN]);
    expect(result.status).toBe("pass");
  });

  it("fails a missing inputSchema", async () => {
    const result = await run([{ name: "probeTool" }]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("inputSchema");
  });

  it("fails a null inputSchema", async () => {
    const result = await run([withSchema(null)]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("null");
  });

  it('fails an inputSchema whose type is not "object"', async () => {
    const result = await run([withSchema({ type: "string" })]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain('"object"');
  });

  it("fails a required entry that properties does not define", async () => {
    const result = await run([
      withSchema({
        type: "object",
        properties: { query: { type: "string" } },
        required: ["q"],
      }),
    ]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("`q`");
  });

  it("warns on a name outside the allowed character set", async () => {
    const result = await run([{ ...CLEAN, name: "search products!" }]);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("search products!");
  });

  it("warns on a name longer than 128 characters", async () => {
    const result = await run([{ ...CLEAN, name: "a".repeat(129) }]);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("129 characters");
  });

  it("warns on a name duplicated within one server", async () => {
    const result = await run([CLEAN, { ...CLEAN }]);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("defined 2 times");
  });

  it("warns on a name outside printable ASCII, naming the sentinel encoding", async () => {
    const result = await run([{ ...CLEAN, name: "búsqueda" }]);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("=?base64?");
  });

  it("fails an empty x-mcp-header value", async () => {
    const result = await run([
      withSchema({
        type: "object",
        properties: { a: { type: "string", "x-mcp-header": "" } },
      }),
    ]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("non-empty string");
  });

  it("fails an x-mcp-header value with a non-tchar character", async () => {
    const result = await run([
      withSchema({
        type: "object",
        properties: { a: { type: "string", "x-mcp-header": "X Custom" } },
      }),
    ]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("RFC 9110 token");
  });

  it("fails an x-mcp-header value with an embedded CR", async () => {
    const result = await run([
      withSchema({
        type: "object",
        properties: {
          a: { type: "string", "x-mcp-header": "X-Custom\r\nInjected: 1" },
        },
      }),
    ]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("CR or LF");
  });

  it("fails two x-mcp-header values that differ only in case", async () => {
    const result = await run([
      withSchema({
        type: "object",
        properties: {
          a: { type: "string", "x-mcp-header": "X-Tenant" },
          b: { type: "string", "x-mcp-header": "x-tenant" },
        },
      }),
    ]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("repeats case-insensitively");
  });

  // number is excluded on purpose: it has no canonical header serialization.
  it("fails an x-mcp-header on a property of type number", async () => {
    const result = await run([
      withSchema({
        type: "object",
        properties: { a: { type: "number", "x-mcp-header": "X-Limit" } },
      }),
    ]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("only string, integer and boolean");
  });

  it("fails an x-mcp-header reached through items", async () => {
    const result = await run([
      withSchema({
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string", "x-mcp-header": "X-Tag" },
          },
        },
      }),
    ]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("`items`");
  });

  it("fails an x-mcp-header reached through oneOf", async () => {
    const result = await run([
      withSchema({
        type: "object",
        properties: {
          who: { oneOf: [{ type: "string", "x-mcp-header": "X-Who" }] },
        },
      }),
    ]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("`oneOf`");
  });

  it("fails an x-mcp-header reached through a $ref hop", async () => {
    const result = await run([
      withSchema({
        type: "object",
        properties: {
          who: { $ref: { type: "string", "x-mcp-header": "X-Who" } },
        },
      }),
    ]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("$ref");
  });

  // The deletion instruction is unconditional, so the ratio cannot rescue it.
  it("fails a server with 9 clean tools and 1 header violation", async () => {
    const clean = Array.from({ length: 9 }, (_, i) => ({
      ...CLEAN,
      name: `tool${i}`,
    }));
    const broken = withSchema(
      {
        type: "object",
        properties: { a: { type: "number", "x-mcp-header": "X-Limit" } },
      },
      "brokenTool",
    );
    const result = await run([...clean, broken]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("whatever the pass ratio");
    expect(result.found).toContain("9 pass every MUST");
  });

  it("fails an outputSchema that is not a JSON Schema object", async () => {
    const result = await run([{ ...CLEAN, outputSchema: "string" }]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("outputSchema");
  });

  it("assesses every page of a paginated tools/list", async () => {
    const broken = withSchema(
      { type: "object", properties: {}, required: ["missing"] },
      "page2Tool",
    );
    const result = await run([CLEAN], { "cursor-2": [broken] });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("page2Tool");
    expect(result.found).toContain("2 tool(s)");
  });
});
