import { describe, it, expect } from 'vitest';
import { SvgBloatAudit } from './svg-bloat';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const pathData = (bytes: number) => `<path d="${'M0 0L1 1'.repeat(Math.ceil(bytes / 8))}"/>`;
const bigSvg = (bytes: number, attrs = '') =>
  `<svg ${attrs} viewBox="0 0 100 100">${pathData(bytes)}</svg>`;

describe('SvgBloatAudit', () => {
  const audit = new SvgBloatAudit();

  it('is not applicable when no SVGs exist', () => {
    const html = '<html><head></head><body><h1>Hello</h1></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('No inline SVG');
  });

  it('passes when SVGs are small', () => {
    const html = `<html><body>${bigSvg(200)}</body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('unhidden');
  });

  it('passes when large SVGs are aria-hidden', () => {
    const html = `<html><body>${bigSvg(30000, 'aria-hidden="true"')}</body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('0 unhidden');
  });

  it('passes when large SVGs have role="presentation"', () => {
    const html = `<html><body>${bigSvg(30000, 'role="presentation"')}</body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('warns when an unhidden SVG exceeds 2KB', () => {
    const html = `<html><body>${bigSvg(4000)}</body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('exceed 2KB');
    expect(result.found).toContain('Top offenders');
  });

  it('fails when a single unhidden SVG exceeds 10KB', () => {
    const html = `<html><body>${bigSvg(12000)}</body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Severe SVG context bloat');
  });

  it('fails when total unhidden SVG bytes exceed 20KB across pages', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', `<html><body>${bigSvg(9000)}</body></html>`, 0),
      mockPageContext(
        'https://example.com/about',
        `<html><body>${bigSvg(9000)}${bigSvg(6000)}</body></html>`,
        1,
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('https://example.com/about');
  });

  it('warns when many small unhidden SVGs total over 8KB', () => {
    const svgs = Array.from({ length: 6 }, () => bigSvg(1500)).join('');
    const html = `<html><body>${svgs}</body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('bloating agent context');
  });

  it('warns when total unhidden SVG bytes exceed 8KB', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', `<html><body>${bigSvg(5000)}</body></html>`, 0),
      mockPageContext('https://example.com/about', `<html><body>${bigSvg(5000)}</body></html>`, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
  });
});
