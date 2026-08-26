import { describe, it, expect } from 'vitest';
import { ServerRenderedAudit } from './server-rendered';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';
import { AuditResultSchema } from '../../schemas';

describe('ServerRenderedAudit', () => {
  const audit = new ServerRenderedAudit();

  it('passes when the homepage has substantial text content', () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
    const page = mockPageContext('https://example.com', `<html><body><main>${words}</main></body></html>`);
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('meaningful server-rendered content');
  });

  it('fails when the homepage has minimal content', () => {
    const page = mockPageContext('https://example.com', '<html><body><main>Hi</main></body></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('minimal server-rendered content');
  });

  it('warns when no homepage is available', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No homepage data');
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
    expect(result.found).toContain('194 words');
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
    expect(result.found).toContain('121 words');
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

    expect(result.status).toBe('pass');
    expect(result.found).toContain('6 words');
    expect(result.found).toContain('401 characters');
  });
});
