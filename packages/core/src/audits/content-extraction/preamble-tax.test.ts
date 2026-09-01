import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { PreambleTaxTokensBeforeTheFirstContentTokenAudit } from './preamble-tax';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { CheckContext } from '../../check-context';

const prose = (n: number) =>
  Array.from(
    { length: n },
    (_v, i) => `Sentence number ${i} explains how the mug keeps coffee hot for hours.`,
  ).join(' ');

const page = (head: string, body: string): CheckContext =>
  mockCheckContext([
    mockPageContext('https://example.com/', `<html><head>${head}</head><body>${body}</body></html>`, 0),
  ]);

describe('PreambleTaxTokensBeforeTheFirstContentTokenAudit', () => {
  const audit = new PreambleTaxTokensBeforeTheFirstContentTokenAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('passes when the main content starts immediately', async () => {
    const result = await audit.audit(page('<title>Mugs</title>', `<main><h1>Mugs</h1><p>${prose(30)}</p></main>`));
    expect(result.status).toBe('pass');
  });

  it('fails when the content sits behind a huge inline style block', async () => {
    const css = '.selector-name{color:#ffffff;background:#000000;padding:12px}'.repeat(1200);
    const result = await audit.audit(
      page(`<style>${css}</style>`, `<main><h1>Mugs</h1><p>${prose(30)}</p></main>`),
    );
    expect(result.status).toBe('fail');
    expect(result.found).toContain('style');
  });

  it('names the largest pre-content node with its token cost and line', async () => {
    const css = '.selector-name{color:#ffffff}'.repeat(1200);
    const result = await audit.audit(
      page(`\n<style>${css}</style>`, `<main><h1>Mugs</h1><p>${prose(30)}</p></main>`),
    );
    expect(result.found).toMatch(/<style> at line \d+/);
    expect(Number(result.details?.['largestNodeTokens'])).toBeGreaterThan(1000);
  });

  it('warns between 2000 and 10000 preamble tokens', async () => {
    const css = '.selector-name{color:#ffffff}'.repeat(400);
    const result = await audit.audit(
      page(`<style>${css}</style>`, `<main><h1>Mugs</h1><p>${prose(30)}</p></main>`),
    );
    expect(result.status).toBe('warn');
    expect(Number(result.details?.['preambleTokens'])).toBeGreaterThan(2000);
    expect(Number(result.details?.['preambleTokens'])).toBeLessThan(10000);
  });

  it('reports the offset as a share of the whole document', async () => {
    const result = await audit.audit(page('', `<main><p>${prose(30)}</p></main>`));
    const share = Number(result.details?.['preambleShare']);
    expect(share).toBeGreaterThanOrEqual(0);
    expect(share).toBeLessThanOrEqual(1);
  });

  // Guessing an offset would invent the finding. Saying so is the honest result.
  it('is notApplicable when the extracted content cannot be located in the body', async () => {
    const ctx = page('', `<main><p>${prose(30)}</p></main>`);
    // A body the parsed page does not correspond to: nothing to locate.
    ctx.pages[0]!.fetchResult.body = '<html><body><p>Different document entirely.</p></body></html>';
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('is notApplicable when no main content can be extracted', async () => {
    const result = await audit.audit(page('', '<nav><a href="/">Home</a></nav>'));
    expect(result.status).toBe('na');
  });

  it('registers as a scored grade-B audit', () => {
    const { meta } = PreambleTaxTokensBeforeTheFirstContentTokenAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.scoreDisplayMode).toBe('ternary');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new PreambleTaxTokensBeforeTheFirstContentTokenAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      PreambleTaxTokensBeforeTheFirstContentTokenAudit.meta.id,
    );
    expect(
      plan.skipped.find(
        (stub) => stub.id === PreambleTaxTokensBeforeTheFirstContentTokenAudit.meta.id,
      )?.status,
    ).toBe('na');
  });
});
