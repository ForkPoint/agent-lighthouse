import { describe, it, expect } from 'vitest';
import { FormErrorMessagesAudit } from './form-error-messages';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('FormErrorMessagesAudit', () => {
  const audit = new FormErrorMessagesAudit();

  it('passes when an input has aria-describedby pointing to an existing element', () => {
    const html = `<html><body><form>
      <input id="email" type="email" aria-describedby="email-error">
      <span id="email-error" role="alert">Please enter a valid email.</span>
    </form></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('aria-describedby');
  });

  it('warns when no form input uses aria-describedby', () => {
    const html = `<html><body><form>
      <input id="email" type="email">
    </form></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No form inputs use aria-describedby');
  });

  it('warns when aria-describedby references a non-existent id', () => {
    const html = `<html><body><form>
      <input id="email" type="email" aria-describedby="missing-id">
    </form></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
  });

  it('is not applicable when there are no form inputs', () => {
    const html = `<html><body><p>no forms here</p></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.found).toContain('No form inputs');
  });

  it('is not applicable when no pages were scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('na');
    expect(result.found).toContain('No pages scanned');
  });

  it('skips hidden, submit, and button type inputs; counts select and textarea', () => {
    // hidden/submit/button should not be counted; select and textarea should be counted
    const html = `<html><body><form>
      <input type="hidden" name="token">
      <input type="submit" value="Submit">
      <input type="button" value="Cancel">
      <select name="country"><option>US</option></select>
      <textarea name="msg"></textarea>
      <input id="email" type="email" aria-describedby="email-error">
      <span id="email-error" role="alert">Error</span>
    </form></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    // email input has a valid aria-describedby → passes
    expect(result.status).toBe('pass');
    expect(result.message).toContain('aria-describedby');
  });
});
