import { describe, it, expect, vi } from 'vitest';
import { parseCssRules, collectPageCss } from './css-rules';
import { mockPageContext, mockCheckContext, mockFetchResult } from '../__tests__/test-utils';
import type { FetchOptions } from '../fetcher';

// isSafeUrl performs a real DNS lookup before the gatherer fetches a stylesheet
// whose href came out of site-controlled markup. Stub it with an offline
// stand-in that still blocks loopback and private ranges.
vi.mock('../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fetcher')>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== 'http:' && protocol !== 'https:') return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

describe('parseCssRules', () => {
  it('reads a selector list and its declarations', () => {
    const [rule] = parseCssRules('.a, .b { display: none; color: red }');
    expect(rule).toMatchObject({
      selector: '.a, .b',
      declarations: 'display: none; color: red',
      origin: 'inline',
    });
    expect(rule!.atRule).toBeUndefined();
  });

  it('strips comments before scanning', () => {
    const rules = parseCssRules('/* .a { display:none } */ .b { opacity: 0 }');
    expect(rules).toHaveLength(1);
    expect(rules[0]!.selector).toBe('.b');
  });

  it('records the enclosing at-rule on a nested rule', () => {
    const [rule] = parseCssRules('@media print { .a { display: none } }');
    expect(rule).toMatchObject({ selector: '.a', atRule: 'media print' });
  });

  // A @font-face body holds declarations, not rules. Reading it as a rule
  // would invent a selector out of a `src:` line.
  it('skips at-rules whose body holds declarations, not selectors', () => {
    const rules = parseCssRules('@font-face { font-family: X; src: url(x.woff) } .a { color: red }');
    expect(rules.map((r) => r.selector)).toEqual(['.a']);
  });

  it('skips a keyframes body', () => {
    const rules = parseCssRules('@keyframes spin { from { opacity: 0 } to { opacity: 1 } } .a { color: red }');
    expect(rules.map((r) => r.selector)).toEqual(['.a']);
  });

  it('lowercases and collapses whitespace in declarations', () => {
    const [rule] = parseCssRules('.a {\n  DISPLAY:   NONE;\n}');
    expect(rule!.declarations).toBe('display: none;');
  });

  it('returns nothing for an empty sheet', () => {
    expect(parseCssRules('')).toEqual([]);
  });

  it('survives an unterminated block', () => {
    const rules = parseCssRules('.a { display: none');
    expect(rules[0]).toMatchObject({ selector: '.a' });
  });

  it('tags each rule with its origin', () => {
    const [rule] = parseCssRules('.a { color: red }', 'https://a.test/s.css');
    expect(rule!.origin).toBe('https://a.test/s.css');
  });
});

describe('collectPageCss', () => {
  function ctxWith(sheets: Record<string, string>) {
    const seen: string[] = [];
    const ctx = mockCheckContext([]);
    ctx.fetch = async (o: FetchOptions) => {
      seen.push(o.url);
      const body = sheets[o.url];
      return body === undefined
        ? mockFetchResult('', 404)
        : mockFetchResult(body, 200, 'text/css');
    };
    return { ctx, seen };
  }

  it('reads inline <style> blocks', async () => {
    const { ctx } = ctxWith({});
    const page = mockPageContext(
      'https://a.test/',
      '<html><head><style>.a { display: none }</style></head><body></body></html>',
    );
    const css = await collectPageCss(ctx, page);
    expect(css.rules.map((r) => r.selector)).toEqual(['.a']);
  });

  it('fetches a same-origin stylesheet and scans it', async () => {
    const { ctx, seen } = ctxWith({ 'https://a.test/s.css': '.ghost { display: none }' });
    const page = mockPageContext(
      'https://a.test/',
      '<html><head><link rel="stylesheet" href="/s.css"></head><body></body></html>',
    );
    const css = await collectPageCss(ctx, page);
    expect(seen).toEqual(['https://a.test/s.css']);
    expect(css.rules[0]).toMatchObject({ selector: '.ghost', origin: 'https://a.test/s.css' });
    expect(css.fetched).toEqual(['https://a.test/s.css']);
  });

  // A scan must not pull bytes from a third party on the scanned site's behalf.
  it('does not fetch a cross-origin stylesheet, and reports it', async () => {
    const { ctx, seen } = ctxWith({ 'https://cdn.test/s.css': '.ghost { display: none }' });
    const page = mockPageContext(
      'https://a.test/',
      '<html><head><link rel="stylesheet" href="https://cdn.test/s.css"></head><body></body></html>',
    );
    const css = await collectPageCss(ctx, page);
    expect(seen).toEqual([]);
    expect(css.skippedCrossOrigin).toEqual(['https://cdn.test/s.css']);
    expect(css.rules).toEqual([]);
  });

  it('ignores a stylesheet that does not return 200', async () => {
    const { ctx } = ctxWith({});
    const page = mockPageContext(
      'https://a.test/',
      '<html><head><link rel="stylesheet" href="/missing.css"></head><body></body></html>',
    );
    const css = await collectPageCss(ctx, page);
    expect(css.rules).toEqual([]);
    expect(css.fetched).toEqual([]);
  });

  it('caps the number of stylesheets it fetches', async () => {
    const sheets: Record<string, string> = {};
    const links: string[] = [];
    for (let i = 0; i < 9; i += 1) {
      sheets[`https://a.test/s${i}.css`] = `.a${i} { display: none }`;
      links.push(`<link rel="stylesheet" href="/s${i}.css">`);
    }
    const { ctx, seen } = ctxWith(sheets);
    const page = mockPageContext('https://a.test/', `<html><head>${links.join('')}</head><body></body></html>`);
    await collectPageCss(ctx, page);
    expect(seen).toHaveLength(5);
  });
});
