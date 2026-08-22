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

// Sort audits by slug ID (e.g. `structured-data/faqpage-schema`): category
// slug first, then the audit slug, both compared as text. The v1 ids were
// numeric (`3.2`) and sorted numerically; v2 ids are slugs, so a numeric parse
// yields NaN for every id and leaves the list in registry order.
auditList.sort((a, b) => {
  const [aCat = '', aName = ''] = String(a.id).split('/');
  const [bCat = '', bName = ''] = String(b.id).split('/');
  return aCat.localeCompare(bCat) || aName.localeCompare(bName);
});

const outPath = path.resolve(__dirname, '../packages/website/audits-data.json');
fs.writeFileSync(outPath, JSON.stringify(auditList, null, 2));

console.log(`Extracted metadata for ${auditList.length} audits to ${outPath}`);
