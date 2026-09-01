import { describe, it, expect } from "vitest";
import { LabelAudit } from "./label";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";

describe("LabelAudit", () => {
  it("registers under the label id with its dossier and grade", () => {
    expect(LabelAudit.meta.id).toBe("operability-safety/label");
    expect(LabelAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/label.md",
    );
    expect(LabelAudit.meta.evidenceGrade).toBe("A");
    expect(LabelAudit.meta.tier).toBe("scored");
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        label: { status: "pass", nodes: [] },
        "select-name": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(LabelAudit, ctx);
    expect(result.expected).toBe(
      "accessibility rules pass: label, select-name",
    );
  });

  it("fails when the `label` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        label: {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "select-name": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(LabelAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("fails when the `select-name` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        label: { status: "pass", nodes: [] },
        "select-name": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(LabelAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        label: { status: "pass", nodes: [] },
        "select-name": { status: "pass", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(LabelAudit, ctx).status).toBe("pass");
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        label: { status: "inapplicable", nodes: [] },
        "select-name": { status: "inapplicable", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(LabelAudit, ctx).status).toBe("na");
  });
});
