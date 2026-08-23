import { describe, it, expect } from 'vitest';
import { emptyContext, expectNotApplicableOnEmpty } from './na-contract';
import type { CheckContext } from '../check-context';
import type { AuditResult } from '../types';

const naAudit = {
  audit(_ctx: CheckContext): AuditResult {
    return { status: 'na', score: 0, message: 'nothing to assess', expected: '', found: '' } as AuditResult;
  },
};
const vacuousAudit = {
  audit(_ctx: CheckContext): AuditResult {
    return { status: 'pass', score: 1, message: 'passes on nothing', expected: '', found: '' } as AuditResult;
  },
};

describe('na contract', () => {
  it('emptyContext has no pages and 404s every fetch', async () => {
    const ctx = emptyContext();
    expect(ctx.pages).toHaveLength(0);
    const result = await ctx.fetch({ url: 'https://example.test/llms.txt' });
    expect(result.status).toBe(404);
  });
  it('accepts an audit that returns na on an empty site', async () => {
    await expectNotApplicableOnEmpty(naAudit);
  });
  it('rejects a vacuous pass', async () => {
    await expect(expectNotApplicableOnEmpty(vacuousAudit)).rejects.toThrow(/vacuous/i);
  });
});
