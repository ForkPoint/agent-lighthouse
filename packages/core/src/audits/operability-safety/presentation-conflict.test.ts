import { describe, it, expect } from "vitest";
import { PresentationConflictAudit } from "./presentation-conflict";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";

describe("PresentationConflictAudit", () => {
  it("registers under the presentation-conflict id with its dossier and grade", () => {
    expect(PresentationConflictAudit.meta.id).toBe(
      "operability-safety/presentation-conflict",
    );
    expect(PresentationConflictAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/presentation-conflict.md",
    );
    expect(PresentationConflictAudit.meta.evidenceGrade).toBe("A");
    expect(PresentationConflictAudit.meta.tier).toBe("scored");
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "presentation-role-conflict": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(PresentationConflictAudit, ctx);
    expect(result.expected).toBe(
      "accessibility rules pass: presentation-role-conflict",
    );
  });

  it("fails when the `presentation-role-conflict` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "presentation-role-conflict": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(PresentationConflictAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "presentation-role-conflict": { status: "pass", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(PresentationConflictAudit, ctx).status).toBe("pass");
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "presentation-role-conflict": { status: "inapplicable", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(PresentationConflictAudit, ctx).status).toBe("na");
  });
});
