import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { setDocument } from './checks';
import { toVNode } from './core';
import {
  isValidRole,
  isUnsupportedRole,
  getRoleType,
  getAriaValue,
  hasAriaValue,
  getExplicitRole,
  getImplicitRole,
  getRole,
  namedFromContents,
  allowedAttr,
  requiredAttr,
  requiredContext,
  requiredOwned,
  validateAttr,
  validateAttrValue,
  isAriaRoleAllowedOnElement,
  getElementUnallowedRoles,
  getOwnedVirtual,
  getAccessibleRefs,
  isAccessibleRef,
  arialabelText,
  isComboboxPopup,
} from './aria';

/**
 * Role and attribute resolution.
 *
 * Ten rules ask "what role is this and what may it carry", so a wrong answer
 * here changes ten verdicts at once. The implicit-role mapping in particular
 * has no rule that exercises it directly: every rule reads the resolved role
 * and never sees where it came from.
 */

function doc(body: string): Document {
  const d = new JSDOM(`<!doctype html><html lang="en"><head><title>T</title></head><body>${body}</body></html>`)
    .window.document;
  setDocument(d);
  return d;
}

function node(body: string, selector = '#t') {
  const found = doc(body).querySelector(selector);
  if (!found) throw new Error(`no element matched ${selector}`);
  return toVNode(found);
}

describe('isValidRole', () => {
  it('accepts a role in the ARIA taxonomy', () => {
    expect(isValidRole('button')).toBe(true);
    expect(isValidRole('navigation')).toBe(true);
  });

  it('rejects an invented role', () => {
    expect(isValidRole('not-a-real-role')).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidRole(null)).toBe(false);
  });

  it('accepts an abstract role only when asked', () => {
    expect(isValidRole('widget')).toBe(false);
    expect(isValidRole('widget', { allowAbstract: true })).toBe(true);
  });
});

describe('isUnsupportedRole', () => {
  it('is false for a supported role', () => {
    expect(isUnsupportedRole('button')).toBe(false);
  });

  it('is false for a role that does not exist at all', () => {
    expect(isUnsupportedRole('not-a-real-role')).toBe(false);
  });
});

describe('getRoleType', () => {
  it('classifies a widget role', () => {
    expect(getRoleType('button')).toBe('widget');
  });

  it('classifies a landmark role', () => {
    expect(getRoleType('navigation')).toBe('landmark');
  });

  it('is null for an unknown role', () => {
    expect(getRoleType('not-a-real-role')).toBeNull();
  });
});

describe('getAriaValue and hasAriaValue', () => {
  it('reads an aria attribute', () => {
    const n = node('<div id="t" aria-checked="TRUE"></div>');
    expect(getAriaValue(n, 'aria-checked', { lowercase: true })?.value).toBe('true');
    expect(hasAriaValue(n, 'aria-checked')).toBe(true);
  });

  it('reports an absent attribute', () => {
    expect(hasAriaValue(node('<div id="t"></div>'), 'aria-checked')).toBe(false);
  });
});

describe('getExplicitRole', () => {
  it('reads the role attribute', () => {
    expect(getExplicitRole(node('<div id="t" role="button">x</div>'))).toBe('button');
  });

  it('is null when there is no role attribute', () => {
    expect(getExplicitRole(node('<div id="t">x</div>'))).toBeNull();
  });

  // A space-separated list is a fallback chain; the first valid role wins.
  it('takes the first valid role of a fallback list', () => {
    expect(getExplicitRole(node('<div id="t" role="nope button">x</div>'), { fallback: true })).toBe(
      'button',
    );
  });

  it('is null for an invented role', () => {
    expect(getExplicitRole(node('<div id="t" role="not-a-real-role">x</div>'))).toBeNull();
  });
});

describe('getImplicitRole', () => {
  it.each([
    ['<button id="t">x</button>', 'button'],
    ['<nav id="t">x</nav>', 'navigation'],
    ['<main id="t">x</main>', 'main'],
    ['<ul id="t"><li>x</li></ul>', 'list'],
    ['<input id="t" type="checkbox">', 'checkbox'],
    ['<input id="t" type="radio">', 'radio'],
    ['<select id="t"><option>a</option></select>', 'combobox'],
    ['<textarea id="t"></textarea>', 'textbox'],
    ['<h2 id="t">x</h2>', 'heading'],
  ])('maps %s to %p', (html, role) => {
    expect(getImplicitRole(node(html))).toBe(role);
  });

  // The href is what exposes the link role; without it the anchor has none.
  it('maps an anchor to link only when it has an href', () => {
    expect(getImplicitRole(node('<a id="t" href="/x">x</a>'))).toBe('link');
    expect(getImplicitRole(node('<a id="t">x</a>'))).toBeNull();
  });

  it('is null for a div', () => {
    expect(getImplicitRole(node('<div id="t">x</div>'))).toBeNull();
  });
});

describe('getRole', () => {
  it('prefers the explicit role over the implicit one', () => {
    expect(getRole(node('<button id="t" role="link">x</button>'))).toBe('link');
  });

  it('falls back to the implicit role', () => {
    expect(getRole(node('<button id="t">x</button>'))).toBe('button');
  });

  it('is null for an element with neither', () => {
    expect(getRole(node('<div id="t">x</div>'))).toBeNull();
  });

  // presentation strips the element from the accessibility tree.
  it('resolves role="presentation" rather than the implicit role', () => {
    expect(getRole(node('<img id="t" src="/x.png" alt="" role="presentation">'))).toBe(
      'presentation',
    );
  });
});

describe('namedFromContents', () => {
  it('is true for a button, whose text is its name', () => {
    expect(namedFromContents(node('<button id="t">Save</button>'))).toBe(true);
  });

  it('is false for a textbox, whose value is not its name', () => {
    expect(namedFromContents(node('<input id="t" type="text">'))).toBe(false);
  });
});

describe('role attribute tables', () => {
  it('lists the attributes a role allows', () => {
    expect(allowedAttr('checkbox')).toContain('aria-checked');
  });

  it('lists the attributes a role requires', () => {
    expect(requiredAttr('checkbox')).toContain('aria-checked');
    expect(requiredAttr('button')).toEqual([]);
  });

  it('lists the parent a role requires', () => {
    expect(requiredContext('listitem')).toContain('list');
    expect(requiredContext('button')).toBeNull();
  });

  it('lists the children a role requires', () => {
    expect(requiredOwned('list')).toContain('listitem');
    expect(requiredOwned('button')).toBeNull();
  });
});

describe('validateAttr', () => {
  it('accepts a real aria attribute', () => {
    expect(validateAttr('aria-label')).toBe(true);
  });

  it('rejects a misspelled one', () => {
    expect(validateAttr('aria-labeledby')).toBe(false);
  });
});

describe('validateAttrValue', () => {
  it('accepts a valid token', () => {
    expect(validateAttrValue(node('<div id="t" role="checkbox" aria-checked="true"></div>'), 'aria-checked')).toBe(true);
  });

  it('rejects a token outside the allowed set', () => {
    expect(validateAttrValue(node('<div id="t" role="checkbox" aria-checked="maybe"></div>'), 'aria-checked')).toBe(false);
  });

  it('accepts a valid integer value', () => {
    expect(validateAttrValue(node('<div id="t" role="heading" aria-level="2"></div>'), 'aria-level')).toBe(true);
  });

  it('rejects a non-numeric value where a number is required', () => {
    expect(validateAttrValue(node('<div id="t" role="heading" aria-level="two"></div>'), 'aria-level')).toBe(false);
  });

  it('accepts an idref that resolves', () => {
    const n = node('<span id="l">L</span><div id="t" aria-labelledby="l"></div>');
    expect(validateAttrValue(n, 'aria-labelledby')).toBe(true);
  });
});

describe('role allowance on an element', () => {
  it('allows a button role on an anchor with href', () => {
    expect(isAriaRoleAllowedOnElement(node('<a id="t" href="/x">x</a>'), 'button')).toBe(true);
  });

  it('disallows a button role on a checkbox input', () => {
    expect(isAriaRoleAllowedOnElement(node('<input id="t" type="checkbox">'), 'button')).toBe(false);
  });

  it('lists the roles an element may not carry', () => {
    expect(getElementUnallowedRoles(node('<input id="t" type="checkbox" role="button">'))).toContain(
      'button',
    );
  });

  it('lists nothing for an element carrying an allowed role', () => {
    expect(getElementUnallowedRoles(node('<div id="t" role="button">x</div>'))).toEqual([]);
  });
});

describe('getOwnedVirtual', () => {
  it('returns the element children', () => {
    const owned = getOwnedVirtual(node('<ul id="t"><li>a</li><li>b</li></ul>'));
    expect(owned.map((v) => v.props.nodeName)).toEqual(['li', 'li']);
  });

  // aria-owns re-parents a node that is elsewhere in the DOM.
  it('includes a node pulled in by aria-owns', () => {
    const n = node('<ul id="t" aria-owns="extra"><li>a</li></ul><li id="extra">b</li>');
    expect(getOwnedVirtual(n)).toHaveLength(2);
  });
});

describe('accessible references', () => {
  it('finds the elements referring to a node', () => {
    const d = doc('<span id="l">L</span><div id="t" aria-labelledby="l"></div>');
    expect(getAccessibleRefs(d.querySelector('#l')!)).toHaveLength(1);
    expect(isAccessibleRef(d.querySelector('#l')!)).toBe(true);
  });

  it('reports no references for an unreferenced element', () => {
    const d = doc('<span id="l">L</span>');
    expect(isAccessibleRef(d.querySelector('#l')!)).toBe(false);
  });
});

describe('arialabelText', () => {
  it('reads aria-label', () => {
    expect(arialabelText(node('<div id="t" aria-label="Close">x</div>'))).toBe('Close');
  });

  it('is empty when the attribute is absent', () => {
    expect(arialabelText(node('<div id="t">x</div>'))).toBe('');
  });
});

describe('isComboboxPopup', () => {
  it('is true for a listbox controlled by a combobox', () => {
    const d = doc(
      '<div role="combobox" aria-expanded="true" aria-controls="p">x</div><ul id="p" role="listbox"><li role="option">a</li></ul>',
    );
    expect(isComboboxPopup(toVNode(d.querySelector('#p')!))).toBe(true);
  });

  it('is false for a listbox no combobox controls', () => {
    const d = doc('<ul id="p" role="listbox"><li role="option">a</li></ul>');
    expect(isComboboxPopup(toVNode(d.querySelector('#p')!))).toBe(false);
  });
});
