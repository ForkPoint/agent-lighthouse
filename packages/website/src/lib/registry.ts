import {
  defaultConfig,
  CATEGORY_NAMES,
} from "@forkpoint/agent-lighthouse-core";

export interface AuditRecord {
  id: string;
  category: string;
  categoryTitle: string;
  title: string;
  description: string;
  evidenceGrade: string;
  tier: string;
  weight: number;
  priority: string;
  tags: string[];
}

/**
 * One record of `/audits-data.json`.
 *
 * A superset of `AuditRecord`: the endpoint replaces the file the v1 site
 * shipped, so it keeps every field that file carried (`scripts/build-docs-data.ts`
 * still generates it today). The extra fields live here rather than on
 * `AuditRecord` because the site's own pages never render them — keeping them
 * off `AuditRecord` leaves the type the explorer consumes honest.
 */
export interface AuditDataRecord extends AuditRecord {
  failureTitle: string;
  scoreDisplayMode: string;
  /** Repo-relative path to the dossier that proves the audit. */
  dossier: string;
  applicablePageTypes?: string[];
  guidance?: {
    impact: string;
    fix: string;
    code?: string;
    effort: string;
    docsUrl?: string;
    tags?: string[];
  };
}

export interface CategoryRecord {
  id: string;
  name: string;
  count: number;
}

/**
 * Order by category slug, then audit slug — the order the v1 `audits-data.json`
 * was written in. Comparing the two halves separately rather than the whole id
 * keeps the order stable if a category slug ever becomes a prefix of another.
 */
function byCategoryThenSlug(a: { id: string }, b: { id: string }): number {
  const [aCategory = "", aSlug = ""] = a.id.split("/");
  const [bCategory = "", bSlug = ""] = b.id.split("/");
  return aCategory.localeCompare(bCategory) || aSlug.localeCompare(bSlug);
}

/** Every registered audit, flattened, sorted by id. */
export function auditList(): AuditRecord[] {
  const out: AuditRecord[] = [];
  for (const registrations of Object.values(defaultConfig.audits)) {
    for (const reg of registrations) {
      const meta = reg.meta;
      out.push({
        id: meta.id,
        category: meta.category,
        categoryTitle: CATEGORY_NAMES[meta.category] ?? meta.category,
        title: meta.title,
        description: meta.description,
        evidenceGrade: meta.evidenceGrade ?? "D",
        tier: meta.tier ?? "scored",
        weight: meta.weight,
        priority: meta.defaultPriority ?? "medium",
        tags: meta.guidance?.tags ?? [],
      });
    }
  }
  return out.sort(byCategoryThenSlug);
}

/** The same audits with the fields only `/audits-data.json` publishes. */
export function auditDataList(): AuditDataRecord[] {
  const metaById = new Map(
    Object.values(defaultConfig.audits)
      .flat()
      .map((reg) => [reg.meta.id, reg.meta] as const),
  );
  return auditList().map((audit) => {
    const meta = metaById.get(audit.id)!;
    return {
      ...audit,
      failureTitle: meta.failureTitle || meta.title,
      scoreDisplayMode: meta.scoreDisplayMode,
      dossier: meta.dossier ?? "",
      // Optional fields are omitted rather than emitted as undefined: the v1
      // file left them out entirely, and `JSON.stringify` would drop them anyway.
      ...(meta.applicablePageTypes
        ? { applicablePageTypes: meta.applicablePageTypes }
        : {}),
      ...(meta.guidance
        ? {
            guidance: {
              impact: meta.guidance.impact,
              fix: meta.guidance.fix,
              ...(meta.guidance.code ? { code: meta.guidance.code } : {}),
              effort: meta.guidance.effort,
              ...(meta.guidance.docsUrl
                ? { docsUrl: meta.guidance.docsUrl }
                : {}),
              ...(meta.guidance.tags ? { tags: meta.guidance.tags } : {}),
            },
          }
        : {}),
    };
  });
}

/** The eight categories in report order, with live counts. */
export function categoryList(): CategoryRecord[] {
  const audits = auditList();
  return defaultConfig.categories.map((category) => ({
    id: category.id,
    name: CATEGORY_NAMES[category.id] ?? category.id,
    count: audits.filter((audit) => audit.category === category.id).length,
  }));
}
