import { describe, it, expect } from "vitest";
import { AriaHiddenBodyAudit } from "./aria-hidden-body";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";

describe("AriaHiddenBodyAudit", () => {
  it("registers under the aria-hidden-body id with its dossier and grade", () => {
    expect(AriaHiddenBodyAudit.meta.id).toBe(
      "operability-safety/aria-hidden-body",
    );
    expect(AriaHiddenBodyAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/aria-hidden-body.md",
    );
    expect(AriaHiddenBodyAudit.meta.evidenceGrade).toBe("A");
    expect(AriaHiddenBodyAudit.meta.tier).toBe("scored");
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-hidden-body": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaHiddenBodyAudit, ctx);
    expect(result.expected).toBe("accessibility rules pass: aria-hidden-body");
  });

  it("fails when the `aria-hidden-body` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-hidden-body": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(AriaHiddenBodyAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-hidden-body": { status: "pass", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AriaHiddenBodyAudit, ctx).status).toBe("pass");
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-hidden-body": { status: "inapplicable", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AriaHiddenBodyAudit, ctx).status).toBe("na");
  });

  // Ported from the former _a11y.test.ts (aggregation cases).
  it("returns na when pages have no a11yResults at all", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", "<html></html>"),
    ]);
    const result = runA11yAudit(AriaHiddenBodyAudit, ctx);
    expect(result.status).toBe("na");
  });

  it("warns when a rule is incomplete and none pass or fail", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-hidden-body": { status: "incomplete", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaHiddenBodyAudit, ctx);
    expect(result.status).toBe("warn");
  });

  it("passes when a rule passes even when incomplete is also seen", () => {
    // sawIncomplete && !sawPass → false, so falls through to sawPass check
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-hidden-body": { status: "incomplete", nodes: [] },
      }),
      pageWithA11y("https://example.com/p", {
        "aria-hidden-body": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaHiddenBodyAudit, ctx);
    expect(result.status).toBe("pass");
  });
});
