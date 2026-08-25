import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  VNode,
  toVNode,
  getNodeFromTree,
  nodeLookup,
  isVNode,
  tokenList,
  parseTabindex,
  uniqueArray,
  escapeSelector,
  memoize,
  contains,
  nodeSorter,
  matches,
  closest,
  findUp,
  isHtmlElement,
} from './core';

/**
 * The virtual-node layer every rule is built on.
 *
 * These are small enough to look obviously right and are the reason they were
 * never tested; each one is also load-bearing for all 30 rules at once.
 */

function doc(body: string): Document {
  return new JSDOM(`<!doctype html><html lang="en"><head><title>T</title></head><body>${body}</body></html>`)
    .window.document;
}

function el(body: string, selector: string): Element {
  const found = doc(body).querySelector(selector);
  if (!found) throw new Error(`no element matched ${selector}`);
  return found;
}

describe('toVNode', () => {
  it('wraps a DOM node', () => {
    const node = toVNode(el('<div id="t">x</div>', '#t'));
    expect(node).toBeInstanceOf(VNode);
    expect(node.props.nodeName).toBe('div');
  });

  // Rules look the same node up repeatedly; a fresh VNode each time would drop
  // every memoized computation the checks depend on.
  it('returns the same VNode for the same DOM node', () => {
    const node = el('<div id="t">x</div>', '#t');
    expect(toVNode(node)).toBe(toVNode(node));
  });

  it('passes a VNode straight through', () => {
    const node = toVNode(el('<div id="t">x</div>', '#t'));
    expect(toVNode(node)).toBe(node);
    expect(getNodeFromTree(node)).toBe(node);
  });

  it('nodeLookup returns both halves', () => {
    const dom = el('<div id="t">x</div>', '#t');
    const { vNode, domNode } = nodeLookup(dom);
    expect(domNode).toBe(dom);
    expect(vNode).toBe(toVNode(dom));
  });

  it('isVNode distinguishes the two', () => {
    const dom = el('<div id="t">x</div>', '#t');
    expect(isVNode(toVNode(dom))).toBe(true);
    expect(isVNode(dom)).toBe(false);
  });
});

describe('VNode', () => {
  const node = () => toVNode(el('<div id="t" class="a b" role="button">x</div>', '#t'));

  it('reads attributes', () => {
    expect(node().attr('role')).toBe('button');
    expect(node().hasAttr('role')).toBe(true);
    expect(node().hasAttr('aria-label')).toBe(false);
  });

  it('returns null for an absent attribute', () => {
    expect(node().attr('aria-label')).toBeNull();
  });

  it('lists the attribute names', () => {
    expect(node().attrNames.sort()).toEqual(['class', 'id', 'role']);
  });

  it('exposes the node type and name', () => {
    expect(node().props.nodeType).toBe(1);
    expect(node().props.nodeName).toBe('div');
  });
});

describe('tokenList', () => {
  it('splits on whitespace', () => {
    expect(tokenList('a b c')).toEqual(['a', 'b', 'c']);
  });

  it('collapses runs of whitespace and trims', () => {
    expect(tokenList('  a   b  ')).toEqual(['a', 'b']);
  });

  it('returns a single empty token for an empty value', () => {
    expect(tokenList('')).toEqual(['']);
    expect(tokenList(null)).toEqual(['']);
  });
});

describe('parseTabindex', () => {
  it.each([
    ['0', 0],
    ['-1', -1],
    ['3', 3],
    ['+2', 2],
    ['  1  ', 1],
  ])('reads %p as %p', (value, expected) => {
    expect(parseTabindex(value)).toBe(expected);
  });

  // A non-numeric tabindex is not focusable, and reading it as 0 would put a
  // decorative element into the tab order.
  it.each(['', 'abc', 'e1'])('returns null for %p', (value) => {
    expect(parseTabindex(value)).toBeNull();
  });

  it('returns null for a non-string', () => {
    expect(parseTabindex(undefined)).toBeNull();
    expect(parseTabindex(3)).toBeNull();
  });

  it('reads the leading integer of a trailing-garbage value', () => {
    expect(parseTabindex('2px')).toBe(2);
  });
});

describe('uniqueArray', () => {
  it('concatenates and drops duplicates', () => {
    expect(uniqueArray([1, 2], [2, 3])).toEqual([1, 2, 3]);
  });

  it('handles empty inputs', () => {
    expect(uniqueArray<number>([], [])).toEqual([]);
  });
});

describe('escapeSelector', () => {
  it('leaves an ordinary identifier alone', () => {
    expect(escapeSelector('main-nav')).toBe('main-nav');
  });

  it('escapes a leading digit', () => {
    expect(escapeSelector('1abc')).not.toBe('1abc');
  });

  it('escapes a colon, which is what React useId emits', () => {
    expect(escapeSelector(':r0:')).toContain('\\:');
  });

  it('produces a selector the DOM accepts', () => {
    const d = doc('<div id=":r0:">x</div>');
    expect(d.querySelector(`#${escapeSelector(':r0:')}`)).not.toBeNull();
  });
});

// A documented passthrough: memoization here is a performance optimisation
// only, and every place correctness depends on caching (the accessible-name
// loop guard, the table caches) does it explicitly. Asserted so a future
// caching implementation is a deliberate change, not an accident.
describe('memoize', () => {
  it('returns the function itself', () => {
    const fn = (n: number) => n * 2;
    expect(memoize(fn)).toBe(fn);
  });

  it('does not cache: every call reaches the function', () => {
    const fn = vi.fn((n: number) => n * 2);
    const wrapped = memoize(fn);
    expect(wrapped(3)).toBe(6);
    expect(wrapped(3)).toBe(6);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('contains', () => {
  it('is true for a descendant', () => {
    const d = doc('<div id="p"><span id="c">x</span></div>');
    expect(contains(toVNode(d.querySelector('#p')!), toVNode(d.querySelector('#c')!))).toBe(true);
  });

  it('is false for a sibling', () => {
    const d = doc('<div id="a">x</div><div id="b">y</div>');
    expect(contains(toVNode(d.querySelector('#a')!), toVNode(d.querySelector('#b')!))).toBe(false);
  });

  it('is true for the node itself', () => {
    const d = doc('<div id="a">x</div>');
    const n = toVNode(d.querySelector('#a')!);
    expect(contains(n, n)).toBe(true);
  });
});

describe('nodeSorter', () => {
  it('orders nodes as they appear in the document', () => {
    const d = doc('<div id="a">1</div><div id="b">2</div><div id="c">3</div>');
    const nodes = [d.querySelector('#c')!, d.querySelector('#a')!, d.querySelector('#b')!];
    expect([...nodes].sort(nodeSorter).map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('reports the same node as equal', () => {
    const node = el('<div id="a">1</div>', '#a');
    expect(nodeSorter(node, node)).toBe(0);
  });

  it('accepts VNodes as well as DOM nodes', () => {
    const d = doc('<div id="a">1</div><div id="b">2</div>');
    expect(nodeSorter(toVNode(d.querySelector('#a')!), toVNode(d.querySelector('#b')!))).toBe(-1);
  });
});

describe('matches and closest', () => {
  it('matches a tag selector', () => {
    expect(matches(toVNode(el('<button id="t">x</button>', '#t')), 'button')).toBe(true);
  });

  it('does not match a different tag', () => {
    expect(matches(toVNode(el('<button id="t">x</button>', '#t')), 'a')).toBe(false);
  });

  it('closest walks up to the matching ancestor', () => {
    const d = doc('<form id="f"><div><input id="t"></div></form>');
    expect(closest(toVNode(d.querySelector('#t')!), 'form')?.attr('id')).toBe('f');
  });

  it('closest returns null when nothing matches', () => {
    const d = doc('<div><input id="t"></div>');
    expect(closest(toVNode(d.querySelector('#t')!), 'form')).toBeNull();
  });
});

describe('findUp', () => {
  it('finds the nearest matching ancestor in the real DOM', () => {
    const d = doc('<form id="f"><div><input id="t"></div></form>');
    expect(findUp(d.querySelector('#t')!, 'form')?.id).toBe('f');
  });

  it('returns null when nothing matches', () => {
    const d = doc('<div><input id="t"></div>');
    expect(findUp(d.querySelector('#t')!, 'form')).toBeNull();
  });
});

describe('isHtmlElement', () => {
  it('is true for a standard HTML element', () => {
    expect(isHtmlElement(el('<button id="t">x</button>', '#t'))).toBe(true);
  });

  it('is false for an SVG element', () => {
    expect(isHtmlElement(el('<svg id="s"><circle id="t"/></svg>', '#t'))).toBe(false);
  });

  it('is false for an unknown tag', () => {
    expect(isHtmlElement(el('<my-widget id="t">x</my-widget>', '#t'))).toBe(false);
  });
});
