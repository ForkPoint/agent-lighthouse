import { describe, it, expect } from 'vitest';
import { ExtractorSurvivalRecallAudit } from './extractor-survival-recall';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { CheckContext } from '../../check-context';

const PROSE =
  'The copper kettle reaches a rolling boil in about three minutes on a gas hob. ' +
  'It holds that heat for a further hour once the lid is closed properly. ';

const page = (body: string, head = ''): CheckContext =>
  mockCheckContext([
    mockPageContext(
      'https://example.com/kettles',
      `<html><head><title>Kettles</title>${head}</head><body>${body}</body></html>`,
      1,
    ),
  ]);

const article = (extra = '') => `<main><article>
  <h1>Copper kettle</h1>
  <h2>Boiling</h2><p>${PROSE.repeat(3)}</p>
  <h2>Descaling</h2><p>${PROSE.repeat(3)}</p>
  ${extra}
</article></main>`;

describe('ExtractorSurvivalRecallAudit', () => {
  const audit = new ExtractorSurvivalRecallAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when the page carries no key spans', async () => {
    expect((await audit.audit(page('<div>Nothing structured here at all.</div>'))).status).toBe('na');
  });

  it('passes when every key span survives both extractors', async () => {
    const result = await audit.audit(page(article()));
    expect(result.status).toBe('pass');
    expect(Number(result.details?.['recall'])).toBeGreaterThanOrEqual(0.9);
  });

  it('takes its key spans from h1, section openers, captions, dt, th and JSON-LD', async () => {
    const head = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Copper kettle',
      description: 'A two litre copper kettle with a riveted handle.',
    })}</script>`;
    const body = article(
      '<table><caption>Specifications table</caption><tr><th>Capacity</th><td>2 litres</td></tr></table>' +
        '<dl><dt>Warranty term</dt><dd>Two years</dd></dl>' +
        '<p>A two litre copper kettle with a riveted handle.</p>',
    );
    const result = await audit.audit(page(body, head));
    const kinds = result.details?.['spanKinds'] as string[];
    expect(kinds).toContain('h1');
    expect(kinds).toContain('caption');
    expect(kinds).toContain('dt');
    expect(kinds).toContain('th');
    expect(kinds).toContain('json-ld');
  });

  it('fails when a spec table lives in an aside, and names the ancestor chain', async () => {
    const body = `${article()}<aside class="related-specs"><table><caption>Specifications table</caption><tr><th>Capacity</th><td>2 litres</td></tr><tr><th>Material</th><td>Copper</td></tr></table></aside>`;
    const result = await audit.audit(page(body));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('aside.related-specs');
  });

  it('reports both extractors separately', async () => {
    const result = await audit.audit(page(article()));
    expect(result.details?.['readabilityRecall']).toBeTypeOf('number');
    expect(result.details?.['aggressiveRecall']).toBeTypeOf('number');
  });

  it('reports over-strip risk and boilerplate leakage without deciding the status', async () => {
    const result = await audit.audit(page(article()));
    expect(Number(result.details?.['textRatio'])).toBeGreaterThan(0);
    expect(Number(result.details?.['textRatio'])).toBeLessThanOrEqual(1);
  });

  it('registers as a scored grade-B audit with high priority', () => {
    const { meta } = ExtractorSurvivalRecallAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.defaultPriority).toBe('high');
  });
});
