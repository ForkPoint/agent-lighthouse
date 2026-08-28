import { describe, it, expect } from 'vitest';
import { LanguageAttributeAudit } from './language-attribute';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

describe('LanguageAttributeAudit', () => {
  const audit = new LanguageAttributeAudit();

  it('passes when <html lang> is set', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', '<html lang="en"><head></head><body></body></html>'),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('lang="en"');
  });

  it('fails when <html> has no lang attribute', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', '<html><head></head><body></body></html>'),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No lang attribute');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new LanguageAttributeAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
});
