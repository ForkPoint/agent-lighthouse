import { vi } from 'vitest';
import { SCANNER_USER_AGENT, MAX_RESPONSE_BODY_BYTES } from './constants';

vi.mock('undici', () => {
  class Agent {
    compose() {
      return this;
    }
  }
  return {
    request: vi.fn(),
    Agent,
    interceptors: {
      redirect: vi.fn(() => ({})),
    },
  };
});

vi.mock('node:dns/promises', () => ({
  default: { lookup: vi.fn() },
}));

import { request } from 'undici';
import dns from 'node:dns/promises';
import { createFetcher, isSafeUrl, splitCredentials } from './fetcher';

const mockRequest = vi.mocked(request);
const mockLookup = vi.mocked(dns.lookup);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponse(statusCode: number, body: string, headers: Record<string, string> = {}) {
  return {
    statusCode,
    headers,
    body: {
      text: vi.fn().mockResolvedValue(body),
      dump: vi.fn().mockResolvedValue(undefined),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createFetcher
// ---------------------------------------------------------------------------

describe('createFetcher', () => {
  it('returns an object with a fetch method', () => {
    const fetcher = createFetcher();
    expect(fetcher).toHaveProperty('fetch');
    expect(typeof fetcher.fetch).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — successful responses
// ---------------------------------------------------------------------------

describe('fetcher.fetch', () => {
  it('returns a FetchResult for a successful 200 response', async () => {
    mockRequest.mockResolvedValue(
      mockResponse(200, '<html>Hello</html>', {
        'content-type': 'text/html',
      }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://example.com' });

    expect(result.status).toBe(200);
    expect(result.body).toBe('<html>Hello</html>');
    expect(result.url).toBe('https://example.com');
    expect(result.finalUrl).toBe('https://example.com');
    expect(result.contentType).toBe('text/html');
    expect(result.contentLength).toBe('<html>Hello</html>'.length);
    expect(result.error).toBeUndefined();
    expect(result.ttfbMs).toBeGreaterThanOrEqual(0);
    expect(result.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('returns a FetchResult for a 404 response', async () => {
    mockRequest.mockResolvedValue(mockResponse(404, 'Not Found') as any);

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://example.com/missing' });

    expect(result.status).toBe(404);
    expect(result.body).toBe('Not Found');
    expect(result.error).toBeUndefined();
  });

  it('lowercases response header keys', async () => {
    mockRequest.mockResolvedValue(
      mockResponse(200, '', {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
      }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://example.com' });

    expect(result.headers['content-type']).toBe('application/json');
    expect(result.headers['x-custom-header']).toBe('custom-value');
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — error handling
// ---------------------------------------------------------------------------

describe('fetcher.fetch — error handling', () => {
  it('handles network errors gracefully with status 0 and error field', async () => {
    mockRequest.mockRejectedValue(new Error('ECONNREFUSED'));

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://unreachable.test' });

    expect(result.status).toBe(0);
    expect(result.body).toBe('');
    expect(result.error).toBe('ECONNREFUSED');
    expect(result.url).toBe('https://unreachable.test');
    expect(result.headers).toEqual({});
    expect(result.contentLength).toBe(0);
  });

  it('handles timeout errors (AbortSignal.timeout triggers)', async () => {
    mockRequest.mockRejectedValue(new Error('The operation was aborted'));

    const fetcher = createFetcher();
    const result = await fetcher.fetch({
      url: 'https://slow.test',
      timeout: 100,
    });

    expect(result.status).toBe(0);
    expect(result.error).toBe('The operation was aborted');
  });

  it('handles non-Error thrown values', async () => {
    mockRequest.mockRejectedValue('string error');

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://example.com' });

    expect(result.status).toBe(0);
    expect(result.error).toBe('Unknown fetch error');
  });
});

// ---------------------------------------------------------------------------
// splitCredentials + basic-auth handling
// ---------------------------------------------------------------------------

describe('splitCredentials', () => {
  it('returns the URL unchanged when there are no credentials', () => {
    expect(splitCredentials('https://example.com/path')).toEqual({ url: 'https://example.com/path' });
  });

  it('does not treat an @ in the path as credentials', () => {
    expect(splitCredentials('https://example.com/@handle')).toEqual({
      url: 'https://example.com/@handle',
    });
  });

  it('extracts basic-auth creds into an Authorization header and strips them from the URL', () => {
    const { url, authHeader } = splitCredentials('https://user:pass@example.com/x');
    expect(url).toBe('https://example.com/x');
    expect(authHeader).toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`);
  });

  it('decodes percent-encoded userinfo before base64-encoding the header', () => {
    const { authHeader } = splitCredentials('https://user:p%40ss@example.com/');
    expect(authHeader).toBe(`Basic ${Buffer.from('user:p@ss').toString('base64')}`);
  });

  it('handles username-only credentials', () => {
    const { url, authHeader } = splitCredentials('https://token@example.com/');
    expect(url).toBe('https://example.com/');
    expect(authHeader).toBe(`Basic ${Buffer.from('token:').toString('base64')}`);
  });
});

describe('fetcher.fetch — basic auth from URL', () => {
  it('sends Authorization from URL userinfo and requests the credential-free URL', async () => {
    mockRequest.mockResolvedValue(mockResponse(200, 'ok') as any);

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://user:pass@example.com/secure' });

    expect(mockRequest).toHaveBeenCalledWith(
      'https://example.com/secure',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('user:pass').toString('base64')}`,
        }),
      }),
    );
    // Credentials must never leak into the returned result.
    expect(result.url).toBe('https://example.com/secure');
    expect(result.finalUrl).toBe('https://example.com/secure');
  });

  it('does not set Authorization when the URL has no credentials', async () => {
    mockRequest.mockResolvedValue(mockResponse(200, '') as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: 'https://example.com' });

    const headers = mockRequest.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
    // Fast path: exact URL is passed through unchanged (no trailing-slash rewrite).
    expect(mockRequest).toHaveBeenCalledWith('https://example.com', expect.anything());
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — error cause enrichment
// ---------------------------------------------------------------------------

describe('fetcher.fetch — error cause enrichment', () => {
  it("appends undici's cause code to the error detail", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }),
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://nope.test' });

    expect(result.error).toBe('fetch failed (ENOTFOUND)');
  });

  it('uses a top-level error code when there is no cause', async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error('connect'), { code: 'UND_ERR_CONNECT_TIMEOUT' }),
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://slow.test' });

    expect(result.error).toBe('connect (UND_ERR_CONNECT_TIMEOUT)');
  });

  it('falls back to the bare message when neither code nor cause is present', async () => {
    mockRequest.mockRejectedValue(new Error('ECONNREFUSED'));

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://unreachable.test' });

    expect(result.error).toBe('ECONNREFUSED');
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — HTTP methods
// ---------------------------------------------------------------------------

describe('fetcher.fetch — HTTP methods', () => {
  it('defaults method to GET', async () => {
    mockRequest.mockResolvedValue(mockResponse(200, '') as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: 'https://example.com' });

    expect(mockRequest).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('passes POST method through', async () => {
    mockRequest.mockResolvedValue(mockResponse(200, '{}') as any);

    const fetcher = createFetcher();
    await fetcher.fetch({
      url: 'https://example.com/api',
      method: 'POST',
      body: '{"key":"value"}',
      contentType: 'application/json',
    });

    expect(mockRequest).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        body: '{"key":"value"}',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('does not read body for OPTIONS requests (dumps instead)', async () => {
    const resp = mockResponse(204, '');
    mockRequest.mockResolvedValue(resp as any);

    const fetcher = createFetcher();
    const result = await fetcher.fetch({
      url: 'https://example.com',
      method: 'OPTIONS',
    });

    expect(resp.body.dump).toHaveBeenCalled();
    expect(resp.body.text).not.toHaveBeenCalled();
    expect(result.body).toBe('');
  });

  it('reads body for GET requests', async () => {
    const resp = mockResponse(200, 'response body');
    mockRequest.mockResolvedValue(resp as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: 'https://example.com' });

    expect(resp.body.text).toHaveBeenCalled();
    expect(resp.body.dump).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — headers
// ---------------------------------------------------------------------------

describe('fetcher.fetch — request headers', () => {
  it('sets the custom User-Agent header', async () => {
    mockRequest.mockResolvedValue(mockResponse(200, '') as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: 'https://example.com' });

    expect(mockRequest).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': SCANNER_USER_AGENT,
        }),
      }),
    );
  });

  it('sets Accept header from acceptHeader option', async () => {
    mockRequest.mockResolvedValue(mockResponse(200, '') as any);

    const fetcher = createFetcher();
    await fetcher.fetch({
      url: 'https://example.com',
      acceptHeader: 'application/json',
    });

    expect(mockRequest).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      }),
    );
  });

  it('defaults Accept header to */*', async () => {
    mockRequest.mockResolvedValue(mockResponse(200, '') as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: 'https://example.com' });

    expect(mockRequest).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: '*/*',
        }),
      }),
    );
  });

  it('does not set Content-Type for GET requests', async () => {
    mockRequest.mockResolvedValue(mockResponse(200, '') as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: 'https://example.com' });

    const callHeaders = mockRequest.mock.calls[0][1]?.headers as Record<string, string>;
    expect(callHeaders['Content-Type']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — request configuration
// ---------------------------------------------------------------------------

describe('fetcher.fetch — request configuration', () => {
  it('passes an AbortSignal for timeout', async () => {
    mockRequest.mockResolvedValue(mockResponse(200, '') as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: 'https://example.com', timeout: 5000 });

    const callOptions = mockRequest.mock.calls[0][1] as any;
    expect(callOptions.signal).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — body handling & header filtering
// ---------------------------------------------------------------------------

describe('fetcher.fetch — body and headers edge cases', () => {
  it('does not set Content-Type for POST without an explicit contentType', async () => {
    mockRequest.mockResolvedValue(mockResponse(200, 'ok') as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: 'https://example.com/api', method: 'POST', body: 'raw' });

    const callHeaders = mockRequest.mock.calls[0][1]?.headers as Record<string, string>;
    expect(callHeaders['Content-Type']).toBeUndefined();
  });

  it('truncates response bodies larger than MAX_RESPONSE_BODY_BYTES', async () => {
    const huge = 'a'.repeat(MAX_RESPONSE_BODY_BYTES + 100);
    mockRequest.mockResolvedValue(mockResponse(200, huge, { 'content-type': 'text/html' }) as any);

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://example.com/big' });

    expect(result.body.length).toBe(MAX_RESPONSE_BODY_BYTES);
    expect(result.contentLength).toBe(MAX_RESPONSE_BODY_BYTES);
  });

  // RFC 9110 §5.3: repeated field lines are one field value. Set-Cookie is the
  // standing exception, because its own values may contain commas.
  it('keeps repeated Set-Cookie lines on separate lines', async () => {
    mockRequest.mockResolvedValue(
      mockResponse(200, '', {
        'content-type': 'text/html',
        'set-cookie': ['a=1', 'b=2'] as unknown as string,
      }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://example.com' });

    expect(result.headers['content-type']).toBe('text/html');
    expect(result.headers['set-cookie']).toBe('a=1\nb=2');
  });

  it('joins repeated header lines with ", " so none is lost', async () => {
    mockRequest.mockResolvedValue(
      mockResponse(200, '', {
        'x-robots-tag': ['googlebot: max-snippet:0', 'noarchive'] as unknown as string,
        'x-content-type-options': ['nosniff', 'nosniff'] as unknown as string,
      }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://example.com' });

    expect(result.headers['x-robots-tag']).toBe('googlebot: max-snippet:0, noarchive');
    expect(result.headers['x-content-type-options']).toBe('nosniff, nosniff');
  });

  it('uses a non-following dispatcher when followRedirects is false', async () => {
    mockRequest.mockResolvedValue(mockResponse(301, '', { location: '/next' }) as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: 'https://example.com/a' });
    await fetcher.fetch({ url: 'https://example.com/a', followRedirects: false });

    const following = mockRequest.mock.calls[0][1]?.dispatcher;
    const notFollowing = mockRequest.mock.calls[1][1]?.dispatcher;
    expect(following).toBeDefined();
    expect(notFollowing).toBeDefined();
    expect(notFollowing).not.toBe(following);
  });

  it('ignores header values that are neither a string nor an array', async () => {
    mockRequest.mockResolvedValue(
      mockResponse(200, '', { 'x-weird': undefined as unknown as string }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://example.com' });

    expect(result.headers['x-weird']).toBeUndefined();
  });

  it('defaults contentType to empty string when no content-type header present', async () => {
    mockRequest.mockResolvedValue(mockResponse(200, 'body', {}) as any);

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://example.com' });

    expect(result.contentType).toBe('');
  });

  it('reports the error and ttfb when the body read fails after a response', async () => {
    mockRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: {
        text: vi.fn().mockRejectedValue(new Error('body read failed')),
        dump: vi.fn().mockResolvedValue(undefined),
      },
    } as any);

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: 'https://example.com' });

    expect(result.status).toBe(0);
    expect(result.error).toBe('body read failed');
    expect(result.ttfbMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// isSafeUrl
// ---------------------------------------------------------------------------

describe('isSafeUrl', () => {
  it('rejects malformed URLs', async () => {
    expect(await isSafeUrl('not a url')).toBe(false);
  });

  it('rejects non-http(s) protocols', async () => {
    expect(await isSafeUrl('ftp://example.com/file')).toBe(false);
  });

  it('rejects localhost and loopback hostnames', async () => {
    expect(await isSafeUrl('http://localhost/')).toBe(false);
    expect(await isSafeUrl('http://127.0.0.1/')).toBe(false);
    expect(await isSafeUrl('http://[::1]/')).toBe(false);
  });

  it('rejects private IP literals without a DNS lookup', async () => {
    expect(await isSafeUrl('http://10.0.0.5/')).toBe(false);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('rejects hostnames that resolve to a private address', async () => {
    mockLookup.mockResolvedValue({ address: '10.1.2.3', family: 4 } as any);
    expect(await isSafeUrl('https://internal.example.com/')).toBe(false);
  });

  it('accepts hostnames that resolve to a public address', async () => {
    mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 } as any);
    expect(await isSafeUrl('https://example.com/')).toBe(true);
  });

  it('returns false when DNS lookup throws', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
    expect(await isSafeUrl('https://nonexistent.example/')).toBe(false);
  });
});
