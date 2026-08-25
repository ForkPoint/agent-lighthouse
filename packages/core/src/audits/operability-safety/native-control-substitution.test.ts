import { describe, it, expect } from 'vitest';
import { NativeControlSubstitutionAudit } from './native-control-substitution';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';

const page = (body: string) => `<html><body>${body}</body></html>`;

function run(html: string, url = 'https://example.test/page') {
  const audit = new NativeControlSubstitutionAudit();
  return audit.audit(mockCheckContext([mockPageContext(url, page(html))]));
}

/** A styled country picker with the full APG combobox contract. */
const COMPLETE_COMBOBOX = `
  <form>
    <div role="combobox" class="dropdown" tabindex="0"
         aria-expanded="false" aria-controls="opts" aria-activedescendant="opt-1">Country</div>
    <ul id="opts" role="listbox">
      <li id="opt-1" role="option">Netherlands</li>
    </ul>
    <input type="hidden" name="country">
  </form>`;

describe('NativeControlSubstitutionAudit', () => {
  const audit = new NativeControlSubstitutionAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable on a page with no form and no substituted control', () => {
    expect(run('<main><p>Just prose.</p></main>').status).toBe('na');
  });

  it('classifies a native select as native and reports no substitution', () => {
    const result = run(`<form><select name="c"><option>NL</option></select></form>`);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('0 substituted');
  });

  it('treats native date and file inputs as native', () => {
    const result = run(`
      <form>
        <input type="date" name="when">
        <input type="file" name="doc">
      </form>`);
    expect(result.status).toBe('pass');
  });

  // A clickable div carrying the value in a hidden input is the classic
  // substituted select: Playwright's selectOption cannot touch it.
  it('classifies a clickable dropdown div paired with a hidden input as substituted', () => {
    const result = run(`
      <form>
        <div class="dropdown" tabindex="0">Country</div>
        <input type="hidden" name="country">
      </form>`);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('1 substituted');
  });

  it('warns rather than fails when a substituted control satisfies the APG contract', () => {
    const result = run(COMPLETE_COMBOBOX);
    expect(result.status).toBe('warn');
  });

  // A dangling aria-controls is worse than no contract: the markup claims a
  // popup an agent then cannot find.
  it('fails and names the dangling id when aria-controls resolves to nothing', () => {
    const result = run(COMPLETE_COMBOBOX.replace('aria-controls="opts"', 'aria-controls="gone"'));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('gone');
  });

  it('fails when aria-controls points at an element that is not a popup role', () => {
    const result = run(COMPLETE_COMBOBOX.replace('role="listbox"', 'role="presentation"'));
    expect(result.status).toBe('fail');
  });

  it('fails when the popup carries no option roles', () => {
    const result = run(COMPLETE_COMBOBOX.replace('role="option"', 'class="option"'));
    expect(result.status).toBe('fail');
  });

  it('fails when aria-activedescendant does not resolve', () => {
    const result = run(
      COMPLETE_COMBOBOX.replace('aria-activedescendant="opt-1"', 'aria-activedescendant="opt-9"'),
    );
    expect(result.status).toBe('fail');
  });

  it('fails when the substituted control declares no aria-expanded', () => {
    const result = run(COMPLETE_COMBOBOX.replace(' aria-expanded="false"', ''));
    expect(result.status).toBe('fail');
  });

  it('fails a drop zone with no sibling file input', () => {
    const result = run(`<form><div class="file-drop">Drop a file here</div></form>`);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('file');
  });

  it('does not flag a drop zone that wraps a real file input', () => {
    const result = run(`
      <form>
        <div class="file-drop">Drop a file here<input type="file" name="doc"></div>
      </form>`);
    expect(result.status).toBe('pass');
  });

  // The same defect costs more on a path a conversion depends on, so the
  // reported index is weighted by where the control lives.
  it('weights a substituted control on a conversion path above one elsewhere', () => {
    const markup = `
      <form>
        <div class="dropdown" tabindex="0">Country</div>
        <input type="hidden" name="country">
      </form>`;
    const checkout = run(markup, 'https://example.test/checkout');
    const elsewhere = run(markup, 'https://example.test/about');
    expect(checkout.displayValue).toContain('weighted index 2');
    expect(elsewhere.displayValue).toContain('weighted index 1');
  });

  it('reads the conversion path off the form action as well as the URL', () => {
    const result = run(
      `<form action="/cart/add">
         <div class="dropdown" tabindex="0">Size</div>
         <input type="hidden" name="size">
       </form>`,
      'https://example.test/p/shirt',
    );
    expect(result.displayValue).toContain('weighted index 2');
  });

  it('does not count the popup listbox as a second substituted control', () => {
    const result = run(COMPLETE_COMBOBOX);
    expect(result.found).toContain('1 substituted');
  });

  it('does not flag a dropdown div in a region that also holds a native select', () => {
    const result = run(`
      <form>
        <div class="dropdown" tabindex="0">Country</div>
        <select name="country"><option>NL</option></select>
      </form>`);
    expect(result.status).toBe('pass');
  });

  it('reports the page the first substituted control is on', () => {
    const result = run(`<form><div class="file-drop">Drop here</div></form>`);
    expect(result.pageUrl).toBe('https://example.test/page');
  });

  // A framework id is any non-whitespace string: React's `useId` emits `:r0:`,
  // and `#:r0:` parses as a pseudo-class, so an interpolated id selector throws
  // and the whole audit reports nothing.
  // `warn`, not `fail`: the contract is complete, so the id resolved. Before
  // the fix the audit threw on the selector and reported nothing at all.
  it('resolves an aria-controls id the CSS grammar rejects', () => {
    const result = run(COMPLETE_COMBOBOX.replace(/"opts"/g, '":r0:-tab-0"'));
    expect(result.status).toBe('warn');
  });
});
