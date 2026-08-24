import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { isSafeUrl } from '../../fetcher';
import { parseHtml } from '../../parser';
import { sharedFeeds, type FeedDocument, type FeedEntry } from '../../gatherers/feeds';

/** Entries whose identity is checked. The newest twenty is what a consumer reads. */
const MAX_ENTRIES = 20;

/** Item URLs fetched to compare against their canonical. Each costs a request. */
const MAX_CANONICAL_CHECKS = 5;

/** Feeds audited per scan. */
const MAX_FEEDS = 2;

/** Tracking parameters that make a feed link differ from the canonical it points at. */
const TRACKING_PARAM = /^(utm_|ref$|ref_|fbclid$|gclid$|mc_cid$|mc_eid$)/i;

/** Media types that match what the document turned out to be. */
const EXPECTED_TYPE: Record<string, RegExp> = {
  atom: /^application\/atom\+xml/i,
  rss: /^application\/(rss\+xml|rdf\+xml)/i,
  json: /^application\/(feed\+json|json)/i,
};

/** A generic XML type: not wrong enough to fail, not the registered type either. */
const GENERIC_XML = /^(application|text)\/xml/i;

/** Does `text` carry a `<content>` that points elsewhere or holds non-text data? */
function needsSummary(entry: FeedEntry): boolean {
  if (entry.contentSrc !== '') return true;
  const type = entry.contentType.toLowerCase();
  if (type === '') return false;
  return !/^(text|html|xhtml)$/.test(type) && !/^text\//.test(type) && !/\+xml$/.test(type);
}

export class FeedEntryIdentityAndCanonicalIntegrityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/feed-entry-identity-and-canonical-integrity',
    category: 'machine-discovery',
    title: 'Feed entries have stable identities that resolve to their canonical pages',
    failureTitle: 'This site’s feed entries cannot be identified or point away from their canonical URLs',
    description:
      'Checks the identity half of a feed: that every entry carries exactly the id and timestamp its format requires, that no id repeats, and that item links are absolute HTTPS URLs which match the `rel="canonical"` of the page they open — no redirect, no tracking parameters the canonical does not carry.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier:
      'docs/evidence/audits/machine-discovery/feed-entry-identity-and-canonical-integrity.md',
    guidance: {
      impact:
        'A feed is how a consumer tracks what changed without re-crawling the site, and identity is what makes that possible: the id says "this is the same item you saw last time". An entry with no id, or with an id that repeats, forces the consumer to guess — usually by URL, which is exactly the thing that changes. A link that carries `utm_` parameters or redirects somewhere else creates a second address for one page, so the item the consumer stores is not the page the site considers canonical.',
      fix: 'Give every entry a stable id — an `atom:id` that never changes, or an RSS `<guid>` that is an absolute URL when `isPermaLink` is true — and never reuse one. Point item links at the canonical URL itself, with no tracking parameters and no redirect in between. Serve the feed as its registered media type, with no byte-order mark before the first element.',
      effort: 'complex',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/machine-discovery/feed-entry-identity-and-canonical-integrity/',
      tags: ['feeds', 'rss', 'atom', 'canonical'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const feeds = await sharedFeeds(ctx, { max: MAX_FEEDS });
    if (feeds.length === 0) {
      return this.notApplicable(
        'This site publishes no feed that fetched and parsed.',
        'An RSS, Atom or JSON feed with identifiable entries',
        'No feed found at an advertised or conventional URL',
      );
    }

    const failures: string[] = [];
    const warnings: string[] = [];
    let entriesChecked = 0;

    for (const feed of feeds) {
      const where = feed.url;
      const type = feed.contentType.split(';')[0]!.trim().toLowerCase();
      const expected = EXPECTED_TYPE[feed.declaredType];
      if (expected && !expected.test(type)) {
        if (GENERIC_XML.test(type)) {
          warnings.push(`${where}: served as "${type}" rather than the registered ${feed.declaredType} media type`);
        } else {
          failures.push(`${where}: served as "${type}", which is not a ${feed.declaredType} media type`);
        }
      }
      if (feed.bomOrLeadingSpace) {
        failures.push(`${where}: a byte-order mark or whitespace precedes the first element, which strict parsers reject`);
      }

      const entries = feed.entries.slice(0, MAX_ENTRIES);
      entriesChecked += entries.length;
      const ids = new Map<string, number>();

      for (const [index, entry] of entries.entries()) {
        const label = `${where} entry ${index + 1}${entry.title === '' ? '' : ` ("${entry.title.slice(0, 40)}")`}`;

        if (entry.id === '') {
          failures.push(
            `${label}: no ${feed.declaredType === 'atom' ? 'atom:id' : 'guid'}, so a consumer cannot tell it apart from a rewrite`,
          );
        } else {
          ids.set(entry.id, (ids.get(entry.id) ?? 0) + 1);
        }

        if (feed.declaredType === 'atom') {
          if (entry.idCount > 1) failures.push(`${label}: ${entry.idCount} atom:id elements; RFC 4287 allows exactly one`);
          if (entry.updatedCount !== 1) {
            failures.push(`${label}: ${entry.updatedCount} atom:updated elements; RFC 4287 requires exactly one`);
          }
          if (needsSummary(entry) && !entry.summaryPresent) {
            failures.push(
              `${label}: atom:content carries ${entry.contentSrc !== '' ? 'a src attribute' : `type="${entry.contentType}"`}, so RFC 4287 requires an atom:summary`,
            );
          }
        }

        if (feed.declaredType === 'rss' && entry.idIsPermalink) {
          let absolute = false;
          try {
            absolute = new URL(entry.id).protocol.startsWith('http');
          } catch {
            absolute = false;
          }
          if (!absolute) {
            failures.push(
              `${label}: guid "${entry.id}" is a permalink by default but is not an absolute URL; set isPermaLink="false" or use a URL`,
            );
          }
        }

        if (entry.link === '') {
          failures.push(`${label}: no item link`);
        } else if (!entry.link.startsWith('https://')) {
          failures.push(`${label}: item link ${entry.link} is not absolute HTTPS`);
        }
      }

      for (const [id, count] of ids) {
        if (count > 1) failures.push(`${where}: id "${id}" appears on ${count} entries`);
      }
    }

    // Canonical comparison, for the newest few items only: each one is a fetch.
    const canonicalChecks: string[] = [];
    const newest = feeds
      .flatMap((feed: FeedDocument) => feed.entries.map((entry) => ({ feed: feed.url, entry })))
      .filter((item) => item.entry.link !== '')
      .sort((a, b) => (b.entry.updated ?? 0) - (a.entry.updated ?? 0))
      .slice(0, MAX_CANONICAL_CHECKS);

    for (const item of newest) {
      const link = item.entry.link;
      if (!(await isSafeUrl(link))) continue;
      const result = await ctx.fetch({ url: link, followRedirects: true });
      if (result.status < 200 || result.status >= 300) {
        failures.push(`${link}: the feed links to a URL that answered HTTP ${result.status}`);
        continue;
      }
      if (result.finalUrl !== '' && result.finalUrl !== link) {
        failures.push(`${link}: redirects to ${result.finalUrl}, so the feed advertises a URL the site does not serve`);
      }
      const params = new URL(link).searchParams;
      const tracking = [...params.keys()].filter((key) => TRACKING_PARAM.test(key));
      const canonical = parseHtml(result.body)('link[rel~="canonical"]').first().attr('href') ?? '';
      const resolved = (() => {
        try {
          return canonical === '' ? '' : new URL(canonical, result.finalUrl || link).toString();
        } catch {
          return '';
        }
      })();
      // One entry, one finding. A canonical that disagrees already covers the
      // tracking parameters, so the tracking arm only fires when the page
      // declares no canonical at all to disagree with.
      if (resolved !== '' && resolved !== link) {
        const because = tracking.length > 0 ? ` (the link carries ${tracking.join(', ')})` : '';
        failures.push(`${link}: the page names ${resolved} as canonical${because}`);
      } else if (tracking.length > 0 && resolved === '') {
        failures.push(
          `${link}: carries ${tracking.join(', ')} and the page declares no canonical, so the feed is the only address for it`,
        );
      }
      canonicalChecks.push(`${link} -> canonical ${resolved || 'not declared'}`);
    }

    const displayValue = `${entriesChecked} entries, ${failures.length} problem(s)`;
    const expected =
      'Every entry carries the id and timestamp its format requires, no id repeats, and item links are absolute HTTPS URLs equal to the page’s canonical';
    const found = `${feeds.length} feed(s), ${entriesChecked} entries checked, ${canonicalChecks.length} item URL(s) compared against their canonical; ${failures.length} failure(s), ${warnings.length} warning(s).`;
    const details = {
      feeds: feeds.map((feed) => feed.url),
      entriesChecked,
      canonicalChecks,
      failures: failures.slice(0, 30),
      warnings: warnings.slice(0, 30),
    };

    if (failures.length > 0) {
      return {
        ...this.fail(
          `${failures.length} identity or canonical problem(s) across ${feeds.length} feed(s).`,
          expected,
          found,
          'Give every entry a stable, unique id, and link items at their canonical URL with no redirect and no tracking parameters.',
        ),
        displayValue,
        details,
      };
    }

    if (warnings.length > 0) {
      return {
        ...this.warn(
          `Entry identity is sound, but ${warnings.length} delivery problem(s) remain.`,
          expected,
          found,
          'Serve the feed as its registered media type.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `${entriesChecked} entries across ${feeds.length} feed(s) carry stable identities and canonical links.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
