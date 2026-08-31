import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { LanguageAttributeAudit } from './language-attribute';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  shellSiteContext,
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
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new LanguageAttributeAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      LanguageAttributeAudit.meta.id,
    );
    expect(plan.skipped.find((stub) => stub.id === LanguageAttributeAudit.meta.id)?.status).toBe(
      'na',
    );
  });

  // `requires` deliberately omits `rendered-body`: `<html lang>` is served
  // before any body renders.
  it('still judges a page that served no readable text', async () => {
    const result = await new LanguageAttributeAudit().audit(shellSiteContext());
    expect(result.status).not.toBe('na');
  });
});
