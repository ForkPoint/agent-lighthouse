import { describe, it, expect } from 'vitest';
import { DescriptiveUrlsAudit } from './descriptive-urls';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

describe('DescriptiveUrlsAudit', () => {
  const audit = new DescriptiveUrlsAudit();

  it('passes when all URLs use descriptive slugs', () => {
    const page = mockPageContext(
      'https://example.com/how-to-optimize-for-ai/',
      `<html><body><p>Content</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('descriptive slugs');
  });

  it('warns when some URLs are non-descriptive', () => {
    const good = mockPageContext(
      'https://example.com/getting-started-guide/',
      `<html><body><p>Content</p></body></html>`,
    );
    const bad = mockPageContext(
      'https://example.com/post-123/',
      `<html><body><p>Content</p></body></html>`,
      1,
    );
    const result = audit.audit(mockCheckContext([good, bad]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('non-descriptive URL slugs');
  });

  it('fails when all URLs are non-descriptive', () => {
    const page = mockPageContext(
      'https://example.com/post-123/',
      `<html><body><p>Content</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('All scanned page URLs have non-descriptive slugs');
  });

  it('fails when no pages scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new DescriptiveUrlsAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
});
