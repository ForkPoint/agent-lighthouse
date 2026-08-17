import { describe, it, expect } from 'vitest';
import { ServiceProductSchemaAudit } from './service-product-schema';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (head: string) =>
  mockPageContext('https://example.com/services', `<html><head>${head}</head><body></body></html>`, 1);

describe('ServiceProductSchemaAudit', () => {
  const audit = new ServiceProductSchemaAudit();

  it('fails when no Service or Product schema is present', () => {
    const ctx = mockCheckContext([
      page(ld({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No Service or Product schema found');
  });

  it('passes when Service has name, description, and provider', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Consulting',
          description: 'We consult.',
          provider: { '@type': 'Organization', name: 'Acme' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects Service/Product nested inside @graph', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Product',
              name: 'Widget',
              description: 'A widget.',
              provider: { '@type': 'Organization', name: 'Acme' },
            },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects Service in a top-level `[{...}]` array (Shopify-style)', () => {
    const ctx = mockCheckContext([
      page(
        ld([
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Consulting',
            description: 'We consult.',
            provider: { '@type': 'Organization', name: 'Acme' },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('warns when Service/Product is missing required props', () => {
    const ctx = mockCheckContext([
      page(ld({ '@context': 'https://schema.org', '@type': 'Product', name: 'Widget' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('missing: description, provider');
  });

  it('detects a Service with array @type (Array.isArray branch in matchesAnyType)', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': ['Service', 'ProfessionalService'],
          name: 'Consulting',
          description: 'We consult.',
          provider: { '@type': 'Organization', name: 'Acme' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
