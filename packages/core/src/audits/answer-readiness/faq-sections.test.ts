import { describe, it, expect } from 'vitest';
import { FaqSectionsAudit } from './faq-sections';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('FaqSectionsAudit', () => {
  const audit = new FaqSectionsAudit();

  it('passes when FAQPage JSON-LD is present', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}
        </script>
      </head><body><main><p>Some content.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('FAQPage structured data');
  });

  it('passes when an FAQ heading is present', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body><main>
        <h2>Frequently Asked Questions</h2>
        <h3>What is your return policy?</h3>
        <p>We offer a 30-day guarantee.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('FAQ label');
  });

  it('passes when an FAQ accordion container is present', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body><main>
        <h2>Help Center</h2>
        <div class="faq-section">
          <div class="faq-item">Some question text</div>
        </div>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('accordion');
  });

  it('fails when no FAQ signals exist', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body><main>
        <h2>About Us</h2>
        <p>We make great products.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No FAQ sections found');
  });

  it('fails when no pages were scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('passes when FAQPage is expressed as an array @type in JSON-LD', () => {
    // Uses a three-element array ["WebPage", null, "FAQPage"] to cover all three
    // branch directions of the .some() callback on line 16:
    //   "WebPage" → typeof string TRUE, /faqpage/ FALSE  (regex-false branch)
    //   null      → typeof string FALSE                   (typeof-false branch)
    //   "FAQPage" → typeof string TRUE, /faqpage/ TRUE   (full match, returns true)
    const page = mockPageContext(
      'https://example.com',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":["WebPage",null,"FAQPage"],"mainEntity":[]}
        </script>
      </head><body><main><p>Content here.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('FAQPage structured data');
  });

  it('passes when an element with an id containing "faq" is present (no class attr)', () => {
    // Exercises the filter callback branches on lines 91 and 93:
    //   - attr('class') is undefined → ?? '' right side taken (line 91)
    //   - /faq/.test(cls) is false → evaluates right: /faq/.test(id) is true (line 93)
    const page = mockPageContext(
      'https://example.com',
      `<html><body><main>
        <h2>Help Center</h2>
        <div id="faq-section">
          <p>What is your return policy?</p>
        </div>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('accordion');
  });

  it('passes when a <summary> element contains FAQ text', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body><main>
        <details>
          <summary>Frequently Asked Questions</summary>
          <p>Here are the most common questions.</p>
        </details>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('Frequently Asked Questions');
  });

  it('does not false-positive when JSON-LD @type is a non-string non-array value', () => {
    // @type = 42 (number): typeof 42 !== 'string' → line 15 false; Array.isArray(42) → false
    // → line 16 && short-circuits (FALSE branch of Array.isArray covered). No FAQ signals → fail.
    const page = mockPageContext(
      'https://example.com',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":42,"name":"Test"}
        </script>
      </head><body><main><p>No FAQ content on this page at all.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
  });

  it('passes when question-formatted <details><summary> elements are present', () => {
    // No FAQ class/id, no FAQ heading — but <details><summary> ending with '?' qualifies.
    const page = mockPageContext(
      'https://example.com',
      `<html><body><main>
        <details>
          <summary>What is your return policy?</summary>
          <p>We offer a 30-day money-back guarantee.</p>
        </details>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('accordion');
  });
});
