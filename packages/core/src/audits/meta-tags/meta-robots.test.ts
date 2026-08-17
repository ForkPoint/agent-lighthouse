import { describe, it, expect } from 'vitest';
import { MetaRobotsAudit } from './meta-robots';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('MetaRobotsAudit', () => {
  const audit = new MetaRobotsAudit();

  it('passes when there is no robots meta tag', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(''))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No meta robots tag');
  });

  it('passes when robots meta has no noindex directive', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta name="robots" content="index, follow">')),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('no blocking directives');
  });

  it('fails when robots meta contains noindex', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta name="robots" content="noindex, follow">')),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('noindex');
  });

  it('passes when there are no pages (not blocking by default)', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('pass');
  });
});
