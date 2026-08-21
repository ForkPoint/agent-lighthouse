import { describe, it, expect } from 'vitest';
import { FirstParagraphAnswersAudit } from './first-paragraph-answers';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('FirstParagraphAnswersAudit', () => {
  const audit = new FirstParagraphAnswersAudit();

  it('is not-applicable when no article content page is scanned', () => {
    // Homepage ('/' as first page) is not an article content page.
    const page = mockPageContext('https://example.com/', '<html><body><main><p>Home</p></main></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
    expect(result.message).toContain('No article content pages');
  });

  it('passes when the first substantive paragraph is a declarative answer', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Unified content preparation optimizes your site for AI agents by structuring content with semantic HTML and machine-readable metadata.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('direct, declarative answer');
  });

  it('fails when the first paragraph starts with a weak opener', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>In this article we explore how to prepare content for AI agents using semantic markup and structured data today.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('weak opener');
  });

  it('fails when there is no substantive opening paragraph', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Home</p>
        <p>Search</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No substantive opening paragraph');
  });

  it('falls back to <body> when no <main> element exists', () => {
    // No <main> element — the audit must use $('body') as the container.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <p>Unified content preparation optimizes your site for AI agents by structuring content with semantic HTML, JSON-LD, and machine-readable metadata for better visibility.</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('includes the full text in found when the first paragraph is 120 chars or fewer', () => {
    // Short declarative paragraph (≤120 chars) → firstP.length > 120 is false → found = firstP (no truncation).
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Unified content preparation structures your site for AI agents using semantic HTML and clear markup.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).not.toContain('...');
  });

  it('truncates a long declarative first paragraph in the found field', () => {
    // Paragraph > 120 chars, strong opener — exercises the firstP.length > 120 ternary in the pass branch.
    const longPara =
      'Unified content preparation optimizes your site for AI agents by structuring content with semantic HTML, JSON-LD, and machine-readable metadata for better search engine visibility and AI answer results.';
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main><p>${longPara}</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('...');
  });

  it('truncates a long weak-opener paragraph in the found field', () => {
    // Paragraph > 120 chars, weak opener — exercises the firstP.length > 120 ternary in the fail branch.
    const longPara =
      'In this article we explore how to prepare content for AI agents using semantic markup, structured data, and machine-readable metadata to improve visibility in search engines and AI answer results.';
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main><p>${longPara}</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('...');
  });
});
