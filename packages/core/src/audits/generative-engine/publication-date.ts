import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from '../../check-context';
import { getMainContentText, flattenJsonLd } from '../../parser';

// Kept identical to dates-on-content / last-updated. See the comment there.
const DATE_PATTERN =
  /\b(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+\d{4}|\d+\s+(?:day|week|month|year)s?\s+ago)\b/i;

/** Gate to genuine article pages — excludes XML sitemaps and interstitials. */
function isArticleContentPage(p: PageContext): boolean {
  if (p.pageType !== 'content') return false;
  let pathname = '';
  try {
    pathname = new URL(p.url).pathname.toLowerCase();
  } catch {
    pathname = '';
  }
  if (pathname.endsWith('.xml')) return false;
  /* v8 ignore next -- fetchResult.body is always a string in all callers; the ?? '' is a safety guard */
  const head = (p.fetchResult.body ?? '').slice(0, 256).trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<urlset') || head.startsWith('<sitemapindex')) {
    return false;
  }
  return true;
}

function findJsonLdDate(jsonLd: object[]): string | null {
  for (const node of flattenJsonLd(jsonLd)) {
    const n = node as Record<string, unknown>;
    const v = n['datePublished'] ?? n['dateModified'] ?? n['uploadDate'] ?? n['dateCreated'];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function findStructuredDate(p: PageContext): { value: string; source: string } | null {
  const timeWithAttr = p.$('time[datetime]').first();
  if (timeWithAttr.length) {
    /* v8 ignore next -- time[datetime] selector guarantees the attribute exists; the ?? fallback is unreachable */
    return { value: timeWithAttr.attr('datetime') ?? timeWithAttr.text().trim(), source: '<time datetime>' };
  }
  const jsonDate = findJsonLdDate(p.structuredData ?? p.jsonLd);
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

export class PublicationDateAudit extends Audit {
  static override meta: AuditMeta = {
    id: '10.9',
    category: 'generative-engine',
    title: 'Publication date visible',
    failureTitle: 'Publication date visible',
    description:
      'AI engines use visible dates to assess content freshness. Undated content is deprioritized for recency-weighted queries.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI generative engines use visible publication dates as a freshness signal when ranking content sources. Undated content is deprioritized because agents cannot determine whether the information is current, especially for topics where recency matters.',
      fix: 'Add a visible publication date using the <time> element with a machine-readable datetime attribute. Place it prominently near the article title.',
      code: '<p>Published: <time datetime="2025-01-15">January 15, 2025</time></p>',
      effort: 'trivial',
      tags: ['freshness', 'html', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const contentPages = ctx.pages.filter(isArticleContentPage);
    if (contentPages.length === 0) {
      return this.notApplicable(
        'No article content pages were scanned, so publication dates do not apply.',
        '<time> element or visible date on content pages',
        'No content pages',
      );
    }

    for (const p of contentPages) {
      const structured = findStructuredDate(p);
      if (structured) {
        return this.pass(
          `Found a structured date (${structured.source}).`,
          '<time> element or visible date on content pages',
          `${structured.source}: "${structured.value}"`,
          p.url,
        );
      }

      const text = getMainContentText(p.$);
      const dateMatch = text.match(DATE_PATTERN);
      if (dateMatch) {
        return this.pass(
          'Visible date found in content.',
          '<time> element or visible date on content pages',
          dateMatch[0],
          p.url,
        );
      }
    }

    return this.fail(
      'No visible publication date found on any scanned page.',
      '<time> element or visible date on content pages',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI generative engines use visible publication dates as a freshness signal when ranking content sources. Undated content is deprioritized because agents cannot determine whether the information is current, especially for topics where recency matters like technology, regulations, or market data.',
        code: '<p>Published: <time datetime="2025-01-15">January 15, 2025</time></p>',
      },
      contentPages[0].url,
    );
  }
}
