import { describe, it, expect } from 'vitest';
import { DefinitionElementsAudit } from './definition-elements';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('DefinitionElementsAudit', () => {
  const audit = new DefinitionElementsAudit();

  it('passes when a page uses a <dl> definition list', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><dl><dt>Term</dt><dd>Definition</dd></dl></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1 page(s)');
  });

  it('passes when a page uses an inline <dfn>', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><p>A <dfn>widget</dfn> is a thing.</p></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('warns when no definition elements exist', () => {
    const page = mockPageContext('https://example.com', '<html><body><p>No definitions</p></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No <dfn> or <dl> elements found');
  });
});
