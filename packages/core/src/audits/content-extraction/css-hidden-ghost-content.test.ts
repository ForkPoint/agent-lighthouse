import { describe, it, expect, vi } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { CssHiddenGhostContentAudit } from './css-hidden-ghost-content';
import {
  attributableFixture,
  mockCheckContext,
  mockFetchResult,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { FetchOptions } from '../../fetcher';

// isSafeUrl performs a real DNS lookup before a linked stylesheet is fetched.
// Stub it with an offline stand-in that still blocks loopback and private
// ranges.
vi.mock('../../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../fetcher')>();
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

/** 400 words of prose, well past both the share and the absolute threshold. */
const BULK = 'the quarterly figures showed a modest improvement across every region '.repeat(40);
const VISIBLE = 'our flagship product ships in three colours and two sizes today '.repeat(10);

function run(body: string, head = '', sheets: Record<string, string> = {}) {
  const audit = new CssHiddenGhostContentAudit();
  const html = `<html><head>${head}</head><body>${body}</body></html>`;
  const ctx = mockCheckContext([mockPageContext('https://example.test/', html)]);
  ctx.fetch = async (o: FetchOptions) => {
    const sheet = sheets[o.url];
    return sheet === undefined ? mockFetchResult('', 404) : mockFetchResult(sheet, 200, 'text/css');
  };
  return audit.audit(ctx);
}

const SHEET_LINK = '<link rel="stylesheet" href="/s.css">';
const sheet = (css: string) => ({ 'https://example.test/s.css': css });

describe('CssHiddenGhostContentAudit', () => {
  const audit = new CssHiddenGhostContentAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when the page has no body text', async () => {
    const result = await run('<div></div>');
    expect(result.status).toBe('na');
  });

  it('passes a page with no stylesheets and no inline hidden text', async () => {
    const result = await run(`<main><p>${VISIBLE}</p></main>`);
    expect(result.status).toBe('pass');
  });

  // The selector is the evidence: no cascade is resolved, so a human has to be
  // able to check the match the scanner made.
  it('fails on a class-hidden block, naming the selector and the token estimate', async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet('.ghost { display: none }'),
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('.ghost');
    expect(result.found).toMatch(/\d+ est\. tokens/);
  });

  it('treats visibility:hidden the same way', async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet('.ghost { visibility: hidden }'),
    );
    expect(result.status).toBe('fail');
  });

  it('treats content-visibility:hidden the same way', async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet('.ghost { content-visibility: hidden }'),
    );
    expect(result.status).toBe('fail');
  });

  // The sr-only idiom is legitimate assistive text, not a payload, as long as
  // it stays short.
  it('excludes the 1px clip idiom when the text is under 120 characters', async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><span class="sr-only">Skip to main content</span>`,
      SHEET_LINK,
      sheet('.sr-only { position: absolute; clip: rect(0,0,0,0); width: 1px; height: 1px }'),
    );
    expect(result.status).toBe('pass');
  });

  it('counts a clip-idiom block that is far too long to be assistive text', async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><span class="sr-only">${BULK}</span>`,
      SHEET_LINK,
      sheet('.sr-only { position: absolute; clip: rect(0,0,0,0); width: 1px; height: 1px }'),
    );
    expect(result.status).toBe('fail');
  });

  // Hiding text from a printer is not hiding it from a reader.
  it('ignores a rule inside @media print', async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet('@media print { .ghost { display: none } }'),
    );
    expect(result.status).toBe('pass');
  });

  // Readability already drops these, so counting them would report a cost no
  // extractor actually pays.
  it('excludes a node that already carries an inline hidden marker', async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost" style="display:none">${BULK}</div>`,
      SHEET_LINK,
      sheet('.ghost { display: none }'),
    );
    expect(result.status).toBe('pass');
  });

  it('reports near-duplicate hidden text as duplication, not novel content', async () => {
    const result = await run(
      `<main><p>${BULK}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet('.ghost { display: none }'),
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('duplicat');
  });

  it('calls novel hidden content novel rather than duplication', async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet('.ghost { display: none }'),
    );
    expect(result.message).not.toContain('duplicat');
  });

  it('warns on a small class-hidden block below both thresholds', async () => {
    const result = await run(
      `<main><p>${BULK}</p><p>${BULK}</p></main><div class="ghost">a short hidden aside about shipping times and returns</div>`,
      SHEET_LINK,
      sheet('.ghost { display: none }'),
    );
    expect(result.status).toBe('warn');
  });

  it('reports a cross-origin stylesheet it did not fetch', async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main>`,
      '<link rel="stylesheet" href="https://cdn.test/s.css">',
    );
    expect(result.found).toContain('1 cross-origin stylesheet not fetched');
  });

  it('reports the page the ghost content is on', async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet('.ghost { display: none }'),
    );
    expect(result.pageUrl).toBe('https://example.test/');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new CssHiddenGhostContentAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      CssHiddenGhostContentAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === CssHiddenGhostContentAudit.meta.id)?.status,
    ).toBe('na');
  });
});
