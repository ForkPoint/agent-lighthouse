import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { ServerRenderedAudit } from './server-rendered';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';
import { AuditResultSchema } from '../../schemas';
import type { PageContext } from '../../check-context';

/** A page whose served body carries `words` readable words. */
function wordyPage(url: string, words: number): PageContext {
  const text = Array.from({ length: words }, (_, i) => `word${i}`).join(' ');
  return mockPageContext(url, `<html><body><main>${text}</main></body></html>`);
}

describe('ServerRenderedAudit', () => {
  const audit = new ServerRenderedAudit();

  it('passes when the homepage has substantial text content', () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
    const page = mockPageContext('https://example.com', `<html><body><main>${words}</main></body></html>`);
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('serve their content in the HTML response');
  });

  it('fails when the homepage has minimal content', () => {
    const page = mockPageContext('https://example.com', '<html><body><main>Hi</main></body></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('serve readable content');
  });

  it('is notApplicable when the scan fetched no page', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('no page');
  });
});

describe('ServerRenderedAudit — body-text metric', () => {
  const audit = new ServerRenderedAudit();

  // velasca.com: one empty <main>, 194 words of copy elsewhere in the body.
  // The shipped audit read the empty <main> and reported "0 words".
  it('passes a page whose only <main> is empty but whose body is full', () => {
    const words = Array.from({ length: 194 }, (_, i) => `word${i}`).join(' ');
    const html = `<html><body><main></main><div class="section"><p>${words}</p></div></body></html>`;
    const page = mockPageContext('https://example.com', html);
    const result = audit.audit(mockCheckContext([page]));

    expect(result.status).toBe('pass');
    expect(result.found).toContain('1 of 1');
  });

  // hiutdenim.co.uk: four <main> elements, the first holding 49 characters.
  it('passes a page with several <main> elements and a tiny first one', () => {
    const tiny = 'a'.repeat(49);
    const real = Array.from({ length: 120 }, (_, i) => `real${i}`).join(' ');
    const html = `<html><body>
      <main>${tiny}</main>
      <main></main>
      <main>${real}</main>
    </body></html>`;
    const page = mockPageContext('https://example.com', html);
    const result = audit.audit(mockCheckContext([page]));

    expect(result.status).toBe('pass');
    expect(result.found).toContain('1 of 1');
  });

  it('still fails a true client-rendered shell at critical priority', () => {
    const html =
      '<html><body><nav>Home Shop About</nav><div id="root"></div><footer>(c) 2026</footer></body></html>';
    const page = mockPageContext('https://example.com', html);
    const result = audit.audit(mockCheckContext([page]));

    expect(result.status).toBe('fail');
    expect(result.priority).toBe('critical');
    expect(AuditResultSchema.parse(result).status).toBe('fail');
  });

  it('passes a CJK page on the character branch alone', () => {
    // Six whitespace-delimited runs of Han characters: 6 "words", 401 chars.
    const chunk = '\u4e2d'.repeat(66);
    const body = Array.from({ length: 6 }, () => chunk).join(' ');
    const html = `<html><body><main>${body}</main></body></html>`;
    const page = mockPageContext('https://example.com', html);
    const result = audit.audit(mockCheckContext([page]));

    // 6 whitespace-delimited words, 401 characters: only the character
    // branch of the threshold can carry this page.
    expect(result.status).toBe('pass');
  });
});


describe('ServerRenderedAudit — every page, not just the first', () => {
  const audit = new ServerRenderedAudit();

  it('passes when every fetched page served readable text, and reports the ratio', () => {
    const ctx = mockCheckContext([
      wordyPage('https://example.com/', 80),
      wordyPage('https://example.com/shop', 80),
    ]);
    const result = audit.audit(ctx);

    expect(result.status).toBe('pass');
    expect(result.found).toContain('2 of 2');
  });

  it('warns when some pages are shells and names them', () => {
    const ctx = mockCheckContext([
      wordyPage('https://example.com/', 80),
      wordyPage('https://example.com/shop', 3),
    ]);
    const result = audit.audit(ctx);

    expect(result.status).toBe('warn');
    expect(result.found).toContain('1 of 2');
    expect(AuditResultSchema.parse(result).details?.emptyPages).toContain(
      'https://example.com/shop',
    );
  });

  it('fails at critical priority when no page served readable text', () => {
    const ctx = mockCheckContext([
      wordyPage('https://example.com/', 2),
      wordyPage('https://example.com/shop', 2),
    ]);
    const result = audit.audit(ctx);

    expect(result.status).toBe('fail');
    expect(result.priority).toBe('critical');
    expect(result.found).toContain('0 of 2');
  });

  it('reads the scan evidence rather than re-deciding per page', () => {
    const pages = [wordyPage('https://example.com/', 80), wordyPage('https://example.com/shop', 80)];
    const ctx = mockCheckContext(pages);
    // The scan saw one of these pages answer with nothing. The audit must
    // report what the scan recorded, not what the stored DOM says now.
    ctx.evidence.renderedByPage = {
      'https://example.com/': true,
      'https://example.com/shop': false,
    };
    const result = audit.audit(ctx);

    expect(result.status).toBe('warn');
    expect(result.found).toContain('1 of 2');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new ServerRenderedAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(ServerRenderedAudit.meta.id);
    expect(plan.skipped.find((stub) => stub.id === ServerRenderedAudit.meta.id)?.status).toBe('na');
  });
});
