import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScanReport } from "@forkpoint/agent-lighthouse-core";
import { CATEGORY_MASS } from "@forkpoint/agent-lighthouse-core";
import { auditWebsite } from "./index";

/**
 * The programmatic helper, which agent toolkits import directly rather than
 * going through the stdio server. It is a published entry point, so its shape
 * is a contract even though nothing in this repo calls it.
 */

const runScan = vi.hoisted(() => vi.fn());
vi.mock("@forkpoint/agent-lighthouse-core", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@forkpoint/agent-lighthouse-core")
  >()),
  runScan,
}));

function report(over: Partial<ScanReport> = {}): ScanReport {
  return {
    scanId: "s1",
    url: "https://shop.test/",
    domain: "shop.test",
    overallScore: 42,
    scoreTier: "needs-work",
    categories: [
      {
        id: "agent-interfaces",
        name: "agent-interfaces",
        weight: CATEGORY_MASS["agent-interfaces"] ?? 0.1,
        score: 80,
        passCount: 1,
        warnCount: 0,
        failCount: 0,
        checks: [
          {
            id: "agent-interfaces/webmcp",
            category: "agent-interfaces",
            title: "WebMCP endpoint",
            description: "desc",
            status: "pass",
            score: 1,
            scoreDisplayMode: "binary",
            priority: "medium",
            impact: "",
            fix: "",
          },
        ],
      },
    ],
    topPasses: [],
    topFails: [],
    recommendations: [],
    pagesScanned: [{ url: "https://shop.test/", pageType: "homepage" }],
    scannedAt: "2026-01-01T00:00:00.000Z",
    durationMs: 12_340,
    ...over,
  } as ScanReport;
}

beforeEach(() => {
  runScan.mockReset();
});

describe("auditWebsite", () => {
  it("scans the URL it is given", async () => {
    runScan.mockResolvedValue(report());
    await auditWebsite("https://shop.test/");
    expect(runScan).toHaveBeenCalledWith("https://shop.test/");
  });

  it("returns the headline numbers", async () => {
    runScan.mockResolvedValue(report());
    const result = await auditWebsite("https://shop.test/");
    expect(result.url).toBe("https://shop.test/");
    expect(result.scoreTier).toBe("needs-work");
    expect(typeof result.overallScore).toBe("number");
  });

  // Milliseconds, unlike the MCP tool's summary, which pre-formats seconds.
  it("reports the duration in milliseconds", async () => {
    runScan.mockResolvedValue(report({ durationMs: 12_340 }));
    expect((await auditWebsite("https://shop.test/")).durationMs).toBe(12_340);
  });

  it("flattens the view groups into a flat category list", async () => {
    runScan.mockResolvedValue(report());
    const result = await auditWebsite("https://shop.test/");
    const entry = result.categories.find(
      (c: { name: string }) => c.name === "agent-interfaces",
    );
    expect(entry).toMatchObject({ pass: 1, warn: 0, fail: 0 });
  });

  // Unlike the MCP tool, which caps at ten: a caller in code can page itself.
  it("returns every top fail, uncapped", async () => {
    const fails = Array.from({ length: 25 }, (_v, i) => ({
      id: `f${i}`,
      category: "agent-interfaces",
      title: `Fail ${i}`,
      description: "",
      status: "fail" as const,
      score: 0,
      scoreDisplayMode: "binary" as const,
      priority: "high" as const,
      impact: "impact",
      fix: "fix",
    }));
    runScan.mockResolvedValue(report({ topFails: fails }));
    const result = await auditWebsite("https://shop.test/");
    expect(result.topFails).toHaveLength(25);
    expect(result.topFails[0]).toMatchObject({
      id: "f0",
      impact: "impact",
      fix: "fix",
    });
  });

  it("propagates a scan failure rather than returning a partial result", async () => {
    runScan.mockRejectedValue(new Error("host unreachable"));
    await expect(auditWebsite("https://shop.test/")).rejects.toThrow(
      "host unreachable",
    );
  });
});
