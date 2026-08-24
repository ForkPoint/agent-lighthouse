import { describe, it, expect } from 'vitest';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { escapeRawHtmlPlugin } from './raw-html';
import { createDocRenderer, resolveDocLink } from './doc-markdown';

const published = new Set(['structured-data/service-schema']);

describe('resolveDocLink', () => {
  it('sends a README link to a page this site publishes', () => {
    expect(resolveDocLink('docs/BADGE.md', '', published)).toBe('/agent-lighthouse/docs/badge/');
  });

  it('sends a sibling docs link to its page and keeps the fragment', () => {
    expect(resolveDocLink('./CLI.md#--experimental', 'docs', published))
      .toBe('/agent-lighthouse/docs/cli/#--experimental');
  });

  it('sends the evidence policy to the published policy page', () => {
    expect(resolveDocLink('./evidence/POLICY.md', 'docs', published)).toBe('/agent-lighthouse/policy/');
  });

  it('sends a published dossier to its page', () => {
    expect(resolveDocLink('./evidence/audits/structured-data/service-schema.md', 'docs', published))
      .toBe('/agent-lighthouse/audits/structured-data/service-schema/');
  });

  it('sends a source file to GitHub', () => {
    expect(resolveDocLink('../packages/core/src/scorer.ts', 'docs', published))
      .toBe('https://github.com/ForkPoint/agent-lighthouse/blob/main/packages/core/src/scorer.ts');
  });

  it('sends a markdown file this site does not publish to GitHub', () => {
    expect(resolveDocLink('docs/PROMOTION.md', '', published))
      .toBe('https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/PROMOTION.md');
  });

  it('sends a directory to GitHub as a tree URL', () => {
    expect(resolveDocLink('docs/launch-posts/', '', published))
      .toBe('https://github.com/ForkPoint/agent-lighthouse/tree/main/docs/launch-posts');
  });

  it('leaves an absolute link and a bare fragment alone', () => {
    expect(resolveDocLink('https://example.com/', 'docs', published)).toBe('https://example.com/');
    expect(resolveDocLink('#fixed-limits', 'docs', published)).toBe('#fixed-limits');
  });
});

describe('createDocRenderer', () => {
  it('rewrites the relative links the prose was written with', async () => {
    const render = await createDocRenderer(published);
    const { html } = await render('See [the CLI](./CLI.md) and [the policy](./evidence/POLICY.md).', 'docs');

    expect(html).toContain('href="/agent-lighthouse/docs/cli/"');
    expect(html).toContain('href="/agent-lighthouse/policy/"');
    expect(html).not.toContain('CLI.md');
  });

  it('reports the headings the page builds its table of contents from', async () => {
    const render = await createDocRenderer(published);
    const { headings } = await render('# Title\n\n## Section\n', 'docs');

    expect(headings).toEqual([
      { depth: 1, slug: 'title', text: 'Title' },
      { depth: 2, slug: 'section', text: 'Section' },
    ]);
  });

  // The decision this test exists to pin: the README writes HTML on purpose —
  // alignment wrappers and badge images — so the docs pipeline renders it,
  // while the dossier pipeline keeps escaping the tags its prose merely names.
  it('renders the HTML the source writes, rather than escaping it', async () => {
    const render = await createDocRenderer(published);
    const source = '<div align="center">\n  <p><strong>Lighthouse, but for AI agents.</strong></p>\n</div>';
    const { html } = await render(source, '');

    expect(html).toContain('<div align="center">');
    expect(html).toContain('<strong>Lighthouse, but for AI agents.</strong>');
    expect(html).not.toContain('&lt;div');
  });

  it('still escapes raw HTML on the dossier pipeline, which keeps that plugin', async () => {
    const processor = await createSatteriMarkdownProcessor({
      syntaxHighlight: false,
      hastPlugins: [escapeRawHtmlPlugin()],
    });
    const { code } = await processor.render('<div align="center">tags in prose</div>', {});

    expect(code).not.toContain('<div align="center">');
    expect(code).toContain('&lt;div');
  });
});
