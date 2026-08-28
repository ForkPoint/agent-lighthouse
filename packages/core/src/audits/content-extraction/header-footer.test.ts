import { describe, it, expect } from 'vitest';
import { HeaderFooterAudit } from './header-footer';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

describe('HeaderFooterAudit', () => {
  const audit = new HeaderFooterAudit();

  it('passes when all pages have both <header> and <footer>', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><header>Nav</header><main>x</main><footer>Legal</footer></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1/1');
  });

  it('warns when the homepage has both but another page is missing one', () => {
    const home = mockPageContext(
      'https://example.com',
      '<html><body><header>H</header><footer>F</footer></body></html>',
    );
    const other = mockPageContext('https://example.com/x', '<html><body><header>H only</header></body></html>');
    const result = audit.audit(mockCheckContext([home, other]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('footer on 1/2');
  });

  it('fails when the homepage lacks both landmarks', () => {
    const page = mockPageContext('https://example.com', '<html><body><div>Nothing</div></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Header found on 0/1');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new HeaderFooterAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
});
