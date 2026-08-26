// Graduated from proposal 2026-08-22 (Plan 5, Task 20).
// Evidence dossier: docs/evidence/audits/machine-discovery/ai-crawler-surface-reachability.md
//
// The robots.txt `Sitemap:` directive is host-global and user-agent independent
// (RFC 9309 §2.2.3), while the sitemap file, the feed files and every URL they
// list are subject to per-crawler rules. That gap is the whole audit: a site can
// advertise a discovery surface the same file forbids, and a bot-blocking plugin
// that adds `Disallow: /*.xml$` to a named AI group produces exactly that.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import {
  parseRobotsFile,
  groupsForBot,
  hasNamedGroup,
  isBlanketBlocked,
  isPathAllowed,
  decidingRule,
  type RobotsGroup,
} from '../../gatherers/robots';
import { siteSitemapTree, sampleEntries } from '../../gatherers/sitemap';

/**
 * The crawler panel, in the spelling each operator documents.
 *
 * Retrieval agents (ChatGPT-User, Claude-User, Perplexity-User) sit beside the
 * indexers deliberately: a surface unreachable to them is unreachable at answer
 * time even when the index is current.
 */
const UA_PANEL = [
  'GPTBot',
  'OAI-SearchBot',
  'OAI-AdsBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Googlebot',
  'Bingbot',
  'Amazonbot',
  'Applebot-Extended',
  'meta-externalagent',
  'CCBot',
  'Bytespider',
] as const;

/** `<link rel="alternate">` types that advertise a machine-readable feed. */
const FEED_TYPES = new Set([
  'application/rss+xml',
  'application/atom+xml',
  'application/feed+json',
]);

/** How many sitemap URLs to test per crawler. */
const SAMPLE_SIZE = 50;
/** Below this share of the sample a crawler cannot see the site through its sitemap. */
const COVERAGE_FLOOR = 0.5;
/** How many crawler names a single finding lists before it summarises. */
const MAX_NAMED = 4;
/** A token no group can name, used to ask what the `*` rules alone would say. */
const WILDCARD_BASELINE = 'agent-lighthouse-wildcard-baseline';

function pathOf(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return undefined;
  }
}

function registrableHost(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/** Absolute, on-site URLs only: an off-site surface is not governed by this robots.txt. */
function onSite(urls: string[], baseUrl: string): string[] {
  const base = registrableHost(baseUrl);
  if (!base) return [];
  const out: string[] = [];
  for (const raw of urls) {
    let resolved: URL;
    try {
      resolved = new URL(raw, baseUrl);
    } catch {
      continue;
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
    const host = resolved.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== base && !host.endsWith(`.${base}`)) continue;
    const href = resolved.toString();
    if (!out.includes(href)) out.push(href);
  }
  return out;
}

/** Every feed advertised by `<link rel="alternate">` across the scanned pages. */
function advertisedFeeds(ctx: CheckContext): string[] {
  const hrefs: string[] = [];
  for (const page of ctx.pages) {
    for (const link of page.headLinks) {
      if (!link.rel.toLowerCase().split(/\s+/).includes('alternate')) continue;
      if (!FEED_TYPES.has(link.type.trim().toLowerCase())) continue;
      if (!link.href.trim()) continue;
      try {
        hrefs.push(new URL(link.href, page.url).toString());
      } catch {
        // Unresolvable href — nothing to reach.
      }
    }
  }
  return onSite(hrefs, ctx.baseUrl);
}

/** One blocked surface, plus the crawlers it is blocked for. */
interface Blocked {
  url: string;
  rulePath: string;
  bots: string[];
}

function record(into: Map<string, Blocked>, url: string, rulePath: string, bot: string): void {
  const key = `${url}|${rulePath}`;
  const existing = into.get(key);
  if (existing) {
    existing.bots.push(bot);
    return;
  }
  into.set(key, { url, rulePath, bots: [bot] });
}

function nameList(bots: string[]): string {
  if (bots.length <= MAX_NAMED) return bots.join(', ');
  return `${bots.slice(0, MAX_NAMED).join(', ')} and ${bots.length - MAX_NAMED} more`;
}

const EXPECTED =
  'every crawler in the panel can fetch the sitemaps and feeds the site advertises, and at least half of the sitemap URLs it lists';

const SAMPLE = `# robots.txt — advertise nothing you forbid
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /sitemap.xml
Allow: /feed.xml
Disallow: /cart
Disallow: /checkout

Sitemap: https://example.com/sitemap.xml`;

export class AiCrawlerSurfaceReachabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/ai-crawler-surface-reachability',
    category: 'machine-discovery',
    title: 'AI crawlers can reach the discovery surfaces the site advertises',
    failureTitle: 'AI crawlers are blocked from discovery surfaces the site advertises',
    description:
      'Evaluates robots.txt per named AI user-agent against the exact URLs the site advertises for indexing — the Sitemap: targets, the autodiscovered RSS/Atom/JSON feeds, and a sample of the URLs listed inside the sitemap tree — and flags the self-contradiction of advertising a discovery surface the same file forbids.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/machine-discovery/ai-crawler-surface-reachability.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'high',
    guidance: {
      impact:
        "The Sitemap: directive is host-global and user-agent independent (RFC 9309 §2.2.3), but the sitemap file, the feed files and every URL they list obey per-crawler rules — and under §2.2.1 a crawler with a named group ignores the '*' group entirely. OpenAI documents the consequence at the extreme: 'Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers.' So for any crawler whose named group disallows the advertised sitemap or feed path, or a majority of the URLs the sitemap lists, the site's whole pull-indexing surface is unreachable to that agent no matter how good the sitemap is. The common trigger is a bot-blocking plugin adding a broad pattern (Disallow: /*.xml$, Disallow: /feed/, Disallow: /) to an AI-bot group while the site keeps advertising those exact paths.",
      fix: "Read robots.txt as each named AI crawler reads it. For every group that names an AI crawler, add an explicit Allow for the sitemap and feed paths you advertise, and keep the group's Disallow patterns off the content the sitemap lists — narrow /*.xml$ and /feed/ style patterns to the paths you actually mean to protect. A named group replaces the '*' group rather than adding to it, so anything the wildcard allowed has to be restated inside the named group. If you intend to block a crawler entirely, keep Disallow: / as the whole group: a deliberate opt-out is a policy, and this audit reports it as one.",
      code: SAMPLE,
      effort: 'easy',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/machine-discovery/ai-crawler-surface-reachability/',
      tags: ['robots', 'sitemap', 'feeds', 'crawlers', 'discovery'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const robots = ctx.rootFiles['/robots.txt'];
    const { groups, sitemaps } = parseRobotsFile(
      robots && robots.status === 200 ? robots.body : '',
    );

    const declared = onSite(sitemaps, ctx.baseUrl);
    const feeds = advertisedFeeds(ctx);

    const tree = await siteSitemapTree(ctx);
    const samplePaths = sampleEntries(tree.entries, SAMPLE_SIZE)
      .map((entry) => pathOf(entry.loc))
      .filter((path): path is string => path !== undefined);

    if (declared.length === 0 && feeds.length === 0 && samplePaths.length === 0) {
      return this.notApplicable(
        'The site advertises no discovery surface: robots.txt names no Sitemap, no sitemap responded, and no page links a feed. There is nothing for a crawler to be blocked from.',
        EXPECTED,
        'No advertised sitemap, feed or sitemap URL',
      );
    }

    const wildcard: RobotsGroup[] = groups.filter((group) => group.userAgent.trim() === '*');
    const optOut: string[] = [];
    const sitemapBlocks = new Map<string, Blocked>();
    const feedBlocks = new Map<string, Blocked>();
    const starved: string[] = [];

    for (const bot of UA_PANEL) {
      // A named group with Disallow: / is a policy statement. Reading it as a
      // broken configuration would score an operator's own decision against them.
      if (hasNamedGroup(groups, bot) && isBlanketBlocked(groups, bot)) {
        optOut.push(groupsForBot(groups, bot)[0]?.userAgent ?? bot);
        continue;
      }

      for (const sitemapUrl of declared) {
        const path = pathOf(sitemapUrl);
        const rule = path ? decidingRule(groups, bot, path) : undefined;
        if (rule?.type === 'disallow') record(sitemapBlocks, sitemapUrl, rule.path, bot);
      }

      for (const feedUrl of feeds) {
        const path = pathOf(feedUrl);
        const rule = path ? decidingRule(groups, bot, path) : undefined;
        if (rule?.type === 'disallow') record(feedBlocks, feedUrl, rule.path, bot);
      }

      if (samplePaths.length === 0) continue;
      const allowed = samplePaths.filter((path) => isPathAllowed(groups, bot, path)).length;
      const coverage = allowed / samplePaths.length;
      if (coverage >= COVERAGE_FLOOR) continue;
      // Only a divergence counts: if the wildcard is just as restrictive, the
      // site blocks everyone and this audit is not the place to say so.
      const baseline =
        samplePaths.filter((path) => isPathAllowed(wildcard, WILDCARD_BASELINE, path)).length /
        samplePaths.length;
      if (baseline > coverage) {
        starved.push(
          `${groupsForBot(groups, bot)[0]?.userAgent ?? bot} reaches ${Math.round(coverage * 100)}% of the sampled sitemap URLs where the * group would have allowed ${Math.round(baseline * 100)}%`,
        );
      }
    }

    const problems: string[] = [];
    for (const block of sitemapBlocks.values()) {
      problems.push(
        `robots.txt advertises "Sitemap: ${block.url}" but "Disallow: ${block.rulePath}" blocks that path for ${block.bots.length} panel crawler(s) (${nameList(block.bots)})`,
      );
    }
    for (const block of feedBlocks.values()) {
      problems.push(
        `${block.url} is advertised by <link rel="alternate"> but "Disallow: ${block.rulePath}" blocks it for ${block.bots.length} panel crawler(s) (${nameList(block.bots)})`,
      );
    }
    problems.push(...starved);

    const optOutNote =
      optOut.length > 0
        ? ` ${optOut.length} crawler(s) are blocked outright by a named group (${nameList(optOut)}); that is a deliberate opt-out, not a defect, and this audit scores nothing for them.`
        : '';

    const found = `${samplePaths.length} sampled sitemap URL(s) of ${tree.entries.length} listed; ${declared.length} advertised sitemap(s); ${feeds.length} advertised feed(s); ${UA_PANEL.length} crawlers checked; ${problems.length} problem(s)`;

    if (problems.length > 0) {
      return this.fail(`${problems.join('; ')}.${optOutNote}`, EXPECTED, found, 'high');
    }

    if (optOut.length > 0) {
      return this.warn(
        `Every advertised discovery surface is reachable by the crawlers that are allowed to fetch it.${optOutNote}`,
        EXPECTED,
        found,
        'low',
      );
    }

    return this.pass(
      `All ${UA_PANEL.length} panel crawlers can fetch every advertised sitemap and feed, and at least ${Math.round(COVERAGE_FLOOR * 100)}% of the sampled sitemap URLs.`,
      EXPECTED,
      found,
    );
  }
}
