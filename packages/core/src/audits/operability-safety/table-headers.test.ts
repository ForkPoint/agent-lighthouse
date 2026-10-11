import { describe, it, expect } from "vitest";
import { TableHeadersAudit } from "./table-headers";
import { mockCheckContext } from "#core/__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";
import { AuditTier, CheckStatus, EvidenceGrade } from "#core/types";
import { RuleStatus } from "./engine/rules";

describe("TableHeadersAudit", () => {
  it("registers under the table-headers id with its dossier and grade", () => {
    expect(TableHeadersAudit.meta.id).toBe("operability-safety/table-headers");
    expect(TableHeadersAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/table-headers.md",
    );
    expect(TableHeadersAudit.meta.evidenceGrade).toBe(EvidenceGrade.B);
    expect(TableHeadersAudit.meta.tier).toBe(AuditTier.Scored);
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: CheckStatus.Pass, nodes: [] },
        "th-has-data-cells": { status: CheckStatus.Pass, nodes: [] },
        "td-headers-attr": { status: CheckStatus.Pass, nodes: [] },
        "scope-attr-valid": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(TableHeadersAudit, ctx);
    expect(result.expected).toBe(
      "accessibility rules pass: td-has-header, th-has-data-cells, td-headers-attr, scope-attr-valid",
    );
  });

  it("fails when the `td-has-header` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "th-has-data-cells": { status: CheckStatus.Pass, nodes: [] },
        "td-headers-attr": { status: CheckStatus.Pass, nodes: [] },
        "scope-attr-valid": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(TableHeadersAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("fails when the `th-has-data-cells` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: CheckStatus.Pass, nodes: [] },
        "th-has-data-cells": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "td-headers-attr": { status: CheckStatus.Pass, nodes: [] },
        "scope-attr-valid": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(TableHeadersAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("fails when the `td-headers-attr` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: CheckStatus.Pass, nodes: [] },
        "th-has-data-cells": { status: CheckStatus.Pass, nodes: [] },
        "td-headers-attr": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "scope-attr-valid": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(TableHeadersAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("fails when the `scope-attr-valid` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: CheckStatus.Pass, nodes: [] },
        "th-has-data-cells": { status: CheckStatus.Pass, nodes: [] },
        "td-headers-attr": { status: CheckStatus.Pass, nodes: [] },
        "scope-attr-valid": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(TableHeadersAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: CheckStatus.Pass, nodes: [] },
        "th-has-data-cells": { status: CheckStatus.Pass, nodes: [] },
        "td-headers-attr": { status: CheckStatus.Pass, nodes: [] },
        "scope-attr-valid": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(TableHeadersAudit, ctx).status).toBe(CheckStatus.Pass);
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: RuleStatus.Inapplicable, nodes: [] },
        "th-has-data-cells": { status: RuleStatus.Inapplicable, nodes: [] },
        "td-headers-attr": { status: RuleStatus.Inapplicable, nodes: [] },
        "scope-attr-valid": { status: RuleStatus.Inapplicable, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(TableHeadersAudit, ctx).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  // Ported from the former _a11y.test.ts (aggregation cases).
  it("returns na when every constituent rule is inapplicable / unseen", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: RuleStatus.Inapplicable, nodes: [] },
        "th-has-data-cells": { status: RuleStatus.Inapplicable, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(TableHeadersAudit, ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });
});
