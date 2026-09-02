import { describe, it, expect } from "vitest";
import { AccessibleNamesAudit } from "./accessible-names";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";

describe("AccessibleNamesAudit", () => {
  it("registers under the accessible-names id with its dossier and grade", () => {
    expect(AccessibleNamesAudit.meta.id).toBe(
      "operability-safety/accessible-names",
    );
    expect(AccessibleNamesAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/accessible-names.md",
    );
    expect(AccessibleNamesAudit.meta.evidenceGrade).toBe("A");
    expect(AccessibleNamesAudit.meta.tier).toBe("scored");
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "button-name": { status: "pass", nodes: [] },
        "link-name": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AccessibleNamesAudit, ctx);
    expect(result.expected).toBe(
      "accessibility rules pass: button-name, link-name",
    );
  });

  it("fails when the `button-name` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "button-name": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "link-name": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AccessibleNamesAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("fails when the `link-name` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "button-name": { status: "pass", nodes: [] },
        "link-name": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(AccessibleNamesAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "button-name": { status: "pass", nodes: [] },
        "link-name": { status: "pass", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AccessibleNamesAudit, ctx).status).toBe("pass");
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "button-name": { status: "inapplicable", nodes: [] },
        "link-name": { status: "inapplicable", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AccessibleNamesAudit, ctx).status).toBe("na");
  });
});
