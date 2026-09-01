import { describe, it, expect, vi } from "vitest";
import {
  McpToolDescriptionCoverageAudit,
  collectLeaves,
} from "./mcp-tool-description-coverage";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";
import type { FetchOptions, FetchResult } from "../../fetcher";
import type { AuditResult } from "../../types";

vi.mock("../../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => url.startsWith("https://api.example.com"),
  };
});

const ENDPOINT = "https://api.example.com/mcp";
const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];
const num = (result: AuditResult, key: string): number =>
  result.details?.[key] as number;

const LONG =
  "Search the product catalogue and return matching items with prices.";

function servers(): Record<string, FetchResult> {
  return {
    "/.well-known/mcp/servers.json": mockFetchResult(
      JSON.stringify({ servers: [{ url: ENDPOINT }] }),
      200,
      "application/json",
    ),
  };
}

interface Server {
  tools?: unknown[];
  /** Top-level guidance in the server/discover result. */
  instructions?: string;
  undeclared?: boolean;
}

function run(server: Server = {}) {
  const audit = new McpToolDescriptionCoverageAudit();
  const ctx: CheckContext = mockCheckContext(
    [],
    server.undeclared ? {} : servers(),
  );
  const methods: string[] = [];

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    const body = JSON.parse(o.body ?? "{}") as { method?: string };
    methods.push(body.method ?? "");
    if (body.method === "tools/list") {
      return mockFetchResult(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { tools: server.tools ?? [] },
        }),
        200,
        "application/json",
      );
    }
    if (body.method === "server/discover") {
      const result: Record<string, unknown> = {
        serverInfo: { name: "x", version: "1" },
      };
      if (server.instructions !== undefined)
        result["instructions"] = server.instructions;
      return mockFetchResult(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result }),
        200,
        "application/json",
      );
    }
    return mockFetchResult("{}", 404);
  };

  return { result: audit.audit(ctx), methods };
}

/** A fully documented tool, the baseline every case mutates. */
const GOOD = () => ({
  name: "search_products",
  title: "Search products",
  description: LONG,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Free-text search over product titles.",
      },
      locale: {
        type: "string",
        description: "BCP 47 tag.",
        enum: ["en-GB", "de-DE"],
      },
    },
    required: ["query"],
  },
  outputSchema: { type: "object", properties: { results: { type: "array" } } },
});

describe("McpToolDescriptionCoverageAudit", () => {
  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(new McpToolDescriptionCoverageAudit());
  });

  it("is notApplicable when the endpoint lists no tools", async () => {
    const r = await run({ tools: [] }).result;
    expect(r.status).toBe("na");
  });

  // The tools/list read is the shared probe; this audit adds no fetch of its own
  // beyond the discover response the reachability audit already asks for.
  it("sends only tools/list and server/discover", async () => {
    const { result, methods } = run({
      tools: [GOOD()],
      instructions: "Call search first.",
    });
    await result;
    expect(new Set(methods)).toEqual(
      new Set(["tools/list", "server/discover"]),
    );
    expect(methods.filter((m) => m === "tools/list")).toHaveLength(1);
  });

  it("passes a fully documented tool surface", async () => {
    const r = await run({
      tools: [GOOD()],
      instructions: "Call search_products first.",
    }).result;
    expect(r.status).toBe("pass");
    expect(num(r, "toolDescriptionCoverage")).toBe(100);
    expect(num(r, "paramDescriptionCoverage")).toBe(100);
    expect(num(r, "requiredParamDescriptionCoverage")).toBe(100);
  });

  it("fails a tool that carries no description at all", async () => {
    const tool = GOOD() as Record<string, unknown>;
    delete tool["description"];
    const r = await run({ tools: [tool], instructions: "x" }).result;
    expect(r.status).toBe("fail");
    expect(num(r, "toolDescriptionCoverage")).toBe(0);
    expect(strings(r, "undescribedTools")).toEqual(["search_products"]);
  });

  // A stub is not a failure: the tool is described, just not usefully.
  it("counts a description under 40 characters as a stub and warns", async () => {
    const r = await run({
      tools: [{ ...GOOD(), description: "Searches." }],
      instructions: "x",
    }).result;
    expect(r.status).toBe("warn");
    expect(num(r, "stubDescriptions")).toBe(1);
    expect(num(r, "toolDescriptionCoverage")).toBe(100);
  });

  it("fails an undocumented required parameter and names its path", async () => {
    const tool = GOOD();
    tool.inputSchema.properties.query = { type: "string" } as never;
    const r = await run({ tools: [tool], instructions: "x" }).result;
    expect(r.status).toBe("fail");
    expect(num(r, "requiredParamDescriptionCoverage")).toBe(0);
    expect(strings(r, "undescribedRequiredParams")).toEqual([
      "search_products.query",
    ]);
  });

  it("walks arrays of objects and names the path with []", async () => {
    const tool = {
      name: "create_invoice",
      description: LONG,
      inputSchema: {
        type: "object",
        properties: {
          line_items: {
            type: "array",
            items: {
              type: "object",
              properties: { tax_code: { type: "string" } },
            },
          },
        },
      },
    };
    const r = await run({ tools: [tool], instructions: "x" }).result;
    expect(strings(r, "undescribedParams")).toEqual([
      "create_invoice.line_items[].tax_code",
    ]);
  });

  it("fails below the 90% parameter threshold and passes at exactly 90%", async () => {
    const props = (documented: number, total: number) => {
      const out: Record<string, unknown> = {};
      for (let i = 0; i < total; i += 1) {
        out[`p${i}`] =
          i < documented
            ? { type: "string", description: "A documented one." }
            : { type: "string" };
      }
      return out;
    };
    const tool = (documented: number, total: number) => ({
      name: "wide",
      description: LONG,
      inputSchema: { type: "object", properties: props(documented, total) },
    });

    const atThreshold = await run({ tools: [tool(9, 10)], instructions: "x" })
      .result;
    expect(num(atThreshold, "paramDescriptionCoverage")).toBe(90);
    expect(atThreshold.status).toBe("pass");

    const below = await run({ tools: [tool(8, 10)], instructions: "x" }).result;
    expect(below.status).toBe("fail");
  });

  it("reports the advisory ratios without gating on them", async () => {
    const bare = {
      name: "ping",
      description: LONG,
      inputSchema: {
        type: "object",
        properties: { host: { type: "string", description: "Host to ping." } },
      },
    };
    const r = await run({ tools: [bare], instructions: "x" }).result;
    expect(r.status).toBe("pass");
    expect(num(r, "constrainedStringRatio")).toBe(0);
    expect(num(r, "outputSchemaCoverage")).toBe(0);
    expect(num(r, "titleCoverage")).toBe(0);
  });

  it("warns when the server returns no instructions and reports the length", async () => {
    const r = await run({ tools: [GOOD()] }).result;
    expect(r.status).toBe("warn");
    expect(num(r, "instructionsLength")).toBe(0);
    expect(r.message).toContain("instructions");
  });

  it("counts container objects as paths, not as parameters", () => {
    const leaves = collectLeaves(
      {
        type: "object",
        properties: {
          customer: {
            type: "object",
            properties: {
              email: { type: "string", description: "Billing email." },
            },
          },
        },
        required: ["customer"],
      },
      "",
    );
    expect(leaves).toHaveLength(1);
    expect(leaves[0]?.path).toBe("customer.email");
    // Required-ness travels from the container to the leaf it reached.
    expect(leaves[0]?.required).toBe(false);
  });

  it("marks a string leaf constrained by enum, format or pattern", () => {
    const leaves = collectLeaves(
      {
        type: "object",
        properties: {
          a: { type: "string", enum: ["x"] },
          b: { type: "string", format: "email" },
          c: { type: "string", pattern: "^x$" },
          d: { type: "string" },
        },
      },
      "",
    );
    expect(leaves.filter((l) => l.constrained).map((l) => l.path)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(leaves.every((l) => l.isString)).toBe(true);
  });
});
