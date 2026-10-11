import { describe, it, expect } from "vitest";
import { AriaAttributesAudit } from "./aria-attributes";
import { mockCheckContext } from "#core/__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";
import { AuditTier, CheckStatus, EvidenceGrade } from "#core/types";
import { RuleStatus } from "./engine/rules";

describe("AriaAttributesAudit", () => {
  it("registers under the aria-attributes id with its dossier and grade", () => {
    expect(AriaAttributesAudit.meta.id).toBe(
      "operability-safety/aria-attributes",
    );
    expect(AriaAttributesAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/aria-attributes.md",
    );
    expect(AriaAttributesAudit.meta.evidenceGrade).toBe(EvidenceGrade.A);
    expect(AriaAttributesAudit.meta.tier).toBe(AuditTier.Scored);
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": { status: CheckStatus.Pass, nodes: [] },
        "aria-valid-attr-value": { status: CheckStatus.Pass, nodes: [] },
        "aria-allowed-attr": { status: CheckStatus.Pass, nodes: [] },
        "aria-prohibited-attr": { status: CheckStatus.Pass, nodes: [] },
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
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "aria-valid-attr-value": { status: CheckStatus.Pass, nodes: [] },
        "aria-allowed-attr": { status: CheckStatus.Pass, nodes: [] },
        "aria-prohibited-attr": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaAttributesAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("fails when the `aria-valid-attr-value` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": { status: CheckStatus.Pass, nodes: [] },
        "aria-valid-attr-value": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "aria-allowed-attr": { status: CheckStatus.Pass, nodes: [] },
        "aria-prohibited-attr": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaAttributesAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("fails when the `aria-allowed-attr` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": { status: CheckStatus.Pass, nodes: [] },
        "aria-valid-attr-value": { status: CheckStatus.Pass, nodes: [] },
        "aria-allowed-attr": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "aria-prohibited-attr": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaAttributesAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("fails when the `aria-prohibited-attr` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": { status: CheckStatus.Pass, nodes: [] },
        "aria-valid-attr-value": { status: CheckStatus.Pass, nodes: [] },
        "aria-allowed-attr": { status: CheckStatus.Pass, nodes: [] },
        "aria-prohibited-attr": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(AriaAttributesAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": { status: CheckStatus.Pass, nodes: [] },
        "aria-valid-attr-value": { status: CheckStatus.Pass, nodes: [] },
        "aria-allowed-attr": { status: CheckStatus.Pass, nodes: [] },
        "aria-prohibited-attr": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AriaAttributesAudit, ctx).status).toBe(
      CheckStatus.Pass,
    );
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-valid-attr": { status: RuleStatus.Inapplicable, nodes: [] },
        "aria-valid-attr-value": { status: RuleStatus.Inapplicable, nodes: [] },
        "aria-allowed-attr": { status: RuleStatus.Inapplicable, nodes: [] },
        "aria-prohibited-attr": { status: RuleStatus.Inapplicable, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AriaAttributesAudit, ctx).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});
