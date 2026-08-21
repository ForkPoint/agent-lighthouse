import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Three-way freshness lag and orphaned fresh content".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/feeds-indexing/three-way-freshness-lag-and-orphaned-fresh-content.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) Build three sets: SITEMAP (all URLs from the sitemap tree, capped), FEED (all item links
// across discovered feeds), and SITE (URLs harvested from the homepage plus up to 5
// section/index/blog-listing pages, restricted to same-host, non-paginated, HTML content-type after
// HEAD). 2) Compute ORPHANS = SITE \ (SITEMAP ∪ FEED); FAIL when |ORPHANS| > 0 and any orphan's
// on-page datePublished is within the last 30 days — report those URLs explicitly. 3) Compute
// newest_on_page = max(datePublished/dateModified across sampled SITE pages), newest_sitemap =
// max(lastmod), newest_feed = max(item date). FAIL when newest_on_page - newest_sitemap > 7 days,
// or newest_on_page - newest_feed > 7 days. 4) Assert feed-level <lastBuildDate>/<updated> >=
// max(item date); FAIL otherwise (generator bug). 5) Assert item ordering is newest-first, since
// many consumers read only the head of the feed; WARN on unordered feeds. 6) Report the inverse set
// too: SITEMAP \ SITE URLs that return 404/410/noindex — advertised-but-dead entries that waste
// every crawler's budget. All date parsing normalizes to UTC and ignores timezone-less values
// rather than guessing.
export class ThreeWayFreshnessLagAndOrphanedFreshContentAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/feeds-indexing/three-way-freshness-lag-and-orphaned-fresh-content',
    category: 'feeds-indexing',
    title: "Three-way freshness lag and orphaned fresh content",
    failureTitle: "Three-way freshness lag and orphaned fresh content",
    description: "Compares the newest content the site actually shows against the newest entry in its sitemap and its feed, and reports content that exists on the site but appears in neither push/pull surface. Also catches generator-level staleness where the feed's own build timestamp trails its newest item.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "A discovery surface is only useful if it is fresher than organic rediscovery — the stated premise of IndexNow ('it can take days or even weeks for new URLs to be discovered'). Falsifiable claim: any URL reachable from the homepage or a section index that is listed in neither the sitemap nor any feed is discoverable only by link-following, so a pull-based AI crawler that fetches sitemap and feed on a schedule will never see it on that schedule. Second falsifiable claim: when <lastBuildDate>/<feed><updated> is older than the newest item's own pubDate/atom:updated, the generator is not updating its own freshness header, and conditional-poll consumers that key off it will skip the feed entirely. Third: when the newest sitemap lastmod trails the newest on-page dateModified by more than a week, the sitemap is regenerated on a cadence slower than publication.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/feeds-indexing/three-way-freshness-lag-and-orphaned-fresh-content.md',
      tags: ['proposed', 'feeds-indexing'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/feeds-indexing/three-way-freshness-lag-and-orphaned-fresh-content.md',
      'TODO stub',
    );
  }
}
