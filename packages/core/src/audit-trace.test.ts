import { describe, it, expect } from "vitest";
import { traceFromCheck, outcomeOf, formatTrace } from "./audit-trace";
import { TAG_SCAN_ERROR, TAG_SKIPPED_PAGE_TYPE } from "./constants";
import type { CheckResult } from "./types";

/**
 * The trace record.
 *
 * Its whole purpose is to be diffable across runs, so the fields it carries
 * and the fields it omits both matter: an `undefined` where a value used to be
 * reads as a change when nothing changed.
 */

function check(over: Partial<CheckResult> = {}): CheckResult {
  return {
    id: "structured-data/json-ld-present",
    category: "structured-data",
    title: "JSON-LD present",
    description: "d",
    status: "pass",
    score: 1,
    weight: 1,
    scoreDisplayMode: "binary",
    priority: "medium",
    impact: "",
    fix: "",
    ...over,
  };
}

describe("outcomeOf", () => {
  it("reads an ordinary check as ran", () => {
    expect(outcomeOf(check())).toBe("ran");
  });

  it("reads a scan-error stub as an error", () => {
    expect(outcomeOf(check({ status: "na", tags: [TAG_SCAN_ERROR] }))).toBe(
      "error",
    );
  });

  it("reads a page-type stub as skipped", () => {
    expect(
      outcomeOf(check({ status: "na", tags: [TAG_SKIPPED_PAGE_TYPE] })),
    ).toBe("skipped");
  });

  // An audit that ran and concluded "nothing to assess" is not the same as one
  // that never ran, and a trace that conflated them would hide the second.
  it("reads a plain not-applicable as ran, not skipped", () => {
    expect(outcomeOf(check({ status: "na" }))).toBe("ran");
  });
});

describe("traceFromCheck", () => {
  it("carries the verdict and what it contributed", () => {
    const trace = traceFromCheck(
      check({ status: "fail", score: 0, weight: 0.6 }),
      12,
    );
    expect(trace).toMatchObject({
      id: "structured-data/json-ld-present",
      category: "structured-data",
      outcome: "ran",
      status: "fail",
      score: 0,
      weight: 0.6,
      durationMs: 12,
    });
  });

  it("defaults a missing weight to zero rather than leaving it undefined", () => {
    expect(traceFromCheck(check({ weight: undefined }), 1).weight).toBe(0);
  });

  // Omitted, not emitted as undefined: a diff of two runs should show only the
  // fields that actually differ.
  it("omits optional fields the check does not carry", () => {
    const trace = traceFromCheck(check(), 1);
    expect(Object.hasOwn(trace, "displayValue")).toBe(false);
    expect(Object.hasOwn(trace, "pageUrl")).toBe(false);
    expect(Object.hasOwn(trace, "details")).toBe(false);
    expect(JSON.stringify(trace)).not.toContain("undefined");
  });

  it("carries the evidence the verdict was drawn from", () => {
    const trace = traceFromCheck(
      check({
        displayValue: "3 schema block(s)",
        explanation: "Three JSON-LD blocks parsed.",
        pageUrl: "https://shop.test/",
        details: { expected: "at least one", found: "3" },
        tier: "scored",
        evidenceGrade: "A",
      }),
      7,
    );
    expect(trace).toMatchObject({
      displayValue: "3 schema block(s)",
      pageUrl: "https://shop.test/",
      tier: "scored",
      evidenceGrade: "A",
      details: { expected: "at least one", found: "3" },
    });
  });

  it("serialises to one NDJSON line", () => {
    const line = JSON.stringify(traceFromCheck(check(), 1));
    expect(line).not.toContain("\n");
    expect(JSON.parse(line).id).toBe("structured-data/json-ld-present");
  });
});

describe("formatTrace", () => {
  it("names the audit, the outcome and the verdict", () => {
    const line = formatTrace(
      traceFromCheck(check({ status: "fail", score: 0 }), 12),
    );
    expect(line).toContain("structured-data/json-ld-present");
    expect(line).toContain("ran/fail");
    expect(line).toContain("12ms");
  });

  // A skipped audit's zero is not a measurement, so printing it as one would
  // put 214 fictional "0ms" timings in the log.
  it("leaves the timing off an audit that never ran", () => {
    const line = formatTrace(
      traceFromCheck(check({ status: "na", tags: [TAG_SKIPPED_PAGE_TYPE] }), 0),
    );
    expect(line).toContain("skipped/na");
    expect(line).not.toContain("0ms");
  });

  it("appends the display value when there is one", () => {
    expect(
      formatTrace(traceFromCheck(check({ displayValue: "3 blocks" }), 1)),
    ).toContain("3 blocks");
  });
});
