import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  handlers: new Map<unknown, (request: any) => Promise<any>>(),
  runScan: vi.fn(),
}));
vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: class {
    setRequestHandler(
      schema: unknown,
      handler: (request: any) => Promise<any>,
    ) {
      state.handlers.set(schema, handler);
    }
    async connect() {}
    async notification() {}
  },
}));
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(),
}));
vi.mock("@forkpoint/agent-lighthouse-core", async (original) => ({
  ...(await original<typeof import("@forkpoint/agent-lighthouse-core")>()),
  runScan: state.runScan,
}));
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
beforeAll(async () => {
  await import("./server.js");
});

beforeEach(() => state.runScan.mockReset());
describe("MCP handler page declarations", () => {
  it("advertises the control and forwards it through the actual tools/call handler", async () => {
    const listed = await state.handlers.get(ListToolsRequestSchema)!({});
    expect(listed.tools[0].inputSchema.properties.pageType.enum).toContain(
      "article",
    );
    const pageAttempts = [
      {
        url: "https://x.test",
        pageType: "unknown",
        source: "detected",
        outcome: "unread",
        status: 503,
      },
    ];
    state.runScan.mockResolvedValue({
      url: "https://x.test",
      domain: "x.test",
      overallScore: null,
      scoreTier: null,
      categories: [],
      topFails: [],
      topPasses: [],
      recommendations: [],
      pagesScanned: [],
      pageAttempts,
      durationMs: 0,
    });
    const args = {
      url: "https://x.test",
      pageType: "article",
      pages: [{ url: "https://x.test/other", pageType: "product" }],
    };
    const result = await state.handlers.get(CallToolRequestSchema)!({
      params: { name: "audit_website", arguments: args },
    });
    expect(state.runScan).toHaveBeenCalledWith(
      args.url,
      expect.objectContaining({ pageType: args.pageType, pages: args.pages }),
    );
    expect(JSON.parse(result.content[0].text).pageScope.attempts).toEqual(
      pageAttempts,
    );
  });
  it("rejects an invalid declaration before a scan starts", async () => {
    await expect(
      state.handlers.get(CallToolRequestSchema)!({
        params: {
          name: "audit_website",
          arguments: { url: "https://x.test", pageType: "author" },
        },
      }),
    ).rejects.toThrow();
    expect(state.runScan).not.toHaveBeenCalled();
  });
});
