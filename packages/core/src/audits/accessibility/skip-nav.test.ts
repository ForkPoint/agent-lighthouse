import { describe, it, expect } from 'vitest';
import { SkipNavAudit } from './skip-nav';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('SkipNavAudit', () => {
  const audit = new SkipNavAudit();

  it('passes when a skip-to-content link is among the first body links', () => {
    const html = `<html><body>
      <a href="#main-content">Skip to main content</a>
      <nav><a href="/home">Home</a></nav>
      <main id="main-content">Content</main>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('Skip navigation link detected');
  });

  it('fails when no skip link exists', () => {
    const html = `<html><body>
      <nav><a href="/home">Home</a><a href="/about">About</a></nav>
      <main>Content</main>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No skip navigation link found');
  });

  it('fails when text says skip but href does not target main/content/skip', () => {
    const html = `<html><body>
      <a href="/elsewhere">Skip to elsewhere</a>
      <nav><a href="/home">Home</a></nav>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('warns (na) when no pages were scanned', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('No pages scanned');
  });

  it('handles an anchor with no href attribute without crashing (covers ?? null branch)', () => {
    // <a> without href → attr('href') returns undefined → ?? '' path taken
    const html = `<html><body>
      <a>Click me</a>
      <nav><a href="/home">Home</a></nav>
      <main>Content</main>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No skip navigation link found');
  });

  it('passes with "jump to" wording in the skip link', () => {
    const html = `<html><body>
      <a href="#main-content">Jump to main content</a>
      <nav><a href="/home">Home</a></nav>
      <main id="main-content">Content</main>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('passes with "go to main" wording and #content href in the skip link', () => {
    const html = `<html><body>
      <a href="#content">Go to main content</a>
      <nav><a href="/home">Home</a></nav>
      <main id="content">Content</main>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
