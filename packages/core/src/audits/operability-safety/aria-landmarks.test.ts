import { describe, it, expect } from 'vitest';
import { AriaLandmarksAudit } from './aria-landmarks';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('AriaLandmarksAudit', () => {
  const audit = new AriaLandmarksAudit();

  it('passes when all four landmarks are present', () => {
    const html = `<html><body>
      <header>Site</header>
      <nav>Menu</nav>
      <main>Content</main>
      <footer>Footer</footer>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('Present');
  });

  it('passes when landmarks are present via ARIA roles', () => {
    const html = `<html><body>
      <div role="banner">Site</div>
      <div role="navigation">Menu</div>
      <div role="main">Content</div>
      <div role="contentinfo">Footer</div>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    expect(audit.audit(ctx).status).toBe('pass');
  });

  it('warns when exactly one landmark is missing', () => {
    const html = `<html><body>
      <header>Site</header>
      <nav>Menu</nav>
      <main>Content</main>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('Missing: contentinfo/footer');
  });

  it('fails when two or more landmarks are missing', () => {
    const html = `<html><body><div>Just a div</div></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Missing ARIA landmarks');
  });

  it('warns when only banner/header is missing (covers its code-generation branch)', () => {
    const html = `<html><body>
      <nav>Menu</nav>
      <main>Content</main>
      <footer>Footer</footer>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('Missing: banner/header');
  });

  it('warns when only main is missing (covers its code-generation branch)', () => {
    const html = `<html><body>
      <header>Site</header>
      <nav>Menu</nav>
      <footer>Footer</footer>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('Missing: main');
  });

  it('warns when only navigation is missing (covers its code-generation branch)', () => {
    const html = `<html><body>
      <header>Site</header>
      <main>Content</main>
      <footer>Footer</footer>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('Missing: navigation');
  });

  it('warns when no pages were scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('No pages scanned');
  });
});
