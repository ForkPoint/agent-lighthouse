import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { parseRobotsTxt, isPathAllowed } from './_robots-txt-helpers';
import { parseHtml } from '../../parser';
import { weightForGrade } from '../../scorer';

/**
 * AI crawler product tokens whose vendors document path-level `Disallow`.
 *
 * Apple's support article shows `User-agent: Applebot / Allow: / / Disallow:
 * /private/` and, for the AI-training token, `User-agent: Applebot-Extended /
 * Disallow: /private/`. Meta's crawler doc shows `User-agent:
 * meta-externalagent / Allow: / # Allow everything / Disallow: /private/ #
 * Disallow a specific directory`. OpenAI and Anthropic point publishers at
 * robots.txt for GPTBot/OAI-SearchBot and ClaudeBot respectively, over the
 * RFC 9309 path-matching semantics all of them implement.
 *
 * Coverage is judged against every token: a rule written only for one bot
 * leaves the rest of the field crawling the URL, so it is partial by
 * construction. `isPathAllowed` applies RFC 9309 group selection (a
 * bot-specific group wins, otherwise the `*` group) and longest-match
 * arbitration, so this never re-implements matching.
 */
const AI_CRAWLER_TOKENS = [
  'GPTBot',
  'ClaudeBot',
  'Applebot-Extended',
  'meta-externalagent',
  'Google-Extended',
  'PerplexityBot',
] as const;

interface LowValueFamily {
  /** Human-readable family name, used in the report. */
  readonly id: string;
  /** Why the family is low value in an AI crawl. */
  readonly why: string;
  /** First path segments that identify the family. */
  readonly segments: readonly string[];
}

/**
 * URL families that are worth keeping out of an AI crawl.
 *
 * This is crawl hygiene, not access control: every entry is a URL space that
 * is session-bearing, non-canonical, or carries nothing an answer engine could
 * ever cite. `/api/` is deliberately absent — API surfaces are exactly what
 * agents need, so telling a site to hide them works against agent readiness.
 *
 * Families are only ever evaluated when the crawl actually observed a URL in
 * them, so a site without a cart is never asked to disallow one.
 */
const LOW_VALUE_FAMILIES: readonly LowValueFamily[] = [
  {
    id: 'cart/checkout',
    why: 'session-bearing and never canonical',
    segments: ['cart', 'carts', 'checkout', 'basket'],
  },
  {
    id: 'site search',
    why: 'an unbounded, non-canonical URL space',
    segments: ['search'],
  },
  {
    id: 'authentication',
    why: 'no citable content',
    segments: ['login', 'signin', 'sign-in', 'signup', 'sign-up', 'register', 'logout', 'signout'],
  },
  {
    id: 'account area',
    why: 'session-bearing and personalised',
    segments: ['account', 'my-account', 'dashboard'],
  },
  {
    id: 'admin surface',
    why: 'no citable content',
    segments: ['admin', 'wp-admin', 'administrator'],
  },
];

const SEGMENT_TO_FAMILY = new Map<string, LowValueFamily>(
  LOW_VALUE_FAMILIES.flatMap((family) => family.segments.map((s) => [s, family] as const)),
);

/** One observed URL family, with the concrete path that evidenced it. */
interface Candidate {
  readonly family: LowValueFamily;
  readonly segment: string;
  /** Path + query exactly as observed — what RFC 9309 matches against. */
  readonly path: string;
  /**
   * The recommended `Disallow` value: the observed path truncated after the
   * classified segment, so it is always a literal prefix of `path` and
   * therefore always matches it under RFC 9309 prefix semantics. On a
   * locale-prefixed URL this keeps the locale (`/en-gb/checkout`), which a
   * bare `/checkout` rule would not match.
   */
  readonly disallow: string;
}

/**
 * Classify a same-origin URL by its first path segment, ignoring a leading
 * language/locale prefix (`/en/cart`, `/en-gb/checkout`), and return the
 * prefix a robots.txt rule has to carry to actually match it.
 */
function classify(pathname: string): { segment: string; prefix: string } | undefined {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return undefined;

  let index = 0;
  let head = decodeURIComponent(parts[0]!).toLowerCase();
  if (/^[a-z]{2}(-[a-z]{2})?$/.test(head) && parts.length > 1) {
    index = 1;
    head = decodeURIComponent(parts[1]!).toLowerCase();
  }
  if (!SEGMENT_TO_FAMILY.has(head)) return undefined;

  // Built from the raw (still percent-encoded) segments so the emitted rule is
  // byte-identical to the head of the observed path.
  return { segment: head, prefix: `/${parts.slice(0, index + 1).join('/')}` };
}

/**
 * Collect the low-value URL families the crawl actually observed — from the
 * crawled page URLs, the same-origin links on those pages, and the sitemap.
 *
 * Discovering candidates instead of hardcoding a list is what stops the audit
 * failing a WordPress site for not disallowing an `/admin/` it does not have.
 */
function observedCandidates(ctx: CheckContext): Candidate[] {
  let origin: string;
  try {
    origin = new URL(ctx.baseUrl).host;
  } catch {
    return [];
  }

  // Keyed by the recommended rule, not by the segment: `/en-gb/checkout` and
  // `/de/checkout` are the same family but need a rule each, and collapsing
  // them would emit a fix that only covers one locale.
  const byRule = new Map<string, Candidate>();

  const note = (raw: string, base: string) => {
    let url: URL;
    try {
      url = new URL(raw, base);
    } catch {
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (url.host !== origin) return;

    const hit = classify(url.pathname);
    if (!hit || byRule.has(hit.prefix)) return;
    byRule.set(hit.prefix, {
      family: SEGMENT_TO_FAMILY.get(hit.segment)!,
      segment: hit.segment,
      path: `${url.pathname}${url.search}`,
      disallow: hit.prefix,
    });
  };

  for (const page of ctx.pages) {
    note(page.url, ctx.baseUrl);
    page.$('a[href]').each((_, el) => {
      const href = page.$(el).attr('href');
      if (href) note(href, page.url);
    });
  }

  const sitemap = ctx.rootFiles['/sitemap.xml'] ?? ctx.rootFiles['/sitemap-index.xml'];
  if (sitemap?.status === 200 && sitemap.body) {
    const $sitemap = parseHtml(sitemap.body);
    $sitemap('loc').each((_, el) => {
      const loc = $sitemap(el).text().trim();
      if (loc) note(loc, ctx.baseUrl);
    });
  }

  return [...byRule.values()];
}

const EXPECTED =
  'Low-value URL families observed on the site (cart, checkout, search, login, account, admin) are disallowed for AI crawlers in robots.txt';

export class SensitivePathsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/sensitive-paths',
    category: 'access-crawl-control',
    title: 'Low-value URLs excluded from AI crawls',
    failureTitle: 'Low-value URLs excluded from AI crawls',
    description:
      'AI crawlers honour path-level Disallow rules (RFC 9309), so robots.txt is the lever for keeping low-value URL spaces — carts, checkouts, site-search results, login and account pages — out of AI crawls and out of the answers built from them. This is crawl hygiene, not access control.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/sensitive-paths.md',
    defaultPriority: 'low',
    guidance: {
      impact:
        'Cart, checkout, site-search, login and account URLs carry nothing an answer engine can cite, but they are crawled and can surface in AI answers as dead, session-bearing links. Apple documents Applebot and Applebot-Extended honouring "Disallow: /private/", and Meta documents the same for meta-externalagent, so a path-level rule keeps that noise out of AI crawls. Two limits matter: RFC 9309 states the protocol "is not a substitute for valid content security measures" and that listed paths become publicly discoverable, so never use robots.txt to protect anything; and user-initiated fetchers are documented not to obey it — OpenAI says of ChatGPT-User "Because these actions are initiated by a user, robots.txt rules may not apply", and Perplexity says Perplexity-User "generally ignores robots.txt rules".',
      fix: 'Add Disallow rules for the low-value URL families your site actually has — cart, checkout, site search, login and account areas. Leave API paths crawlable: agents need them. Never list a private directory here expecting it to be protected; use HTTP authentication for that.',
      code: 'User-agent: *\nAllow: /\nDisallow: /cart\nDisallow: /checkout\nDisallow: /search\nDisallow: /account\n\n# API paths are deliberately left crawlable — agents need them.',
      effort: 'trivial',
      docsUrl: 'https://www.rfc-editor.org/rfc/rfc9309.html',
      tags: ['robots-txt', 'crawl-hygiene', 'crawler-permissions'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const candidates = observedCandidates(ctx);

    if (candidates.length === 0) {
      return this.notApplicable(
        'The crawl observed no low-value URL family (cart, checkout, search, login, account, admin), so there is nothing to exclude.',
        EXPECTED,
        'No low-value URL families observed',
      );
    }

    const robotsFile = ctx.rootFiles['/robots.txt'];
    const hasRobots = Boolean(
      robotsFile && robotsFile.status === 200 && robotsFile.body && !/^\s*</.test(robotsFile.body),
    );
    const groups = hasRobots ? parseRobotsTxt(robotsFile!.body) : [];

    // A site that blocks every AI crawler at the root has already excluded all
    // of this; per-path hygiene is moot and would contradict
    // `access-crawl-control/no-blanket-block`, which owns that finding.
    if (groups.length > 0 && AI_CRAWLER_TOKENS.every((t) => !isPathAllowed(groups, t, '/'))) {
      return this.notApplicable(
        'robots.txt blanket-blocks AI crawlers, so individual low-value paths are already excluded.',
        EXPECTED,
        'Blanket block in robots.txt — see access-crawl-control/no-blanket-block',
      );
    }

    const excluded: Candidate[] = [];
    const crawled: Candidate[] = [];
    for (const candidate of candidates) {
      const allBlocked = AI_CRAWLER_TOKENS.every(
        (token) => !isPathAllowed(groups, token, candidate.path),
      );
      (allBlocked ? excluded : crawled).push(candidate);
    }

    // Long lists are truncated in the prose; the emitted rules are not, so the
    // fix stays complete even when the report is abbreviated.
    const label = (list: Candidate[]) => {
      const shown = list.slice(0, 8).map((c) => `${c.family.id} (${c.path})`);
      const rest = list.length - shown.length;
      return rest > 0 ? `${shown.join(', ')} +${rest} more` : shown.join(', ');
    };

    if (crawled.length === 0) {
      return this.pass(
        `Every low-value URL family observed on the site is disallowed for AI crawlers: ${label(excluded)}.`,
        EXPECTED,
        `Excluded: ${label(excluded)}`,
      );
    }

    const suffix = hasRobots ? '' : ' (no robots.txt is served)';
    // One rule per candidate, each a literal prefix of the path it was
    // classified from — so applying this block verbatim makes the audit pass.
    const fixCode = [...new Set(crawled.map((c) => `Disallow: ${c.disallow}`))].join('\n');
    const why = [...new Set(crawled.map((c) => `${c.family.id} is ${c.family.why}`))].join('; ');

    if (excluded.length > 0) {
      const result = this.warn(
        `Some low-value URL families are still crawlable by AI crawlers: ${label(crawled)}.`,
        EXPECTED,
        `Excluded: ${label(excluded)}; still crawlable: ${label(crawled)}${suffix}`,
        {
          priority: 'low',
          description: `${why}. Extend the robots.txt rules to cover the remaining families so AI crawlers spend their budget on citable pages instead. Leave API paths crawlable.`,
        },
      );
      return { ...result, details: { code: `User-agent: *\n${fixCode}` } };
    }

    const result = this.fail(
      `Low-value URL families are crawlable by AI crawlers: ${label(crawled)}.`,
      EXPECTED,
      `Still crawlable: ${label(crawled)}${suffix}`,
      {
        priority: 'low',
        description: `${why}. Add path-level Disallow rules so AI crawlers spend their budget on citable pages instead of session-bearing and non-canonical URLs. Leave API paths crawlable — agents need them — and remember robots.txt is not an access control.`,
      },
    );
    return { ...result, details: { code: `User-agent: *\nAllow: /\n${fixCode}` } };
  }
}
