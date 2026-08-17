import { describe, it, expect } from 'vitest';
import { HeaderFooterAudit } from './header-footer';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

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
});
