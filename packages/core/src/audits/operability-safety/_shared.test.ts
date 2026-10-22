import { describe, it, expect } from "vitest";
import { mockCheckContext } from "#core/__tests__/test-utils";
import { defaultConfig } from "#core/audit-config";
import { CheckPriority, CheckStatus, EvidenceGrade } from "#core/types";
import type { AuditResult } from "#core/types";
import { base, defineA11yAudit, graded } from "./_shared";
import { pageWithA11y, runA11yAudit } from "./_test-utils";
import { RuleStatus } from "./engine/rules";

/**
 * Up to 9.1.0 the CommonJS bundle gave every audit made by `defineA11yAudit`
 * the rules of the last one defined (see the comment in `defineA11yAudit`).
 * These tests pin the contract at the source; `scripts/packages/check-bundle-parity.mjs`
 * pins it in the built bundles, where the bug lived.
 */
describe("defineA11yAudit", () => {
  function define(slug: string, rules: string[]) {
    return defineA11yAudit({
      rules,
      meta: {
        ...base,
        ...graded(EvidenceGrade.C, slug),
        id: `operability-safety/${slug}`,
        title: slug,
        failureTitle: slug,
        description: slug,
        defaultPriority: CheckPriority.Low,
      },
    });
  }

  it("keeps each defined audit's own rule set after a later definition", () => {
    // Real rule ids, so the shared A11Y_RULES list gains nothing new.
    const First = define("first-test-audit", ["tabindex"]);
    const Second = define("second-test-audit", ["meta-refresh"]);

    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        tabindex: {
          status: RuleStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "meta-refresh": { status: RuleStatus.Pass, nodes: [] },
      }),
    ]);

    // Both constructed after both definitions, as the registry does.
    const first = runA11yAudit(First, ctx);
    const second = runA11yAudit(Second, ctx);
    expect(first.expected).toBe("accessibility rules pass: tabindex");
    expect(first.status).toBe(CheckStatus.Fail);
    expect(second.expected).toBe("accessibility rules pass: meta-refresh");
    expect(second.status).toBe(CheckStatus.Pass);
  });

  it("gives every registered a11y audit a distinct rule set", () => {
    const ctx = mockCheckContext([]);
    const expectedByAudit = new Map<string, string>();
    for (const reg of defaultConfig.audits["operability-safety"] ?? []) {
      const audit = reg.create();
      // Only the engine-backed audits carry a rule list.
      if (!("rules" in audit)) continue;
      const result = audit.audit(ctx) as AuditResult;
      expectedByAudit.set(reg.meta.id, result.expected ?? "");
    }
    expect(expectedByAudit.size).toBe(17);
    expect(new Set(expectedByAudit.values()).size).toBe(expectedByAudit.size);
  });
});
