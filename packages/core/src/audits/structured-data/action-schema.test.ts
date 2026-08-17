import { describe, it, expect } from 'vitest';
import { ActionSchemaAudit } from './action-schema';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (url: string, head = '') =>
  mockPageContext(url, `<html><head>${head}</head><body></body></html>`, 1);

const confirmPage = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  potentialAction: { '@type': 'ConfirmAction', target: 'https://example.com/confirm' },
};

describe('ActionSchemaAudit', () => {
  const audit = new ActionSchemaAudit();

  it('warns (low) when no confirmation pages are detected', () => {
    const ctx = mockCheckContext([page('https://example.com/about')]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No thank-you or confirmation pages');
  });

  it('passes when a confirmation page has a ConfirmAction', () => {
    const ctx = mockCheckContext([page('https://example.com/thank-you', ld(confirmPage))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects a ConfirmAction on a schema nested inside @graph', () => {
    const ctx = mockCheckContext([
      page(
        'https://example.com/order-complete',
        ld({ '@context': 'https://schema.org', '@graph': [confirmPage] }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when a confirmation page has no action schema', () => {
    const ctx = mockCheckContext([
      page(
        'https://example.com/confirmation',
        ld({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Confirmed' }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No ConfirmAction/ReserveAction found');
  });

  it('warns when only some confirmation pages have an action schema', () => {
    const ctx = mockCheckContext([
      page('https://example.com/thank-you', ld(confirmPage)),
      page('https://example.com/success'),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toBe('1/2 confirmation pages with action schema');
  });

  it('detects a standalone ConfirmAction with array @type', () => {
    // Covers the Array.isArray(@type) branch in matchesAnyType (line 10)
    const ctx = mockCheckContext([
      page(
        'https://example.com/thank-you',
        ld({
          '@context': 'https://schema.org',
          '@type': ['ConfirmAction', 'Action'],
          target: 'https://example.com/confirm',
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects a potentialAction when it is an array of action objects', () => {
    // Covers Array.isArray(action) ternary true-branch (line 83)
    const ctx = mockCheckContext([
      page(
        'https://example.com/order-complete',
        ld({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          potentialAction: [
            { '@type': 'ReserveAction', target: 'https://example.com/reserve' },
            { '@type': 'SearchAction', target: 'https://example.com/search?q={q}' },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
