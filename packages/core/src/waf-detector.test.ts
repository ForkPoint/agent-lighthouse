import { describe, it, expect } from 'vitest';
import { detectWafProtection } from './waf-detector';
import type { FetchResult } from './fetcher';

function mockResult(status: number, headers: Record<string, string> = {}, body = '', error?: string): FetchResult {
  return {
    url: 'https://example.com',
    finalUrl: 'https://example.com',
    status,
    headers,
    body,
    ttfbMs: 20,
    totalMs: 50,
    contentType: 'text/html',
    contentLength: body.length,
    error,
  };
}

describe('detectWafProtection', () => {
  it('detects Cloudflare managed challenge via header', () => {
    const res = mockResult(403, { 'cf-mitigated': 'challenge', server: 'cloudflare' }, 'Just a moment...');
    const result = detectWafProtection('https://example.com', res, {}, 0);
    expect(result).not.toBeNull();
    expect(result?.provider).toBe('cloudflare');
    expect(result?.name).toContain('Cloudflare');
  });

  it('detects DataDome anti-bot via header and script', () => {
    const res = mockResult(200, { 'x-datadome': 'protected' }, '<html><script src="https://datadome.co/tags.js"></script></html>');
    const result = detectWafProtection('https://example.com', res, {}, 1);
    expect(result).not.toBeNull();
    expect(result?.provider).toBe('datadome');
  });

  it('detects PerimeterX via body markers', () => {
    const res = mockResult(403, {}, '<html><body>Please Press & Hold to verify</body></html>');
    const result = detectWafProtection('https://example.com', res, {}, 0);
    expect(result).not.toBeNull();
    expect(result?.provider).toBe('perimeterx');
  });

  it('detects Akamai Bot Manager via server header and 403', () => {
    const res = mockResult(403, { server: 'AkamaiGHost' }, 'Access Denied');
    const result = detectWafProtection('https://example.com', res, {}, 0);
    expect(result).not.toBeNull();
    expect(result?.provider).toBe('akamai');
  });

  it('detects aggressive connection drops on 0 pages scanned', () => {
    const res = mockResult(0, {}, '', 'The operation was aborted due to timeout');
    const result = detectWafProtection('https://example.com', res, {}, 0);
    expect(result).not.toBeNull();
    expect(result?.provider).toBe('connection-drop');
  });

  it('returns null for normal accessible websites', () => {
    const res = mockResult(200, { server: 'nginx' }, '<html><body><h1>Welcome to our store</h1></body></html>');
    const result = detectWafProtection('https://example.com', res, {}, 5);
    expect(result).toBeNull();
  });
});
