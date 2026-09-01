import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { auditList } from './lib/registry';
import { PAGEFIND_URL } from './islands/search';

/**
 * The search index, as the build actually produces it.
 *
 * Pagefind indexes built HTML, so there is nothing to assert until `pnpm build`
 * has run — and it cannot be rendered in-process here, for the reason
 * `layouts/chrome.test.ts` sets out: Astro 7 needs Vite 8 and Vitest 2.1 pins
 * Vite 5. These run against the artefact the build gate already produces and
 * are skipped on a checkout that has never been built.
 *
 * What they are for: the `data-pagefind-body` regions are the whole contract
 * between the pages and the search dialog, and it is a silent one. A page that
 * loses its region does not fail to build and does not look wrong — it simply
 * stops being findable. Pagefind is explicit that once *any* page declares a
 * body, every page without one is dropped from the index, so "all 239 declare
 * exactly one" is the invariant, and it is asserted rather than assumed.
 */
const DIST = resolve(__dirname, '../dist');
const FRAGMENTS = resolve(DIST, 'pagefind/fragment');

/** Every built page, as `{ route, html }`. */
function builtPages(dir = DIST, route = '/'): Array<{ route: string; html: string }> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      // `pagefind/` is Pagefind's own output, not a page of this site.
      return entry.name === 'pagefind' ? [] : builtPages(resolve(dir, entry.name), `${route}${entry.name}/`);
    }
    if (entry.name !== 'index.html') return [];
    return [{ route, html: readFileSync(resolve(dir, entry.name), 'utf8') }];
  });
}

/**
 * One Pagefind fragment — the record it keeps per page.
 *
 * The files are gzipped JSON behind a short `pagefind_dcd` marker, so reading
 * them is the only way to see what was really indexed; grepping the directory
 * proves nothing either way.
 */
interface Fragment {
  url: string;
  content: string;
  word_count: number;
  meta: { title?: string };
  filters: Record<string, string[]>;
}

function fragments(): Fragment[] {
  return readdirSync(FRAGMENTS).map((file) => {
    const text = gunzipSync(readFileSync(resolve(FRAGMENTS, file))).toString('utf8');
    return JSON.parse(text.slice(text.indexOf('{'))) as Fragment;
  });
}

const built = existsSync(FRAGMENTS);
describe.skipIf(!built)('the built search index', () => {
  it('ships the module the dialog imports, at the path it imports it from', () => {
    // `PAGEFIND_URL` is a base-pathed url; `dist/` is the site root under it.
    expect(existsSync(resolve(DIST, PAGEFIND_URL.replace('/agent-lighthouse/', '')))).toBe(true);
  });

  it('gives every built page exactly one indexed region', () => {
    const pages = builtPages();
    expect(pages).toHaveLength(auditList().length + 24);
    for (const page of pages) {
      const declared = page.html.match(/data-pagefind-body/g) ?? [];
      expect(declared, `${page.route} declares ${declared.length} search bodies`).toHaveLength(1);
    }
  });

  it('indexes every page, and titles all of them', () => {
    const all = fragments();
    expect(all).toHaveLength(builtPages().length);
    expect(all.filter((fragment) => !fragment.meta.title)).toEqual([]);
  });

  it('indexes a dossier’s prose and its id, which its prose never mentions', () => {
    const dossier = fragments().find((fragment) =>
      fragment.url.endsWith('/audits/agentic-commerce/offer-truth-consistency/'),
    );
    expect(dossier).toBeDefined();
    expect(dossier!.meta.title).toBe('Offer Truth Consistency');
    // A phrase that appears in this dossier's body and nowhere else on the site.
    expect(dossier!.content).toContain('Hunts for internal contradictions');
    // The id is printed by the badge strip above the article, which is why the
    // indexed region is the content column and not the `<article>` alone.
    expect(dossier!.content).toContain('agentic-commerce/offer-truth-consistency');
    expect(dossier!.filters['category']).toEqual(['Agentic Commerce']);
    expect(dossier!.filters['grade']).toEqual(['B']);
  });

  it('keeps the chrome around a dossier out of the index', () => {
    const dossier = fragments().find((fragment) => fragment.url.includes('offer-truth-consistency'))!;

    // The sidebar lists every sibling audit in the category; the contents rail
    // repeats the headings; prev/next names the two neighbours. Indexed, each
    // would make a dossier a match for its neighbours' names.
    expect(dossier.content).not.toContain('Previous');
    expect(dossier.content).not.toContain('Browse audits and page contents');
    expect(dossier.content).not.toContain('On this page');
    // Header and footer, repeated on all 238 pages.
    expect(dossier.content).not.toContain('Source on GitHub');
    expect(dossier.content).not.toContain('Search this site');
  });

  it('keeps a listing page out of its own listings', () => {
    const byUrl = new Map(fragments().map((fragment) => [fragment.url, fragment]));
    const audits = byUrl.get('/audits/')!;

    // `/audits/` prints all 215 cards. Indexing them would put this page in the
    // results for every query the site can answer; it is indexed for what it is.
    expect(audits.meta.title).toBe('Audits');
    expect(audits.content).not.toContain('Offer Truth Consistency');
    expect(audits.word_count).toBeLessThan(60);
    expect(byUrl.get('/categories/agentic-commerce/')!.content).not.toContain('Offer Truth Consistency');
  });

  it('indexes the source registry page, and none of its 715 records', () => {
    // Deliberate, and said out loud in the dialog: `/sources/` fetches the
    // registry in the browser, so the built HTML holds the page's prose and not
    // the records. The page is findable; a search for a single source is not
    // answered here, and the dialog links the page that does answer it.
    const sources = fragments().find((fragment) => fragment.url === '/sources/')!;

    expect(sources.content).toContain('715 sources');
    expect(sources.content).not.toContain('Agentic Commerce Protocol');
  });
});
