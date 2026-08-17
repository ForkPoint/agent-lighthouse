import { describe, it, expect } from 'vitest';
import { LocalBusinessSchemaAudit } from './local-business-schema';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (body: string, head = '') =>
  mockPageContext('https://example.com/', `<html><head>${head}</head><body>${body}</body></html>`, 0);

const locatorLink = '<a href="/stores">Find a store</a>';
const localBusiness = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Acme Store',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '123 Main St',
    addressLocality: 'City',
    postalCode: '12345',
  },
  telephone: '+1-555-555-5555',
};

describe('LocalBusinessSchemaAudit', () => {
  const audit = new LocalBusinessSchemaAudit();

  it('is not applicable when there are no physical location signals', () => {
    const ctx = mockCheckContext([
      page('<h1>Online only</h1>', ld({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('No physical store signals detected');
  });

  it('passes when physical signals co-occur with LocalBusiness schema', () => {
    // LocalBusiness carries a nested PostalAddress (flattened) and the page has
    // a store-locator link -> physical signals present + matching schema.
    const ctx = mockCheckContext([page(locatorLink, ld(localBusiness))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('LocalBusiness/ProfessionalService schema found');
  });

  it('fails when physical signals exist but no LocalBusiness schema', () => {
    // A standalone PostalAddress block gives the address signal; the locator
    // link gives the second signal; but there is no LocalBusiness schema.
    const ctx = mockCheckContext([
      page(
        locatorLink,
        ld({
          '@context': 'https://schema.org',
          '@type': 'PostalAddress',
          streetAddress: '123 Main St',
          postalCode: '12345',
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no LocalBusiness or ProfessionalService schema');
  });

  it('is not applicable when a PostalAddress exists but there is no locator link', () => {
    const ctx = mockCheckContext([page('<h1>Contact</h1>', ld(localBusiness))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('detects LocalBusiness with array @type (covers Array.isArray branch)', () => {
    // @type as an array triggers the Array.isArray branch in matchesAnyType
    const ctx = mockCheckContext([
      page(
        locatorLink,
        ld({
          '@context': 'https://schema.org',
          '@type': ['LocalBusiness', 'Organization'],
          name: 'Acme Store',
          address: { '@type': 'PostalAddress', streetAddress: '123 Main St', postalCode: '12345' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('handles a schema without @type alongside LocalBusiness (return false branch)', () => {
    // A typeless schema makes matchesAnyType reach its final `return false`.
    // The valid LocalBusiness schema still drives the audit to pass.
    const ctx = mockCheckContext([
      page(
        locatorLink,
        ld([
          { name: 'Untyped object' },
          {
            '@type': 'LocalBusiness',
            name: 'Acme Store',
            address: { '@type': 'PostalAddress', streetAddress: '1 Main St', postalCode: '12345' },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('takes the early-exit path when multiple store-locator links are present', () => {
    // A second matching link triggers `if (found) return;` (the true branch) in
    // hasStoreLocatorLink's each() callback.
    const twoLocatorLinks = `
      <a href="/stores">Find a store</a>
      <a href="/locations">Our locations</a>
    `;
    const ctx = mockCheckContext([page(twoLocatorLinks, ld(localBusiness))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects a store locator via link text when href does not match', () => {
    // href "/about" does not match the locator regex, but the link text
    // "Store Locator" matches the text pattern — covering the text-branch of ||.
    const textMatchLink = '<a href="/about">Store Locator</a>';
    const ctx = mockCheckContext([
      page(
        textMatchLink,
        ld({
          '@context': 'https://schema.org',
          '@type': 'PostalAddress',
          streetAddress: '123 Main St',
          postalCode: '12345',
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    // PostalAddress block + text-matched locator link = physical signals found,
    // but no LocalBusiness schema → fail
    expect(result.status).toBe('fail');
  });
});
