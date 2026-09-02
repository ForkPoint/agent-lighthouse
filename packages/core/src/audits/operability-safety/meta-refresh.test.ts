import { describe, it, expect } from "vitest";
import { MetaRefreshAudit } from "./meta-refresh";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";

describe("MetaRefreshAudit", () => {
  it("registers under the meta-refresh id with its dossier and grade", () => {
    expect(MetaRefreshAudit.meta.id).toBe("operability-safety/meta-refresh");
    expect(MetaRefreshAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/meta-refresh.md",
    );
    expect(MetaRefreshAudit.meta.evidenceGrade).toBe("A");
    expect(MetaRefreshAudit.meta.tier).toBe("scored");
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "meta-refresh": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(MetaRefreshAudit, ctx);
    expect(result.expected).toBe("accessibility rules pass: meta-refresh");
  });

  it("fails when the `meta-refresh` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "meta-refresh": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(MetaRefreshAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "meta-refresh": { status: "pass", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(MetaRefreshAudit, ctx).status).toBe("pass");
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "meta-refresh": { status: "inapplicable", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(MetaRefreshAudit, ctx).status).toBe("na");
  });
});
