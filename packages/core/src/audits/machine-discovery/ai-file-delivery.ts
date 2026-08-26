import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import type { FetchResult } from '../../fetcher';

interface Expectation {
  path: string;
  expectedTypes: string[];
  label: string;
}

const EXPECTATIONS: Expectation[] = [
  { path: '/llms.txt', expectedTypes: ['text/plain', 'text/markdown'], label: 'llms.txt' },
  {
    path: '/.well-known/ai-catalog.json',
    expectedTypes: ['application/json', 'text/json'],
    label: 'ai-catalog.json',
  },
  {
    path: '/openapi.json',
    expectedTypes: ['application/json', 'text/json', 'application/yaml', 'text/yaml'],
    label: 'openapi.json',
  },
  { path: '/sitemap.xml', expectedTypes: ['application/xml', 'text/xml'], label: 'sitemap.xml' },
];

/**
 * True when a 200 response is really the site's HTML shell.
 *
 * SPA and Jamstack hosts answer unknown paths with 200 + index.html, so v1
 * reported a file the site never published as having the wrong Content-Type,
 * with a fix the user could not act on (review finding 8.10).
 */
function isHtmlShell(file: FetchResult): boolean {
  return /^\s*(<!doctype html|<html)/i.test(file.body);
}

/**
 * Does this response let a client avoid re-downloading the file?
 *
 * Absorbed from v1 8.11 with its review's required fixes: the directive value
 * is parsed (v1 passed `no-store` — the header that guarantees the re-fetching
 * it warned about), and an `ETag`/`Last-Modified` validator counts, since
 * conditional requests are the mechanism that actually saves the transfer.
 */
function cachingState(file: FetchResult): 'cacheable' | 'validator' | 'none' {
  const cacheControl = (file.headers['cache-control'] ?? '').toLowerCase();
  if (cacheControl) {
    const directives = cacheControl.split(',').map((d) => d.trim());
    const blocked = directives.some((d) => d === 'no-store' || d === 'no-cache');
    // A validator saves the transfer only when the client may keep the copy.
    // `no-store` forbids that outright, so an ETag beside it stores nothing.
    if (blocked) return 'none';
    const maxAge = directives
      .map((d) => /^s?-?max-age=(\d+)$/.exec(d) ?? /^(?:s-)?maxage=(\d+)$/.exec(d))
      .find((m) => m !== null);
    const seconds = maxAge ? Number(maxAge[1]) : 0;
    if (seconds > 0) return 'cacheable';
  }
  if (file.headers['etag'] || file.headers['last-modified']) return 'validator';
  return 'none';
}

/** nosniff removes a client's ability to recover from a wrong Content-Type. */
function hasNosniff(file: FetchResult): boolean {
  return (file.headers['x-content-type-options'] ?? '').trim().toLowerCase() === 'nosniff';
}

export class AiFileDeliveryAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/ai-file-delivery',
    category: 'machine-discovery',
    title: 'AI files are delivered correctly',
    failureTitle: 'AI files are delivered correctly',
    description:
      'AI agents use the Content-Type header to decide how to parse a file, and caching headers to avoid re-downloading one that has not changed. This audit reports both for every AI file the scan fetched.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('B', 'informative'),
    evidenceGrade: 'B',
    tier: 'informative',
    dossier: 'docs/evidence/audits/machine-discovery/ai-file-delivery.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Incorrect Content-Type headers cause AI agents to misparse your files: JSON served as text/html breaks structured-data extraction, an XML sitemap served as text/plain hides it from crawl discovery, and llms.txt served as application/octet-stream triggers a download instead of a read. Missing caching headers make every agent re-download the full file on each visit rather than revalidating it.',
      fix: 'Serve each AI file with its own MIME type (application/json for JSON, application/xml for XML sitemaps, text/plain or text/markdown for llms.txt) and add either a Cache-Control with a non-zero max-age or an ETag / Last-Modified validator.',
      code: 'llms.txt:        Content-Type: text/plain\nopenapi.json:    Content-Type: application/json\nai-catalog.json: Content-Type: application/json\nsitemap.xml:     Content-Type: application/xml\n\nCache-Control: public, max-age=3600\nETag: "a1b2c3"',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type',
      tags: ['headers', 'ai-files', 'caching', 'configuration'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];
    const expected =
      'Each AI file served with its own MIME type and a cache-control max-age or a validator';

    const correct: string[] = [];
    const incorrect: Array<{ label: string; expected: string; actual: string; nosniff: boolean }> =
      [];
    const uncached: string[] = [];

    for (const { path, expectedTypes, label } of EXPECTATIONS) {
      const file = ctx.rootFiles[path];
      if (!file || file.status !== 200) continue;
      // An HTML shell is an unpublished file, not a mis-typed one.
      if (isHtmlShell(file) && !expectedTypes.some((t) => t.includes('html'))) continue;

      const contentType = file.contentType.toLowerCase().split(';')[0]!.trim();
      if (expectedTypes.some((et) => contentType.includes(et))) {
        correct.push(label);
      } else {
        incorrect.push({
          label,
          expected: expectedTypes[0]!,
          actual: contentType,
          nosniff: hasNosniff(file),
        });
      }

      if (cachingState(file) === 'none') uncached.push(label);
    }

    if (correct.length + incorrect.length === 0) {
      return this.notApplicable(
        'No AI/data files were served, so there is nothing to deliver.',
        expected,
        'No applicable files found',
        page?.url,
      );
    }

    const cachingNote =
      uncached.length > 0
        ? `no caching headers on: ${uncached.join(', ')}`
        : 'all files carry caching headers';

    if (incorrect.length > 0) {
      const details = incorrect
        .map(
          (i) =>
            `${i.label}: expected ${i.expected}, got ${i.actual}${i.nosniff ? ' (served with nosniff, so a client cannot recover from the wrong type)' : ''}`,
        )
        .join('; ');

      return this.fail(
        `Incorrect Content-Type on some files: ${details}`,
        expected,
        `Incorrect: ${details}; ${cachingNote}`,
        {
          priority: 'medium',
          description:
            'AI agents use Content-Type headers to determine how to parse your files. Incorrect MIME types cause JSON files to be treated as plain text (breaking schema parsing) or XML to be treated as HTML (breaking sitemap crawling). Fix Content-Type headers to match each file format.',
          code: incorrect.map((i) => `${i.label}: Content-Type: ${i.expected}`).join('\n'),
        },
        page?.url,
      );
    }

    if (uncached.length > 0) {
      return this.warn(
        `Content-Types are correct, but some AI files have no caching headers: ${uncached.join(', ')}`,
        expected,
        `Correct: ${correct.join(', ')}; ${cachingNote}`,
        {
          priority: 'low',
          description:
            'Without a cache-control max-age or an ETag / Last-Modified validator, every agent request re-downloads the whole file instead of revalidating it. Google documents honouring both conditional-request mechanisms.',
          code: 'Cache-Control: public, max-age=3600\nETag: "a1b2c3"',
        },
        page?.url,
      );
    }

    return this.pass(
      `All checked files have correct Content-Type and caching headers: ${correct.join(', ')}`,
      expected,
      `Correct: ${correct.join(', ')}; ${cachingNote}`,
      page?.url,
    );
  }
}
