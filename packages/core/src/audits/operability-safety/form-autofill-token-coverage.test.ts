import { describe, it, expect } from 'vitest';
import { FormAutofillTokenCoverageAudit } from './form-autofill-token-coverage';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';

const page = (body: string) => `<html><body>${body}</body></html>`;

function run(html: string, url = 'https://example.test/checkout') {
  const audit = new FormAutofillTokenCoverageAudit();
  return audit.audit(mockCheckContext([mockPageContext(url, page(html))]));
}

const COVERED_FORM = `
  <form>
    <label for="e">Email</label>
    <input id="e" name="email" type="email" autocomplete="email">
    <label for="z">ZIP</label>
    <input id="z" name="zip" type="text" autocomplete="postal-code">
    <button type="submit">Go</button>
  </form>`;

describe('FormAutofillTokenCoverageAudit', () => {
  const audit = new FormAutofillTokenCoverageAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable on a page with no form', () => {
    const result = run('<main><p>Just prose.</p></main>');
    expect(result.status).toBe('na');
  });

  it('passes a form whose every control carries the right token, a name and a matching type', () => {
    const result = run(COVERED_FORM);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('2 of 2');
  });

  // The expected token is the actionable half of the finding: "add
  // autocomplete" is not guidance, "add autocomplete=\"email\"" is.
  it('fails an email field with type="text" and no autocomplete, naming the expected token', () => {
    const result = run(`
      <form>
        <label for="e">Email address</label>
        <input id="e" name="f_2" type="text">
      </form>`);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('autocomplete="email"');
  });

  // Inference reads the label, not the name: "ZIP" is the label a human sees
  // and the only concept signal a name="f_3" field carries.
  it('counts a field labelled ZIP with autocomplete="postal-code" as covered', () => {
    const result = run(`
      <form>
        <label for="p">ZIP</label>
        <input id="p" name="f_3" type="text" autocomplete="postal-code">
      </form>`);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1 of 1');
  });

  it('expects new-password on a signup page', () => {
    const result = run(
      `<form><label for="p">Password</label><input id="p" name="p" type="password"></form>`,
      'https://example.test/signup',
    );
    expect(result.message).toContain('autocomplete="new-password"');
  });

  it('expects current-password on a login page', () => {
    const result = run(
      `<form><label for="p">Password</label><input id="p" name="p" type="password"></form>`,
      'https://example.test/login',
    );
    expect(result.message).toContain('autocomplete="current-password"');
  });

  it('accepts a section- or billing-prefixed token', () => {
    const result = run(`
      <form>
        <label for="z">Postcode</label>
        <input id="z" name="z" type="text" autocomplete="billing postal-code">
      </form>`);
    expect(result.status).toBe('pass');
  });

  it('does not count a field whose type contradicts the token', () => {
    const result = run(`
      <form>
        <label for="e">Email</label>
        <input id="e" name="e" type="text" autocomplete="email">
      </form>`);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('type="email"');
  });

  it('does not count a field with a token but no name and no id', () => {
    const result = run(`
      <form>
        <label>Email <input type="email" autocomplete="email"></label>
      </form>`);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('0 of 1');
  });

  // A visual asterisk is not in the accessibility tree, so an agent cannot see
  // that the field is mandatory. It is its own defect, not a token miss.
  it('reports asterisk-only required-ness as a separate finding', () => {
    const result = run(`
      <form>
        <label for="e">Email *</label>
        <input id="e" name="email" type="email" autocomplete="email">
      </form>`);
    expect(result.status).toBe('warn');
    // Token coverage is untouched by the asterisk finding.
    expect(result.found).toContain('1 of 1');
    expect(result.found).toContain('1 required by a visual asterisk only');
  });

  it('does not report an asterisk label when the field is really required', () => {
    const result = run(`
      <form>
        <label for="e">Email *</label>
        <input id="e" name="email" type="email" autocomplete="email" required>
      </form>`);
    expect(result.status).toBe('pass');
  });

  it('reports an unwired error message as a separate finding', () => {
    const result = run(`
      <form>
        <label for="e">Email</label>
        <input id="e" name="email" type="email" autocomplete="email">
        <span class="error-text">Invalid</span>
      </form>`);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('1 of 1');
    expect(result.found).toContain('1 error message not wired');
  });

  it('does not report an error message the field points at', () => {
    const result = run(`
      <form>
        <label for="e">Email</label>
        <input id="e" name="email" type="email" autocomplete="email"
               aria-invalid="true" aria-describedby="err">
        <span id="err" class="error-text">Invalid</span>
      </form>`);
    expect(result.status).toBe('pass');
  });

  it('warns when some fields are covered and some are not', () => {
    const result = run(`
      <form>
        <label for="e">Email</label>
        <input id="e" name="email" type="email" autocomplete="email">
        <label for="c">City</label>
        <input id="c" name="city" type="text">
      </form>`);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('1 of 2');
    expect(result.message).toContain('autocomplete="address-level2"');
  });

  it('ignores hidden, submit and search controls', () => {
    const result = run(`
      <form>
        <input type="hidden" name="csrf" value="x">
        <label for="q">Search</label>
        <input id="q" name="q" type="search">
        <button type="submit">Go</button>
      </form>`);
    expect(result.status).toBe('na');
  });

  it('reads the concept off a placeholder when there is no label', () => {
    const result = run(`
      <form>
        <input name="f_7" type="text" placeholder="State">
      </form>`);
    expect(result.message).toContain('autocomplete="address-level1"');
  });

  it('reports the page the first uncovered field is on', () => {
    const result = run(`<form><input name="f" type="text" placeholder="City"></form>`);
    expect(result.pageUrl).toBe('https://example.test/checkout');
  });
});
