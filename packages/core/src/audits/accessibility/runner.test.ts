import { describe, it, expect } from 'vitest';
import { runA11yForHtml, stripStyles } from './runner';

// The runner builds a fresh jsdom per call and runs the vendored a11y rules
// against it, fully isolated, re-runnable, and concurrency-safe.
describe('runA11yForHtml', () => {
  const RULES = ['document-title', 'aria-roles', 'tabindex'];
  const withTitle =
    '<!doctype html><html lang="en"><head><title>Hi</title></head><body><button>Go</button></body></html>';
  const noTitle =
    '<!doctype html><html lang="en"><head></head><body><div role="notarole">x</div></body></html>';

  it('runs across multiple different documents sequentially', async () => {
    const a = await runA11yForHtml(withTitle, 'https://a.test/', RULES);
    const b = await runA11yForHtml(noTitle, 'https://b.test/', RULES);
    const c = await runA11yForHtml(withTitle, 'https://c.test/', RULES);
    for (const r of [a, b, c]) expect(Object.keys(r).length).toBeGreaterThan(0);
  });

  it('runs concurrently across documents', async () => {
    const results = await Promise.all([
      runA11yForHtml(withTitle, 'https://1.test/', RULES),
      runA11yForHtml(noTitle, 'https://2.test/', RULES),
      runA11yForHtml(withTitle, 'https://3.test/', RULES),
    ]);
    for (const r of results) expect(Object.keys(r).length).toBeGreaterThan(0);
  });

  it('reports violations vs passes correctly', async () => {
    const bad = await runA11yForHtml(noTitle, 'https://bad.test/', RULES);
    // Invalid `role="notarole"` → aria-roles violation.
    expect(bad['aria-roles']?.status).toBe('fail');
    // No <title> → document-title violation.
    expect(bad['document-title']?.status).toBe('fail');

    const good = await runA11yForHtml(withTitle, 'https://good.test/', RULES);
    expect(good['document-title']?.status).toBe('pass');
  });

  it('reports failing-node targets for violations', async () => {
    const bad = await runA11yForHtml(noTitle, 'https://nodes.test/', RULES);
    expect(bad['aria-roles']?.nodes.length).toBeGreaterThan(0);
    expect(typeof bad['aria-roles']?.nodes[0].target).toBe('string');
  });

  it('returns an empty map without throwing on unparseable input', async () => {
    const r = await runA11yForHtml('', 'https://empty.test/', RULES);
    expect(typeof r).toBe('object');
  });

  it('degrades to an empty map when the run throws (invalid jsdom url)', async () => {
    // An unparseable `url` makes the JSDOM constructor throw, exercising the
    // catch path that logs and returns {} so audits fall back to not-applicable.
    const r = await runA11yForHtml(withTitle, 'http://%%%-invalid-url', RULES);
    expect(r).toEqual({});
  });

  it('collects inapplicable rules', async () => {
    // `frame-title` has no frames to evaluate here → inapplicable.
    const r = await runA11yForHtml(withTitle, 'https://inapplicable.test/', ['frame-title']);
    expect(r['frame-title']?.status).toBe('inapplicable');
  });

  it('ignores unknown rule ids', async () => {
    const r = await runA11yForHtml(withTitle, 'https://unknown.test/', ['not-a-real-rule']);
    expect(r['not-a-real-rule']).toBeUndefined();
  });

  it('drains the concurrency queue when more runs are inflight than the limit', async () => {
    // Default A11Y_CONCURRENCY is 3; fire 8 at once to force the semaphore to
    // queue the overflow and later release them.
    const runs = Array.from({ length: 8 }, (_v, i) =>
      runA11yForHtml(withTitle, `https://q${i}.test/`, RULES),
    );
    const results = await Promise.all(runs);
    expect(results).toHaveLength(8);
    for (const r of results) expect(Object.keys(r).length).toBeGreaterThan(0);
  });

  it('evaluates rules correctly on a CSS-heavy page (styles are not parsed)', async () => {
    // A big, deliberately malformed <style> block would flood jsdom's CSS
    // parser; stripping it keeps construction fast and leaves rule results
    // unchanged (no rule reads CSS). Inline style="" on the button is kept.
    const bloat = '.x{color:red;;;} @media(} .y{{ '.repeat(2000);
    const html = `<!doctype html><html lang="en"><head><title>Hi</title>
      <style>${bloat}</style><link rel="stylesheet" href="/big.css"></head>
      <body><button style="display:none">Go</button></body></html>`;
    const r = await runA11yForHtml(html, 'https://css.test/', RULES);
    expect(r['document-title']?.status).toBe('pass');
  });
});

describe('stripStyles', () => {
  it('removes <style> blocks and stylesheet <link>s but keeps inline style attrs', () => {
    const out = stripStyles(
      '<head><style>.a{color:red}</style><link rel="stylesheet" href="a.css">' +
        '<link rel="icon" href="f.ico"></head><body><p style="color:red">x</p></body>',
    );
    expect(out).not.toContain('<style');
    expect(out).not.toContain('stylesheet');
    expect(out).toContain('<link rel="icon"'); // non-stylesheet links preserved
    expect(out).toContain('style="color:red"'); // inline style attr preserved
  });

  it('strips multiple and attribute-bearing style blocks', () => {
    const out = stripStyles('<style type="text/css">a</style>t<style media="print">b</style>');
    expect(out).toBe('t');
  });
});
