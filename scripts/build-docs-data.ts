import * as fs from 'node:fs';
import * as path from 'node:path';
import { defaultConfig, CATEGORY_NAMES } from '../packages/core/src';

const auditList: any[] = [];

for (const [categoryId, registrations] of Object.entries(defaultConfig.audits)) {
  for (const reg of registrations) {
    const meta = reg.meta;
    auditList.push({
      id: meta.id,
      category: meta.category,
      categoryTitle: CATEGORY_NAMES[meta.category] || meta.category,
      title: meta.title,
      failureTitle: meta.failureTitle || meta.title,
      description: meta.description,
      scoreDisplayMode: meta.scoreDisplayMode,
      weight: meta.weight,
      priority: meta.defaultPriority || 'medium',
      applicablePageTypes: meta.applicablePageTypes,
      guidance: meta.guidance ? {
        impact: meta.guidance.impact,
        fix: meta.guidance.fix,
        code: meta.guidance.code,
        effort: meta.guidance.effort,
        docsUrl: meta.guidance.docsUrl,
        tags: meta.guidance.tags,
      } : undefined,
    });
  }
}

// Sort audits naturally by ID (e.g. 1.1, 1.2, ... 10.15)
auditList.sort((a, b) => {
  const [aCat, aNum] = a.id.split('.').map(Number);
  const [bCat, bNum] = b.id.split('.').map(Number);
  if (aCat !== bCat) return aCat - bCat;
  return aNum - bNum;
});

const outPath = path.resolve(__dirname, '../packages/website/audits-data.json');
fs.writeFileSync(outPath, JSON.stringify(auditList, null, 2));

console.log(`Extracted metadata for ${auditList.length} audits to ${outPath}`);
