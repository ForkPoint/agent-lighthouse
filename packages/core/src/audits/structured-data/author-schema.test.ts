import { describe, it, expect } from 'vitest';
import { AuthorSchemaAudit } from './author-schema';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (head: string) =>
  mockPageContext('https://example.com/blog/post', `<html><head>${head}</head><body></body></html>`, 1);

const completePerson = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Jane Smith',
  jobTitle: 'Engineer',
  sameAs: ['https://linkedin.com/in/jane'],
  affiliation: { '@type': 'Organization', name: 'Acme' },
};

describe('AuthorSchemaAudit', () => {
  const audit = new AuthorSchemaAudit();

  it('fails when no Person/author schema is present', () => {
    const ctx = mockCheckContext([
      page(ld({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No Person (author) schema found');
  });

  it('passes when a complete Person schema is present', () => {
    const ctx = mockCheckContext([page(ld(completePerson))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects a complete Person via an Article author property', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'X',
          author: {
            '@type': 'Person',
            name: 'Jane',
            jobTitle: 'Engineer',
            sameAs: ['https://linkedin.com/in/jane'],
            affiliation: { '@type': 'Organization', name: 'Acme' },
          },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects a Person in a top-level `[{...}]` array (Shopify-style)', () => {
    const ctx = mockCheckContext([page(ld([completePerson]))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('warns when the Person schema is missing credentials', () => {
    const ctx = mockCheckContext([
      page(ld({ '@context': 'https://schema.org', '@type': 'Person', name: 'Jane' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('missing: jobTitle, sameAs, affiliation');
  });

  it('detects a complete Person schema with array @type', () => {
    // Covers Array.isArray(@type) true branch in matchesType
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': ['Person', 'Employee'],
          name: 'Jane Smith',
          jobTitle: 'Engineer',
          sameAs: ['https://linkedin.com/in/jane'],
          affiliation: { '@type': 'Organization', name: 'Acme' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('handles a schema without @type alongside a valid Person (return false branch)', () => {
    // A JSON-LD array with a typeless object makes matchesType reach `return false`.
    // The valid Person schema still drives the audit to pass.
    const ctx = mockCheckContext([
      page(
        ld([
          { name: 'Raw data without a type field' },
          {
            '@type': 'Person',
            name: 'Jane Smith',
            jobTitle: 'Engineer',
            sameAs: ['https://linkedin.com/in/jane'],
            affiliation: { '@type': 'Organization', name: 'Acme' },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('picks the best Person when multiple persons differ in completeness', () => {
    // Forces the `? p : best` true branch in the reduce (currentMissing < bestMissing)
    // by having two Person schemas where the second is more complete than the first.
    const ctx = mockCheckContext([
      page(
        ld([
          { '@type': 'Person', name: 'Incomplete Alice' },
          {
            '@type': 'Person',
            name: 'Jane Smith',
            jobTitle: 'Engineer',
            sameAs: ['https://linkedin.com/in/jane'],
            affiliation: { '@type': 'Organization', name: 'Acme' },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    // Should pass because Jane (the better person) is selected by reduce
    expect(result.status).toBe('pass');
  });
});
