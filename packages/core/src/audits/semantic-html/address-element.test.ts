import { describe, it, expect } from 'vitest';
import { AddressElementAudit } from './address-element';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('AddressElementAudit', () => {
  const audit = new AddressElementAudit();

  it('passes when a page uses <address> for contact info', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><address><a href="mailto:a@b.com">a@b.com</a></address></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1 page(s)');
  });

  it('warns when no <address> elements exist', () => {
    const page = mockPageContext('https://example.com', '<html><body><p>Email us</p></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No <address> elements found');
  });
});
