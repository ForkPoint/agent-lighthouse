import { describe, it, expect } from 'vitest';
import { NavigationJsonAudit } from './navigation-json';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('NavigationJsonAudit', () => {
  const audit = new NavigationJsonAudit();

  it('passes when navigation.json exists with valid JSON', () => {
    const body = JSON.stringify({ name: 'Site', items: [{ label: 'Home', url: '/' }] });
    const ctx = mockCheckContext([], {
      '/navigation.json': mockFetchResult(body, 200, 'application/json'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('valid JSON');
  });

  it('fails when navigation.json contains invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/navigation.json': mockFetchResult('{ not json', 200, 'application/json'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('invalid JSON');
  });

  it('fails when navigation.json is missing', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No navigation.json found');
  });

  it('reports HTTP status when navigation.json exists but returns non-200 (covers result ? branch)', () => {
    // result is truthy (500 response) → ternary takes `HTTP ${status}` branch
    const ctx = mockCheckContext([], {
      '/navigation.json': mockFetchResult('Server Error', 500, 'text/plain'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('HTTP 500');
  });
});
