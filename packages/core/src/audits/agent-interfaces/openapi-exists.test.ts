import { describe, it, expect, vi } from 'vitest';
import { OpenApiExistsAudit } from './openapi-exists';
import { mockCheckContext, mockPageContext, mockFetchResult } from '../../__tests__/test-utils';

// isSafeUrl performs a real DNS lookup before the audit follows an advertised
// <link>. Stub it with an offline stand-in that still blocks loopback and
// private ranges, so the refusal test below proves the gate rather than the mock.
vi.mock('../../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../fetcher')>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== 'http:' && protocol !== 'https:') return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

const SPEC = JSON.stringify({ openapi: '3.0.3', info: { title: 'API' }, paths: { '/x': {} } });
const YAML_SPEC = 'openapi: 3.0.3\ninfo:\n  title: API\npaths:\n  /x: {}\n';

const CATALOG = JSON.stringify({
  linkset: [
    {
      anchor: 'https://example.com/api',
      'service-desc': [{ href: 'https://example.com/openapi.json' }],
    },
  ],
});

const page = (head: string) =>
  mockPageContext('https://example.com/', `<html><head>${head}</head><body></body></html>`);

describe('OpenApiExistsAudit', () => {
  const audit = new OpenApiExistsAudit();

  // ── RFC 9727 /.well-known/api-catalog — the absorbed grade-B path ──

  it('passes on an RFC 9727 linkset at /.well-known/api-catalog', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/api-catalog': mockFetchResult(
        CATALOG,
        200,
        'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('api-catalog');
  });

  it('prefers the api-catalog over a root spec when both are present', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/api-catalog': mockFetchResult(CATALOG, 200, 'application/linkset+json'),
      '/openapi.json': mockFetchResult(SPEC, 200, 'application/json'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('api-catalog');
  });

  it('rejects an HTML 200 at /.well-known/api-catalog and falls through', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/api-catalog': mockFetchResult(
        '<html><body>Page not found</body></html>',
        200,
        'text/html',
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('rejects a JSON 200 at /.well-known/api-catalog that carries no linkset', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/api-catalog': mockFetchResult(
        JSON.stringify({ hello: 1 }),
        200,
        'application/json',
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).not.toBe('pass');
  });

  // ── root OpenAPI document ───────────────────────────────────

  it('passes with a valid JSON spec at /openapi.json', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult(SPEC, 200, 'application/json'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/openapi.json');
  });

  it('passes with a Swagger 2.0 document', async () => {
    const swagger = JSON.stringify({ swagger: '2.0', info: {}, paths: { '/x': {} } });
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult(swagger, 200, 'application/json'),
    });
    expect((await audit.audit(ctx)).status).toBe('pass');
  });

  it('warns when /openapi.json serves a JSON object that is not an OpenAPI document', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult(JSON.stringify({ hello: 1 }), 200, 'application/json'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('not a valid OpenAPI');
  });

  it('passes with a YAML spec at /openapi.yaml', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.yaml': mockFetchResult(YAML_SPEC, 200, 'application/yaml'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/openapi.yaml');
  });

  it('rejects an HTML soft-404 at /openapi.yaml that merely contains "openapi:"', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.yaml': mockFetchResult(
        '<html><body><code>openapi: 3.0.3</code> is what we would serve</body></html>',
        200,
        'text/html',
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('rejects a YAML body with no paths key', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.yaml': mockFetchResult('foo: bar\n', 200, 'application/yaml'),
    });
    expect((await audit.audit(ctx)).status).toBe('na');
  });

  // ── absorbed openapi-link (4.18): the head link is a hint, not a gate ──

  it('follows a <link rel="service-desc"> to a spec that is not at a probed root path', async () => {
    const ctx = mockCheckContext([
      page('<link rel="service-desc" type="application/json" href="/api/v2/openapi.json">'),
    ]);
    ctx.fetch = async () => mockFetchResult(SPEC, 200, 'application/json');
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/api/v2/openapi.json');
  });

  it('accepts a title-less alternate link matched on href', async () => {
    const ctx = mockCheckContext([
      page('<link rel="alternate" type="application/json" href="/openapi.json">'),
    ]);
    ctx.fetch = async () => mockFetchResult(SPEC, 200, 'application/json');
    expect((await audit.audit(ctx)).status).toBe('pass');
  });

  it('accepts a YAML link and a charset-parameterised MIME type', async () => {
    const ctx = mockCheckContext([
      page(
        '<link rel="alternate" type="application/yaml; charset=utf-8" href="/spec/openapi.yaml">',
      ),
    ]);
    ctx.fetch = async () => mockFetchResult(YAML_SPEC, 200, 'application/yaml');
    expect((await audit.audit(ctx)).status).toBe('pass');
  });

  it('accepts an alternate link typed application/vnd.oai.openapi whatever the href', async () => {
    const ctx = mockCheckContext([
      page('<link rel="alternate" type="application/vnd.oai.openapi+json" href="/spec/api">'),
    ]);
    ctx.fetch = async () => mockFetchResult(SPEC, 200, 'application/json');
    expect((await audit.audit(ctx)).status).toBe('pass');
  });

  it('finds the link on a developer page rather than only the homepage', async () => {
    const ctx = mockCheckContext([
      page(''),
      mockPageContext(
        'https://example.com/developers',
        '<html><head><link rel="service-desc" href="/openapi.json"></head><body></body></html>',
        1,
      ),
    ]);
    ctx.fetch = async () => mockFetchResult(SPEC, 200, 'application/json');
    expect((await audit.audit(ctx)).status).toBe('pass');
  });

  it('warns when an advertised spec URL does not resolve to a spec', async () => {
    const ctx = mockCheckContext([
      page('<link rel="service-desc" type="application/json" href="/api/openapi.json">'),
    ]);
    ctx.fetch = async () => mockFetchResult('<html><body>404</body></html>', 404, 'text/html');
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('advertised');
  });

  it('refuses to follow a link pointing at a private address, without fetching it', async () => {
    const ctx = mockCheckContext([
      page('<link rel="service-desc" type="application/json" href="http://127.0.0.1:8080/openapi.json">'),
    ]);
    let called = false;
    ctx.fetch = async () => {
      called = true;
      return mockFetchResult(SPEC, 200, 'application/json');
    };
    const result = await audit.audit(ctx);
    expect(called).toBe(false);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('not safe to probe');
  });

  it('ignores an unrelated alternate link (RSS)', async () => {
    const ctx = mockCheckContext([
      page('<link rel="alternate" type="application/rss+xml" href="/feed.xml">'),
    ]);
    expect((await audit.audit(ctx)).status).toBe('na');
  });

  // ── applicability and verifiability ─────────────────────────

  it('is not applicable to a site with no API surface at all', async () => {
    const ctx = mockCheckContext([page('')], {});
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('No API surface');
  });

  it('warns rather than failing when a WAF blocked the scan', async () => {
    const ctx = mockCheckContext([page('')], {});
    ctx.wafProtection = { isBlocked: true, name: 'Cloudflare', reason: 'challenge' };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Cloudflare');
  });

  it('warns when /openapi.json is served but unparseable', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('not json {{{', 200, 'application/json'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
  });
});
