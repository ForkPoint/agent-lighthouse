import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { isSafeUrl } from '../../fetcher';
import { allJsonLdNodes } from '../../parser';
import { siteSitemapTree, isW3CDateTime, sampleEntries } from '../../gatherers/sitemap';
import { sharedFeeds, parseFeedDate, type FeedDocument } from '../../gatherers/feeds';

/** How far a surface may trail the page before it is a lag rather than a delay. */
const LAG_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Sitemap URLs checked for being advertised but dead. Each is a request. */
const DEAD_URL_SAMPLE = 5;

/** Feeds read. The same cap the other Wave C feed audits use. */
const MAX_FEEDS = 2;

/** Meta names that carry a modification time. */
const META_KEYS = ['article:modified_time', 'article:published_time', 'og:updated_time', 'date'];

/** A page that declares itself noindex is advertised but not indexable. */
const NOINDEX = /<meta[^>]+name=["']?robots["']?[^>]+content=["'][^"']*noindex/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Every modification time a page publishes, in UTC.
 *
 * `parseFeedDate` rather than `Date.parse`: a timestamp carrying no timezone
 * is dropped rather than read in the scanner's own offset, because a lag
 * measured in days must not be manufactured by a guess about hours.
 */
function pageTimes(page: PageContext): number[] {
  const out: number[] = [];
  const add = (value: unknown) => {
    if (typeof value !== 'string') return;
    const time = parseFeedDate(value);
    if (time !== undefined) out.push(time);
  };

  add(page.fetchResult.headers['last-modified']);
  for (const node of allJsonLdNodes(page.jsonLd)) {
    if (!isObject(node)) continue;
    add(node['dateModified']);
    add(node['datePublished']);
  }
  for (const key of META_KEYS) add(page.meta[key]);
  return out;
}

/** The largest of `values`, or undefined when there is none. */
function newest(values: number[]): number | undefined {
  return values.length === 0 ? undefined : Math.max(...values);
}

/** Whole days between two instants, rounded down. */
function lagDays(later: number, earlier: number): number {
  return Math.floor((later - earlier) / DAY_MS);
}

/** An ISO day, for a finding a human has to read. */
function day(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export class ThreeWayFreshnessLagAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/three-way-freshness-lag',
    category: 'machine-discovery',
    title: 'The sitemap and the feed are as fresh as the site itself',
    failureTitle: 'This site’s sitemap or feed trails what the site actually publishes',
    description:
      'Compares the newest date the pages themselves publish against the newest `<lastmod>` in the sitemap and the newest entry in the feed. A surface that trails the site by more than a week is regenerated on a slower cadence than publication, so a crawler polling it sees a site that stopped publishing. Also checks that a feed’s own build timestamp is not older than its newest item, and that its items are in newest-first order.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/machine-discovery/three-way-freshness-lag.md',
    guidance: {
      impact:
        'A pull-based crawler fetches the sitemap and the feed on a schedule and reads nothing else. When those two surfaces trail the site, everything published in between is discoverable only by link-following, which is the slow path the site published a sitemap to avoid. A feed whose `lastBuildDate` is older than its own newest item is worse than stale: consumers that poll conditionally on that timestamp skip the feed entirely, so the new items are never read at all.',
      fix: 'Regenerate the sitemap and the feed when content changes, not on a nightly cron that can fail silently. Stamp `<lastBuildDate>` (or the Atom feed-level `<updated>`) from the newest item at generation time. Order feed items newest-first, since many consumers read only the head. Remove sitemap entries whose URLs 404 or are noindex.',
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/machine-discovery/three-way-freshness-lag/',
      tags: ['freshness', 'sitemap', 'feeds', 'discovery'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const tree = await siteSitemapTree(ctx);
    const feeds = await sharedFeeds(ctx, { max: MAX_FEEDS });

    const newestOnPage = newest(ctx.pages.flatMap((page) => pageTimes(page)));
    const newestSitemap = newest(
      tree.entries
        .map((entry) => entry.lastmod ?? '')
        .filter((value) => value !== '' && isW3CDateTime(value))
        .map((value) => parseFeedDate(value))
        .filter((time): time is number => time !== undefined),
    );
    const newestFeed = newest(
      feeds.flatMap((feed) => feed.entries.map((entry) => entry.updated)).filter((time): time is number => time !== undefined),
    );

    const surfaces = [newestOnPage, newestSitemap, newestFeed].filter((time) => time !== undefined);
    if (surfaces.length < 2) {
      return this.notApplicable(
        'Fewer than two of the three surfaces publish a date, and one date cannot lag another.',
        'A dated page, sitemap or feed on at least two of the three surfaces',
        `Pages: ${newestOnPage === undefined ? 'no date' : day(newestOnPage)}; sitemap: ${newestSitemap === undefined ? 'no lastmod' : day(newestSitemap)}; feed: ${newestFeed === undefined ? 'no dated entry' : day(newestFeed)}.`,
      );
    }

    const failures: string[] = [];
    const warnings: string[] = [];

    if (newestOnPage !== undefined && newestSitemap !== undefined) {
      const lag = lagDays(newestOnPage, newestSitemap);
      if (lag > LAG_DAYS) {
        failures.push(
          `The sitemap's newest lastmod is ${day(newestSitemap)}, ${lag} days behind the newest page date ${day(newestOnPage)}`,
        );
      }
    }
    if (newestOnPage !== undefined && newestFeed !== undefined) {
      const lag = lagDays(newestOnPage, newestFeed);
      if (lag > LAG_DAYS) {
        failures.push(
          `The feed's newest entry is ${day(newestFeed)}, ${lag} days behind the newest page date ${day(newestOnPage)}`,
        );
      }
    }

    for (const feed of feeds) {
      const items = feed.entries.map((entry) => entry.updated).filter((time): time is number => time !== undefined);
      const newestItem = newest(items);
      if (newestItem !== undefined && feed.lastBuild !== undefined && feed.lastBuild < newestItem) {
        failures.push(
          `${feed.url}: the feed's own build timestamp is ${day(feed.lastBuild)} while its newest item is ${day(newestItem)}, so a consumer polling on that timestamp skips the new items`,
        );
      }
      if (items.length > 1 && !isNewestFirst(feed)) {
        warnings.push(`${feed.url}: items are not in newest-first order, and many consumers read only the head`);
      }
    }

    // Advertised-but-dead sitemap entries. Sampled, because each one is a request.
    const dead: string[] = [];
    const sample = sampleEntries(tree.entries, DEAD_URL_SAMPLE);
    for (const entry of sample) {
      if (!(await isSafeUrl(entry.loc))) continue;
      const result = await ctx.fetch({ url: entry.loc, followRedirects: true });
      if (result.status === 404 || result.status === 410) {
        dead.push(`${entry.loc} (HTTP ${result.status})`);
      } else if (result.status === 200 && NOINDEX.test(result.body)) {
        dead.push(`${entry.loc} (noindex)`);
      }
    }
    if (dead.length > 0) {
      warnings.push(
        `${dead.length} of ${sample.length} sampled sitemap URLs are advertised but dead: ${dead.slice(0, 3).join(', ')}`,
      );
    }

    const details = {
      newestOnPage: newestOnPage === undefined ? '' : day(newestOnPage),
      newestSitemap: newestSitemap === undefined ? '' : day(newestSitemap),
      newestFeed: newestFeed === undefined ? '' : day(newestFeed),
      sitemapLagDays:
        newestOnPage !== undefined && newestSitemap !== undefined ? lagDays(newestOnPage, newestSitemap) : 0,
      feedLagDays: newestOnPage !== undefined && newestFeed !== undefined ? lagDays(newestOnPage, newestFeed) : 0,
      deadSitemapUrls: dead.slice(0, 20),
      failures: failures.slice(0, 20),
      warnings: warnings.slice(0, 20),
    };
    const expected = `No discovery surface more than ${LAG_DAYS} days behind the newest page date, and a feed whose build timestamp is at least as new as its newest item`;
    const found = `Newest page date ${newestOnPage === undefined ? 'none' : day(newestOnPage)}; newest sitemap lastmod ${newestSitemap === undefined ? 'none' : day(newestSitemap)}; newest feed entry ${newestFeed === undefined ? 'none' : day(newestFeed)}.`;
    const displayValue = `${Math.max(details.sitemapLagDays, details.feedLagDays)} days behind`;

    if (failures.length > 0) {
      return {
        ...this.fail(
          failures[0]!,
          expected,
          found,
          'Regenerate the sitemap and the feed when content changes, and stamp the feed build timestamp from its newest item.',
        ),
        displayValue,
        details,
      };
    }

    if (warnings.length > 0) {
      return {
        ...this.warn(
          warnings[0]!,
          expected,
          found,
          'Order feed items newest-first and drop sitemap entries whose URLs no longer resolve.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        'The sitemap and the feed are as fresh as the pages themselves.',
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}

/** Are the feed's dated items in newest-first order, as published? */
function isNewestFirst(feed: FeedDocument): boolean {
  const times = feed.entries.map((entry) => entry.updated).filter((time): time is number => time !== undefined);
  for (let i = 1; i < times.length; i += 1) {
    if (times[i]! > times[i - 1]!) return false;
  }
  return true;
}
