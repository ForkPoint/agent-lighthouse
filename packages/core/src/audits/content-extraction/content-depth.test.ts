import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { ContentDepthAudit } from './content-depth';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

const manyWords = Array.from({ length: 350 }, (_, i) => `word${i}`).join(' ');

describe('ContentDepthAudit', () => {
  const audit = new ContentDepthAudit();

  it('passes when all pages exceed 300 words', () => {
    const page = mockPageContext('https://example.com', `<html><body><p>${manyWords}</p></body></html>`);
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1/1');
  });

  it('warns when the homepage is deep but a secondary page is thin', () => {
    const home = mockPageContext('https://example.com', `<html><body><p>${manyWords}</p></body></html>`);
    const thin = mockPageContext('https://example.com/x', '<html><body><p>Too short here.</p></body></html>');
    const result = audit.audit(mockCheckContext([home, thin]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Lowest:');
  });

  it('fails when the only page is thin', () => {
    const page = mockPageContext('https://example.com', '<html><body><p>Just a few words.</p></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('0/1');
  });

  it('passes when there are no pages (empty ctx.pages)', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new ContentDepthAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(ContentDepthAudit.meta.id);
    expect(plan.skipped.find((stub) => stub.id === ContentDepthAudit.meta.id)?.status).toBe('na');
  });
});
