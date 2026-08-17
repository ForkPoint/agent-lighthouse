import { describe, it, expect } from 'vitest';
import { NoRenderBlockingAudit } from './no-render-blocking';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('NoRenderBlockingAudit', () => {
  const audit = new NoRenderBlockingAudit();

  const body = `<body><main>${'content '.repeat(40)}</main></body>`;

  it('passes when head scripts are deferred', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><head><script src="app.js" defer></script></head>${body}</html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No render-blocking');
  });

  it('fails when a synchronous blocking script is in head', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><head><script src="blocking.js"></script></head>${body}</html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('render-blocking script');
    expect(result.found).toContain('blocking.js');
  });

  it('warns when the page body has virtually no content', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no content');
  });

  it('warns when no homepage is available', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No homepage data');
  });

  it('ignores script[src=""] in head (empty src skips headScriptSrcs)', () => {
    // A head script with src="" satisfies the [src] selector but attr('src')=""
    // so `if (src)` is false and it is never added to headScriptSrcs → not blocking
    const page = mockPageContext(
      'https://example.com',
      `<html><head><script src=""></script></head>${body}</html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No render-blocking');
  });

  it('does not count a nomodule script as blocking', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><head><script src="ie-polyfill.js" nomodule></script></head>${'<body><main>' + 'content '.repeat(40) + '</main></body>'}</html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No render-blocking');
  });
});
