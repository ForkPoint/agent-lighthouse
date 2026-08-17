import { describe, it, expect } from 'vitest';
import { PotentialActionAudit } from './potential-action';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (head: string) =>
  mockPageContext('https://example.com/', `<html><head>${head}</head><body></body></html>`, 0);

describe('PotentialActionAudit', () => {
  const audit = new PotentialActionAudit();

  it('passes when a schema has a qualifying potentialAction (OrderAction)', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Acme',
          potentialAction: { '@type': 'OrderAction', target: 'https://example.com/order' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('potentialAction');
  });

  it('detects a qualifying potentialAction on a schema inside @graph', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              name: 'Acme',
              potentialAction: { '@type': 'ContactAction', target: 'https://example.com/contact' },
            },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects a potentialAction in a top-level `[{...}]` array (Shopify-style)', () => {
    const ctx = mockCheckContext([
      page(
        ld([
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Acme',
            potentialAction: { '@type': 'OrderAction', target: 'https://example.com/order' },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when no qualifying potentialAction is present', () => {
    const ctx = mockCheckContext([
      page(ld({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No potentialAction');
  });

  it('fails when potentialAction is a non-qualifying type (SearchAction)', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          potentialAction: { '@type': 'SearchAction', target: 'https://example.com/s?q={q}' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('detects a qualifying potentialAction with array @type (Array.isArray @type branch)', () => {
    // potentialAction action object uses array @type, triggering Array.isArray(@type) branch
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Acme',
          potentialAction: {
            '@type': ['OrderAction', 'BuyAction'],
            target: 'https://example.com/order',
          },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when potentialAction action object has no @type (return false branch)', () => {
    // An action object without @type makes matchesAnyType reach `return false`
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Acme',
          potentialAction: { target: 'https://example.com/order' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('detects a qualifying action when potentialAction is an array of actions', () => {
    // potentialAction as an array triggers Array.isArray(action) true branch (line 59)
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Acme',
          potentialAction: [
            { '@type': 'OrderAction', target: 'https://example.com/order' },
            { '@type': 'SearchAction', target: 'https://example.com/search?q={q}' },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
