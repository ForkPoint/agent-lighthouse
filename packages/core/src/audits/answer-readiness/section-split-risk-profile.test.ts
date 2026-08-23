import { describe, it, expect } from 'vitest';
import { SectionSplitRiskProfileAudit } from './section-split-risk-profile';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import { countTokens } from '../../gatherers/tokens';
import type { CheckContext } from '../../check-context';

/** Roughly `n` tokens of ordinary prose. */
const prose = (n: number) =>
  Array.from({ length: Math.ceil(n / 12) }, (_v, i) =>
    `Sentence ${i} explains how the copper kettle behaves on a gas hob for readers.`,
  ).join(' ');

const page = (body: string): CheckContext =>
  mockCheckContext([
    mockPageContext(
      'https://example.com/kettles',
      `<html><head><title>Kettles</title></head><body><main><h1>Kettles</h1>${body}</main></body></html>`,
      1,
    ),
  ]);

const section = (heading: string, tokens: number) => `<h2>${heading}</h2><p>${prose(tokens)}</p>`;

describe('SectionSplitRiskProfileAudit', () => {
  const audit = new SectionSplitRiskProfileAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable on a page under one retrieval window', async () => {
    expect((await audit.audit(page(section('Boiling', 100)))).status).toBe('na');
  });

  it('passes a long page cut into sections that each fit the window', async () => {
    const body = ['Boiling', 'Descaling', 'Warranty', 'Storage']
      .map((heading) => section(heading, 300))
      .join('');
    const result = await audit.audit(page(body));
    expect(result.status).toBe('pass');
  });

  it('flags a section over 512 tokens as SPLIT with its headless tail count', async () => {
    const body = section('Boiling', 1600) + section('Descaling', 200);
    const result = await audit.audit(page(body));
    expect(result.found).toContain('SPLIT');
    // ceil(tokens / 512) - 1 headless tails.
    expect(Number(result.details?.['worstSeverity'])).toBeGreaterThanOrEqual(2);
  });

  it('flags a long page with fewer than two h2 elements as BLOB', async () => {
    const result = await audit.audit(page(`<p>${prose(900)}</p>`));
    expect(result.found).toContain('BLOB');
    expect(result.status).toBe('fail');
  });

  it('flags a section under 25 tokens as THIN', async () => {
    const body = section('Boiling', 700) + '<h2>Note</h2><p>Short.</p>';
    const result = await audit.audit(page(body));
    expect(result.found).toContain('THIN');
  });

  it('flags a table whose markdown exceeds the window as ATOMIC-SPLIT', async () => {
    const rows = Array.from(
      { length: 90 },
      (_v, i) => `<tr><td>Row ${i} model name</td><td>Capacity ${i} litres</td><td>Copper body</td></tr>`,
    ).join('');
    const body = section('Boiling', 200) + `<h2>Specifications</h2><table><tr><th>Model</th><th>Capacity</th><th>Body</th></tr>${rows}</table>`;
    const result = await audit.audit(page(body));
    expect(result.found).toContain('ATOMIC-SPLIT');
  });

  it('reports headingDistance as the one actionable number', async () => {
    const result = await audit.audit(page(section('Boiling', 700) + section('Descaling', 200)));
    expect(Number(result.details?.['headingDistance'])).toBeGreaterThan(0);
  });

  it('scores the share of body tokens living inside the window', async () => {
    const result = await audit.audit(page(section('Boiling', 1600) + section('Descaling', 200)));
    const score = Number(result.details?.['score']);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.5);
  });

  // Real BPE counts, never chars / 4.
  it('counts tokens with the o200k tokenizer', async () => {
    const text = prose(600);
    const result = await audit.audit(page(`<h2>Boiling</h2><p>${text}</p><h2>Care</h2><p>${prose(200)}</p>`));
    const reported = (result.details?.['sectionTokens'] as number[])[0];
    expect(reported).toBeCloseTo(countTokens(`Boiling ${text}`), -1);
  });

  it('registers as a scored grade-B audit', () => {
    const { meta } = SectionSplitRiskProfileAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(0.6);
  });
});
