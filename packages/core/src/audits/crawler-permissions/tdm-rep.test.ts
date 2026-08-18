import { describe, it, expect } from 'vitest';
import { TdmRepAudit } from './tdm-rep';
import { mockPageContext, mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('TdmRepAudit', () => {
  const audit = new TdmRepAudit();

  it('passes when a page declares tdm-reservation meta tag', async () => {
    const html = `<html><head>
      <meta name="tdm-reservation" content="1" />
      <meta name="tdm-policy" content="https://example.com/tdm-policy" />
    </head><body></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.score).toBe(1.0);
    expect(result.message).toContain('tdm-reservation="1"');
    expect(result.message).toContain('tdm-policy');
    expect(result.pageUrl).toBe('https://example.com/');
  });

  it('passes when tdm-reservation is 0 (mining explicitly permitted)', async () => {
    const html = '<html><head><meta name="tdm-reservation" content="0" /></head><body></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('permitted');
  });

  it('passes when /.well-known/tdmrep.json is in rootFiles with valid JSON', async () => {
    const html = '<html><head></head><body></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)], {
      '/.well-known/tdmrep.json': mockFetchResult(
        JSON.stringify({ 'tdm-reservation': 1, 'tdm-policy': 'https://example.com/tdm-policy' }),
        200,
        'application/json',
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/.well-known/tdmrep.json');
    expect(result.message).toContain('tdm-reservation=1');
  });

  it('passes when tdmrep.json is fetched via ctx.fetch (not prefetched)', async () => {
    const html = '<html><head></head><body></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    ctx.fetch = async ({ url }) =>
      url === 'https://example.com/.well-known/tdmrep.json'
        ? mockFetchResult(JSON.stringify({ 'tdm-reservation': 0 }), 200, 'application/json')
        : mockFetchResult('', 404);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('permitted');
  });

  it('warns when tdmrep.json returns 200 but is not valid JSON', async () => {
    const html = '<html><head></head><body></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)], {
      '/.well-known/tdmrep.json': mockFetchResult('not json', 200, 'application/json'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.score).toBe(0.5);
    expect(result.message).toContain('not valid JSON');
  });

  it('warns when no TDM declaration exists anywhere', async () => {
    const html = '<html><head><title>Plain page</title></head><body></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)], {
      '/.well-known/tdmrep.json': mockFetchResult('', 404),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.score).toBe(0.5);
    expect(result.message).toContain('No TDM-Rep declaration');
    expect(result.message).toContain('HTTP 404');
  });

  it('warns gracefully when the tdmrep.json fetch throws a network error', async () => {
    const html = '<html><head></head><body></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    ctx.fetch = async () => {
      throw new Error('fetch failed (ENOTFOUND)');
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toBe('No TDM-Rep declaration found');
  });

  it('never returns fail for any absence state', async () => {
    const ctx = mockCheckContext([]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.status).not.toBe('fail');
  });
});
