import { describe, it, expect } from 'vitest';
import { SecurityHeaderHygieneAudit } from './security-header-hygiene';
import { weightForGrade } from '../../scorer';
import { mockCheckContext, mockPageContext, mockFetchResult } from '../../__tests__/test-utils';
import type { CheckContext, PageContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';

/** A homepage with the given response headers (lower-cased keys, as the fetcher stores them). */
function pageWith(headers: Record<string, string>, html = '<html></html>'): PageContext {
  const page = mockPageContext('https://example.com', html);
  Object.assign(page.fetchResult.headers, headers);
  return page;
}

/** A context whose homepage carries `headers` and whose root files carry `rootFiles`. */
function ctxWith(
  headers: Record<string, string>,
  rootFiles: Record<string, FetchResult> = {},
  html = '<html></html>',
): CheckContext {
  return mockCheckContext([pageWith(headers, html)], rootFiles);
}

/** A well-formed security.txt whose Expires is far in the future. */
const VALID_SECURITY_TXT = 'Contact: mailto:security@example.com\nExpires: 2099-12-31T23:59:59.000Z\n';

/** Every signal healthy — the baseline the per-signal tests perturb one at a time. */
const HEALTHY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
  'content-security-policy': "default-src 'self'",
  'x-content-type-options': 'nosniff',
};
const HEALTHY_ROOT_FILES = {
  '/.well-known/security.txt': mockFetchResult(VALID_SECURITY_TXT, 200),
};

const audit = new SecurityHeaderHygieneAudit();

describe('SecurityHeaderHygieneAudit — meta', () => {
  const { meta } = SecurityHeaderHygieneAudit;

  it('is the consolidated id in the operability-safety category', () => {
    expect(meta.id).toBe('operability-safety/security-header-hygiene');
    expect(meta.category).toBe('operability-safety');
  });

  it('is informative at weight 0 — it can never move a score', () => {
    expect(meta.tier).toBe('informative');
    expect(meta.scoreDisplayMode).toBe('informative');
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.weight).toBe(weightForGrade('B', 'informative'));
    expect(meta.weight).toBe(0);
  });

  it('points at the merged dossier', () => {
    expect(meta.dossier).toBe(
      'docs/evidence/audits/operability-safety/security-header-hygiene.md',
    );
  });
});

describe('SecurityHeaderHygieneAudit — never fails a site', () => {
  it('reports the all-missing case as a warning, not a failure', () => {
    const result = audit.audit(ctxWith({}));
    expect(result.status).toBe('warn');
  });

  it('is not applicable when no page response was captured', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('na');
    expect(result.message).toContain('No page response');
  });
});

describe('SecurityHeaderHygieneAudit — all four signals', () => {
  it('passes when every signal is healthy', () => {
    const result = audit.audit(ctxWith(HEALTHY_HEADERS, HEALTHY_ROOT_FILES));
    expect(result.status).toBe('pass');
    expect(result.score).toBe(1);
  });

  it('lists a row for every signal whatever the outcome', () => {
    const found = audit.audit(ctxWith({})).found ?? '';
    for (const label of [
      'Strict-Transport-Security',
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'security.txt',
    ]) {
      expect(found).toContain(label);
    }
  });
});

describe('SecurityHeaderHygieneAudit — HSTS (v1 8.2)', () => {
  const hsts = (value: string) =>
    audit.audit(ctxWith({ ...HEALTHY_HEADERS, 'strict-transport-security': value }, HEALTHY_ROOT_FILES));

  it('accepts a max-age of at least one year', () => {
    expect(hsts('max-age=31536000; includeSubDomains').status).toBe('pass');
  });

  it('does not accept max-age=0 — that value disables HSTS', () => {
    const result = hsts('max-age=0');
    expect(result.status).toBe('warn');
    expect(result.found).toContain('max-age=0');
  });

  it('does not accept a max-age far below one year', () => {
    const result = hsts('max-age=300');
    expect(result.status).toBe('warn');
    expect(result.found).toContain('300');
  });

  it('does not accept a header with no max-age directive', () => {
    expect(hsts('includeSubDomains').status).toBe('warn');
  });

  it('reports the header as missing when it is absent', () => {
    const result = audit.audit(
      ctxWith(
        { 'content-security-policy': "default-src 'self'", 'x-content-type-options': 'nosniff' },
        HEALTHY_ROOT_FILES,
      ),
    );
    expect(result.status).toBe('warn');
    expect(result.found).toMatch(/Strict-Transport-Security: missing/);
  });
});

describe('SecurityHeaderHygieneAudit — CSP (v1 8.3)', () => {
  it('accepts a policy delivered as a response header', () => {
    const result = audit.audit(ctxWith(HEALTHY_HEADERS, HEALTHY_ROOT_FILES));
    expect(result.status).toBe('pass');
  });

  it('accepts a policy delivered as <meta http-equiv>', () => {
    const { 'content-security-policy': _dropped, ...rest } = HEALTHY_HEADERS;
    const result = audit.audit(
      ctxWith(
        rest,
        HEALTHY_ROOT_FILES,
        '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'"></head></html>',
      ),
    );
    expect(result.status).toBe('pass');
    expect(result.found).toContain('meta');
  });

  it('treats report-only as partial, not as an enforced policy', () => {
    const { 'content-security-policy': _dropped, ...rest } = HEALTHY_HEADERS;
    const result = audit.audit(
      ctxWith(
        { ...rest, 'content-security-policy-report-only': "default-src 'self'" },
        HEALTHY_ROOT_FILES,
      ),
    );
    expect(result.status).toBe('warn');
    expect(result.found).toContain('report-only');
  });

  it('does not treat a permissive policy as equivalent to a strict one', () => {
    const result = audit.audit(
      ctxWith(
        { ...HEALTHY_HEADERS, 'content-security-policy': "default-src *; script-src 'unsafe-inline'" },
        HEALTHY_ROOT_FILES,
      ),
    );
    expect(result.status).toBe('warn');
    expect(result.found).toContain('permissive');
  });

  it('reports the policy as missing when neither header nor meta tag is present', () => {
    const { 'content-security-policy': _dropped, ...rest } = HEALTHY_HEADERS;
    const result = audit.audit(ctxWith(rest, HEALTHY_ROOT_FILES));
    expect(result.status).toBe('warn');
    expect(result.found).toMatch(/Content-Security-Policy: missing/);
  });
});

describe('SecurityHeaderHygieneAudit — nosniff (v1 8.4)', () => {
  it('accepts the exact nosniff token, case- and space-insensitively', () => {
    const result = audit.audit(
      ctxWith({ ...HEALTHY_HEADERS, 'x-content-type-options': ' NoSniff ' }, HEALTHY_ROOT_FILES),
    );
    expect(result.status).toBe('pass');
  });

  it('does not accept a value that merely contains the substring nosniff', () => {
    const result = audit.audit(
      ctxWith({ ...HEALTHY_HEADERS, 'x-content-type-options': 'no-nosniff-here' }, HEALTHY_ROOT_FILES),
    );
    expect(result.status).toBe('warn');
    expect(result.found).toContain('no-nosniff-here');
  });

  it('reports the header as missing when it is absent', () => {
    const { 'x-content-type-options': _dropped, ...rest } = HEALTHY_HEADERS;
    const result = audit.audit(ctxWith(rest, HEALTHY_ROOT_FILES));
    expect(result.status).toBe('warn');
    expect(result.found).toMatch(/X-Content-Type-Options: missing/);
  });
});

describe('SecurityHeaderHygieneAudit — security.txt (v1 8.7)', () => {
  const withFile = (file: FetchResult | undefined) =>
    audit.audit(ctxWith(HEALTHY_HEADERS, file ? { '/.well-known/security.txt': file } : {}));

  it('accepts a file with Contact and a future Expires', () => {
    expect(withFile(mockFetchResult(VALID_SECURITY_TXT, 200)).status).toBe('pass');
  });

  it('falls back to the legacy top-level location', () => {
    const result = audit.audit(
      ctxWith(HEALTHY_HEADERS, { '/security.txt': mockFetchResult(VALID_SECURITY_TXT, 200) }),
    );
    expect(result.status).toBe('pass');
    expect(result.found).toContain('legacy location');
  });

  it('does not accept an expired file', () => {
    const result = withFile(
      mockFetchResult('Contact: mailto:s@example.com\nExpires: 2020-01-01T00:00:00.000Z\n', 200),
    );
    expect(result.status).toBe('warn');
    expect(result.found).toContain('expired');
  });

  it('does not accept a file without a Contact field', () => {
    const result = withFile(mockFetchResult('Expires: 2099-12-31T23:59:59.000Z\n', 200));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('no Contact');
  });

  it('does not accept a file without an Expires field', () => {
    const result = withFile(mockFetchResult('Contact: mailto:s@example.com\n', 200));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('no Expires');
  });

  it('does not accept an SPA HTML soft-404 served at 200', () => {
    const result = withFile(mockFetchResult('<!doctype html><html><body>Not found</body></html>', 200));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('HTML');
  });

  it('reports a 404 as missing', () => {
    const result = withFile(mockFetchResult('', 404));
    expect(result.status).toBe('warn');
    expect(result.found).toMatch(/security\.txt: missing/);
  });

  it('reports an unfetched file as missing', () => {
    const result = withFile(undefined);
    expect(result.status).toBe('warn');
    expect(result.found).toMatch(/security\.txt: missing/);
  });
});
