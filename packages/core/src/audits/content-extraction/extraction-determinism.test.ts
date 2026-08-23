import { describe, it, expect } from 'vitest';
import { ExtractionDeterminismAudit } from './extraction-determinism';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { CheckContext } from '../../check-context';

const prose = (seed: string, n = 25) =>
  Array.from(
    { length: n },
    (_v, i) => `The ${seed} kettle boils in ${i} minutes and keeps its heat for another hour.`,
  ).join(' ');

const page = (body: string): CheckContext =>
  mockCheckContext([
    mockPageContext('https://example.com/kettles', `<html><head><title>Kettles</title></head><body>${body}</body></html>`, 1),
  ]);

describe('ExtractionDeterminismAudit', () => {
  const audit = new ExtractionDeterminismAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable on a page with no prose at all', async () => {
    expect((await audit.audit(page('<div><img src="/a.png"></div>'))).status).toBe('na');
  });

  it('passes when all three extractors agree', async () => {
    const result = await audit.audit(page(`<main><article><h1>Kettles</h1><p>${prose('copper')}</p></article></main>`));
    expect(result.status).toBe('pass');
    expect(Number(result.details?.['worstPairSimilarity'])).toBeGreaterThanOrEqual(0.8);
  });

  it('fails when one extractor returns a different article', async () => {
    const result = await audit.audit(
      page(`<main><p>${prose('copper', 2)}</p></main><div class="feature"><p>${prose('ceramic', 40)}</p></div>`),
    );
    expect(result.status).toBe('fail');
    expect(result.found).toContain('ceramic');
  });

  // The most widely deployed extractor giving an agent nothing is the finding.
  it('fails outright when readability declines the document', async () => {
    const options = Array.from(
      { length: 40 },
      (_v, i) => `<option>Kettle option number ${i} in this long list of choices</option>`,
    ).join('');
    const result = await audit.audit(page(`<select>${options}</select>`));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('declined');
  });

  it('fails when readability returns less than its own 500-character threshold', async () => {
    const nav = Array.from({ length: 30 }, (_v, i) => `<a href="/c/${i}">Category number ${i}</a>`).join('');
    const result = await audit.audit(page(`<nav>${nav}</nav><main><p>A short line about kettles.</p></main>`));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('500');
  });

  it('reports the symmetric difference of the worst-disagreeing pair', async () => {
    const result = await audit.audit(
      page(`<main><p>${prose('copper', 2)}</p></main><div class="feature"><p>${prose('ceramic', 40)}</p></div>`),
    );
    expect(result.details?.['worstPair']).toBeTypeOf('string');
    expect(Array.isArray(result.details?.['symmetricDifference'])).toBe(true);
  });

  it('registers as a scored grade-B audit with high priority', () => {
    const { meta } = ExtractionDeterminismAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.defaultPriority).toBe('high');
  });
});
