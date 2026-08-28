import { describe, it, expect } from 'vitest';
import { ContentWithoutClickthroughAudit } from './content-without-clickthrough';
import {
  attributableFixture,
  mockCheckContext,
  shellSiteContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

describe('ContentWithoutClickthroughAudit', () => {
  const audit = new ContentWithoutClickthroughAudit();

  it('fails when two or more click-through teasers dominate the page', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Click here to read more about our services.</p>
        <p>Sign up to access the full report.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('click-through teasers');
  });

  it('passes when content is self-contained with enough words', () => {
    const body = Array.from({ length: 12 }, () => 'Our API supports REST and GraphQL with OAuth.').join(' ');
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main><p>${body}</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No excessive click-through teasers');
  });

  it('warns when a non-homepage page has insufficient content', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      '<html><body><main><p>Short content here.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Insufficient content');
  });

  // hiutdenim.co.uk shape: a short first <main> shadowing the real content
  // region. The low-content warning must read the largest <main>, not the first.
  it('counts the largest <main>, so a stub first <main> does not trigger the warning', () => {
    const stub = 'a'.repeat(49);
    const real = Array.from({ length: 120 }, (_, i) => `real${i}`).join(' ');
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <main>${stub}</main>
        <main></main>
        <main><p>${real}</p></main>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('fails when no pages were scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('passes when all pages are homepages (checkPage stays undefined)', () => {
    // Homepage pages are excluded from the word-count check; with no non-homepage pages
    // checkPage is never assigned and the audit goes straight to pass.
    const page = mockPageContext(
      'https://example.com/',
      '<html><body><main><p>Welcome to our store.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('passes when the only non-homepage page has an .xml URL (filtered out)', () => {
    // .xml pages are excluded from the word-count check; checkPage ends up undefined → pass.
    const page = mockPageContext(
      'https://example.com/blog/feed.xml',
      '<html><body><main><p>Atom feed content.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('passes when the only non-homepage page body starts with <?xml (filtered out)', () => {
    // Body starting with <?xml is excluded; checkPage ends up undefined → pass.
    const page = mockPageContext(
      'https://example.com/blog/feed',
      '<?xml version="1.0"?><rss><channel><title>Feed</title></channel></rss>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('warns when a non-homepage page has no <main> element and insufficient content', () => {
    // No <main> element → contentWordCount falls back to $('body').
    // Body has fewer than 50 words → warn.
    const page = mockPageContext(
      'https://example.com/blog/post',
      '<html><body><p>Short content without a main element here.</p></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Insufficient content');
  });

  it('passes when a non-homepage page has an invalid URL (catch sets pathname to empty)', () => {
    // Override URL after creation to trigger the try/catch in the checkPage finder.
    // With pathname='' the .xml check is false; body is HTML so the page is selected
    // as checkPage. The 50+ words in the body mean wordCount >= 50 → pass.
    const body = Array.from({ length: 12 }, () => 'Our API supports REST and GraphQL with OAuth.').join(' ');
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main><p>${body}</p></main></body></html>`,
    );
    page.url = 'not-a-valid-url';
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('truncates the found field when combined teaser details exceed 200 chars', () => {
    // Two teaser pages with long URLs produce a details string > 200 chars,
    // exercising the `details.length > 200` ternary branch.
    const teaserHtml = `<html><body><main>
      <p>Click here to read more about our exclusive content and offers.</p>
      <p>Sign up to access the full report with all the details.</p>
    </main></body></html>`;
    const page1 = mockPageContext(
      'https://example.com/blog/this-is-a-long-title-for-the-page-to-make-details-long',
      teaserHtml,
    );
    const page2 = mockPageContext(
      'https://example.com/products/another-long-page-path-here-to-push-details-over-limit',
      teaserHtml,
    );
    const result = audit.audit(mockCheckContext([page1, page2]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('...');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new ContentWithoutClickthroughAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });

  // Teasers are body copy. The low-content branch skips the homepage, which on a
  // shell scan is often the only page there is, so the pass was unreachable
  // evidence dressed as a clean bill of health.
  it('declines a page that served no readable text', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new ContentWithoutClickthroughAudit();
    const rendered = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(rendered.status, 'the same input rendered is judged').not.toBe('na');

    const shell = await instance.audit(shellSiteContext());
    expect(shell.status).toBe('na');
  });
});
