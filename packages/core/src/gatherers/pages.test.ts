import { describe, it, expect } from 'vitest';
import { pagesOfType, judgePages } from './pages';
import { parseHtml } from '../parser';
import type { CheckContext, PageContext } from '../check-context';
import type { PageType } from '../types';
import { allEvidenceMet } from '../scan-evidence';

const page = (url: string, pageType: PageType, title: string): PageContext => ({
  url,
  pageType,
  fetchResult: {
    url,
    finalUrl: url,
    status: 200,
    headers: {},
    body: '',
    ttfbMs: 1,
    totalMs: 1,
    contentType: 'text/html',
    contentLength: 0,
  },
  $: parseHtml(`<title>${title}</title>`),
  jsonLd: [],
  meta: title ? { description: title } : {},
  headLinks: [],
});

const ctx = {
  pages: [
    page('https://x.test/', 'homepage', 'Home'),
    page('https://x.test/p', 'product', ''),
    page('https://x.test/c', 'category', 'Cat'),
  ],
  evidence: allEvidenceMet(),
} as unknown as CheckContext;

describe('pagesOfType', () => {
  it('returns all pages when no types given', () => {
    expect(pagesOfType(ctx)).toHaveLength(3);
  });
  it('filters by page type', () => {
    expect(pagesOfType(ctx, 'product').map((p) => p.url)).toEqual(['https://x.test/p']);
  });
  it('returns a copy, so mutating the result never touches ctx.pages', () => {
    const all = pagesOfType(ctx);
    all.pop();
    expect(all).toHaveLength(2);
    expect(ctx.pages).toHaveLength(3);
  });
});

describe('judgePages', () => {
  it('judges every page, not just the first', () => {
    const { judged, passRate, failures } = judgePages(pagesOfType(ctx), (p) => ({
      ok: Boolean(p.meta['description']),
      detail: p.url,
    }));
    expect(judged).toHaveLength(3);
    expect(passRate).toBeCloseTo(2 / 3);
    expect(failures.map((f) => f.page.url)).toEqual(['https://x.test/p']);
  });
  it('keeps the real page even when the judge returns its own page key', () => {
    const [first] = ctx.pages;
    const { judged } = judgePages([first!], () => ({ ok: true, page: 'bogus' }) as never);
    expect(judged[0]!.page).toBe(first);
  });
  it('empty page set gives passRate 1 and empty judged (caller must return na)', () => {
    const { judged, passRate } = judgePages([], () => ({ ok: true }));
    expect(judged).toHaveLength(0);
    expect(passRate).toBe(1);
  });
});
