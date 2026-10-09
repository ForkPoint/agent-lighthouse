import type { AuditMeta, PageType } from "./types";

/** One interpretation of both public metadata spellings, including empty arrays. */
export function auditPageTypes(meta: AuditMeta): PageType[] | undefined {
  const canonical = meta.applicablePageTypes;
  const legacy = meta.pageTypes;
  if (canonical !== undefined && legacy !== undefined) {
    const a = new Set(canonical);
    const b = new Set(legacy);
    if (a.size !== b.size || [...a].some((type) => !b.has(type))) {
      throw new Error(
        `Conflicting page types for audit ${meta.id}: pageTypes and applicablePageTypes must name the same set.`,
      );
    }
  }
  const types = canonical ?? legacy;
  return types === undefined ? undefined : [...new Set(types)].sort();
}

/** Clone public metadata at the runner boundary; never mutate caller config. */
export function normalizeAuditMeta(meta: AuditMeta): AuditMeta {
  const applicablePageTypes = auditPageTypes(meta);
  const { pageTypes: _legacy, ...rest } = meta;
  return {
    ...rest,
    ...(applicablePageTypes === undefined ? {} : { applicablePageTypes }),
  };
}
