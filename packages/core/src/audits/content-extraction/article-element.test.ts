import { describe, it, expect } from 'vitest';
import { ArticleElementAudit } from './article-element';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

describe('ArticleElementAudit', () => {
  const audit = new ArticleElementAudit();

  it('passes when all pages use <article>', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><article><h2>Post</h2><p>Body</p></article></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1/1');
  });

  it('warns when the homepage uses <article> but a secondary page does not', () => {
    const home = mockPageContext('https://example.com', '<html><body><article>Post</article></body></html>');
    const other = mockPageContext('https://example.com/x', '<html><body><div>No article</div></body></html>');
    const result = audit.audit(mockCheckContext([home, other]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('1/2');
  });

  it('fails when no page uses <article>', () => {
    const page = mockPageContext('https://example.com', '<html><body><div>No article</div></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('0/1');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new ArticleElementAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
});
