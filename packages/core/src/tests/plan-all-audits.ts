import type { ScanConfig } from "#core/audit-config";
import type { AuditPlan } from "#core/audit-runner";

/** Test-only registry view. Production planning must never bypass its gates. */
export function planAllAuditsForTest(config: ScanConfig): AuditPlan {
  return {
    runnable: config.categories.flatMap((category) =>
      (config.audits[category.id] ?? []).map((reg) => ({
        reg,
        categoryId: category.id,
      })),
    ),
    skipped: [],
  };
}
