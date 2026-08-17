import { describe, it, expect } from 'vitest';
import { DescriptiveUrlsAudit } from './descriptive-urls';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

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
});
