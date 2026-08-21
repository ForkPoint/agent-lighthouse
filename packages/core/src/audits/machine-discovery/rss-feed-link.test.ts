import { describe, it, expect } from 'vitest';
import { RssFeedLinkAudit } from './rss-feed-link';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('RssFeedLinkAudit', () => {
  const audit = new RssFeedLinkAudit();

  it('passes when an application/rss+xml alternate link is present', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/feed.xml');
  });

  it('fails when no RSS feed link is present', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(''))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No RSS feed link');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
