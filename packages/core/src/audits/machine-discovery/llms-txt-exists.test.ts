import { describe, it, expect } from 'vitest';
import { LlmsTxtExistsAudit } from './llms-txt-exists';
import { mockCheckContext, mockPageContext, mockFetchResult } from '../../__tests__/test-utils';

const pageWithHead = (head: string) =>
  mockPageContext('https://example.com/', `<html><head>${head}</head><body>Home</body></html>`);

describe('LlmsTxtExistsAudit', () => {
  const audit = new LlmsTxtExistsAudit();

  it('passes when llms.txt exists and starts with #', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('# My Site\n\n> Intro', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when llms.txt is missing (404)', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('llms.txt not found');
  });

  it('warns when llms.txt exists but lacks H1 heading', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('Welcome to my site\n\nNo heading here', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('missing markdown heading');
  });

  it('fails when fetch result is completely missing', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  describe('discovery <link> (absorbed from llms-txt-link, v1 4.11)', () => {
    // The well-known path is the spec's discovery mechanism and the head link
    // has no documented consumer, so its absence never costs a passing site.
    it('still passes when the file exists but no head link points at it', () => {
      const ctx = mockCheckContext([pageWithHead('')], {
        '/llms.txt': mockFetchResult('# My Site', 200),
      });
      const result = audit.audit(ctx);
      expect(result.status).toBe('pass');
      expect(result.found).toContain('no discovery <link>');
    });

    it('reports the discovery link when one points at llms.txt', () => {
      const ctx = mockCheckContext(
        [pageWithHead('<link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt">')],
        { '/llms.txt': mockFetchResult('# My Site', 200) },
      );
      const result = audit.audit(ctx);
      expect(result.status).toBe('pass');
      expect(result.found).toContain('discovery <link>');
      expect(result.found).not.toContain('no discovery <link>');
    });

    // Review finding (4.11): the title attribute is optional, so the minimal
    // correct markup failed the v1 audit at priority high.
    it('accepts a link with no title attribute', () => {
      const ctx = mockCheckContext(
        [pageWithHead('<link rel="alternate" type="text/plain" href="/llms.txt">')],
        { '/llms.txt': mockFetchResult('# My Site', 200) },
      );
      expect(audit.audit(ctx).found).toContain('discovery <link>');
    });

    // Review finding (4.11): llms.txt is Markdown; real sites emit
    // text/markdown, a charset parameter, or no type at all.
    it('accepts any content type on the link', () => {
      for (const type of ['text/markdown', 'text/plain; charset=utf-8', '']) {
        const ctx = mockCheckContext(
          [pageWithHead(`<link rel="alternate" type="${type}" href="/llms.txt">`)],
          { '/llms.txt': mockFetchResult('# My Site', 200) },
        );
        expect(audit.audit(ctx).found, `type="${type}"`).toContain('discovery <link>');
      }
    });

    // Review finding (4.11): rel === 'alternate' was an exact, case-sensitive
    // compare, and the v2 spec also defines rel="describedby" for llms.txt.
    it('accepts an uppercase or multi-token rel, and rel="describedby"', () => {
      for (const rel of ['Alternate', 'alternate stylesheet', 'describedby']) {
        const ctx = mockCheckContext([pageWithHead(`<link rel="${rel}" href="/llms.txt">`)], {
          '/llms.txt': mockFetchResult('# My Site', 200),
        });
        expect(audit.audit(ctx).found, `rel="${rel}"`).toContain('discovery <link>');
      }
    });

    // Review finding (4.11): title.includes('llms') matched "LLMs-full.txt", so
    // a site publishing only llms-full.txt passed the llms.txt link audit.
    it('does not accept an llms-full.txt link as the llms.txt link', () => {
      const ctx = mockCheckContext(
        [
          pageWithHead(
            '<link rel="alternate" type="text/plain" href="/llms-full.txt" title="LLMs-full.txt">',
          ),
        ],
        { '/llms.txt': mockFetchResult('# My Site', 200) },
      );
      expect(audit.audit(ctx).found).toContain('no discovery <link>');
    });

    it('reports a link that points at an llms.txt which is not there', () => {
      const ctx = mockCheckContext([pageWithHead('<link rel="alternate" href="/llms.txt">')], {
        '/llms.txt': mockFetchResult('', 404),
      });
      const result = audit.audit(ctx);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('links to llms.txt');
    });
  });
});
