import { describe, it, expect } from 'vitest';
import { NavAriaLabelAudit } from './nav-aria-label';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('NavAriaLabelAudit', () => {
  const audit = new NavAriaLabelAudit();

  it('passes when all nav elements have aria-label', () => {
    const html = `<html><body>
      <nav aria-label="Main navigation"><a href="/">Home</a></nav>
      <nav aria-labelledby="footer-heading"><a href="/x">X</a></nav>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('all labeled');
  });

  it('warns when at least half of navs are labeled but some are not', () => {
    const html = `<html><body>
      <nav aria-label="Main">a</nav>
      <nav>b</nav>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('1 of 2');
  });

  it('fails when fewer than half of navs are labeled', () => {
    const html = `<html><body>
      <nav aria-label="Main">a</nav>
      <nav>b</nav>
      <nav>c</nav>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('2 of 3');
  });

  it('warns when no nav elements exist on page', () => {
    const html = `<html><body><div>no nav here</div></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('No <nav> elements on page');
  });

  it('warns when no pages were scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('No pages scanned');
  });
});
