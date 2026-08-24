import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditList, categoryList } from './lib/registry';
import { auditPath, categoryPath, withBase } from './lib/routes';
import { BADGE_LINK, DEFAULT_SCORE, DEFAULT_URL, badgeMarkdown } from './islands/badge-generator';

const SRC = resolve(__dirname, '.');
const DIST = resolve(SRC, '../dist');
const source = () => readFileSync(resolve(SRC, 'pages/index.astro'), 'utf8');

describe('the landing page source', () => {
  it('exists, and is the site root the header links to', () => {
    expect(existsSync(resolve(SRC, 'pages/index.astro'))).toBe(true);
    expect(withBase('')).toBe('/agent-lighthouse/');
  });

  it('counts the registry rather than repeating a number that goes stale', () => {
    const page = source();

    expect(page).toContain('auditList()');
    expect(page).toContain('categoryList()');
    // The page it replaces hardcoded both, and both had drifted by the time it
    // was retired. A literal count in the template is the bug, not the style.
    expect(page).not.toMatch(/>\s*215\s*</);
    expect(page).not.toMatch(/>\s*8\s*</);
  });

  it('mounts both tools and nothing that reaches the server', () => {
    const page = source();

    expect(page).toContain('mountBadgeGenerator');
    expect(page).toContain('mountReportViewer');
    // The islands are imported inside `<script>`, which Astro bundles for the
    // browser; the registry is read in the frontmatter, which is not.
    const script = /<script>([\s\S]*?)<\/script>/.exec(page)?.[1] ?? '';
    expect(script).not.toContain('registry');
    expect(script).not.toContain('agent-lighthouse-core');
  });
});

/**
 * Rendered assertions read `dist/` for the reason `layouts/chrome.test.ts`
 * gives: `experimental_AstroContainer` needs Vite 8 and the runner pins Vite 5.
 * They are skipped on a checkout that has never been built.
 */
const built = existsSync(resolve(DIST, 'index.html'));
const home = () => readFileSync(resolve(DIST, 'index.html'), 'utf8');

describe.skipIf(!built)('the rendered landing page', () => {
  it('is published at the site root', () => {
    expect(existsSync(resolve(DIST, 'index.html'))).toBe(true);
  });

  it('has exactly one h1', () => {
    expect(home().match(/<h1[\s>]/g) ?? []).toHaveLength(1);
  });

  it('shows the counts the registry actually holds', () => {
    const page = home();
    const audits = auditList().length;
    const categories = categoryList();

    expect(page).toContain(String(audits));
    expect(page).toContain(String(categories.length));
    for (const category of categories) {
      expect(page, `${category.id} is missing from the landing page`).toContain(
        `href="${categoryPath(category.id)}"`,
      );
      // Escaped, because one category name carries an ampersand.
      expect(page).toContain(category.name.replace(/&/g, '&amp;'));
    }
  });

  it('leads into the audit index and the quickstart', () => {
    const page = home();
    expect(page).toContain(`href="${withBase('audits/')}"`);
    expect(page).toContain(`href="${withBase('docs/quickstart/')}"`);
    // A route helper produced every href, so no link can be missing the base.
    expect(page).not.toMatch(/href="\/(?!agent-lighthouse)[a-zA-Z]/);
  });

  it('ships a badge snippet that is already correct without any JavaScript', () => {
    const page = home();
    const snippet = badgeMarkdown(DEFAULT_SCORE, DEFAULT_URL);

    // Escaped, so the `<!-- Scanned: … -->` line is characters in the `<pre>`
    // and not a comment node the parser swallows.
    expect(page).toContain(snippet.split('\n')[0]!.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    expect(page).toContain('&lt;!-- Scanned: https://example.com --&gt;');
    expect(page).toContain(BADGE_LINK);
  });

  it('gives both tools a keyboard path and an announcement', () => {
    const page = home();

    // A real file input, reachable by tab — not a div listening for drops.
    expect(page).toMatch(/<input[^>]*id="report-file"[^>]*type="file"/);
    expect(page).toMatch(/<label[^>]*for="report-file"/);
    expect(page).toMatch(/<label[^>]*for="badge-score"/);
    expect(page).toMatch(/<label[^>]*for="badge-url"/);
    // Status changes are announced, and the regions exist before they change.
    expect(page).toMatch(/id="report-status"[^>]*aria-live="polite"/);
    expect(page).toMatch(/id="badge-copy-status"[^>]*aria-live="polite"/);
    // And are actually in the accessibility tree. `aria-live` on a `hidden`
    // element announces nothing: preflight makes `[hidden]` `display:none`, and
    // revealing the region in the same block that writes its text loses the
    // message. Asserting the attribute alone cannot see that, so assert the
    // absence of `hidden` on the same tag.
    for (const id of ['report-status', 'badge-copy-status']) {
      const tag = new RegExp(`<[a-z]+[^>]*\\bid="${id}"[^>]*>`).exec(page)?.[0];
      expect(tag, `${id} is missing from the page`).toBeDefined();
      expect(tag, `${id} is hidden, so its aria-live does nothing`).not.toMatch(/\bhidden\b/);
    }
  });

  it('hides the controls that only work once their island has mounted', () => {
    const page = home();
    expect(page).toMatch(/<button[^>]*id="badge-copy"[^>]*\bhidden\b/);
    expect(page).toMatch(/id="report-output"[^>]*\bhidden\b/);
  });

  it('explains itself with scripting off', () => {
    const page = home();
    expect(page).toContain('<noscript>');
    // Both tools say what they need; the report inspector cannot work at all.
    expect(page.match(/<noscript>/g) ?? []).toHaveLength(2);
  });

  it('binds its behaviour in a module, never in an on-attribute', () => {
    // The page this one replaces wired every control with `onclick=` and
    // `oninput=`, which a content security policy would refuse outright.
    expect(home()).not.toMatch(/\son(?:click|input|change|drop|dragover|dragleave)=/);
  });

  it('keeps core and the registry out of the browser bundle', () => {
    const page = home();
    const inline = [...page.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(
      (m) => ['inline', m[1]!] as const,
    );
    const external = [...page.matchAll(/<script[^>]*src="([^"]+)"/g)].map(
      (m) => [m[1]!, readFileSync(resolve(DIST, m[1]!.replace('/agent-lighthouse/', '')), 'utf8')] as const,
    );
    const scripts = [...inline, ...external];

    expect(scripts.length, 'the landing page ships no script').toBeGreaterThan(0);
    for (const [where, code] of scripts) {
      expect(code, `${where} reaches for core`).not.toContain('@forkpoint/agent-lighthouse-core');
      expect(code, `${where} reaches for the filesystem`).not.toContain('node:fs');
      // Task 5's lesson: the corpus does not travel with the page.
      expect(code, `${where} carries a dossier id`).not.toContain(auditPath(auditList()[0]!.id));
    }
  });

  it('stays small enough to be the first page anyone loads', () => {
    // The whole point of retiring the 478 KB single page. The dossiers are the
    // heaviest pages on the site at a few tens of KB; the home page is a page,
    // not a corpus.
    expect(Buffer.byteLength(home())).toBeLessThan(60_000);
  });
});
