import { describe, it, expect } from "vitest";
import type {
  CategoryResult,
  CheckResult,
  ScanReport,
} from "@forkpoint/agent-lighthouse-core";
import { CATEGORY_MASS } from "@forkpoint/agent-lighthouse-core";
import { buildReportView } from "@forkpoint/agent-lighthouse-report";
import {
  AUDIT_TOOL,
  MAX_OPPORTUNITIES,
  buildAuditSummary,
  targetUrl,
} from "./tool";

/**
 * The MCP tool contract.
 *
 * `server.ts` is a stdio entry point — it connects a transport at import time,
 * so a test can never call its handlers. These are the two pieces a client
 * actually observes: the declared schema and the JSON of a `tools/call` reply.
 *
 * The view is built by the real `buildReportView` rather than hand-written, so
 * a change to the view model that breaks the summary shows up here instead of
 * in a client's parser.
 */

function check(over: Partial<CheckResult> = {}): CheckResult {
  return {
    id: "c",
    category: "agent-interfaces",
    title: "title",
    description: "desc",
    status: "pass",
    score: 1,
    scoreDisplayMode: "binary",
    priority: "medium",
    impact: "",
    fix: "",
    ...over,
  };
}

function cat(over: Partial<CategoryResult> & { id: string }): CategoryResult {
  return {
    name: over.id,
    weight: CATEGORY_MASS[over.id] ?? 0.1,
    score: 0,
    passCount: 0,
    warnCount: 0,
    failCount: 0,
    checks: [],
    ...over,
  };
}

function report(over: Partial<ScanReport> = {}): ScanReport {
  return {
    scanId: "s1",
    url: "https://shop.test/",
    domain: "shop.test",
    overallScore: 42,
    scoreTier: "needs-work",
    categories: [
      cat({
        id: "agent-interfaces",
        score: 80,
        checks: [
          check({ id: "p1", status: "pass" }),
          check({ id: "w1", status: "warn", priority: "high" }),
          check({ id: "f1", status: "fail", priority: "critical" }),
        ],
        passCount: 1,
        warnCount: 1,
        failCount: 1,
      }),
    ],
    topPasses: [],
    topFails: [],
    recommendations: [],
    pagesScanned: [{ url: "https://shop.test/", pageType: "homepage" }],
    scannedAt: "2026-01-01T00:00:00.000Z",
    durationMs: 12_340,
    ...over,
  };
}

/** Build the summary the way `server.ts` does. */
function summarise(r: ScanReport) {
  return buildAuditSummary(r, buildReportView(r));
}

describe("AUDIT_TOOL", () => {
  it("declares a url string as its only required input", () => {
    expect(AUDIT_TOOL.name).toBe("audit_website");
    expect(AUDIT_TOOL.inputSchema.required).toEqual(["url"]);
    expect(AUDIT_TOOL.inputSchema.properties.url.type).toBe("string");
  });

  it("describes itself, so a model can tell when to call it", () => {
    expect(AUDIT_TOOL.description.length).toBeGreaterThan(40);
  });
});

describe("targetUrl", () => {
  it("reads the url argument", () => {
    expect(targetUrl({ url: "https://shop.test" })).toBe("https://shop.test");
  });

  it("trims surrounding whitespace", () => {
    expect(targetUrl({ url: "  https://shop.test  " })).toBe(
      "https://shop.test",
    );
  });

  // String(undefined) is "undefined", which is truthy: the original guard could
  // never fire, so an argument-less call scanned a host named "undefined".
  it("rejects a call with no arguments", () => {
    expect(() => targetUrl(undefined)).toThrow("Missing target URL");
  });

  it("rejects a missing url", () => {
    expect(() => targetUrl({})).toThrow("Missing target URL");
  });

  it("rejects an empty or blank url", () => {
    expect(() => targetUrl({ url: "" })).toThrow("Missing target URL");
    expect(() => targetUrl({ url: "   " })).toThrow("Missing target URL");
  });

  it("rejects a non-string url instead of coercing it", () => {
    expect(() => targetUrl({ url: 42 })).toThrow("Missing target URL");
    expect(() => targetUrl({ url: null })).toThrow("Missing target URL");
  });
});

describe("buildAuditSummary", () => {
  it("carries the headline numbers", () => {
    const s = summarise(report());
    expect(s.url).toBe("https://shop.test/");
    expect(s.scoreTier).toBe("needs-work");
    expect(typeof s.overallScore).toBe("number");
  });

  it("reports the duration in seconds, not milliseconds", () => {
    expect(summarise(report({ durationMs: 12_340 })).durationSeconds).toBe(
      "12.3",
    );
  });

  it("flattens the view groups into a flat category list", () => {
    const s = summarise(report());
    const names = s.categories.map((c) => c.name);
    expect(names).toContain("agent-interfaces");
    // A model has no use for the report's visual grouping.
    expect(s.categories.every((c) => typeof c.score === "number")).toBe(true);
  });

  it("carries each category status count", () => {
    const entry = summarise(report()).categories.find(
      (c) => c.name === "agent-interfaces",
    );
    expect(entry).toMatchObject({ passCount: 1, warnCount: 1, failCount: 1 });
  });

  it("passes the readiness vitals through", () => {
    expect(summarise(report()).vitals).toBeDefined();
  });

  it("lists the top fixes with the fields a model needs to act", () => {
    const fail = check({
      id: "agent-interfaces/webmcp",
      status: "fail",
      priority: "critical",
      impact: "Agents cannot transact.",
      fix: "Declare a WebMCP endpoint.",
    });
    const s = summarise(report({ topFails: [fail] }));
    expect(s.topOpportunities).toEqual([
      {
        id: "agent-interfaces/webmcp",
        title: "title",
        priority: "critical",
        impact: "Agents cannot transact.",
        fix: "Declare a WebMCP endpoint.",
      },
    ]);
  });

  it(`caps the fix list at ${MAX_OPPORTUNITIES}, so a model is not handed all 215`, () => {
    const fails = Array.from({ length: 25 }, (_, i) =>
      check({ id: `f${i}`, status: "fail" }),
    );
    const s = summarise(report({ topFails: fails }));
    expect(s.topOpportunities).toHaveLength(MAX_OPPORTUNITIES);
    expect(s.topOpportunities[0]?.id).toBe("f0");
  });

  it("returns an empty fix list for a clean scan rather than omitting the key", () => {
    expect(summarise(report({ topFails: [] })).topOpportunities).toEqual([]);
  });

  it("serialises to JSON, which is what the handler actually returns", () => {
    const text = JSON.stringify(summarise(report()), null, 2);
    const parsed = JSON.parse(text);
    expect(parsed.url).toBe("https://shop.test/");
    expect(Array.isArray(parsed.categories)).toBe(true);
  });
});
