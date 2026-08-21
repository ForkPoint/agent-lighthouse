import { describe, it, expect } from 'vitest';
import { SemanticListsAudit } from './semantic-lists';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('SemanticListsAudit', () => {
  const audit = new SemanticListsAudit();

  it('passes when all pages use semantic lists', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><ul><li>One</li><li>Two</li></ul></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1/1');
  });

  it('warns when a majority but not all pages use semantic lists', () => {
    const a = mockPageContext('https://example.com', '<html><body><ol><li>x</li></ol></body></html>');
    const b = mockPageContext('https://example.com/b', '<html><body><dl><dt>t</dt><dd>d</dd></dl></body></html>');
    const c = mockPageContext('https://example.com/c', '<html><body><div>no list</div></body></html>');
    const result = audit.audit(mockCheckContext([a, b, c]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('2/3');
  });

  it('fails when no page uses semantic lists', () => {
    const page = mockPageContext('https://example.com', '<html><body><div>Item one</div></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('0/1');
  });
});
