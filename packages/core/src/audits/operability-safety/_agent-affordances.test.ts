import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import {
  hasClickSignal,
  accessibleName,
  STATE_CLASS_RE,
  CLICKABILITY_CLASS_RE,
  NATIVE_INTERACTIVE,
} from './_agent-affordances';
import { parseCssRules } from '../../gatherers/css-rules';

const load = (html: string) => cheerio.load(html);

describe('_agent-affordances', () => {
  it('reads cursor:pointer out of a stylesheet as a click signal', () => {
    const $ = load('<div class="promo">Buy</div>');
    const rules = parseCssRules('.promo { cursor: pointer }');
    expect(hasClickSignal($('.promo')[0]!, $, rules)).toBe(true);
  });

  it('does not call a plain div clickable', () => {
    const $ = load('<div class="wrapper">Buy</div>');
    expect(hasClickSignal($('.wrapper')[0]!, $, [])).toBe(false);
  });

  it('treats an inline handler attribute as a click signal', () => {
    const $ = load('<div onclick="go()">Buy</div>');
    expect(hasClickSignal($('div')[0]!, $, [])).toBe(true);
  });

  // A stylesheet may carry a selector cheerio cannot parse. One bad selector
  // must not take the whole audit down.
  it('survives a selector cheerio cannot parse', () => {
    const $ = load('<div class="promo">Buy</div>');
    const rules = parseCssRules('div:::broken( { cursor: pointer }');
    expect(() => hasClickSignal($('.promo')[0]!, $, rules)).not.toThrow();
    expect(hasClickSignal($('.promo')[0]!, $, rules)).toBe(false);
  });

  it('resolves an accessible name from aria-labelledby before own text', () => {
    const $ = load('<span id="n">Add to cart</span><button aria-labelledby="n">+</button>');
    expect(accessibleName($('button')[0]!, $)).toBe('Add to cart');
  });

  it('falls back through aria-label, text, title, img alt and svg title', () => {
    const cases: Array<[string, string]> = [
      ['<button aria-label="Close">x</button>', 'Close'],
      ['<button>Add to cart</button>', 'Add to cart'],
      ['<button title="Help"></button>', 'Help'],
      ['<button><img alt="Search"></button>', 'Search'],
      ['<button><svg><title>Menu</title></svg></button>', 'Menu'],
    ];
    for (const [html, expected] of cases) {
      const $ = load(html);
      expect(accessibleName($('button')[0]!, $), html).toBe(expected);
    }
  });

  it('returns an empty name for an icon-only button with no label', () => {
    const $ = load('<button><svg></svg></button>');
    expect(accessibleName($('button')[0]!, $)).toBe('');
  });

  // "transaction" contains "active" only as a substring, not as a
  // hyphen- or underscore-delimited token.
  it('matches state tokens on delimiters, not as substrings', () => {
    expect(STATE_CLASS_RE.test('is-active')).toBe(true);
    expect(STATE_CLASS_RE.test('tab_selected')).toBe(true);
    expect(STATE_CLASS_RE.test('transaction')).toBe(false);
    expect(STATE_CLASS_RE.test('inactive-warning')).toBe(false);
  });

  it('matches clickability tokens on delimiters, not as substrings', () => {
    expect(CLICKABILITY_CLASS_RE.test('btn-primary')).toBe(true);
    expect(CLICKABILITY_CLASS_RE.test('card-link')).toBe(true);
    expect(CLICKABILITY_CLASS_RE.test('subtle')).toBe(false);
    expect(CLICKABILITY_CLASS_RE.test('buttonish')).toBe(false);
  });

  it('names the tags that carry an interactive role without an ARIA attribute', () => {
    for (const tag of ['a', 'button', 'input', 'select', 'textarea', 'summary']) {
      expect(NATIVE_INTERACTIVE.has(tag), tag).toBe(true);
    }
    expect(NATIVE_INTERACTIVE.has('div')).toBe(false);
  });
});
