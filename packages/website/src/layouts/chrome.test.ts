import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditList } from '../lib/registry';
import { auditPath, withBase } from '../lib/routes';

const SRC = resolve(__dirname, '..');
const DIST = resolve(SRC, '../dist');

/** Every .astro file under src, so a hardcoded path cannot hide in one. */
function astroFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return astroFiles(full);
    return entry.name.endsWith('.astro') ? [full] : [];
  });
}

const read = (relative: string) => readFileSync(resolve(SRC, relative), 'utf8');

/** An `.astro` file's template, without the frontmatter or the JSX comments —
 *  so a tag named in a comment is not mistaken for a tag the layout renders. */
const template = (relative: string) =>
  read(relative).replace(/^---[\s\S]*?\n---\n/, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** A page's `<body>`, so a tag named inside a `<head>` attribute — the meta
 *  description quotes tag names verbatim — is not counted as an element. */
function body(html: string): string {
  const start = html.indexOf('<body');
  const end = html.lastIndexOf('</body>');
  expect(start, 'page has no body').toBeGreaterThan(-1);
  return html.slice(start, end);
}

/**
 * Undo the escaping the renderer applies, so an assertion can compare against
 * the registry string. Nine audit titles name HTML elements (`<main> element
 * present`), which is why this is needed at all.
 */
const decode = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

/** A page's `<title>`, decoded. */
const pageTitle = (html: string) => decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '');

describe('chrome', () => {
  it('never hardcodes a site-absolute href', () => {
    // Both the plain-attribute form (`href="/x"`) and the quoted-expression form
    // (`href={'/x'}`), in either case: all of them break under the base path.
    const patterns = [
      /href="\/(?!agent-lighthouse)[a-zA-Z]/g,
      /href=\{\s*['"`]\/(?!agent-lighthouse)[a-zA-Z]/g,
    ];
    for (const file of astroFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      const offenders = patterns.flatMap((pattern) => [...source.matchAll(pattern)]);
      expect(offenders.length, `${file} hardcodes a root-relative href`).toBe(0);
    }
  });

  // `Doc` renders one `<h1>`, and only when the route passes `heading`. The
  // documentation pages omit it because their markdown opens with its own `# `;
  // the dossier pages pass it because the public slice discards theirs. The
  // rendered "exactly one h1 per page" check below is what proves the pair.
  it('renders at most the one conditional heading, and none in the shell', () => {
    expect(template('layouts/Doc.astro')).toMatch(/\{heading && <h1>\{heading\}<\/h1>\}/);
    expect(template('layouts/Base.astro')).not.toMatch(/<h1[\s>]/);
  });

  it('gives the skip link a focusable target', () => {
    const base = read('layouts/Base.astro');

    expect(base).toContain('href="#main"');
    // Both attributes on the same tag: without `tabindex` a fragment link moves
    // the scroll position but not focus, because `<main>` is not focusable.
    expect(base).toMatch(/<main[^>]*\bid="main"[^>]*\btabindex="-1"/);
  });

  it('declares the colour scheme it is legible in', () => {
    expect(read('styles/global.css')).toMatch(/:root\s*\{[^}]*color-scheme:\s*dark/);
  });

  it('scopes Tailwind away from the page it replaces', () => {
    const css = read('styles/global.css');

    // Without this, v4 auto-detection walks the package and scans `index.html`.
    expect(css).toContain('source(none)');
    expect(css).toContain('@source "../";');
  });
});

describe('prev/next ordering', () => {
  const audits = auditList();

  /** The rule the dossier route implements, restated as data. */
  function neighbours(id: string) {
    const category = id.split('/')[0];
    const siblings = audits.filter((audit) => audit.category === category);
    const index = siblings.findIndex((audit) => audit.id === id);
    return { siblings, index, prev: siblings[index - 1], next: siblings[index + 1] };
  }

  it('never steps outside the audit’s own category', () => {
    expect(audits.length).toBeGreaterThan(0);
    for (const audit of audits) {
      const { prev, next } = neighbours(audit.id);
      expect(prev?.category ?? audit.category).toBe(audit.category);
      expect(next?.category ?? audit.category).toBe(audit.category);
    }
  });

  it('gives the first of a category no previous and the last no next', () => {
    const categories = [...new Set(audits.map((audit) => audit.category))];
    expect(categories.length).toBeGreaterThan(1);

    for (const category of categories) {
      const siblings = audits.filter((audit) => audit.category === category);
      expect(siblings.length).toBeGreaterThan(0);
      expect(neighbours(siblings[0]!.id).prev).toBeUndefined();
      expect(neighbours(siblings.at(-1)!.id).next).toBeUndefined();
    }
  });

  it('links a middle audit to the sibling on each side, by route', () => {
    const category = audits[0]!.category;
    const siblings = audits.filter((audit) => audit.category === category);
    const middle = siblings[1]!;
    const { prev, next } = neighbours(middle.id);

    expect(auditPath(prev!.id)).toBe(auditPath(siblings[0]!.id));
    expect(auditPath(next!.id)).toBe(auditPath(siblings[2]!.id));
  });
});

/**
 * The rendered-output assertions.
 *
 * They read `dist/` rather than rendering in-process because
 * `experimental_AstroContainer` cannot run here: it needs Astro 7's Vite
 * plugins, which require Vite 8, and Vitest 2.1.9 pins Vite 5 — loading them
 * crashes the runner in `vite-plugin-head` (`Cannot read properties of
 * undefined (reading 'ssr')`). Building inside the unit suite is not an option
 * either, so these run against the artefact the build gate already produces and
 * are skipped on a checkout that has never been built.
 */
const built = existsSync(resolve(DIST, 'audits'));
describe.skipIf(!built)('rendered dossier pages', () => {
  const pages = () =>
    readdirSync(resolve(DIST, 'audits'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((category) =>
        readdirSync(resolve(DIST, 'audits', category.name), { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((slug) => {
            const full = readFileSync(
              resolve(DIST, 'audits', category.name, slug.name, 'index.html'),
              'utf8',
            );
            return { id: `${category.name}/${slug.name}`, full, html: body(full) };
          }),
      );

  it('gives every page exactly one h1', () => {
    const all = pages();
    expect(all).toHaveLength(auditList().length);
    for (const page of all) {
      expect(page.html.match(/<h1[\s>]/g) ?? [], `${page.id} has the wrong number of h1s`).toHaveLength(1);
    }
  });

  it('emits no image without a source', () => {
    for (const page of pages()) {
      const srcless = [...page.html.matchAll(/<img\b(?![^>]*\bsrc=)[^>]*>/g)];
      expect(srcless.length, `${page.id} emits a srcless img`).toBe(0);
    }
  });

  it('marks the page you are on as current, and nothing else', () => {
    for (const page of pages()) {
      const current = [...page.html.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);
      // One per sidebar copy — the desktop rail and the small-screen disclosure.
      // Only one of the two is ever visible, so the reader still sees one.
      expect(current, `${page.id}`).toHaveLength(2);
      for (const anchor of current) {
        expect(anchor, `${page.id}`).toContain(`href="${auditPath(page.id)}"`);
      }
    }
  });

  it('keeps navigation reachable below the sidebar breakpoint', () => {
    const [page] = pages();
    expect(page!.html).toMatch(/<details[^>]*lg:hidden/);
    expect(page!.html).toContain('<summary');
    // One copy of each nav is visible at any width; the other is `display: none`
    // and so out of the accessibility tree. The ids must still be unique.
    expect(page!.html.match(/aria-label="Documentation"/g) ?? []).toHaveLength(2);
    expect(page!.html.match(/id="toc-heading"/g) ?? []).toHaveLength(1);
    expect(page!.html.match(/id="toc-heading-compact"/g) ?? []).toHaveLength(1);
  });

  /**
   * The title is the registry's, not the dossier heading's. Most dossier
   * headings are still the working title the audit was drafted under — the slug
   * with a v1 numeric id after it, `og-type (4.7)` — and every list that links
   * here shows `audit.title`, so the heading would name the same audit twice.
   */
  it('titles every dossier page with the registry title', () => {
    const titles = new Map(auditList().map((audit) => [audit.id, audit.title]));
    const all = pages();
    expect(all).toHaveLength(titles.size);

    for (const page of all) {
      expect(pageTitle(page.full), page.id).toBe(titles.get(page.id));
    }
  });

  it('links the favicon at a path the build actually emits', () => {
    const [page] = pages();
    const href = /<link rel="icon" href="([^"]+)"/.exec(page!.full)?.[1];
    expect(href).toBeDefined();
    expect(existsSync(resolve(DIST, href!.replace('/agent-lighthouse/', '')))).toBe(true);
  });
});

/**
 * Every page's `<head>`, not just the dossiers'.
 *
 * The page this site replaced carried a full social card, and the first cut of
 * the Astro shell carried none of it, so these assert the whole set on every
 * built page rather than on a sample: the metadata is emitted once in
 * `Base.astro`, and a page that stops going through the layout is exactly the
 * regression worth catching.
 */
describe.skipIf(!built)('head metadata', () => {
  const SITE = 'https://forkpoint.github.io';

  /** Every built HTML page, paired with the address it is published at. */
  function htmlPages(dir = DIST): Array<{ file: string; url: string }> {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = resolve(dir, entry.name);
      // Pagefind writes its own fragments and a playground page under `dist`;
      // none of them is a page this site renders.
      if (entry.isDirectory()) return entry.name === 'pagefind' ? [] : htmlPages(full);
      if (!entry.name.endsWith('.html')) return [];
      const relative = full.slice(DIST.length + 1);
      // `a/b/index.html` is published at `/a/b/`; `404.html` at `/404/`.
      const route = relative.endsWith('index.html')
        ? relative.slice(0, -'index.html'.length)
        : `${relative.slice(0, -'.html'.length)}/`;
      return [{ file: relative, url: `${SITE}${withBase(route)}` }];
    });
  }

  /** The `content` of a `<meta>`, by whichever attribute names it. */
  const meta = (html: string, name: string) =>
    new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`).exec(html)?.[1];

  // Walked inside each test, not in the describe body: a skipped suite still
  // evaluates its body, and on an unbuilt checkout there is no `dist` to walk.
  it('covers every built page, dossiers included', () => {
    const pages = htmlPages();
    expect(pages.length).toBeGreaterThan(auditList().length);
    for (const known of ['index.html', '404.html', 'audits/index.html', 'docs/quickstart/index.html']) {
      expect(pages.map((page) => page.file), `${known} is missing`).toContain(known);
    }
  });

  it('gives every page a canonical link at its own published address', () => {
    for (const page of htmlPages()) {
      const html = readFileSync(resolve(DIST, page.file), 'utf8');
      const canonical = /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1];
      expect(canonical, `${page.file} has no canonical link`).toBe(page.url);
    }
  });

  it('carries the full Open Graph and Twitter card on every page', () => {
    const image = `${SITE}${withBase('og-image.svg')}`;
    expect(existsSync(resolve(DIST, 'og-image.svg')), 'the card image is not published').toBe(true);

    for (const page of htmlPages()) {
      const html = readFileSync(resolve(DIST, page.file), 'utf8');
      const title = pageTitle(html);
      const description = decode(meta(html, 'description') ?? '');
      expect(title, `${page.file} has no title`).not.toBe('');
      expect(description, `${page.file} has no description`).not.toBe('');

      const expected: Record<string, string> = {
        'og:type': 'website',
        'og:title': title,
        'og:description': description,
        'og:url': page.url,
        'og:image': image,
        'twitter:card': 'summary_large_image',
        'twitter:title': title,
        'twitter:description': description,
        'twitter:image': image,
      };
      for (const [name, value] of Object.entries(expected)) {
        expect(decode(meta(html, name) ?? ''), `${page.file}: ${name}`).toBe(value);
      }
      // The alt text describes the card image, so it is the same on every page
      // and only has to be there and say something.
      for (const name of ['og:image:alt', 'twitter:image:alt']) {
        expect((meta(html, name) ?? '').length, `${page.file}: ${name}`).toBeGreaterThan(10);
      }
    }
  });

  it('writes no origin into the layout that emits those URLs', () => {
    // The absolute URLs are built from `Astro.site`; a literal origin here
    // would keep working right up until the site moves.
    const base = read('layouts/Base.astro');
    expect(base).toContain('Astro.site');
    expect(base).not.toContain('https://forkpoint.github.io');
  });
});
