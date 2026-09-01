import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { getMainContentText, flattenJsonLd } from '../../parser';

/**
 * Update wording, absorbed from v1 9.10 `last-updated-indicator`. Global so the
 * text scan can walk every occurrence; every use resets `lastIndex` first.
 */
const UPDATED_PATTERN = /\b(?:last\s+)?(?:updated|modified|revised)\b/gi;

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

/** Pull a modification date out of JSON-LD, robust to nesting. */
function findJsonLdModified(jsonLd: object[]): string | null {
  for (const node of flattenJsonLd(jsonLd)) {
    const v = (node as Record<string, unknown>)['dateModified'];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** The surrounding text when a `<time>` element sits next to update wording. */
function timeWithUpdateKeyword(p: PageContext): string | null {
  let hit: string | null = null;
  p.$('time').each((_, el) => {
    if (hit) return;
    const time = p.$(el);
    const context = `${time.parent().text()} ${time.text()} ${time.attr('datetime') ?? ''}`;
    UPDATED_PATTERN.lastIndex = 0;
    if (UPDATED_PATTERN.test(context)) {
      hit = context.replace(/\s+/g, ' ').trim();
    }
  });
  return hit;
}

/**
 * The modification half of the merged audit (v1 9.10). Structured sources come
 * first, then the visible "last updated" label — which is only accepted with a
 * parseable date beside it, never on the keyword alone.
 */
export function findUpdateIndicator(
  p: PageContext,
): { value: string; source: string } | null {
  const jsonLdModified = findJsonLdModified(p.jsonLd);
  if (jsonLdModified) return { value: jsonLdModified, source: 'JSON-LD dateModified' };

  const metaModified = p.meta['article:modified_time'] ?? p.meta['og:updated_time'];
  if (metaModified?.trim()) {
    const key = p.meta['article:modified_time']?.trim() ? 'article:modified_time' : 'og:updated_time';
    return { value: metaModified.trim(), source: `meta ${key}` };
  }

  const domHit = timeWithUpdateKeyword(p);
  if (domHit) return { value: domHit.slice(0, 100), source: 'visible "last updated" label on a <time>' };

  // Text fallback: update wording with a *parsed* date in a ±window, never just
  // nearby digits (which used to match phone numbers, SKUs and prices).
  const text = getMainContentText(p.$);
  UPDATED_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = UPDATED_PATTERN.exec(text)) !== null) {
    const window = text.slice(
      Math.max(0, m.index - 24),
      Math.min(text.length, m.index + m[0].length + 48),
    );
    if (DATE_PATTERN.test(window)) {
      return { value: window.trim().slice(0, 100), source: 'visible "last updated" text' };
    }
  }

  return null;
}

export class DatesOnContentAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/dates-on-content',
    category: 'answer-readiness',
    title: 'Dates on content pages',
    failureTitle: 'Dates on content pages',
    description:
      'Date extractors read the byline date off a content page from <time datetime>, JSON-LD datePublished/dateModified, article:*_time meta tags or a clearly labelled visible date; a page carrying none of them has no date any downstream consumer can attach to it. A modification date (or a visible "last updated" label with a date beside it) is the full signal; a publication date alone is a partial one.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/answer-readiness/dates-on-content.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Google estimates a byline date from a page\'s visible date and its datePublished/dateModified structured data, and can show it in results — the same results AI Overviews and AI Mode draw their supporting links from. The open extraction stack (htmldate, under trafilatura) reads the same fields in the same order. A page with no date at all gives every one of them nothing to read.',
      fix: 'Add a visible date using the <time> element with a machine-readable datetime attribute on every content page, near the title or byline. When you revise a page, label the revision ("Last updated") and set dateModified — that is what turns a partial result into a pass.',
      code: '<p>Published: <time datetime="2025-01-15">January 15, 2025</time><br>\nLast updated: <time datetime="2025-04-02">April 2, 2025</time></p>',
      effort: 'trivial',
      tags: ['freshness', 'html', 'answer-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const contentPages = ctx.pages.filter(isArticleContentPage);
    const expected =
      'A modification date (dateModified, article:modified_time, or a visible "last updated" label beside a date); a publication date alone is partial';

    if (contentPages.length === 0) {
      return this.notApplicable(
        'No article content pages were scanned, so content freshness dates do not apply.',
        expected,
        'No content pages',
      );
    }

    // First publication-only date seen, kept in case no page carries an update
    // indicator. The update signal wins wherever it is found.
    let published: { value: string; source: string; url: string } | null = null;

    for (const p of contentPages) {
      const updated = findUpdateIndicator(p);
      if (updated) {
        return this.pass(
          `Found a "last updated" signal (${updated.source}).`,
          expected,
          `${updated.source}: "${updated.value}"`,
          p.url,
        );
      }

      if (published) continue;

      const structured = findStructuredDate(p);
      if (structured) {
        published = { ...structured, url: p.url };
        continue;
      }

      const dateMatch = getMainContentText(p.$).match(DATE_PATTERN);
      if (dateMatch) {
        published = { value: dateMatch[0], source: 'visible date pattern', url: p.url };
      }
    }

    if (published) {
      return this.warn(
        `Found a publication date (${published.source}) but no modification date or "last updated" label.`,
        expected,
        `${published.source}: "${published.value}"`,
        {
          // Low: a dated article that has never been revised is correct as it
          // stands. v1 9.10 hard-failed exactly this page.
          priority: 'low',
          description:
            'Google asks that a revision be both labelled ("Last updated") and expressed as dateModified, and htmldate resolves updated dates as a first-class output. Without one, an extractor can date the page but not tell how current it is — so add the modification date when, and only when, you actually revise the page.',
          code: '<p>Last updated: <time datetime="2025-04-02">April 2, 2025</time></p>',
        },
        published.url,
      );
    }

    return this.fail(
      'No dates found on scanned content pages.',
      expected,
      'Not found',
      {
        priority: 'medium',
        description:
          'Google estimates a byline date from a page\'s visible date and its datePublished/dateModified structured data, and the open extraction stack reads the same fields. A page carrying neither gives every consumer nothing to date it by.',
        code: '<p>Published: <time datetime="2025-01-15">January 15, 2025</time></p>',
      },
      contentPages[0].url,
    );
  }
}
