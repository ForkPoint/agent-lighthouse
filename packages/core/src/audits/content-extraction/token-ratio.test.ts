import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { TokenRatioAudit } from './token-ratio';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

describe('TokenRatioAudit', () => {
  const audit = new TokenRatioAudit();

  it('passes when the page is mostly content text', () => {
    const text = 'meaningful content words '.repeat(200);
    const html = `<html><head><title>T</title></head><body><main><h1>Hi</h1><p>${text}</p></main></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.displayValue).toContain('%');
  });

  it('warns when content share is between 5% and 15%', () => {
    const text = 'some real content here. '.repeat(10); // ~240 chars of text
    const padding = `<div class="${'a'.repeat(40)}"></div>`.repeat(50); // ~2.5k chars of markup, no text
    const html = `<html><body><main><p>${text}</p>${padding}</main></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.priority).toBe('high');
  });

  it('fails when tiny text is buried in huge markup padding', () => {
    const padding = `<div class="${'a'.repeat(200)}" data-x="${'b'.repeat(200)}"><span></span></div>`.repeat(
      100,
    );
    const html = `<html><body><main>${padding}<p>Buy now</p></main></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.displayValue).toContain('%');
    expect(result.priority).toBe('high');
  });

  it('ignores inline script and style weight in the content measure', () => {
    const text = 'visible words only '.repeat(100);
    const script = `<script>${'var x = 1;'.repeat(20000)}</script>`;
    const html = `<html><body><main><p>${text}</p>${script}</main></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    // script is excluded from clean text but counted in raw HTML -> low ratio -> fail
    expect(result.status).toBe('fail');
  });

  it('returns na when the body is empty', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', '', 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
  });
  // The signal-density fold: BPE tokens, not characters. Base64 tokenizes far
  // worse than prose of the same length, and the ratio must show that.
  it('measures tokens, so base64 padding costs more than prose padding', () => {
    const body = (padding: string) =>
      `<html><body><main><p>${'meaningful content words '.repeat(40)}</p><!--${padding}--></main></body></html>`;
    const base64 = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo='.repeat(150);
    const prose = 'the quick brown fox jumps over the lazy dog again '.repeat(105);
    const ratioOf = (html: string) => {
      const result = audit.audit(mockCheckContext([mockPageContext('https://example.com/', html, 0)]));
      return Number(result.details?.['contentTokens']) / Number(result.details?.['deliveredTokens']);
    };
    expect(Math.abs(base64.length - prose.length) / prose.length).toBeLessThan(0.05);
    expect(ratioOf(body(base64))).toBeLessThan(ratioOf(body(prose)));
  });

  it('names the extractor it used for the numerator', () => {
    const text = 'The mug holds three hundred millilitres of coffee. '.repeat(30);
    const html = `<html><head><title>Mug</title></head><body><article><h1>Mug</h1><p>${text}</p></article></body></html>`;
    const result = audit.audit(mockCheckContext([mockPageContext('https://example.com/', html, 0)]));
    expect(result.details?.['extractor']).toBe('readability');
    expect(result.displayValue).toContain('readability');
  });

  it('falls back to the semantic extractor when readability declines', () => {
    const html = '<html><body></body></html>';
    const result = audit.audit(mockCheckContext([mockPageContext('https://example.com/', html, 0)]));
    expect(result.details?.['extractor']).toBe('semantic');
  });

  it('splits the denominator into buckets that sum to the delivered tokens', () => {
    const html = `<html><head><style>${'.a{color:red}'.repeat(50)}</style></head><body><!-- note --><main><p>${'words here '.repeat(80)}</p></main><script>${'var x=1;'.repeat(50)}</script></body></html>`;
    const result = audit.audit(mockCheckContext([mockPageContext('https://example.com/', html, 0)]));
    const d = result.details as Record<string, number>;
    expect(d['script']).toBeGreaterThan(0);
    expect(d['style']).toBeGreaterThan(0);
    expect(d['comment']).toBeGreaterThan(0);
    expect(d['script'] + d['style'] + d['comment'] + d['text'] + d['structure']).toBe(
      d['deliveredTokens'],
    );
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new TokenRatioAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(TokenRatioAudit.meta.id);
    expect(plan.skipped.find((stub) => stub.id === TokenRatioAudit.meta.id)?.status).toBe('na');
  });
});
