import { describe, it, expect } from 'vitest';
import { MainElementAudit } from './main-element';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('MainElementAudit', () => {
  const audit = new MainElementAudit();

  it('passes when all pages have a <main> element', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><main><p>Content</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1/1');
  });

  it('warns when the homepage has <main> but not all pages do', () => {
    const home = mockPageContext('https://example.com', '<html><body><main>Home</main></body></html>');
    const other = mockPageContext('https://example.com/x', '<html><body><div>No main</div></body></html>');
    const result = audit.audit(mockCheckContext([home, other]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('1/2');
  });

  it('fails when the homepage lacks a <main> element', () => {
    const page = mockPageContext('https://example.com', '<html><body><div>No main</div></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('0/1');
  });
});
