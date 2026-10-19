import { describe, it, expect, vi } from "vitest";
import { McpToolAnnotationCoverageAudit } from "./mcp-tool-annotation-coverage";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { CheckContext } from "#core/check-context";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import type { AuditResult } from "#core/types";
import {
  AuditTier,
  CheckStatus,
  EvidenceGrade,
  ScoreDisplayMode,
} from "#core/types";
import { AuditResultSchema } from "#core/schemas";
import { weightForGrade } from "#core/scorer";

vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
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
  undeclared?: boolean;
  /** HTTP status tools/list answers with, when not 200. */
  status?: number;
  /** When set, every tools/list page returns this `nextCursor`, so paging never ends. */
  nextCursor?: string;
}

function run(server: Server = {}) {
  const audit = new McpToolAnnotationCoverageAudit();
  const ctx: CheckContext = mockCheckContext(
    [],
    server.undeclared ? {} : servers(),
  );
  const methods: string[] = [];

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    const body = JSON.parse(o.body ?? "{}") as { method?: string };
    methods.push(body.method ?? "");
    if (body.method === "tools/list") {
      if (server.status !== undefined)
        return mockFetchResult("", server.status);
      return mockFetchResult(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            tools: server.tools ?? [],
            ...(server.nextCursor ? { nextCursor: server.nextCursor } : {}),
          },
        }),
        200,
        "application/json",
      );
    }
    return mockFetchResult("{}", 404);
  };

  return { result: audit.audit(ctx), methods };
}

/** A tool carrying all three hints the OpenAI plugin guidelines require. */
const FULL = (name = "search_products") => ({
  name,
  description: "Search the product catalogue.",
  inputSchema: { type: "object", properties: {} },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
});

const parse = (result: AuditResult) =>
  expect(AuditResultSchema.safeParse(result).success).toBe(true);

describe("McpToolAnnotationCoverageAudit", () => {
  // Informative: the directory requirements cover only submitted servers,
  // which the audit cannot see, so the check reports and never scores.
  it("is grade A in the informative tier, with weight 0 from the meta law", () => {
    const { meta } = McpToolAnnotationCoverageAudit;
    expect(meta.id).toBe("agent-interfaces/mcp-tool-annotation-coverage");
    expect(meta.evidenceGrade).toBe(EvidenceGrade.A);
    expect(meta.tier).toBe(AuditTier.Informative);
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
    expect(meta.weight).toBe(
      weightForGrade(EvidenceGrade.A, AuditTier.Informative),
    );
    expect(meta.weight).toBe(0);
  });

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(new McpToolAnnotationCoverageAudit());
  });

  it("is notApplicable when the site declares no MCP endpoint", async () => {
    const r = await run({ undeclared: true }).result;
    expect(r.status).toBe(CheckStatus.NotApplicable);
  });

  it("is notApplicable when the endpoint lists no tools", async () => {
    const r = await run({ tools: [] }).result;
    expect(r.status).toBe(CheckStatus.NotApplicable);
  });

  it.each([401, 403])(
    "is notApplicable and names the sign-in requirement when tools/list answers HTTP %i",
    async (status) => {
      const r = await run({ status }).result;
      expect(r.status).toBe(CheckStatus.NotApplicable);
      expect(r.message).toContain("requires sign-in");
    },
  );

  // The tools/list read is the shared probe the other MCP audits use.
  it("sends only tools/list to the endpoint", async () => {
    const { result, methods } = run({ tools: [FULL()] });
    await result;
    expect(methods).toEqual(["tools/list"]);
  });

  it("passes when every tool carries all three boolean hints", async () => {
    const r = await run({ tools: [FULL("a"), FULL("b")] }).result;
    expect(r.status).toBe(CheckStatus.Pass);
    expect(num(r, "tools")).toBe(2);
    expect(num(r, "fullyAnnotated")).toBe(2);
    expect(num(r, "readOnlyHintCoverage")).toBe(100);
    expect(num(r, "destructiveHintCoverage")).toBe(100);
    expect(num(r, "openWorldHintCoverage")).toBe(100);
    parse(r);
  });

  it("fails a tool that carries neither readOnlyHint nor destructiveHint", async () => {
    const bare = { name: "delete_order", inputSchema: { type: "object" } };
    const r = await run({ tools: [FULL(), bare] }).result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "unannotatedTools")).toEqual(["delete_order"]);
    expect(num(r, "readOnlyHintCoverage")).toBe(50);
    expect(r.message).toContain("delete_order");
    parse(r);
  });

  // A non-boolean value is not a hint: `null` must not claim safety.
  it("does not count a non-boolean hint", async () => {
    const tool = {
      name: "lookup",
      annotations: { readOnlyHint: null, destructiveHint: "false" },
    };
    const r = await run({ tools: [tool] }).result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "unannotatedTools")).toEqual(["lookup"]);
    parse(r);
  });

  it("warns when every tool has a confirmation hint but some lack the full set", async () => {
    const partial = {
      name: "add_to_cart",
      annotations: { readOnlyHint: false, destructiveHint: false },
    };
    const destructiveOnly = {
      name: "cancel_order",
      annotations: { destructiveHint: true },
    };
    const r = await run({ tools: [FULL(), partial, destructiveOnly] }).result;
    expect(r.status).toBe(CheckStatus.Warn);
    expect(strings(r, "unannotatedTools")).toEqual([]);
    expect(strings(r, "incompleteTools")).toEqual([
      "add_to_cart",
      "cancel_order",
    ]);
    expect(num(r, "fullyAnnotated")).toBe(1);
    expect(num(r, "openWorldHintCoverage")).toBe(33.3);
    parse(r);
  });

  it("reports idempotentHint coverage without grading it", async () => {
    const tool = FULL();
    const r = await run({
      tools: [
        { ...tool, annotations: { ...tool.annotations, idempotentHint: true } },
        FULL("b"),
      ],
    }).result;
    expect(r.status).toBe(CheckStatus.Pass);
    expect(num(r, "idempotentHintCoverage")).toBe(50);
  });

  // `annotations` must be an object; a string or an array carries no hints.
  it.each([
    ["a string", "readOnlyHint"],
    ["an array", [{ readOnlyHint: true }]],
  ])(
    "counts a tool whose annotations is %s as unannotated",
    async (_, value) => {
      const tool = { name: "lookup", annotations: value };
      const r = await run({ tools: [tool] }).result;
      expect(r.status).toBe(CheckStatus.Fail);
      expect(strings(r, "unannotatedTools")).toEqual(["lookup"]);
      expect(num(r, "readOnlyHintCoverage")).toBe(0);
      parse(r);
    },
  );

  it("reports pagesTruncated when nextCursor outlasts the page budget", async () => {
    const r = await run({ tools: [FULL()], nextCursor: "more" }).result;
    expect(r.details?.["pagesTruncated"]).toBe(true);
    parse(r);
  });

  it("reports pagesTruncated false when the list ends", async () => {
    const r = await run({ tools: [FULL()] }).result;
    expect(r.details?.["pagesTruncated"]).toBe(false);
    parse(r);
  });

  it("names a tool without a name by its position", async () => {
    const r = await run({ tools: [{ annotations: {} }] }).result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "unannotatedTools")).toEqual(["tool #1"]);
  });
});
