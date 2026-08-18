import { describe, it, expect } from 'vitest';
import { FormActionabilityAudit } from './form-actionability';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const page = (html: string) =>
  mockCheckContext([mockPageContext('https://example.com/contact', html, 0)]);

describe('FormActionabilityAudit', () => {
  const audit = new FormActionabilityAudit();

  it('returns na when no forms are present', () => {
    const result = audit.audit(page('<html><body><h1>Hello</h1></body></html>'));
    expect(result.status).toBe('na');
  });

  it('returns na when forms have no fillable fields', () => {
    const html = `<html><body>
      <form action="/go" method="post">
        <input type="hidden" name="token" value="x" />
        <button type="submit">Go</button>
      </form>
    </body></html>`;
    const result = audit.audit(page(html));
    expect(result.status).toBe('na');
  });

  it('passes for a fully labeled form with standard autocomplete', () => {
    const html = `<html><body>
      <form action="/api/contact" method="post">
        <label for="full-name">Full name</label>
        <input id="full-name" name="name" type="text" autocomplete="name" />
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" />
        <label>Message
          <textarea name="message"></textarea>
        </label>
        <input type="submit" value="Send" />
      </form>
    </body></html>`;
    const result = audit.audit(page(html));
    expect(result.status).toBe('pass');
    expect(result.score).toBe(1);
  });

  it('passes with aria-label association instead of <label>', () => {
    const html = `<html><body>
      <form action="/search" method="get">
        <input name="q" type="search" aria-label="Search query" />
      </form>
    </body></html>`;
    const result = audit.audit(page(html));
    expect(result.status).toBe('pass');
  });

  it('fails for unlabeled inputs and a div role=textbox', () => {
    const html = `<html><body>
      <form action="/signup" method="post">
        <input name="email" type="email" />
        <input name="phone" type="tel" />
        <input name="fullName" type="text" />
        <div role="textbox" id="bio"></div>
      </form>
    </body></html>`;
    const result = audit.audit(page(html));
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.found).toContain('not a native form element');
    expect(result.found).toContain('missing autocomplete');
  });

  it('warns when between 50% and 90% of fields are actionable', () => {
    const html = `<html><body>
      <form action="/api/contact" method="post">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" />
        <input name="company" type="text" />
      </form>
    </body></html>`;
    const result = audit.audit(page(html));
    expect(result.status).toBe('warn');
    expect(result.score).toBe(0.5);
  });

  it('flags identity fields with non-standard autocomplete values', () => {
    const html = `<html><body>
      <form action="/signup" method="post">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="on" />
        <input name="q" type="text" />
      </form>
    </body></html>`;
    const result = audit.audit(page(html));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('non-standard autocomplete');
  });

  it('truncates the non-actionable field list to 10 entries', () => {
    const inputs = Array.from({ length: 12 }, (_, i) => `<input name="f${i}" type="text" />`).join('\n');
    const html = `<html><body><form action="/x" method="post">${inputs}</form></body></html>`;
    const result = audit.audit(page(html));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('and 2 more');
  });
});
