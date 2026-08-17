import { describe, it, expect } from 'vitest';
import { FormsNoJsAudit } from './forms-no-js';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('FormsNoJsAudit', () => {
  const audit = new FormsNoJsAudit();

  it('passes when all forms have action and method', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <form action="/api/contact" method="POST"><input name="name" /></form>
        <form action="/search" method="GET"><input name="q" /></form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 form(s)');
  });

  it('warns when some forms lack an action attribute', () => {
    // method defaults to GET in the parser, so action is the deciding attribute.
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <form action="/api/contact" method="POST"><input name="name" /></form>
        <form method="POST"><input name="email" /></form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('1/2 forms have action');
  });

  it('fails when no form has an action attribute', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <form><input name="name" /></form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('require JavaScript');
  });

  it('returns na when there are no forms (nothing to check)', () => {
    const page = mockPageContext('https://example.com', '<html><body><p>no forms</p></body></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.found).toBe('0 forms');
  });

  it('sets firstPageUrl from the first page and does not overwrite on subsequent pages', () => {
    const page1 = mockPageContext(
      'https://example.com',
      `<html><body>
        <form action="/api/contact" method="POST"><input name="name" /></form>
      </body></html>`,
    );
    const page2 = mockPageContext(
      'https://example.com/signup',
      `<html><body>
        <form action="/api/signup" method="POST"><input name="email" /></form>
      </body></html>`,
      1,
    );
    const ctx = mockCheckContext([page1, page2]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 form(s)');
  });
});
