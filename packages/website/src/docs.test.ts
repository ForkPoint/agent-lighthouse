import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DOC_SECTIONS, readDocSource } from './lib/markdown-slice';
import { docPath } from './lib/routes';

const DIST = resolve(__dirname, '../dist');

const page = (slug: string) => readFileSync(resolve(DIST, 'docs', slug, 'index.html'), 'utf8');

/** A page's `<body>`, so a tag named in a `<head>` attribute is not counted. */
function body(html: string): string {
  const start = html.indexOf('<body');
  expect(start, 'page has no body').toBeGreaterThan(-1);
  return html.slice(start, html.lastIndexOf('</body>'));
}

/** The article, which is the only part of the page the source markdown fills. */
function article(html: string): string {
  const start = html.indexOf('<article');
  expect(start, 'page has no article').toBeGreaterThan(-1);
  return html.slice(start, html.indexOf('</article>'));
}

/** The page as a reader sees it: tags out, one space between what they held. */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/** The same, but closing the gaps — a syntax highlighter splits one identifier
 *  across several spans, and only this joins it back up. */
const tight = (html: string) => html.replace(/<[^>]+>/g, '');

/**
 * The longest run of plain words in a source file — no punctuation, no markup,
 * no code. Markdown leaves such a run untouched, so it survives into the page as
 * one contiguous string and proves that this page rendered *this* source.
 */
function longestPlainPhrase(markdown: string): string {
  const prose = markdown.replace(/^```[\s\S]*?^```/gm, ' ').replace(/`[^`\n]*`/g, ' ');
  const runs = prose.match(/(?:\b[A-Za-z]+\b ){5,}\b[A-Za-z]+\b/g) ?? [];
  return runs.sort((a, b) => b.length - a.length)[0] ?? '';
}

/** The longest identifier anywhere in a source, code included. */
function longestIdentifier(markdown: string): string {
  const words = markdown.match(/[A-Za-z_][A-Za-z0-9_]+/g) ?? [];
  return words.sort((a, b) => b.length - a.length)[0] ?? '';
}

/**
 * These assert against `dist/` for the reason `layouts/chrome.test.ts` records:
 * `experimental_AstroContainer` needs Vite 8 and Vitest pins Vite 5, so a page
 * cannot be rendered in-process here. They are skipped on a checkout that has
 * never been built, and the build gate produces what they read.
 */
const built = existsSync(resolve(DIST, 'docs'));

describe.skipIf(!built)('rendered docs pages', () => {
  it('publishes one page per section and nothing else', () => {
    const emitted = readdirSync(resolve(DIST, 'docs'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(emitted).toEqual(DOC_SECTIONS.map((section) => section.slug).sort());
  });

  it('renders the source each section names, not an empty page', () => {
    for (const section of DOC_SECTIONS) {
      const source = readDocSource(section);
      const html = article(page(section.slug));

      const phrase = longestPlainPhrase(source);
      if (phrase.length > 20) {
        expect(text(html), section.slug).toContain(phrase);
        continue;
      }

      // The SDK section is nothing but a code block, so it carries no prose to
      // match on; its longest identifier is just as much this source and no
      // other.
      const identifier = longestIdentifier(source);
      expect(identifier.length, `${section.slug}: nothing distinctive to look for`).toBeGreaterThan(11);
      expect(tight(html), section.slug).toContain(identifier);
    }
  });

  it('gives every page exactly one h1', () => {
    for (const section of DOC_SECTIONS) {
      const headings = body(page(section.slug)).match(/<h1[\s>]/g) ?? [];
      expect(headings, `${section.slug} has the wrong number of h1s`).toHaveLength(1);
    }
  });

  // The dossiers escape raw HTML because their prose names tags it never meant
  // as markup; the README writes HTML on purpose, so the docs pipeline does not
  // carry that plugin. Escaped markup showing up as text here means it does.
  it('shows no escaped markup where the source wrote real HTML', () => {
    for (const section of DOC_SECTIONS) {
      expect(article(page(section.slug)), section.slug).not.toMatch(/&lt;\/?(?:div|p|a|img|strong)\b/);
    }
  });

  it('emits no image without a source', () => {
    for (const section of DOC_SECTIONS) {
      const html = body(page(section.slug));
      expect([...html.matchAll(/<img\b(?![^>]*\bsrc=)[^>]*>/g)], section.slug).toHaveLength(0);
      // The marker Astro's image pipeline replaces; this one renders outside it.
      expect(html, section.slug).not.toContain('__ASTRO_IMAGE_');
    }
  });

  it('lists every section in the sidebar and marks the one you are on', () => {
    for (const section of DOC_SECTIONS) {
      const html = body(page(section.slug));
      for (const other of DOC_SECTIONS) {
        expect(html, `${section.slug} does not link ${other.slug}`).toContain(`href="${docPath(other.slug)}"`);
      }

      // Scoped to the sidebar: the site header marks its own current section
      // too, and on `/docs/quickstart/` that is a third `aria-current` anchor.
      const sidebars = html.match(/<nav aria-label="Documentation"[\s\S]*?<\/nav>/g) ?? [];
      // One per copy — the desktop rail and the small-screen disclosure. Only
      // one of the two is ever visible, so the reader still sees one.
      expect(sidebars, section.slug).toHaveLength(2);
      for (const sidebar of sidebars) {
        const current = [...sidebar.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);
        expect(current, section.slug).toHaveLength(1);
        expect(current[0], section.slug).toContain(`href="${docPath(section.slug)}"`);
      }
    }
  });

  it('walks the sections in order, and stops at both ends', () => {
    const first = body(page(DOC_SECTIONS[0]!.slug));
    const last = body(page(DOC_SECTIONS.at(-1)!.slug));

    expect(first).not.toMatch(/rel="prev"/);
    const onward = /<a\b[^>]*rel="next"[^>]*>/.exec(first)?.[0];
    expect(onward, 'the first section offers no next').toBeDefined();
    expect(onward).toContain(`href="${docPath(DOC_SECTIONS[1]!.slug)}"`);
    expect(last).not.toMatch(/rel="next"/);
    expect(last).toMatch(/rel="prev"/);

    const middle = body(page(DOC_SECTIONS[1]!.slug));
    const adjacent = [...middle.matchAll(/<a\b[^>]*rel="(prev|next)"[^>]*>/g)];
    expect(adjacent).toHaveLength(2);
    expect(adjacent[0]![0]).toContain(`href="${docPath(DOC_SECTIONS[0]!.slug)}"`);
    expect(adjacent[1]![0]).toContain(`href="${docPath(DOC_SECTIONS[2]!.slug)}"`);
  });

  it('leaves no unresolved relative link in the prose', () => {
    for (const section of DOC_SECTIONS) {
      const hrefs = [...article(page(section.slug)).matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
      for (const href of hrefs) {
        expect(href, `${section.slug} keeps a repository-relative link`).toMatch(/^(?:https?:|mailto:|#|\/)/);
      }
    }
  });
});
