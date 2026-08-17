import { describe, it, expect } from 'vitest';
import { AsideElementAudit } from './aside-element';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('AsideElementAudit', () => {
  const audit = new AsideElementAudit();

  it('passes when at least one page uses <aside>', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><aside><h3>Related</h3></aside></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1 page(s) with <aside>');
  });

  it('warns when no page uses <aside>', () => {
    const page = mockPageContext('https://example.com', '<html><body><div>No aside</div></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No <aside> elements found');
  });
});
