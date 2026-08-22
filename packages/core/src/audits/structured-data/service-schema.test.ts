import { describe, it, expect } from 'vitest';
import { ServiceSchemaAudit } from './service-schema';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (head: string) =>
  mockPageContext('https://example.com/services', `<html><head>${head}</head><body></body></html>`, 1);

describe('ServiceSchemaAudit', () => {
  const audit = new ServiceSchemaAudit();

  it('is registered under the narrowed id', () => {
    expect(ServiceSchemaAudit.meta.id).toBe('structured-data/service-schema');
  });

  it('fails when no Service schema is present', () => {
    const ctx = mockCheckContext([
      page(ld({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No Service schema found');
  });

  it('passes when Service has name and provider', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Consulting',
          provider: { '@type': 'Organization', name: 'Acme' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects a Service nested inside @graph', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Service',
              name: 'Consulting',
              provider: { '@type': 'Organization', name: 'Acme' },
            },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects a Service in a top-level `[{...}]` array (Shopify-style)', () => {
    const ctx = mockCheckContext([
      page(
        ld([
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Consulting',
            provider: { '@type': 'Organization', name: 'Acme' },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('accepts ProfessionalService, the other in-scope type', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: 'Acme Legal',
          provider: { '@type': 'Organization', name: 'Acme' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects a Service with array @type (Array.isArray branch in matchesAnyType)', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': ['Service', 'ProfessionalService'],
          name: 'Consulting',
          provider: { '@type': 'Organization', name: 'Acme' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('warns when the Service is missing provider', () => {
    const ctx = mockCheckContext([
      page(ld({ '@context': 'https://schema.org', '@type': 'Service', name: 'Consulting' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('missing: provider');
  });

  // The narrowing: a Product node is the Product half's business now (3.22),
  // so this audit must not claim it — neither as a subject nor as evidence
  // that "a Service exists".
  it('ignores Product schema entirely — that half moved to advanced-product-details', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Widget',
          brand: { '@type': 'Brand', name: 'Acme' },
          offers: { '@type': 'Offer', availability: 'https://schema.org/InStock' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No Service schema found');
  });

  // 3.8's required fix: "drop `description` from the required set" —
  // schema.org does not require it and no consumer documents it.
  it('does not require description', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Consulting',
          provider: { '@type': 'Organization', name: 'Acme' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).not.toContain('description');
  });

  // 3.8's required fix: "evaluate the best-covered node rather than `[0]`".
  // A listing stub hoisted ahead of the real Service node must not decide the
  // verdict for the whole scan.
  it('judges the best-covered Service node, not the first one found', () => {
    const ctx = mockCheckContext([
      page(
        ld([
          { '@context': 'https://schema.org', '@type': 'Service', name: 'Consulting' },
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Consulting',
            provider: { '@type': 'Organization', name: 'Acme' },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('warns naming every missing property when no node covers any of them', () => {
    const ctx = mockCheckContext([
      page(ld({ '@context': 'https://schema.org', '@type': 'Service' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('missing: name, provider');
  });

  it('reports the Service count in `found`', () => {
    const ctx = mockCheckContext([
      page(
        ld([
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Consulting',
            provider: { '@type': 'Organization', name: 'Acme' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Training',
            provider: { '@type': 'Organization', name: 'Acme' },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('2');
  });
});
