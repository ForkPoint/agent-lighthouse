import type { ScanConfig } from '../audit-config';
import type { AuditPlan } from '../audit-runner';

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
