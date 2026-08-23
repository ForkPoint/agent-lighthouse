import { defaultConfig, CATEGORY_NAMES } from '@forkpoint/agent-lighthouse-core';

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

export interface CategoryRecord {
  id: string;
  name: string;
  count: number;
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
        evidenceGrade: meta.evidenceGrade ?? 'D',
        tier: meta.tier ?? 'scored',
        weight: meta.weight,
        priority: meta.defaultPriority ?? 'medium',
        tags: meta.guidance?.tags ?? [],
      });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
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
