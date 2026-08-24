import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditList, categoryList } from './lib/registry';
import { DOC_SECTIONS } from './lib/markdown-slice';
import {
  POLICY_FILE,
  readPolicySource,
  readSourceRegistry,
  readSourceRegistryRaw,
  sourceTypeCounts,
} from './lib/evidence';
import { docPath, withBase } from './lib/routes';

const DIST = resolve(__dirname, '../dist');

const page = (relative: string) => readFileSync(resolve(DIST, relative, 'index.html'), 'utf8');

/** A page's `<body>`, so a tag named in a `<head>` attribute is not counted. */
function body(html: string): string {
  const start = html.indexOf('<body');
  expect(start, 'page has no body').toBeGreaterThan(-1);
  return html.slice(start, html.lastIndexOf('</body>'));
}

/** The article, which is the only part of the policy page its markdown fills. */
function article(html: string): string {
  const start = html.indexOf('<article');
  expect(start, 'page has no article').toBeGreaterThan(-1);
  return html.slice(start, html.indexOf('</article>'));
}

/** The page as a reader sees it: tags out, one space between what they held. */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/**
 * These assert against `dist/` for the reason `layouts/chrome.test.ts` records:
 * `experimental_AstroContainer` needs Vite 8 and Vitest pins Vite 5, so a page
 * cannot be rendered in-process here. They are skipped on a checkout that has
 * never been built, and the build gate produces what they read.
 */
const built = existsSync(resolve(DIST, 'audits'));

describe.skipIf(!built)('rendered /policy/', () => {
  const html = () => page('policy');

  it('publishes at the route 60 dossiers already link to', () => {
    expect(withBase('policy/')).toBe('/agent-lighthouse/policy/');
    expect(existsSync(resolve(DIST, 'policy', 'index.html'))).toBe(true);
  });

  it('renders the policy on disk, whole, and gives it one h1', () => {
    const rendered = article(html());
    const source = readPolicySource();

    expect(body(html()).match(/<h1[\s>]/g) ?? []).toHaveLength(1);
    // The opening claim and the closing history entry: the whole file, not a
    // slice of it that a broken read would still make look plausible.
    expect(text(rendered)).toContain('A wrong audit is worse than no audit');
    expect(text(rendered)).toContain('policy adopted');
    // Every `## ` heading of the source reaches the page.
    for (const heading of source.match(/^## (.+)$/gm) ?? []) {
      expect(text(rendered), heading).toContain(heading.replace('## ', ''));
    }
  });

  it('renders the grade tables as tables, not as pipes', () => {
    expect(article(html())).toContain('<table');
    expect(article(html())).toMatch(/<th[\s>]/);
  });

  it('resolves the one relative link the policy carries', () => {
    const hrefs = [...article(html()).matchAll(/href="([^"]+)"/g)].map((match) => match[1]!);

    expect(hrefs.length, 'the policy renders no links at all').toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href, `${href} is still repository-relative`).toMatch(/^(?:https?:|mailto:|#|\/)/);
    }
    // `sources.json` is cited as the one registry; on the site that is the page
    // a reader can actually search.
    expect(hrefs).toContain(withBase('sources/'));
    expect(article(html())).not.toContain('./sources.json');
  });

  it('carries the documentation furniture the layout promises', () => {
    const rendered = body(html());

    // One sidebar per copy — the desktop rail and the small-screen disclosure.
    expect(rendered.match(/aria-label="Documentation"/g) ?? []).toHaveLength(2);
    expect(rendered.match(/id="toc-heading"/g) ?? []).toHaveLength(1);
    expect(rendered.match(/id="toc-heading-compact"/g) ?? []).toHaveLength(1);
    // The sidebar reaches every docs section as well as the evidence pair.
    for (const section of DOC_SECTIONS) expect(rendered).toContain(`href="${docPath(section.slug)}"`);
    expect(rendered).toContain(`href="${withBase('sources/')}"`);
  });

  it('marks itself current in the sidebar and in the header', () => {
    const current = [...body(html()).matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);

    expect(current.length).toBeGreaterThan(0);
    for (const anchor of current) expect(anchor).toContain(`href="${withBase('policy/')}"`);
  });
});

describe.skipIf(!built)('rendered /sources/', () => {
  const html = () => page('sources');
  const registry = readSourceRegistry();

  it('gives the page one h1 and the search box a label', () => {
    expect(body(html()).match(/<h1[\s>]/g) ?? []).toHaveLength(1);
    expect(html()).toMatch(/<label[^>]*for="source-search"/);
    expect(html()).toMatch(/<input[^>]*id="source-search"/);
  });

  it('offers one pressed pill per facet the registry actually contains', () => {
    const pills = [...html().matchAll(/<button[^>]*data-filter="type"[^>]*>/g)].map((m) => m[0]);
    const values = pills.map((pill) => /data-value="([^"]+)"/.exec(pill)![1]!);

    expect(values).toEqual(['all', ...sourceTypeCounts(registry.sources).map((entry) => entry.type)]);
    const pressed = pills.filter((pill) => pill.includes('aria-pressed="true"'));
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toContain('data-value="all"');
    // Each pill states its own count, read from the file at build time.
    for (const entry of sourceTypeCounts(registry.sources)) {
      expect(text(html()), entry.type).toContain(`${entry.type} (${entry.count})`);
    }
  });

  it('heads every column, and keeps the scroll container keyboard-reachable', () => {
    const rendered = html();
    const headers = [...rendered.matchAll(/<th[^>]*scope="col"[^>]*>/g)];

    expect(headers.length).toBeGreaterThanOrEqual(5);
    const region = /<div[^>]*id="sources-scroll"[^>]*>/.exec(rendered)?.[0];
    expect(region, 'the table has no scroll container').toBeDefined();
    expect(region).toContain('tabindex="0"');
    expect(region).toMatch(/role="region"|aria-label=/);
    expect(rendered).toMatch(/<caption/);
  });

  it('announces the result count from a live region', () => {
    const region = /<[a-z]+[^>]*aria-live="polite"[^>]*>/.exec(html())?.[0];

    expect(region, 'no live region on the page').toBeDefined();
    expect(region).toContain('id="sources-status"');
  });

  it('never inlines the registry into the page', () => {
    const rendered = html();
    const bytes = statSync(resolve(DIST, 'sources', 'index.html')).size;

    // The registry is 465 KB; a page carrying it could not be this small.
    expect(bytes, 'the sources page is heavy enough to be carrying the registry').toBeLessThan(60_000);
    expect(rendered, 'the page ships a serialized data blob').not.toMatch(
      /<script[^>]*type="application\/json"/,
    );
    // The island's own source names the field, so the tell is the data, not the
    // word: no id, no title and no finding from the registry is on the page.
    for (const source of registry.sources.slice(0, 25)) {
      expect(rendered, source.id).not.toContain(source.id);
      expect(rendered, source.id).not.toContain(source.title);
      expect(rendered, source.id).not.toContain(source.keyFindings.slice(0, 40));
    }
    expect(rendered).not.toContain('"keyFindings":');
  });

  it('says what a reader without JavaScript is looking at, and links the file', () => {
    const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html())?.[1];

    expect(noscript, 'the page is silent without JavaScript').toBeDefined();
    expect(noscript).toContain(withBase('sources.json'));
    expect(text(noscript!).toLowerCase()).toContain('javascript');
    // Closing the gaps rather than replacing tags with a space: HTML collapses
    // a newline-only gap before an anchor away, and `text()` would put the
    // missing space back and hide it.
    const tight = noscript!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
    expect(tight, 'the panel runs two words together').toContain('sources as sources.json');
    expect(tight, 'the panel runs two words together').toContain(', or on GitHub');
    // The shell the island fills is hidden until it has been filled, so nothing
    // renders as an empty table.
    expect(html()).toMatch(/<div[^>]*id="sources-table"[^>]*\bhidden\b/);
    expect(html()).toMatch(/<section[^>]*id="sources-controls"[^>]*\bhidden\b/);
  });

  it('keeps the registry and the core package out of the browser bundle', () => {
    const rendered = html();
    const inline = [...rendered.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(
      (m) => ['inline', m[1]!] as const,
    );
    const external = [...rendered.matchAll(/<script[^>]*src="([^"]+)"/g)].map(
      (m) =>
        [m[1]!, readFileSync(resolve(DIST, m[1]!.replace('/agent-lighthouse/', '')), 'utf8')] as const,
    );
    const scripts = [...inline, ...external];

    expect(scripts.length, 'the sources browser ships no script').toBeGreaterThan(0);
    expect(scripts.some(([, code]) => code.includes('#source-search'))).toBe(true);
    for (const [where, code] of scripts) {
      expect(code, `${where} reaches for core`).not.toContain('@forkpoint/agent-lighthouse-core');
      expect(code, `${where} reaches for the filesystem`).not.toContain('node:fs');
    }
  });
});

describe.skipIf(!built)('the served registry', () => {
  it('is emitted at the URL the browser fetches, byte for byte', () => {
    const served = resolve(DIST, 'sources.json');

    expect(withBase('sources.json')).toBe('/agent-lighthouse/sources.json');
    expect(existsSync(served)).toBe(true);
    expect(readFileSync(served, 'utf8')).toBe(readSourceRegistryRaw());
  });

  it('is the file in the repository, not a copy inside this package', () => {
    expect(POLICY_FILE.startsWith('docs/evidence/')).toBe(true);
    expect(existsSync(resolve(__dirname, 'sources.json'))).toBe(false);
    expect(existsSync(resolve(__dirname, '../public/sources.json'))).toBe(false);
  });
});

describe.skipIf(!built)('the published site', () => {
  it('publishes one page per route and nothing else', () => {
    const pages = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (entry.isDirectory()) return pages(resolve(dir, entry.name));
        return entry.name === 'index.html' ? [resolve(dir, entry.name)] : [];
      });

    // The home page, 215 dossiers, `/audits/`, 8 category indexes, 11 docs
    // pages, the policy and the sources browser.
    const expected = auditList().length + 1 + categoryList().length + DOC_SECTIONS.length + 3;
    expect(pages(DIST)).toHaveLength(expected);
  });
});
