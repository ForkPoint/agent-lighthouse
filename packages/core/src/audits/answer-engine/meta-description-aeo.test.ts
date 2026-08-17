import { describe, it, expect } from 'vitest';
import { MetaDescriptionAeoAudit } from './meta-description-aeo';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('MetaDescriptionAeoAudit', () => {
  const audit = new MetaDescriptionAeoAudit();

  const pageWithDesc = (desc: string) =>
    mockPageContext(
      'https://example.com',
      `<html><head><meta name="description" content="${desc}"></head><body><p>x</p></body></html>`,
    );

  it('passes with an action/result formula', () => {
    const result = audit.audit(
      mockCheckContext([pageWithDesc('Learn how to optimize your site for AI engines to increase visibility.')]),
    );
    expect(result.status).toBe('pass');
    expect(result.message).toContain('action/result');
  });

  it('passes when concrete (contains a number)', () => {
    const result = audit.audit(
      mockCheckContext([pageWithDesc('Boost your online store conversions by 40% this quarter.')]),
    );
    expect(result.status).toBe('pass');
    expect(result.message).toContain('concrete and specific');
  });

  it('passes when concrete (ecommerce material signal)', () => {
    const result = audit.audit(
      mockCheckContext([pageWithDesc('our soft merino wool sweaters with free shipping and returns')]),
    );
    expect(result.status).toBe('pass');
  });

  it('warns on generic marketing filler', () => {
    const result = audit.audit(mockCheckContext([pageWithDesc('Discover our solutions')]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('generic marketing filler');
  });

  it('fails when no meta description exists', () => {
    const page = mockPageContext('https://example.com', '<html><head></head><body><p>x</p></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No meta description');
  });

  it('fails when no pages were scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('passes as substantive when description is non-empty but neither concrete nor generic filler', () => {
    // Not action/result, no digit, no proper noun after first word, no concrete material signal,
    // and does not match GENERIC_DOMINATES pattern — falls through to the final pass branch.
    const result = audit.audit(
      mockCheckContext([pageWithDesc('Our team creates thoughtful content for ambitious businesses.')]),
    );
    expect(result.status).toBe('pass');
    expect(result.message).toContain('present and substantive');
  });
});
