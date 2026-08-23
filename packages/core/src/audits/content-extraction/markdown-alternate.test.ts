import { describe, it, expect, vi } from 'vitest';
import { MarkdownAlternateAudit } from './markdown-alternate';
import { mockCheckContext, mockPageContext, mockFetchResult } from '../../__tests__/test-utils';
import type { CheckContext } from '../../check-context';
import type { FetchOptions, FetchResult } from '../../fetcher';

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

const SECTIONS = [
  ['Boiling time', 'The copper kettle reaches a rolling boil in about three minutes on gas.'],
  ['Descaling', 'Fill the kettle with equal parts water and white vinegar, then leave it overnight.'],
  ['Warranty', 'Every kettle carries a two year warranty covering the element and the handle.'],
] as const;

const HTML = `<html><head><title>Kettles</title></head><body><main><h1>Kettles</h1>${SECTIONS.map(
  ([heading, prose]) => `<h2>${heading}</h2><p>${prose} ${prose}</p>`,
).join('')}</main></body></html>`;

const FAITHFUL_MD = `# Kettles\n\n${SECTIONS.map(
  ([heading, prose]) => `## ${heading}\n\n${prose} ${prose}\n`,
).join('\n')}`;

/** A site whose markdown alternate answers on `url + '.md'`. */
function site(
  markdown: string | null,
  opts: { contentType?: string; head?: string; headers?: Record<string, string> } = {},
): { ctx: CheckContext; calls: () => FetchOptions[] } {
  const calls: FetchOptions[] = [];
  const html = opts.head ? HTML.replace('</head>', `${opts.head}</head>`) : HTML;
  const ctx = mockCheckContext([mockPageContext('https://example.com/kettles', html, 1)]);
  if (opts.headers) Object.assign(ctx.pages[0]!.fetchResult.headers, opts.headers);
  ctx.fetch = async (options: FetchOptions): Promise<FetchResult> => {
    calls.push(options);
    const wantsMarkdown =
      options.url.endsWith('.md') || (options.acceptHeader ?? '').includes('text/markdown');
    if (markdown !== null && wantsMarkdown) {
      return mockFetchResult(markdown, 200, opts.contentType ?? 'text/markdown');
    }
    return mockFetchResult('', 404);
  };
  return { ctx, calls: () => calls };
}

describe('MarkdownAlternateAudit', () => {
  const audit = new MarkdownAlternateAudit();

  // Kept from the audit this fold extended: no alternate anywhere is a failure,
  // not a not-applicable. The link is the documented convention, and its
  // absence is what the grade-A evidence is about.
  it('fails when no alternate is discoverable by any route', async () => {
    const { ctx } = site(null);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No Markdown alternate link');
  });

  it('fails when there are no pages', async () => {
    expect((await audit.audit(mockCheckContext([]))).status).toBe('fail');
  });

  it('passes on a declared link whose document resolves as markdown', async () => {
    const { ctx } = site(FAITHFUL_MD, {
      head: '<link rel="alternate" type="text/markdown" href="/kettles.md">',
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('declared link');
  });

  it('passes a faithful alternate served as text/markdown', async () => {
    const { ctx } = site(FAITHFUL_MD);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('accepts a charset parameter on the content type', async () => {
    const { ctx } = site(FAITHFUL_MD, { contentType: 'text/markdown; charset=utf-8' });
    expect((await audit.audit(ctx)).status).toBe('pass');
  });

  it('fails an alternate served as text/plain or text/html', async () => {
    for (const contentType of ['text/plain', 'text/html']) {
      const { ctx } = site(FAITHFUL_MD, { contentType });
      const result = await audit.audit(ctx);
      expect(result.status, contentType).toBe('fail');
      expect(result.found).toContain('text/markdown');
    }
  });

  it('fails an alternate that is missing half the headings, and names them', async () => {
    const { ctx } = site(`# Kettles\n\n## Boiling time\n\n${SECTIONS[0][1]}\n`);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('Descaling');
  });

  it('reports the token saving in absolute and relative terms', async () => {
    const { ctx } = site(FAITHFUL_MD);
    const result = await audit.audit(ctx);
    expect(Number(result.details?.['htmlTokens'])).toBeGreaterThan(
      Number(result.details?.['markdownTokens']),
    );
    expect(result.found).toMatch(/\d+% fewer tokens/);
  });

  it('reports MDX component tags separately without breaking fidelity', async () => {
    const { ctx } = site(`${FAITHFUL_MD}\n<KettleCard sku="A1" />\n`);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('KettleCard');
  });

  it('finds an alternate declared by a link element', async () => {
    const { ctx, calls } = site(FAITHFUL_MD, {
      head: '<link rel="alternate" type="text/markdown" href="/kettles.md">',
    });
    expect((await audit.audit(ctx)).status).toBe('pass');
    expect(calls()[0]?.url).toBe('https://example.com/kettles.md');
  });

  it('finds an alternate declared by a Link response header', async () => {
    const { ctx } = site(FAITHFUL_MD, {
      headers: { link: '</kettles.md>; rel="alternate"; type="text/markdown"' },
    });
    expect((await audit.audit(ctx)).status).toBe('pass');
  });

  it('sends at most three probes, all GET and all same-origin', async () => {
    const { ctx, calls } = site(null);
    await audit.audit(ctx);
    expect(calls().length).toBeLessThanOrEqual(3);
    for (const call of calls()) {
      expect(call.method ?? 'GET').toBe('GET');
      expect(new URL(call.url).origin).toBe('https://example.com');
    }
  });

  it('keeps the grade-A registration of the audit it extended', () => {
    const { meta } = MarkdownAlternateAudit;
    expect(meta.evidenceGrade).toBe('A');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(1);
  });
  it('fails a declared alternate that does not resolve', async () => {
    const calls: FetchOptions[] = [];
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/kettles',
        HTML.replace('</head>', '<link rel="alternate" type="text/markdown" href="/kettles.md"></head>'),
        1,
      ),
    ]);
    ctx.fetch = async (options: FetchOptions) => {
      calls.push(options);
      return mockFetchResult('', 404);
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('404');
  });

  // A document the scan never saw is not evidence the site is broken.
  it('passes a declared alternate whose document could not be read', async () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/kettles',
        HTML.replace('</head>', '<link rel="alternate" type="text/markdown" href="/kettles.md"></head>'),
        1,
      ),
    ]);
    ctx.fetch = async () => mockFetchResult('', 200, 'text/html');
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.details?.['verified']).toBe(false);
  });
});
