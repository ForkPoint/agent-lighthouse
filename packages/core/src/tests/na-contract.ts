import type { CheckContext } from '../check-context';
import type { FetchOptions, FetchResult } from '../fetcher';
import type { AuditResult } from '../types';

const notFound = (url: string): FetchResult => ({
  url,
  finalUrl: url,
  status: 404,
  headers: {},
  body: '',
  ttfbMs: 0,
  totalMs: 0,
  contentType: '',
  contentLength: 0,
});

export function emptyContext(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    rootFiles: {},
    pages: [],
    domain: 'example.test',
    baseUrl: 'https://example.test',
    fetch: async (options: FetchOptions) => notFound(options.url),
    ...overrides,
  };
}

/**
 * Contract test: on a site with nothing to assess, an audit must return
 * notApplicable — a `pass` here is the vacuous-pass score inflation the
 * v2 restructure removes. Every audit's test file calls this once.
 */
export async function expectNotApplicableOnEmpty(audit: {
  audit(ctx: CheckContext): AuditResult | Promise<AuditResult>;
}): Promise<void> {
  const result = await audit.audit(emptyContext());
  if (result.status !== 'na') {
    throw new Error(
      `Expected notApplicable on an empty site, got "${result.status}" — vacuous ${result.status} inflates scores for features the site does not have.`,
    );
  }
}
