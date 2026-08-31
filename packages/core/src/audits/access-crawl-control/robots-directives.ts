import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

/**
 * Meta names that carry robots directives. `robots` is the generic form; the
 * rest are the per-crawler forms an AI-readiness tool cannot afford to miss —
 * `<meta name="GPTBot" content="noindex">` was invisible to all three v1
 * audits (reviews 1.13, 2.25, 4.20).
 */
const DIRECTIVE_META_NAMES = new Set([
  'robots',
  'googlebot',
  'googlebot-news',
  'google-extended',
  'bingbot',
  'msnbot',
  'applebot',
  'applebot-extended',
  'gptbot',
  'oai-searchbot',
  'chatgpt-user',
  'claudebot',
  'claude-searchbot',
  'claude-user',
  'anthropic-ai',
  'perplexitybot',
  'ccbot',
]);

/** Directives that remove the page from an index. `none` == noindex + nofollow. */
const BLOCKING_TOKENS = new Set(['noindex', 'none']);

/**
 * Directives that permit indexing but forbid quoting. Google documents that
 * `nosnippet` "will also prevent the content from being used as a direct input
 * for AI Overviews and AI Mode"; Bing documents that `noarchive` content "will
 * not be included in Bing Chat answers".
 */
const SUPPRESSING_TOKENS = new Set(['nosnippet', 'noarchive', 'nocache']);

/** Directives whose value follows a colon, so a colon here is not a bot prefix. */
const VALUED_DIRECTIVES = new Set([
  'max-snippet',
  'max-image-preview',
  'max-video-preview',
  'unavailable_after',
]);

/**
 * Routes where `noindex` is the correct configuration. v1's 2.25 failed the
 * whole site at high priority when a crawl happened to include /cart or
 * /login, so the audit's own `expected` string ("primary content pages")
 * contradicted its code. `pageType` cannot express this — its four values are
 * all content-ish — so the split is made on the path.
 */
const UTILITY_PATH =
  /^\/(cart|basket|checkout|login|signin|sign-in|logout|signout|register|signup|sign-up|account|my-account|profile|search|thank-?you|thanks|order-confirmation|admin|wp-admin|wp-login\.php|preview|draft)(\/|$)/;

interface Directive {
  /** Normalized token, e.g. `noindex` or `max-snippet:0`. */
  token: string;
  /** Where it was read from, for the `found` string. */
  source: string;
}

/** Split a directive list into normalized, lower-cased tokens. */
function tokenize(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim().toLowerCase().replace(/\s*:\s*/, ':'))
    .filter(Boolean);
}

/** `max-snippet:0` forbids every snippet; `max-snippet:-1` is the permissive default. */
function suppressesSnippets(token: string): boolean {
  if (SUPPRESSING_TOKENS.has(token)) return true;
  const [name, value] = token.split(':');
  return name === 'max-snippet' && value === '0';
}

/**
 * Every robots directive that applies to a page, from both transports.
 *
 * Meta tags are read off the DOM rather than `page.meta`, because
 * `extractMetaTags` is last-wins: a page carrying `noindex` in the template and
 * a plugin-injected `index, follow` later reported only the permissive tag,
 * while real crawlers apply the most restrictive one.
 */
function directivesFor(page: PageContext): Directive[] {
  const found: Directive[] = [];
  const $ = page.$;

  $('meta[name]').each((_, el) => {
    const name = ($(el).attr('name') ?? '').trim().toLowerCase();
    if (!DIRECTIVE_META_NAMES.has(name)) return;
    const content = $(el).attr('content') ?? '';
    for (const token of tokenize(content)) {
      found.push({ token, source: `meta name="${name}"` });
    }
  });

  // `X-Robots-Tag: noindex` and the per-bot form `X-Robots-Tag: googlebot: noindex`.
  const header = page.fetchResult.headers['x-robots-tag'] ?? '';
  for (const part of tokenize(header)) {
    const colon = part.indexOf(':');
    const prefix = colon === -1 ? '' : part.slice(0, colon);
    if (colon !== -1 && !VALUED_DIRECTIVES.has(prefix)) {
      // A bot-scoped header binds only that crawler. The allowlist is the same
      // one the meta transport uses, so `X-Robots-Tag: yandexbot: noindex` is
      // ignored exactly as `<meta name="yandexbot" content="noindex">` is —
      // v1 1.13 read the whole header as a blanket noindex and over-reported.
      if (DIRECTIVE_META_NAMES.has(prefix)) {
        found.push({ token: part.slice(colon + 1).trim(), source: `X-Robots-Tag (${prefix})` });
      }
      continue;
    }
    found.push({ token: part, source: 'X-Robots-Tag' });
  }

  return found;
}

function isUtilityRoute(url: string): boolean {
  try {
    return UTILITY_PATH.test(new URL(url).pathname.toLowerCase());
  } catch {
    return false;
  }
}

interface PageVerdict {
  url: string;
  isHomepage: boolean;
  isUtility: boolean;
  blocking: Directive[];
  suppressing: Directive[];
}

function describe(verdict: PageVerdict, directives: Directive[]): string {
  const detail = directives.map((d) => `${d.token} via ${d.source}`).join('; ');
  return `${verdict.url} — ${detail}`;
}

export class MetaRobotsNotBlockingAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/robots-directives',
    category: 'access-crawl-control',
    title: 'Robots directives do not block AI indexing',
    failureTitle: 'Robots directives block AI indexing',
    description:
      'Robots directives — `<meta name="robots">`, per-bot meta tags and the `X-Robots-Tag` header — decide whether a page can be indexed at all and whether it can be quoted in an AI answer. A `noindex` on a content page removes it from the index AI Overviews and AI Mode draw on; `nosnippet` and `max-snippet:0` leave it indexed but unquotable.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/robots-directives.md',
    // Gate exemption: being refused is what this category reports, and robots directives
    // live in the head and the headers, which arrive whether or not the body renders.
    requires: ['origin-reachable'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'A content page carrying "noindex" (in a robots meta tag, a per-bot meta tag, or the X-Robots-Tag response header) is dropped from the search index, and Google documents that a page must be indexed to appear in AI Overviews or AI Mode. "nosnippet", "noarchive" and "max-snippet:0" keep the page indexed but stop its text being used as a direct input for AI answers.',
      fix: 'Remove "noindex"/"none" from the content pages you want AI agents to read — check the X-Robots-Tag response header as well as the HTML, since CDN and staging rules apply it there. Drop "nosnippet", "noarchive" and "max-snippet:0" from pages you want quoted. Leaving noindex on cart, login, search and account routes is correct and is not reported as a defect.',
      code: '<meta name="robots" content="index, follow">',
      effort: 'trivial',
      docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
      tags: ['meta-tags', 'indexing', 'crawler-permissions'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (!ctx.pages || ctx.pages.length === 0) {
      // A green "not blocking by default" on a scan where every fetch failed
      // was v1 4.20's worst failure mode; nothing was assessed, so nothing is
      // scored.
      return this.notApplicable(
        'No pages were scanned, so no robots directives could be read.',
        'No blocking robots directive on content pages',
        'No pages scanned',
      );
    }

    const verdicts: PageVerdict[] = ctx.pages.map((page) => {
      const directives = directivesFor(page);
      return {
        url: page.url,
        isHomepage: page.pageType === 'homepage',
        isUtility: isUtilityRoute(page.url),
        blocking: directives.filter((d) => BLOCKING_TOKENS.has(d.token)),
        suppressing: directives.filter((d) => suppressesSnippets(d.token)),
      };
    });

    const blockedContent = verdicts.filter((v) => v.blocking.length > 0 && !v.isUtility);
    const blockedUtility = verdicts.filter((v) => v.blocking.length > 0 && v.isUtility);
    const suppressedContent = verdicts.filter(
      (v) => v.suppressing.length > 0 && v.blocking.length === 0 && !v.isUtility,
    );

    if (blockedContent.length > 0) {
      const homepageBlocked = blockedContent.some((v) => v.isHomepage);
      return this.fail(
        `${blockedContent.length} content page(s) carry a blocking robots directive${
          homepageBlocked ? ', including the homepage' : ''
        }.`,
        'No blocking robots directive on content pages',
        blockedContent.map((v) => describe(v, v.blocking)).join(' | '),
        {
          priority: homepageBlocked ? 'critical' : 'high',
          description:
            'These pages are excluded from the search index, and Google documents that a page must be indexed to be shown as a supporting link in AI Overviews or AI Mode. Remove the noindex/none directive — checking the X-Robots-Tag response header as well as the HTML — from every page you want AI agents to find.',
          code: '<!-- Replace noindex with: -->\n<meta name="robots" content="index, follow">',
        },
        blockedContent[0]!.url,
      );
    }

    if (suppressedContent.length > 0) {
      return this.warn(
        `${suppressedContent.length} content page(s) allow indexing but forbid quoting (nosnippet / noarchive / max-snippet:0).`,
        'No blocking robots directive on content pages',
        suppressedContent.map((v) => describe(v, v.suppressing)).join(' | '),
        {
          priority: 'medium',
          description:
            'These pages stay in the index but their text cannot be used. Google documents that "nosnippet" prevents content "being used as a direct input for AI Overviews and AI Mode" and that "max-snippet" limits it; Bing documents that "noarchive" content is not included in its chat answers. Remove the directive from pages you want cited.',
          code: '<meta name="robots" content="index, follow, max-snippet:-1">',
        },
        suppressedContent[0]!.url,
      );
    }

    const utilityNote =
      blockedUtility.length > 0
        ? ` ${blockedUtility.length} utility route(s) carry noindex, which is the correct configuration for them.`
        : '';

    return this.pass(
      `No scanned content page carries a blocking or snippet-suppressing robots directive.${utilityNote}`,
      'No blocking robots directive on content pages',
      `Checked ${ctx.pages.length} page(s) — meta robots, per-bot meta tags and X-Robots-Tag`,
    );
  }
}
