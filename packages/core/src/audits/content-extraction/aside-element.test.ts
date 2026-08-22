import { describe, it, expect } from 'vitest';
import { AsideElementAudit } from './aside-element';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

/** A content page (index > 0 so it is never typed as the homepage). */
function contentPage(body: string, slug = 'post') {
  return mockPageContext(`https://example.com/blog/${slug}`, `<html><body>${body}</body></html>`, 1);
}

describe('AsideElementAudit', () => {
  const audit = new AsideElementAudit();

  it('is notApplicable when no page carries supplementary content at all', () => {
    const page = contentPage('<main><h1>Title</h1><p>Body only.</p></main>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
  });

  it('passes when every supplementary block is wrapped in <aside>', () => {
    const page = contentPage(
      '<main><p>Body.</p></main><aside class="sidebar"><h3>Related</h3></aside>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('counts role="complementary" as marked supplementary content', () => {
    const page = contentPage('<main><p>Body.</p></main><div role="complementary">Related</div>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('fails when a div-based sidebar exists and nothing is marked', () => {
    const page = contentPage(
      '<main><p>Body.</p></main><div class="sidebar"><h3>Related posts</h3></div>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('sidebar');
  });

  it('warns when some supplementary blocks are marked and others are not', () => {
    const marked = contentPage('<main><p>A.</p></main><aside>Related</aside>', 'a');
    const unmarked = mockPageContext(
      'https://example.com/blog/b',
      '<html><body><main><p>B.</p></main><div class="promo-box">Buy now</div></body></html>',
      2,
    );
    const result = audit.audit(mockCheckContext([marked, unmarked]));
    expect(result.status).toBe('warn');
  });

  it('does not count a div-based sidebar that lives inside an <aside>', () => {
    const page = contentPage(
      '<main><p>Body.</p></main><aside><div class="related-links">More</div></aside>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('evaluates only content pages, not the homepage', () => {
    const home = mockPageContext(
      'https://example.com/',
      '<html><body><div class="sidebar">Promo</div></body></html>',
      0,
    );
    const page = contentPage('<main><p>Body.</p></main>');
    const result = audit.audit(mockCheckContext([home, page]));
    expect(result.status).toBe('na');
  });

  it('states the extraction consequence of <aside> in its guidance', () => {
    const guidance = AsideElementAudit.meta.guidance;
    expect(guidance?.impact).toMatch(/Readability/);
    expect(guidance?.impact).toMatch(/trafilatura/);
    expect(guidance?.fix).toMatch(/never|do not/i);
  });
});
