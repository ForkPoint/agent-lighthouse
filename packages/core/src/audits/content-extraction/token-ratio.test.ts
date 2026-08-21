import { describe, it, expect } from 'vitest';
import { TokenRatioAudit } from './token-ratio';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

describe('TokenRatioAudit', () => {
  const audit = new TokenRatioAudit();

  it('passes when the page is mostly content text', () => {
    const text = 'meaningful content words '.repeat(200);
    const html = `<html><head><title>T</title></head><body><main><h1>Hi</h1><p>${text}</p></main></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.displayValue).toContain('%');
  });

  it('warns when content share is between 5% and 15%', () => {
    const text = 'some real content here. '.repeat(10); // ~240 chars of text
    const padding = `<div class="${'a'.repeat(40)}"></div>`.repeat(50); // ~2.5k chars of markup, no text
    const html = `<html><body><main><p>${text}</p>${padding}</main></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.priority).toBe('high');
  });

  it('fails when tiny text is buried in huge markup padding', () => {
    const padding = `<div class="${'a'.repeat(200)}" data-x="${'b'.repeat(200)}"><span></span></div>`.repeat(
      100,
    );
    const html = `<html><body><main>${padding}<p>Buy now</p></main></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.displayValue).toContain('%');
    expect(result.priority).toBe('high');
  });

  it('ignores inline script and style weight in the content measure', () => {
    const text = 'visible words only '.repeat(100);
    const script = `<script>${'var x = 1;'.repeat(20000)}</script>`;
    const html = `<html><body><main><p>${text}</p>${script}</main></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    // script is excluded from clean text but counted in raw HTML -> low ratio -> fail
    expect(result.status).toBe('fail');
  });

  it('returns na when the body is empty', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', '', 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
  });
});
