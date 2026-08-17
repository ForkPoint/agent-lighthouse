import { describe, it, expect } from 'vitest';
import { FaqPageSchemaAudit } from './faqpage-schema';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (body: string, head = '') =>
  mockPageContext('https://example.com/faq', `<html><head>${head}</head><body>${body}</body></html>`, 1);

const faq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is your return policy?',
      acceptedAnswer: { '@type': 'Answer', text: '30 days.' },
    },
  ],
};

describe('FaqPageSchemaAudit', () => {
  const audit = new FaqPageSchemaAudit();

  it('warns (low) when no question-patterned headings exist', () => {
    const ctx = mockCheckContext([page('<h1>Welcome</h1>')]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No pages with question-patterned headings');
  });

  it('passes when a page with question headings has FAQPage schema', () => {
    const ctx = mockCheckContext([page('<h2>What is your return policy?</h2>', ld(faq))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects FAQPage nested inside @graph', () => {
    const ctx = mockCheckContext([
      page(
        '<h2>What is your return policy?</h2>',
        ld({ '@context': 'https://schema.org', '@graph': [faq] }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when question headings exist but no FAQPage schema', () => {
    const ctx = mockCheckContext([page('<h2>What is your return policy?</h2>')]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No FAQPage schema found');
  });

  it('warns when only some pages with question headings have FAQPage schema', () => {
    // Covers the someHave warn path (not all pages have FAQPage)
    const ctx = mockCheckContext([
      page('<h2>What is your return policy?</h2>', ld(faq)),
      mockPageContext(
        'https://example.com/support',
        '<html><head></head><body><h2>How can I contact you?</h2></body></html>',
        1,
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toBe('1/2 pages with FAQPage schema');
  });

  it('detects FAQPage with array @type (Array.isArray branch in matchesType)', () => {
    // @type as an array triggers the Array.isArray branch in matchesType
    const ctx = mockCheckContext([
      page(
        '<h2></h2><h2>What is your return policy?</h2>',
        ld({ ...faq, '@type': ['FAQPage', 'WebPage'] }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
