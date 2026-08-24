import { describe, it, expect } from 'vitest';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { resolveDossierLink, dossierLinksPlugin } from './dossier-links';

const published = new Set(['agentic-commerce/offer-truth-consistency', 'structured-data/service-schema']);

describe('resolveDossierLink', () => {
  it('sends the policy link to the published policy page', () => {
    expect(resolveDossierLink('../../POLICY.md', 'agentic-commerce/offer-truth-consistency', published))
      .toBe('/agent-lighthouse/policy/');
  });

  it('sends a sibling dossier link to its page', () => {
    expect(resolveDossierLink('./service-schema.md', 'structured-data/advanced-product-details', published))
      .toBe('/agent-lighthouse/audits/structured-data/service-schema/');
  });

  it('sends an unpublished dossier to GitHub', () => {
    expect(resolveDossierLink('../../merged/agentic-commerce/offer-dom-price-parity.md', 'agentic-commerce/offer-truth-consistency', published))
      .toBe('https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/merged/agentic-commerce/offer-dom-price-parity.md');
  });

  it('sends a repo path outside docs to GitHub', () => {
    expect(resolveDossierLink('../../../../packages/core/src/audits/REWORK-TODO.md', 'access-crawl-control/robots-directives', published))
      .toBe('https://github.com/ForkPoint/agent-lighthouse/blob/main/packages/core/src/audits/REWORK-TODO.md');
  });

  it('leaves an absolute link alone', () => {
    const external = 'https://developers.google.com/search/docs';
    expect(resolveDossierLink(external, 'a/b', published)).toBe(external);
  });

  it('leaves an anchor alone', () => {
    expect(resolveDossierLink('#deferred', 'a/b', published)).toBe('#deferred');
  });

  // Shapes beyond the six above, taken from the links the 215 dossiers really carry.

  it('leaves a site-absolute path alone', () => {
    expect(resolveDossierLink('/about', 'a/b', published)).toBe('/about');
  });

  it('leaves a mailto link alone', () => {
    expect(resolveDossierLink('mailto:hi@example.com', 'a/b', published)).toBe('mailto:hi@example.com');
  });

  it('keeps the fragment when a sibling dossier link carries one', () => {
    expect(resolveDossierLink('./service-schema.md#deferred', 'structured-data/advanced-product-details', published))
      .toBe('/agent-lighthouse/audits/structured-data/service-schema/#deferred');
  });

  it('keeps the fragment when the policy link carries one', () => {
    expect(resolveDossierLink('../../POLICY.md#grade', 'agentic-commerce/offer-truth-consistency', published))
      .toBe('/agent-lighthouse/policy/#grade');
  });

  it('keeps the fragment when the target falls through to GitHub', () => {
    expect(resolveDossierLink('../../merged/agentic-commerce/offer-dom-price-parity.md#why', 'agentic-commerce/offer-truth-consistency', published))
      .toBe('https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/merged/agentic-commerce/offer-dom-price-parity.md#why');
  });

  it('sends a directory link to GitHub as a tree URL', () => {
    expect(resolveDossierLink('../../merged/access-crawl-control/', 'agentic-commerce/offer-truth-consistency', published))
      .toBe('https://github.com/ForkPoint/agent-lighthouse/tree/main/docs/evidence/merged/access-crawl-control');
  });

  it('sends a dossier that has no page to GitHub even though it sits under audits/', () => {
    expect(resolveDossierLink('./not-a-real-dossier.md', 'structured-data/service-schema', published))
      .toBe('https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/structured-data/not-a-real-dossier.md');
  });
});

/** The real Astro 7 Markdown pipeline, with only this plugin added. */
async function renderDossier(markdown: string, frontmatter: Record<string, unknown>) {
  const processor = await createSatteriMarkdownProcessor({
    syntaxHighlight: false,
    mdastPlugins: [dossierLinksPlugin(published)],
  });
  const { code } = await processor.render(markdown, { frontmatter });
  return code;
}

describe('dossierLinksPlugin', () => {
  it('rewrites every link in a dossier and leaves absolute ones alone', async () => {
    const html = await renderDossier(
      'See [schema](./service-schema.md), the [policy](../../POLICY.md) and [Google](https://developers.google.com/).',
      { audit: 'structured-data/advanced-product-details' },
    );

    expect(html).toContain('href="/agent-lighthouse/audits/structured-data/service-schema/"');
    expect(html).toContain('href="/agent-lighthouse/policy/"');
    expect(html).toContain('href="https://developers.google.com/"');
    expect(html).not.toContain('POLICY.md');
  });

  it('leaves a link inside a code span alone, because it is not a link', async () => {
    const html = await renderDossier(
      'The parser drops `- [Home](/): Main landing page`.',
      { audit: 'machine-discovery/llms-txt-link-descriptions' },
    );

    expect(html).toContain('[Home](/)');
    expect(html).not.toContain('href=');
  });

  it('leaves the document untouched when the frontmatter carries no audit id', async () => {
    const html = await renderDossier('See [schema](./service-schema.md).', {});

    expect(html).toContain('href="./service-schema.md"');
  });
});
