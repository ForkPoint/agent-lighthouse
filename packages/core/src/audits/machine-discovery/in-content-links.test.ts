import { describe, it, expect } from 'vitest';
import { InContentLinksAudit } from './in-content-links';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

/** A page whose only internal links live in the global nav and footer. */
const CHROME_ONLY = `<html><body>
  <header><nav><a href="/">Home</a><a href="/about">About</a><a href="/pricing">Pricing</a></nav></header>
  <main><p>Body copy with no links at all.</p></main>
  <footer><a href="/terms">Terms</a><a href="/privacy">Privacy</a></footer>
</body></html>`;

/** Two contextual links inside <main>, plus the usual chrome. */
const TWO_IN_CONTENT = `<html><body>
  <header><nav><a href="/">Home</a></nav></header>
  <main><p>See the <a href="/guide">guide</a> and the <a href="/api">API reference</a>.</p></main>
  <footer><a href="/terms">Terms</a></footer>
</body></html>`;

const ONE_IN_CONTENT = `<html><body>
  <header><nav><a href="/">Home</a><a href="/about">About</a></nav></header>
  <main><p>Only the <a href="/guide">guide</a> is linked here.</p></main>
</body></html>`;

const page = (url: string, html: string, index = 0) => mockPageContext(url, html, index);

describe('InContentLinksAudit', () => {
  const audit = new InContentLinksAudit();

  it('passes when every page has at least two in-content internal links', () => {
    const ctx = mockCheckContext([page('https://example.com/', TWO_IN_CONTENT)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('in-content');
  });

  // The rewrite's whole point (reviews 1.15 + 10.11): template chrome made this
  // a near-unconditional pass, because every page has a nav and a footer.
  it('does not count nav, header, footer or aside links', () => {
    const ctx = mockCheckContext([page('https://example.com/', CHROME_ONLY)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no in-content internal links');
  });

  it('ignores links inside [role="navigation"] and [role="contentinfo"]', () => {
    const html = `<html><body><main>
      <div role="navigation"><a href="/a">A</a><a href="/b">B</a></div>
      <div role="contentinfo"><a href="/c">C</a><a href="/d">D</a></div>
      <p>No contextual links.</p>
    </main></body></html>`;
    const ctx = mockCheckContext([page('https://example.com/', html)]);
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('warns when a page has fewer than two in-content links', () => {
    const ctx = mockCheckContext([
      page('https://example.com/', TWO_IN_CONTENT),
      page('https://example.com/thin', ONE_IN_CONTENT, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('thin');
  });

  // Review finding (1.15): a lone accessibility skip-link satisfied the check,
  // because '#main' resolves to the page's own host.
  it('does not count same-page fragments', () => {
    const html =
      '<html><body><main><a href="#main">Skip to content</a><a href="#section-2">Jump</a><p>x</p></main></body></html>';
    const ctx = mockCheckContext([page('https://example.com/', html)]);
    expect(audit.audit(ctx).status).toBe('fail');
  });

  // Review finding (10.11): the site logo linking to / counted as a cross-link
  // from every subpage, and a self-link counted as well.
  it('does not count links to the site root or to the page itself', () => {
    const html =
      '<html><body><main><a href="/">Home</a><a href="/guide">Guide</a><a href="/guide/">Same page</a><p>x</p></main></body></html>';
    const ctx = mockCheckContext([page('https://example.com/guide', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no in-content internal links');
  });

  // Review finding (10.11): de-duplication by full href let a UTM-tagged copy
  // of the same destination count twice.
  it('counts one destination once regardless of query or trailing slash', () => {
    const html = `<html><body><main>
      <a href="/about?utm_source=body">About</a><a href="/about/">About again</a><a href="/about#team">Team</a>
      <p>x</p></main></body></html>`;
    const ctx = mockCheckContext([page('https://example.com/', html)]);
    const result = audit.audit(ctx);
    // One destination, not three: below the bar, so thin rather than linkless.
    expect(result.status).toBe('warn');
    expect(result.found).toContain('1 distinct');
  });

  it('does not count pagination links as contextual links', () => {
    const html =
      '<html><body><main><a href="/blog/page/2">Next</a><a href="/blog/page/3">3</a><p>x</p></main></body></html>';
    const ctx = mockCheckContext([page('https://example.com/blog', html)]);
    expect(audit.audit(ctx).status).toBe('fail');
  });

  // Review finding (1.15): scanning https://www.example.com while the markup
  // links to the bare host classified every link as external.
  it('treats www and bare-host links as the same site', () => {
    const html = `<html><body><main>
      <a href="https://example.com/guide">Guide</a><a href="https://www.example.com/api">API</a>
      <p>x</p></main></body></html>`;
    const ctx = {
      ...mockCheckContext([page('https://www.example.com/', html)]),
      domain: 'www.example.com',
    };
    expect(audit.audit(ctx).status).toBe('pass');
  });

  it('ignores mailto, tel and javascript hrefs', () => {
    const html = `<html><body><main>
      <a href="mailto:a@example.com">Mail</a><a href="tel:+1">Call</a><a href="javascript:void(0)">JS</a>
      <p>x</p></main></body></html>`;
    const ctx = mockCheckContext([page('https://example.com/', html)]);
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('falls back to the body when a page has no main or article element', () => {
    const html =
      '<html><body><p>See <a href="/guide">the guide</a> and <a href="/api">the API</a>.</p></body></html>';
    const ctx = mockCheckContext([page('https://example.com/', html)]);
    expect(audit.audit(ctx).status).toBe('pass');
  });

  it('lists at most five thin pages with a "+N more" suffix', () => {
    const pages = [
      page('https://example.com/', TWO_IN_CONTENT),
      ...Array.from({ length: 6 }, (_, i) =>
        page(`https://example.com/p${i + 1}`, CHROME_ONLY, i + 1),
      ),
    ];
    const result = audit.audit(mockCheckContext(pages));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('+1 more');
  });

  it('is not applicable when no pages were scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('na');
  });
});
