import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { setDocument } from './checks';
import { accessibleText, sanitize, visibleVirtual, isValidAutocomplete } from './text';
import { toVNode } from './core';

/**
 * Accessible-name computation.
 *
 * `button-name`, `link-name`, `label`, `select-name`, `frame-title`,
 * `aria-dialog-name` and `landmark-unique` all reduce to "what name does this
 * element expose", so a defect here shows up as the wrong verdict on seven
 * rules at once. The conformance suite drives each rule end to end; this file
 * pins the precedence chain itself, which no single rule exercises fully.
 *
 * Order per the accname spec: aria-labelledby, aria-label, the native text
 * alternative, the form control value, the subtree, then title.
 */

/** Build a document, register it with the engine, and return the element. */
function el(html: string, selector: string): Element {
  const dom = new JSDOM(`<!doctype html><html lang="en"><head><title>T</title></head><body>${html}</body></html>`);
  setDocument(dom.window.document);
  const found = dom.window.document.querySelector(selector);
  if (!found) throw new Error(`no element matched ${selector}`);
  return found;
}

/** The accessible name the engine computes for `selector` in `html`. */
function name(html: string, selector = '#t'): string {
  return accessibleText(el(html, selector));
}

describe('sanitize', () => {
  it('collapses runs of whitespace and trims', () => {
    expect(sanitize('  Add   to \n cart  ')).toBe('Add to cart');
  });

  it('returns an empty string for null and undefined', () => {
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
  });

  it('leaves an already-clean string alone', () => {
    expect(sanitize('Add to cart')).toBe('Add to cart');
  });
});

describe('accessible name — precedence', () => {
  it('takes aria-labelledby over everything else', () => {
    expect(
      name('<span id="l">From labelledby</span><button id="t" aria-labelledby="l" aria-label="From label" title="From title">From subtree</button>'),
    ).toBe('From labelledby');
  });

  it('joins several aria-labelledby targets in the order listed', () => {
    expect(
      name('<span id="a">Delete</span><span id="b">item</span><button id="t" aria-labelledby="a b"></button>'),
    ).toBe('Delete item');
  });

  // Hidden text is a legitimate label source when referenced by id, which is
  // exactly how a visually-hidden pattern names an icon button.
  it('reads a visually hidden element through aria-labelledby', () => {
    expect(
      name('<span id="l" style="display:none">Close dialog</span><button id="t" aria-labelledby="l">x</button>'),
    ).toBe('Close dialog');
  });

  it('falls through to aria-label when the labelledby target does not exist', () => {
    expect(name('<button id="t" aria-labelledby="missing" aria-label="From label">Sub</button>')).toBe(
      'From label',
    );
  });

  it('takes aria-label over the subtree and the title', () => {
    expect(name('<button id="t" aria-label="From label" title="From title">From subtree</button>')).toBe(
      'From label',
    );
  });

  it('ignores an aria-label that is only whitespace', () => {
    expect(name('<button id="t" aria-label="   ">From subtree</button>')).toBe('From subtree');
  });

  it('takes the subtree over the title', () => {
    expect(name('<button id="t" title="From title">From subtree</button>')).toBe('From subtree');
  });

  it('falls back to the title when there is nothing else', () => {
    expect(name('<button id="t" title="From title"></button>')).toBe('From title');
  });

  it('is empty when the element exposes no name at all', () => {
    expect(name('<button id="t"></button>')).toBe('');
  });
});

describe('accessible name — native text alternatives', () => {
  it('reads an image alt', () => {
    expect(name('<img id="t" src="/x.png" alt="Blue hat">')).toBe('Blue hat');
  });

  it('reads an empty alt as no name, which is what marks an image decorative', () => {
    expect(name('<img id="t" src="/x.png" alt="">')).toBe('');
  });

  it('reads an explicit label through the for attribute', () => {
    expect(name('<label for="t">Email address</label><input id="t" type="text">')).toBe(
      'Email address',
    );
  });

  it('reads an implicit label from a wrapping element', () => {
    expect(name('<label>Postcode<input id="t" type="text"></label>')).toBe('Postcode');
  });

  it('reads a submit button value', () => {
    expect(name('<input id="t" type="submit" value="Place order">')).toBe('Place order');
  });

  it('falls back to the default label for a valueless submit button', () => {
    expect(name('<input id="t" type="submit">')).toBe('Submit');
  });

  it('reads a fieldset legend', () => {
    expect(name('<fieldset id="t"><legend>Delivery</legend><input type="text"></fieldset>')).toBe(
      'Delivery',
    );
  });

  it('reads a table caption', () => {
    expect(name('<table id="t"><caption>Size chart</caption><tr><td>M</td></tr></table>')).toBe(
      'Size chart',
    );
  });

  it('reads an iframe title, which is its only name source', () => {
    expect(name('<iframe id="t" title="Size chart" src="/x"></iframe>')).toBe('Size chart');
  });
});

describe('accessible name — subtree', () => {
  it('concatenates the visible descendant text', () => {
    expect(name('<button id="t"><span>Add</span> <span>to cart</span></button>')).toBe('Add to cart');
  });

  it('skips a descendant hidden from screen readers', () => {
    expect(name('<button id="t">Add <span style="display:none">(disabled)</span></button>')).toBe(
      'Add',
    );
  });

  it('skips an aria-hidden descendant, which is how an icon glyph is muted', () => {
    expect(name('<button id="t"><span aria-hidden="true">X</span>Close</button>')).toBe('Close');
  });

  it('reads a nested image alt as part of the name', () => {
    expect(name('<a id="t" href="/cart"><img src="/cart.png" alt="Cart"></a>')).toBe('Cart');
  });

  it('collapses the whitespace of a multi-line subtree', () => {
    expect(name('<button id="t">\n  Add\n  to\n  cart\n</button>')).toBe('Add to cart');
  });
});

describe('visibleVirtual', () => {
  it('returns the visible text of an element', () => {
    const node = toVNode(el('<div id="t">Hello <span>world</span></div>', '#t'));
    expect(sanitize(visibleVirtual(node))).toBe('Hello world');
  });

  it('omits a display:none descendant', () => {
    const node = toVNode(el('<div id="t">Hello <span style="display:none">gone</span></div>', '#t'));
    expect(sanitize(visibleVirtual(node))).toBe('Hello');
  });

  // A screen reader still reaches text that is merely off-screen.
  it('includes aria-hidden text only when reading as a screen reader', () => {
    const html = '<div id="t">Hello <span aria-hidden="true">muted</span></div>';
    expect(sanitize(visibleVirtual(toVNode(el(html, '#t')), true))).toBe('Hello');
  });
});

describe('isValidAutocomplete', () => {
  it.each(['on', 'off', ''])('accepts the state term %p', (value) => {
    expect(isValidAutocomplete(value)).toBe(true);
  });

  it.each(['name', 'given-name', 'cc-number', 'postal-code', 'one-time-code'])(
    'accepts the standalone term %p',
    (value) => {
      expect(isValidAutocomplete(value)).toBe(true);
    },
  );

  it('accepts a qualified term behind its qualifier', () => {
    expect(isValidAutocomplete('home tel')).toBe(true);
    expect(isValidAutocomplete('work email')).toBe(true);
  });

  it('accepts a billing or shipping location prefix', () => {
    expect(isValidAutocomplete('shipping street-address')).toBe(true);
    expect(isValidAutocomplete('billing postal-code')).toBe(true);
  });

  it('accepts a section- prefix', () => {
    expect(isValidAutocomplete('section-blue given-name')).toBe(true);
  });

  it('accepts the full location, qualifier and term sequence', () => {
    expect(isValidAutocomplete('section-blue shipping work email')).toBe(true);
  });

  it('accepts a webauthn suffix', () => {
    expect(isValidAutocomplete('username webauthn')).toBe(true);
  });

  it('rejects webauthn on its own', () => {
    expect(isValidAutocomplete('webauthn')).toBe(false);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(isValidAutocomplete('  GIVEN-NAME  ')).toBe(true);
  });

  it.each(['fullname', 'firstname', 'nope', 'address'])('rejects the invented term %p', (value) => {
    expect(isValidAutocomplete(value)).toBe(false);
  });

  it('rejects a qualifier in front of a standalone term', () => {
    expect(isValidAutocomplete('home given-name')).toBe(false);
  });

  it('rejects two purpose terms', () => {
    expect(isValidAutocomplete('name email')).toBe(false);
  });

  // A framework-specific token the caller chose not to judge.
  it('returns undefined for an ignored value rather than a verdict', () => {
    expect(isValidAutocomplete('custom-token', { ignoredValues: ['custom-token'] })).toBeUndefined();
  });

  it('accepts a caller-supplied extra standalone term', () => {
    expect(isValidAutocomplete('vat-number', { standaloneTerms: ['vat-number'] })).toBe(true);
  });

  it('skips the term-count check when loosely typed', () => {
    expect(isValidAutocomplete('some junk name', { looseTyped: true })).toBe(true);
  });
});
