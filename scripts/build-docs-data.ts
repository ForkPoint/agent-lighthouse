import * as fs from 'node:fs';
import * as path from 'node:path';
import { defaultConfig, CATEGORY_NAMES } from '../packages/core/src';

/** One record in the website's audit explorer. */
export interface AuditDoc {
  id: string;
  category: string;
  categoryTitle: string;
  title: string;
  failureTitle: string;
  description: string;
  scoreDisplayMode: string;
  weight: number;
  priority: string;
  /** Scoring participation: scored / informative / experimental. */
  tier: string;
  /** Evidence strength from the audit's dossier. */
  evidenceGrade: string;
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

/**
 * Build the explorer's records straight from the live registry.
 *
 * Exported so a test can assert the shape against the registry rather than
 * against a checked-in snapshot that silently ages.
 */
export function buildAuditList(): AuditDoc[] {
  const auditList: AuditDoc[] = [];

  for (const registrations of Object.values(defaultConfig.audits)) {
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
        tier: meta.tier ?? 'scored',
        evidenceGrade: meta.evidenceGrade ?? 'D',
        dossier: meta.dossier ?? '',
        ...(meta.applicablePageTypes ? { applicablePageTypes: meta.applicablePageTypes } : {}),
        ...(meta.guidance
          ? {
              guidance: {
                impact: meta.guidance.impact,
                fix: meta.guidance.fix,
                ...(meta.guidance.code ? { code: meta.guidance.code } : {}),
                effort: meta.guidance.effort,
                ...(meta.guidance.docsUrl ? { docsUrl: meta.guidance.docsUrl } : {}),
                ...(meta.guidance.tags ? { tags: meta.guidance.tags } : {}),
              },
            }
          : {}),
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

  return auditList;
}

/** The category pills, in canonical report order, with their live counts. */
export function buildCategoryPills(audits: AuditDoc[]): Array<{ id: string; name: string; count: number }> {
  const order = defaultConfig.categories.map((c) => c.id);
  return order.map((id) => ({
    id,
    name: CATEGORY_NAMES[id] ?? id,
    count: audits.filter((a) => a.category === id).length,
  }));
}

const EMBED_START = '  window.EMBEDDED_AUDITS = [';
const EMBED_END = '\n];';
const PILLS_START = '<div class="flex flex-wrap gap-1.5" id="category-filter-pills">';
const PILLS_END = '</div>';

/**
 * Replace the page's embedded audit array and its category pills.
 *
 * The page ships a copy of the data inline and only falls back to fetching
 * audits-data.json when that copy is empty, so regenerating the JSON alone
 * leaves the explorer showing whatever the inline array last held.
 */
export function renderIndexHtml(html: string, audits: AuditDoc[]): string {
  const embedStart = html.indexOf(EMBED_START);
  if (embedStart === -1) throw new Error('EMBEDDED_AUDITS block not found in index.html');
  const embedEnd = html.indexOf(EMBED_END, embedStart);
  if (embedEnd === -1) throw new Error('EMBEDDED_AUDITS terminator not found in index.html');

  // Guidance snippets contain literal HTML: `</script>`, `<script>` and `<!--`.
  // Inside a <script> block the HTML parser acts on all three — a closing tag
  // ends the script early, and `<!--` followed by `<script` puts the parser in
  // the double-escaped state where the real closing tag stops being one. Either
  // way every function defined below the array quietly disappears, with no
  // console error to show for it. Escaping every `<` as \u003c is inert to
  // JSON.parse and invisible to the HTML parser.
  const json = JSON.stringify(audits, null, 2).replace(/</g, '\\u003c');
  const embedded = `  window.EMBEDDED_AUDITS = ${json};`;
  let out = html.slice(0, embedStart) + embedded + html.slice(embedEnd + EMBED_END.length);

  const pillsStart = out.indexOf(PILLS_START);
  if (pillsStart === -1) throw new Error('category-filter-pills block not found in index.html');
  const pillsEnd = out.indexOf(PILLS_END, pillsStart + PILLS_START.length);
  if (pillsEnd === -1) throw new Error('category-filter-pills terminator not found in index.html');

  const active =
    'cat-pill active text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white transition-colors';
  const idle =
    'cat-pill text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors';
  const pills = [
    `\n              <button onclick="setCategoryFilter('all')" class="${active}" data-cat="all">All (${audits.length})</button>`,
    ...buildCategoryPills(audits).map(
      (cat) =>
        `\n              <button onclick="setCategoryFilter('${cat.id}')" class="${idle}" data-cat="${cat.id}">${cat.name} (${cat.count})</button>`,
    ),
    '\n            ',
  ].join('');

  out = out.slice(0, pillsStart + PILLS_START.length) + pills + out.slice(pillsEnd);

  // Static copy that quotes the registry size. The v1 page advertised 207.
  out = out.replace(/\b207\b/g, String(audits.length));
  out = out.replace(/207-audit/g, `${audits.length}-audit`);
  out = out.replace(/\(10 categories\)/g, `(${defaultConfig.categories.length} categories)`);
  // The hero's category counter, which the v1 page hard-coded at 10.
  out = out.replace(
    /(<div class="text-2xl font-extrabold text-indigo-400">)\d+(<\/div>\s*<div class="text-xs text-slate-400 mt-0\.5">Audit Categories<\/div>)/,
    `$1${defaultConfig.categories.length}$2`,
  );

  return out;
}

function main(): void {
  const audits = buildAuditList();

  const jsonPath = path.resolve(__dirname, '../packages/website/audits-data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(audits, null, 2));

  const htmlPath = path.resolve(__dirname, '../packages/website/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  fs.writeFileSync(htmlPath, renderIndexHtml(html, audits));

  console.log(`Extracted metadata for ${audits.length} audits to ${jsonPath}`);
  console.log(`Refreshed the embedded audit array and category pills in ${htmlPath}`);
}

if (require.main === module) {
  main();
}
