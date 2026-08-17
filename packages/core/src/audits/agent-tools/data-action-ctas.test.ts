import { describe, it, expect } from 'vitest';
import { DataActionCtasAudit } from './data-action-ctas';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('DataActionCtasAudit', () => {
  const audit = new DataActionCtasAudit();

  it('passes when elements have both data-action and data-action-type', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <button data-action="book-demo" data-action-type="conversion">Book a Demo</button>
        <a href="/pricing" data-action="view-pricing" data-action-type="navigation">Pricing</a>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('data-action-type');
  });

  it('warns when only data-action is present (no data-action-type)', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <button data-action="book-demo">Book a Demo</button>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Partial');
  });

  it('fails when no data-action attributes are present', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body><button>Book a Demo</button></body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toBe('None');
  });

  it('records foundPage from the first matching page when multiple pages match', () => {
    const page1 = mockPageContext(
      'https://example.com',
      `<html><body>
        <button data-action="book-demo" data-action-type="conversion">Book</button>
      </body></html>`,
    );
    const page2 = mockPageContext(
      'https://example.com/pricing',
      `<html><body>
        <a data-action="view-pricing" data-action-type="navigation">Pricing</a>
      </body></html>`,
      1,
    );
    const ctx = mockCheckContext([page1, page2]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 element(s)');
  });
});
