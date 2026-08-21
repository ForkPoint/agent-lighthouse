import { describe, it, expect } from 'vitest';
import { TwitterCardAudit } from './twitter-card';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

const ALL_TWITTER = `
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Title">
  <meta name="twitter:description" content="Description">
`;

describe('TwitterCardAudit', () => {
  const audit = new TwitterCardAudit();

  it('passes when all required Twitter Card tags are present', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(ALL_TWITTER))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('All required Twitter Card tags');
  });

  it('warns when some but not all Twitter Card tags are present', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<meta name="twitter:card" content="summary_large_image">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('twitter:title');
  });

  it('fails when all Twitter Card tags are missing', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(''))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Missing Twitter Card tags');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
