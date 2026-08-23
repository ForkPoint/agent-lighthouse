import { describe, it, expect } from 'vitest';
import { SiteWidePassageUniquenessRatioAudit } from './site-wide-passage-uniqueness-ratio';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { CheckContext } from '../../check-context';

/**
 * Sentences no other page shares, seeded so no five-word window repeats.
 *
 * Each one starts with a capital because an extractor concatenates paragraphs
 * with no separator, and a capital is what marks the sentence boundary there.
 */
const own = (seed: string, n = 10) => {
  const Seed = seed[0]!.toUpperCase() + seed.slice(1);
  return Array.from(
    { length: n },
    (_v, i) => `${Seed}${i}alpha ${seed}${i}bravo ${seed}${i}charlie ${seed}${i}delta ${seed}${i}echo.`,
  );
};

/** Sentences written once and pasted onto several pages. */
const SHARED = [
  'We ship every order worldwide from our warehouse within two working days.',
  'Returns are accepted within thirty days of delivery in the original packaging.',
  'Our support team answers by email on weekdays between nine and five.',
  'All prices include tax and are shown in the currency of your country.',
  'Trade accounts get volume pricing and a named contact for every order.',
];

interface PageSpec {
  url: string;
  sentences: string[];
  canonical?: string;
}

function site(pages: PageSpec[]): CheckContext {
  return mockCheckContext(
    pages.map((page, index) =>
      mockPageContext(
        page.url,
        `<html><head>${
          page.canonical ? `<link rel="canonical" href="${page.canonical}">` : ''
        }</head><body><main>${page.sentences.map((s) => `<p>${s}</p>`).join('')}</main></body></html>`,
        index,
      ),
    ),
  );
}

describe('SiteWidePassageUniquenessRatioAudit', () => {
  const audit = new SiteWidePassageUniquenessRatioAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  // Document frequency and clustering over two pages are not measurements.
  it('is notApplicable with fewer than three pages', async () => {
    const ctx = site([
      { url: 'https://example.com/a', sentences: own('alpha') },
      { url: 'https://example.com/b', sentences: own('bravo') },
    ]);
    expect((await audit.audit(ctx)).status).toBe('na');
  });

  it('calls a sentence boilerplate on three pages but not on two', async () => {
    const onTwo = site([
      { url: 'https://example.com/a', sentences: [...own('alpha'), SHARED[0]!] },
      { url: 'https://example.com/b', sentences: [...own('bravo'), SHARED[0]!] },
      { url: 'https://example.com/c', sentences: own('charlie') },
    ]);
    expect((await audit.audit(onTwo)).details?.['boilerplateSentences']).toBe(0);

    const onThree = site([
      { url: 'https://example.com/a', sentences: [...own('alpha'), SHARED[0]!] },
      { url: 'https://example.com/b', sentences: [...own('bravo'), SHARED[0]!] },
      { url: 'https://example.com/c', sentences: [...own('charlie'), SHARED[0]!] },
    ]);
    expect((await audit.audit(onThree)).details?.['boilerplateSentences']).toBe(1);
  });

  // On a large crawl the floor of three stops being the binding number.
  it('raises the boilerplate threshold to 5% once the sample is large', async () => {
    const pages = Array.from({ length: 80 }, (_v, i) => ({
      url: `https://example.com/p${i}`,
      sentences: own(`seed${i}`, 3),
    }));
    const result = await audit.audit(site(pages));
    expect(result.details?.['boilerplateThresholdPages']).toBe(4);
  });

  it('flags a page under 30% unique sentence text while the median page passes', async () => {
    const ctx = site([
      { url: 'https://example.com/a', sentences: [...own('alpha'), ...SHARED] },
      { url: 'https://example.com/b', sentences: [...own('bravo'), ...SHARED] },
      { url: 'https://example.com/c', sentences: [...own('charlie'), ...SHARED] },
      { url: 'https://example.com/thin', sentences: [...SHARED, ...own('delta', 1)] },
    ]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.details?.['lowUniquenessPages']).toEqual([
      expect.stringContaining('https://example.com/thin'),
    ]);
    expect(result.details?.['medianUniqueFraction']).toBeGreaterThan(0.3);
  });

  it('fails a near-duplicate cluster whose members all name themselves canonical', async () => {
    const shared = own('common', 20);
    const ctx = site([
      { url: 'https://example.com/a', sentences: [...shared, ...own('alpha', 1)] },
      { url: 'https://example.com/b', sentences: [...shared, ...own('bravo', 1)] },
      { url: 'https://example.com/z', sentences: own('zulu', 20) },
    ]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.details?.['nearDuplicateClusters']).toBe(1);
    expect(result.details?.['unresolvedClusters']).toBe(1);
  });

  it('does not fail the same cluster once one member canonicalizes to the other', async () => {
    const shared = own('common', 20);
    const ctx = site([
      { url: 'https://example.com/a', sentences: [...shared, ...own('alpha', 1)] },
      {
        url: 'https://example.com/b',
        sentences: [...shared, ...own('bravo', 1)],
        canonical: 'https://example.com/a',
      },
      { url: 'https://example.com/z', sentences: own('zulu', 20) },
    ]);
    const result = await audit.audit(ctx);
    expect(result.status).not.toBe('fail');
    expect(result.details?.['nearDuplicateClusters']).toBe(1);
    expect(result.details?.['unresolvedClusters']).toBe(0);
  });

  it('reports the median as the site number and names the worst clusters', async () => {
    const shared = own('common', 20);
    const ctx = site([
      { url: 'https://example.com/a', sentences: [...shared, ...own('alpha', 1)] },
      { url: 'https://example.com/b', sentences: [...shared, ...own('bravo', 1)] },
      { url: 'https://example.com/z', sentences: own('zulu', 20) },
    ]);
    const result = await audit.audit(ctx);
    const worst = result.details?.['worstClusters'] as string[];
    expect(worst).toHaveLength(1);
    expect(worst[0]).toContain('https://example.com/a');
    expect(worst[0]).toContain('https://example.com/b');
    expect(worst[0]).toContain('names itself canonical');
    expect(result.found).toContain('median page');
    expect(result.displayValue).toMatch(/% unique$/);
  });

  it('passes a site whose pages each carry their own sentences', async () => {
    const ctx = site([
      { url: 'https://example.com/a', sentences: own('alpha', 20) },
      { url: 'https://example.com/b', sentences: own('bravo', 20) },
      { url: 'https://example.com/c', sentences: own('charlie', 20) },
    ]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.details?.['nearDuplicateClusters']).toBe(0);
  });

  it('is a scored grade B audit', () => {
    const { meta } = SiteWidePassageUniquenessRatioAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(0.6);
  });
});
