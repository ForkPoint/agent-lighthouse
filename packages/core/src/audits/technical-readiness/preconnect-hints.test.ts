import { describe, it, expect } from 'vitest';
import { PreconnectHintsAudit } from './preconnect-hints';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('PreconnectHintsAudit', () => {
  const audit = new PreconnectHintsAudit();

  it('passes when a preconnect hint is present', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><head><link rel="preconnect" href="https://fonts.googleapis.com"></head><body></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('fonts.googleapis.com');
  });

  it('fails when no preconnect hints exist', () => {
    const page = mockPageContext('https://example.com', '<html><head></head><body></body></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('No preconnect hints found');
  });

  it('warns when no homepage is available', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No homepage data');
  });

  it('passes but excludes preconnect links without href from list', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><head><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect"></head><body></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    // Both preconnects are counted but only the one with href appears in message
    expect(result.found).toContain('2 preconnect hint(s)');
    expect(result.message).toContain('fonts.googleapis.com');
  });
});
