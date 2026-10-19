import { describe, it, expect } from "vitest";
import { McpDiscoveryAudit } from "./mcp-discovery";
import { weightForGrade } from "#core/scorer";
import { AuditMetaSchema } from "#core/schemas";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import {
  AuditTier,
  CheckPriority,
  CheckStatus,
  EvidenceGrade,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

const PATH = "/.well-known/mcp/servers.json";

function runWith(files: Record<string, ReturnType<typeof mockFetchResult>>) {
  return new McpDiscoveryAudit().audit(mockCheckContext([], files));
}

describe("McpDiscoveryAudit", () => {
  it("warns that servers.json is unread when a servers list is published", () => {
    const body = JSON.stringify({
      servers: [{ name: "MCP", url: "https://example.com/mcp" }],
    });
    const result = runWith({ [PATH]: mockFetchResult(body, 200) });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.priority).toBe(CheckPriority.Low);
    expect(result.message).toContain("No MCP specification or client reads");
    expect(result.message).toContain("ai-catalog.json");
    expect(result.found).toContain("1 server(s)");
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["an object without a servers array", '{"name":"x"}'],
    ["an empty servers array", '{"servers":[]}'],
  ])("still warns, never fails, for %s", (_label, body) => {
    const result = runWith({ [PATH]: mockFetchResult(body, 200) });
    expect(result.status).toBe(CheckStatus.Warn);
  });

  it.each([
    ["no response", {}],
    ["a 404", { [PATH]: mockFetchResult("Not found", 404) }],
    [
      "an HTML page standing in for the file",
      { [PATH]: mockFetchResult("<!doctype html><html></html>", 200) },
    ],
    ["an empty body", { [PATH]: mockFetchResult("", 200) }],
  ])("is not applicable for %s", (_label, files) => {
    expect(runWith(files).status).toBe(CheckStatus.NotApplicable);
  });

  // The UCP profile is read by Google Merchant; agentic-commerce/ucp-profile
  // judges it now. This audit no longer looks at it.
  it("ignores /.well-known/ucp", () => {
    const result = runWith({
      "/.well-known/ucp": mockFetchResult(
        JSON.stringify({ ucp: { version: "2026-01-11", services: {} } }),
        200,
      ),
    });
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("is not applicable on a scan that read nothing", async () => {
    await expectNotApplicableOnEmpty(new McpDiscoveryAudit());
  });

  it("is an obsolete-tier audit with an obsolete notice", () => {
    const { meta } = McpDiscoveryAudit;
    expect(meta.tier).toBe(AuditTier.Obsolete);
    expect(meta.evidenceGrade).toBe(EvidenceGrade.D);
    expect(meta.weight).toBe(
      weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    );
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
    expect(meta.deprecated?.kind).toBe(NoticeKind.Obsolete);
    expect(meta.deprecated?.replacement).toContain("ai-catalog.json");
    expect(AuditMetaSchema.safeParse(meta).success).toBe(true);
  });
});
