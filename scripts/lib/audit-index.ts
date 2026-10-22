/** Fields for the central audit index, read from audit metadata. */
import type { AuditMeta } from "#core/types";
import { auditPageTypes } from "#core/audit-applicability";
import { AuditTier } from "#core/types";

export function auditIndexFields(meta: AuditMeta) {
  if (!meta.description.trim() || !meta.tier || !meta.evidenceGrade) {
    throw new Error(`Incomplete audit metadata: ${meta.id}`);
  }
  const pageTypes = auditPageTypes(meta) ?? [];
  return {
    purpose: meta.description,
    features: [...new Set(meta.guidance?.tags ?? [])].sort(),
    priority: meta.defaultPriority,
    enabledByDefault: meta.tier !== AuditTier.Experimental,
    applicability: {
      pageTypeGate: pageTypes.length
        ? ("restricted" as const)
        : ("unrestricted" as const),
      pageTypes,
    },
    source: `packages/core/src/audits/${meta.id}.ts`,
    test: `packages/core/src/audits/${meta.id}.test.ts`,
  };
}
