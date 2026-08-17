import { describe, it, expect } from 'vitest';
import { SecurityTxtAudit } from './security-txt';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('SecurityTxtAudit', () => {
  const audit = new SecurityTxtAudit();

  it('passes when security.txt returns 200', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/security.txt': mockFetchResult('Contact: mailto:s@e.com', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('present');
  });

  it('fails when security.txt is 404', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/security.txt': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('Status 404');
  });

  it('fails when security.txt is not fetched', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('File not fetched');
  });
});
