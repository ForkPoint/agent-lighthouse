import { describe, it, expect } from 'vitest';
import { AiContentDeclarationAudit } from './ai-content-declaration';
import { mockCheckContext, mockPageContext, mockFetchResult } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { PageContext } from '../../check-context';

const page = (head: string, url = 'https://example.com/'): PageContext =>
  mockPageContext(url, `<html lang="en"><head>${head}</head><body></body></html>`);

/** Attach a response header to a page, the way a real fetch would. */
function withHeader(p: PageContext, name: string, value: string): PageContext {
  p.fetchResult.headers[name] = value;
  return p;
}

describe('AiContentDeclarationAudit', () => {
  const audit = new AiContentDeclarationAudit();

  it('returns na on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  describe('absence is not a defect', () => {
    // The old audit failed 100% of real sites at medium priority for a tag
    // that does not exist as a standard. Pure score noise, and misinformation.
    it('is na when the site declares nothing', () => {
      const result = audit.audit(mockCheckContext([page('<title>Plain</title>')]));
      expect(result.status).toBe('na');
      expect(result.status).not.toBe('fail');
    });

    it('never returns fail for any input', () => {
      for (const html of ['', '<meta name="noai">', '<meta name="ai-content-declaration" content="x">']) {
        expect(audit.audit(mockCheckContext([page(html)])).status).not.toBe('fail');
      }
    });
  });

  describe('AIPREF Content-Usage — the standards-track path', () => {
    it('passes on a Content-Usage response header', () => {
      const result = audit.audit(
        mockCheckContext([withHeader(page(''), 'content-usage', 'ai-train=n')]),
      );
      expect(result.status).toBe('pass');
      expect(result.found).toContain('Content-Usage');
      expect(result.found).toContain('ai-train=n');
    });

    it('passes on a Content-Usage rule in robots.txt', () => {
      const result = audit.audit(
        mockCheckContext([page('')], {
          '/robots.txt': mockFetchResult(
            'User-agent: *\nContent-Usage: ai-train=n\nAllow: /',
            200,
            'text/plain',
          ),
        }),
      );
      expect(result.status).toBe('pass');
      expect(result.found).toContain('robots.txt');
    });

    it('prefers the header over a head-level declaration', () => {
      const result = audit.audit(
        mockCheckContext([withHeader(page('<meta name="noai">'), 'content-usage', 'ai-train=n')]),
      );
      expect(result.status).toBe('pass');
    });
  });

  describe('noai / noimageai — real convention, no documented consumer', () => {
    it('warns on a bare <meta name="noai"> with no content attribute', () => {
      const result = audit.audit(mockCheckContext([page('<meta name="noai">')]));
      expect(result.status).toBe('warn');
      expect(result.found).toContain('noai');
    });

    it('reads noai and noimageai as tokens of meta robots', () => {
      const result = audit.audit(
        mockCheckContext([page('<meta name="robots" content="index, noai, noimageai">')]),
      );
      expect(result.status).toBe('warn');
      expect(result.found).toContain('noai');
      expect(result.found).toContain('noimageai');
    });

    it('does not match noai inside an unrelated robots token', () => {
      const result = audit.audit(
        mockCheckContext([page('<meta name="robots" content="noarchive, nosnippet">')]),
      );
      expect(result.status).toBe('na');
    });

    it('says plainly that no AI vendor documents honoring these names', () => {
      const result = audit.audit(mockCheckContext([page('<meta name="noai">')]));
      expect(result.message.toLowerCase()).toContain('no ai vendor documents');
      expect(result.message).toContain('robots.txt');
    });

    it('scans every page, not just the first', () => {
      const result = audit.audit(
        mockCheckContext([page(''), page('<meta name="noai">', 'https://example.com/blog')]),
      );
      expect(result.status).toBe('warn');
      expect(result.pageUrl).toBe('https://example.com/blog');
    });
  });

  describe('the invented directive name is reported as invented', () => {
    it('warns that ai-content-declaration is not a real directive', () => {
      const result = audit.audit(
        mockCheckContext([
          page('<meta name="ai-content-declaration" content="https://example.com/llms.txt">'),
        ]),
      );
      expect(result.status).toBe('warn');
      expect(result.message).toContain('ai-content-declaration');
      expect(result.message).toContain('no specification');
    });

    // The old audit warned "not a valid URL" against the value format the real
    // aicontentdeclaration.org proposal actually uses. It no longer judges the
    // value at all, because no spec defines what a valid one would be.
    it('does not judge the value format', () => {
      const url = audit.audit(
        mockCheckContext([page('<meta name="ai-content-declaration" content="https://x.test/p">')]),
      );
      const prose = audit.audit(
        mockCheckContext([page('<meta name="ai-content-declaration" content="AI-generated">')]),
      );
      expect(url.status).toBe(prose.status);
      expect(prose.message).not.toContain('not a valid URL');
    });
  });

  describe('non-double-counting with tdm-rep', () => {
    it('ignores tdm-reservation, which access-crawl-control/tdm-rep owns', () => {
      const result = audit.audit(
        mockCheckContext([page('<meta name="tdm-reservation" content="1">')]),
      );
      expect(result.status).toBe('na');
    });
  });

  describe('meta contract', () => {
    const meta = AiContentDeclarationAudit.meta;

    it('is grade D, experimental, weight 0, informative', () => {
      expect(meta.id).toBe('access-crawl-control/ai-content-declaration');
      expect(meta.evidenceGrade).toBe('D');
      expect(meta.tier).toBe('experimental');
      expect(meta.weight).toBe(0);
      expect(meta.scoreDisplayMode).toBe('informative');
    });

    // The misinformation the code review called out: the shipped copy told
    // users GPTBot and ClaudeBot read this tag. Both document robots.txt only.
    it('no longer claims GPTBot or ClaudeBot consume a meta tag', () => {
      const copy = JSON.stringify(meta);
      expect(copy).not.toContain('GPTBot');
      expect(copy).not.toContain('ClaudeBot');
    });

    it('drops the priority to low', () => {
      expect(meta.defaultPriority).toBe('low');
    });
  });
});
