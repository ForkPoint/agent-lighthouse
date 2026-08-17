import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from '../../check-context';
import { getMainContentText, flattenJsonLd } from '../../parser';

// Broad visible-date matcher. Covers: numeric DD/MM/YYYY & ISO YYYY-MM-DD
// (with optional time component, e.g. 2025-04-02T10:00:00Z — the old trailing
// \b broke right before the "T"), "Month DD, YYYY", UK/EU "DD Month YYYY",
// bare "Month YYYY", the 4-letter "Sept" abbreviation, and relative phrases
// ("3 days ago"). Kept identical across dates-on-content / last-updated /
// publication-date so the three freshness audits agree.
const DATE_PATTERN =
  /\b(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+\d{4}|\d+\s+(?:day|week|month|year)s?\s+ago)\b/i;

/**
 * Only run freshness checks on genuine article pages. Excludes XML sitemaps
 * (Shopify exposes `…/sitemap_products_1.xml` as pageType "content") and other
 * non-HTML interstitials, which have no meaningful publication date.
 */
export function isArticleContentPage(p: PageContext): boolean {
  if (p.pageType !== 'content') return false;
  let pathname = '';
  try {
    pathname = new URL(p.url).pathname.toLowerCase();
  } catch {
    pathname = '';
  }
  if (pathname.endsWith('.xml')) return false;
  /* v8 ignore next -- FetchResult.body is typed as required string; null guard is defensive */
  const head = (p.fetchResult.body ?? '').slice(0, 256).trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<urlset') || head.startsWith('<sitemapindex')) {
    return false;
  }
  return true;
}

/** Pull a publication/modification date from JSON-LD, robust to nesting. */
export function findJsonLdDate(jsonLd: object[]): string | null {
  for (const node of flattenJsonLd(jsonLd)) {
    const n = node as Record<string, unknown>;
    const v = n['datePublished'] ?? n['dateModified'] ?? n['uploadDate'] ?? n['dateCreated'];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Resolve a date from structured sources, in priority order:
 *   1. <time datetime>  2. JSON-LD  3. <meta article:*_time>  4. bare <time>.
 * These are machine-readable and far more reliable than scraping body text —
 * e.g. mejuri's blog article exposes datePublished only in JSON-LD/meta.
 */
export function findStructuredDate(
  p: PageContext,
): { value: string; source: string } | null {
  const timeWithAttr = p.$('time[datetime]').first();
  if (timeWithAttr.length) {
    /* v8 ignore next -- time[datetime] selector guarantees the attr exists; ?? fallback is unreachable */
    return { value: timeWithAttr.attr('datetime') ?? timeWithAttr.text().trim(), source: '<time datetime>' };
  }
  const jsonDate = findJsonLdDate(p.jsonLd);
  if (jsonDate) return { value: jsonDate, source: 'JSON-LD' };
  const metaDate =
    p.meta['article:published_time'] ??
    p.meta['article:modified_time'] ??
    p.meta['og:updated_time'];
  if (metaDate?.trim()) return { value: metaDate.trim(), source: 'meta' };
  const anyTime = p.$('time').first();
  if (anyTime.length) {
    const v = anyTime.attr('datetime') ?? anyTime.text().trim();
    if (v) return { value: v, source: '<time>' };
  }
  return null;
}

export class DatesOnContentAudit extends Audit {
  static override meta: AuditMeta = {
    id: '9.8',
    category: 'answer-engine',
    title: 'Dates on content pages',
    failureTitle: 'Dates on content pages',
    description:
      'AI engines use dates to assess content freshness. Undated content is deprioritized in AI answers because agents cannot verify its recency.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI answer engines use publication dates to assess content freshness for recency-weighted ranking. Undated content is deprioritized because agents cannot verify whether the information is current, especially for queries where timeliness matters.',
      fix: 'Add a visible date using the <time> element with a machine-readable datetime attribute on every content page. Place it near the article title or byline.',
      code: '<p>Published: <time datetime="2025-01-15">January 15, 2025</time></p>',
      effort: 'trivial',
      tags: ['freshness', 'html', 'answer-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const contentPages = ctx.pages.filter(isArticleContentPage);
    if (contentPages.length === 0) {
      return this.notApplicable(
        'No article content pages were scanned, so content freshness dates do not apply.',
        '<time> elements or visible date patterns present',
        'No content pages',
      );
    }

    for (const p of contentPages) {
      const structured = findStructuredDate(p);
      if (structured) {
        return this.pass(
          `Found a structured date (${structured.source}).`,
          '<time> elements or visible date patterns present',
          `${structured.source}: "${structured.value}"`,
          p.url,
        );
      }

      const text = getMainContentText(p.$);
      const dateMatch = text.match(DATE_PATTERN);
      if (dateMatch) {
        return this.pass(
          'Visible date pattern found in content.',
          '<time> elements or visible date patterns present',
          dateMatch[0],
          p.url,
        );
      }
    }

    return this.fail(
      'No dates found on scanned content pages.',
      '<time> elements or visible date patterns present',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI answer engines use publication dates to assess content freshness for recency-weighted ranking. Undated content is deprioritized because agents cannot verify whether the information is current, especially for queries where timeliness matters.',
        code: '<p>Published: <time datetime="2025-01-15">January 15, 2025</time></p>',
      },
      contentPages[0].url,
    );
  }
}
