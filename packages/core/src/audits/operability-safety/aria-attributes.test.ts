import { describe, it, expect } from "vitest";
import { AriaAttributesAudit } from "./aria-attributes";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";

describe("AriaAttributesAudit", () => {
  it("registers under the aria-attributes id with its dossier and grade", () => {
    expect(AriaAttributesAudit.meta.id).toBe(
      "operability-safety/aria-attributes",
    );
    expect(AriaAttributesAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/aria-attributes.md",
    );
    expect(AriaAttributesAudit.meta.evidenceGrade).toBe("A");
    expect(AriaAttributesAudit.meta.tier).toBe("scored");
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": { status: "pass", nodes: [] },
        "aria-valid-attr-value": { status: "pass", nodes: [] },
        "aria-allowed-attr": { status: "pass", nodes: [] },
        "aria-prohibited-attr": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaAttributesAudit, ctx);
    expect(result.expected).toBe(
      "accessibility rules pass: aria-valid-attr, aria-valid-attr-value, aria-allowed-attr, aria-prohibited-attr",
    );
  });

  it("fails when the `aria-valid-attr` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "aria-valid-attr-value": { status: "pass", nodes: [] },
        "aria-allowed-attr": { status: "pass", nodes: [] },
        "aria-prohibited-attr": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaAttributesAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("fails when the `aria-valid-attr-value` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": { status: "pass", nodes: [] },
        "aria-valid-attr-value": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "aria-allowed-attr": { status: "pass", nodes: [] },
        "aria-prohibited-attr": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaAttributesAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("fails when the `aria-allowed-attr` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": { status: "pass", nodes: [] },
        "aria-valid-attr-value": { status: "pass", nodes: [] },
        "aria-allowed-attr": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "aria-prohibited-attr": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaAttributesAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("fails when the `aria-prohibited-attr` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": { status: "pass", nodes: [] },
        "aria-valid-attr-value": { status: "pass", nodes: [] },
        "aria-allowed-attr": { status: "pass", nodes: [] },
        "aria-prohibited-attr": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(AriaAttributesAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": { status: "pass", nodes: [] },
        "aria-valid-attr-value": { status: "pass", nodes: [] },
        "aria-allowed-attr": { status: "pass", nodes: [] },
        "aria-prohibited-attr": { status: "pass", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AriaAttributesAudit, ctx).status).toBe("pass");
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": { status: "inapplicable", nodes: [] },
        "aria-valid-attr-value": { status: "inapplicable", nodes: [] },
        "aria-allowed-attr": { status: "inapplicable", nodes: [] },
        "aria-prohibited-attr": { status: "inapplicable", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AriaAttributesAudit, ctx).status).toBe("na");
  });
});
