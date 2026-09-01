import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { SingleH1Audit } from './single-h1';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

describe('SingleH1Audit', () => {
  const audit = new SingleH1Audit();

  it('passes when the homepage has exactly one <h1>', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><h1>Primary Title</h1><h2>Section</h2></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1 <h1>');
  });

  it('fails when the homepage has multiple <h1> elements', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><h1>One</h1><h1>Two</h1></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('2 <h1> element(s)');
  });

  it('fails when the homepage has zero <h1> elements', () => {
    const page = mockPageContext('https://example.com', '<html><body><h2>No h1</h2></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('0 <h1>');
  });

  it('fails when there are no pages to evaluate', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages available');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new SingleH1Audit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(SingleH1Audit.meta.id);
    expect(plan.skipped.find((stub) => stub.id === SingleH1Audit.meta.id)?.status).toBe('na');
  });
});
