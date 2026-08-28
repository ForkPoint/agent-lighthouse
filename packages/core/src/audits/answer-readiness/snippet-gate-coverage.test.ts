import { describe, it, expect } from 'vitest';
import { SnippetGateCoverageAudit } from './snippet-gate-coverage';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';

/** Filler prose so a small data-nosnippet subtree stays under the 20% floor. */
const FILLER = '<p>Resoling keeps a welted boot in service for many more seasons of wet winter walking.</p>'.repeat(
  12,
);
const LONG_ANSWER =
  'Resoling replaces the outsole and midsole of a welted boot while keeping the original upper, which is why a resoleable boot outlasts a cemented boot by several seasons.';

function run(body: string, head = '', headers: Record<string, string> = {}) {
  const audit = new SnippetGateCoverageAudit();
  const html = `<html><head>${head}</head><body>${body}</body></html>`;
  const page = mockPageContext('https://example.test/guide', html);
  Object.assign(page.fetchResult.headers, headers);
  return audit.audit(mockCheckContext([page]));
}

const FAQ_JSONLD = `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is resoling?',
      acceptedAnswer: { '@type': 'Answer', text: LONG_ANSWER },
    },
  ],
})}</script>`;

describe('SnippetGateCoverageAudit', () => {
  const audit = new SnippetGateCoverageAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('passes a page with no snippet directive and no data-nosnippet', () => {
    const result = run(`<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`);
    expect(result.status).toBe('pass');
  });

  // Google names nosnippet as one of the controls that removes a page from
  // AI surfaces while leaving it visible to humans.
  it('fails on <meta name="robots" content="nosnippet">', () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      '<meta name="robots" content="nosnippet">',
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('nosnippet');
  });

  it('resolves a per-bot header against a page meta, most restrictive winning', () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      '<meta name="robots" content="max-snippet:200">',
      { 'x-robots-tag': 'googlebot: max-snippet:0' },
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('googlebot');
    expect(result.message).toContain('max-snippet:0');
    expect(result.found).toContain('max-snippet:200');
  });

  // Regression pin for the fetcher fix: repeated field lines arrive combined
  // with ", " (RFC 9110 §5.3), so both must still be parsed.
  it('sees every directive when two X-Robots-Tag lines were combined', () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      '',
      { 'x-robots-tag': 'googlebot: max-snippet:0, noarchive' },
    );
    expect(result.found).toContain('max-snippet:0');
    expect(result.found).toContain('noarchive');
  });

  it('fails when data-nosnippet covers over 20% of the main content', () => {
    const suppressed = '<p data-nosnippet>Suppressed pricing and availability detail. </p>'.repeat(8);
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${suppressed}</main>`,
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('20%');
  });

  it('fails and names the span when data-nosnippet holds the first sentence after an h2', () => {
    const result = run(
      `<main><h1>Boots</h1>${FILLER}<h2>What is resoling?</h2>
       <p data-nosnippet>Resoling replaces the outsole.</p>${FILLER}</main>`,
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Resoling replaces the outsole.');
  });

  it('fails when max-snippet is shorter than the primary answer span and shows the cut', () => {
    const answer = `${LONG_ANSWER} ${LONG_ANSWER}`;
    const result = run(
      `<main><h1>Resoling</h1><p>${answer}</p>${FILLER}</main>`,
      '<meta name="robots" content="max-snippet:50">',
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('max-snippet:50');
    expect(result.message).toContain('…');
  });

  // Marking up answers and then forbidding snippets is one mistake, not two.
  it('reports FAQPage markup plus nosnippet as a single combined finding', () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      `<meta name="robots" content="nosnippet">${FAQ_JSONLD}`,
    );
    expect(result.status).toBe('fail');
    expect(result.found).toContain('1 snippet finding');
    expect(result.message).toContain('FAQPage');
  });

  it('warns on a harmless data-nosnippet subtree well under the coverage floor', () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}<p data-nosnippet>Prices vary.</p></main>`,
    );
    expect(result.status).toBe('warn');
  });

  it('reports the page the directives are on', () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      '<meta name="robots" content="nosnippet">',
    );
    expect(result.pageUrl).toBe('https://example.test/guide');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new SnippetGateCoverageAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
});
