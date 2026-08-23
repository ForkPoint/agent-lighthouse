import { describe, it, expect } from 'vitest';
import { HydrationPayloadShareAudit } from './hydration-payload-share';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';

/** Enough visible prose that a small payload stays a small share of the page. */
const PROSE = '<p>Our winter boots are waterproof, insulated and resoleable.</p>'.repeat(300);
/** Distinct main-content text used for the duplication comparison. */
const ARTICLE =
  'Alpine resoling restores a welted boot by replacing the outsole and midsole while keeping the upper, which is why a resoleable boot outlasts a cemented one by several seasons in wet conditions. ';

function run(body: string) {
  const audit = new HydrationPayloadShareAudit();
  const html = `<html><head></head><body>${body}</body></html>`;
  return audit.audit(mockCheckContext([mockPageContext('https://example.test/', html)]));
}

describe('HydrationPayloadShareAudit', () => {
  const audit = new HydrationPayloadShareAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when the page inlines no hydration state', () => {
    expect(run(`<main>${PROSE}</main>`).status).toBe('na');
  });

  // Next.js itself flags a single payload over 128 kB as a defect.
  it('fails a __NEXT_DATA__ payload over 128,000 bytes and names it', () => {
    const blob = JSON.stringify({ props: { pageProps: { filler: 'x'.repeat(130_000) } } });
    const result = run(
      `<main>${PROSE}</main><script id="__NEXT_DATA__" type="application/json">${blob}</script>`,
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('__NEXT_DATA__');
    expect(result.message).toContain('128');
  });

  // The flight stream arrives as many pushes; the cost is their sum.
  it('sums concatenated self.__next_f.push flight frames into one payload', () => {
    const frame = (i: number) => `<script>self.__next_f.push([1,"${String(i)}${'y'.repeat(45_000)}"])</script>`;
    const result = run(`<main>${PROSE}</main>${frame(1)}${frame(2)}${frame(3)}`);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('self.__next_f');
    expect(result.found).toContain('1 state payload');
  });

  it('detects window.__NUXT__ and window.__APOLLO_STATE__ separately', () => {
    const result = run(`<main>${PROSE}</main>
      <script>window.__NUXT__={"data":{"page":"home"}}</script>
      <script>window.__APOLLO_STATE__={"Product:1":{"sku":"AB-1"}}</script>`);
    expect(result.found).toContain('window.__NUXT__');
    expect(result.found).toContain('window.__APOLLO_STATE__');
  });

  it('detects __remixContext and window.__INITIAL_STATE__', () => {
    const result = run(`<main>${PROSE}</main>
      <script>window.__remixContext={"state":{"loaderData":{}}}</script>
      <script>window.__INITIAL_STATE__={"cart":{"items":[]}}</script>`);
    expect(result.found).toContain('__remixContext');
    expect(result.found).toContain('window.__INITIAL_STATE__');
  });

  // Shipping the article body twice in one response is the expensive case.
  it('reports duplication with the shingle fraction when state repeats the main content', () => {
    const body = ARTICLE.repeat(6);
    const blob = JSON.stringify({ props: { pageProps: { article: { body } } } });
    const result = run(
      `<main><article>${body}</article></main><script id="__NEXT_DATA__" type="application/json">${blob}</script>`,
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('duplicat');
    expect(result.message).toMatch(/\d+(\.\d+)?% of the main-content/);
  });

  it('passes a small payload that duplicates nothing', () => {
    const blob = JSON.stringify({ props: { pageProps: { sku: 'AB-1', variants: 'q'.repeat(2_000) } } });
    const result = run(
      `<main>${PROSE}</main><script id="__NEXT_DATA__" type="application/json">${blob}</script>`,
    );
    expect(result.status).toBe('pass');
  });

  it('warns when total state sits between 15% and 30% of the document', () => {
    const blob = JSON.stringify({ props: { pageProps: { filler: 'z'.repeat(4_500) } } });
    const result = run(
      `<main><p>Short page.</p></main><script id="__NEXT_DATA__" type="application/json">${blob}</script>${'<p>Copy.</p>'.repeat(1_500)}`,
    );
    expect(result.status).toBe('warn');
  });

  it('reports the estimated token cost of the payloads', () => {
    const blob = JSON.stringify({ props: { pageProps: { variants: 'q'.repeat(2_000) } } });
    const result = run(
      `<main>${PROSE}</main><script id="__NEXT_DATA__" type="application/json">${blob}</script>`,
    );
    expect(result.found).toMatch(/\d+ est\. tokens/);
  });

  it('reports the page the payload is on', () => {
    const blob = JSON.stringify({ props: { pageProps: { variants: 'q'.repeat(2_000) } } });
    const result = run(
      `<main>${PROSE}</main><script id="__NEXT_DATA__" type="application/json">${blob}</script>`,
    );
    expect(result.pageUrl).toBe('https://example.test/');
  });
});
