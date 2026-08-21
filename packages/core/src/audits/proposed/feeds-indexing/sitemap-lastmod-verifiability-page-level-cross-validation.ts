import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Sitemap lastmod verifiability (page-level cross-validation)".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/feeds-indexing/sitemap-lastmod-verifiability-page-level-cross-validation.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) Fetch robots.txt Sitemap: directives plus /sitemap.xml, /sitemap_index.xml; recurse
// <sitemapindex> one level. 2) Validate each lastmod parses as W3C Datetime (YYYY-MM-DD or full
// RFC3339); count malformed. 3) Reservoir-sample 30-50 URLs across all child sitemaps. 4) For each:
// GET, capture the Last-Modified response header; parse all JSON-LD blocks for
// dateModified/datePublished; parse <meta property="article:modified_time"> and <meta
// name="last-modified">. 5) Per URL compute min absolute delta between sitemap lastmod and any
// available page signal. 6) Report: %future-dated (FAIL if >0), %malformed, distribution entropy of
// lastmod values (FAIL if the modal value covers >90% of sampled URLs AND that value is within 3
// days of the crawl date), and %URLs whose delta exceeds 7 days against every available signal
// (FAIL if >20%). 7) Report separately the %URLs with no page-level signal at all — that is an
// actionable sub-finding (add dateModified to JSON-LD) rather than a lastmod failure.
export class SitemapLastmodVerifiabilityPageLevelCrossValidationAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/feeds-indexing/sitemap-lastmod-verifiability-page-level-cross-validation',
    category: 'feeds-indexing',
    title: "Sitemap lastmod verifiability (page-level cross-validation)",
    failureTitle: "Sitemap lastmod verifiability (page-level cross-validation)",
    description: "Cross-validates every sampled sitemap <lastmod> against three independent page-level modification signals and scores agreement, rather than merely reporting that lastmod exists. Detects the two dominant failure modes: build-stamped lastmod (every URL updated on every deploy) and frozen lastmod (CMS never updates it).",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Google states it uses <lastmod> 'if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate' — i.e. lastmod is a conditional signal that engines silently discard on divergence, and lastmod is the only freshness hint a pull-based AI crawler gets from a sitemap. Falsifiable claim: if sampled lastmod values disagree with all available page-level evidence (HTTP Last-Modified, JSON-LD dateModified, article:modified_time) for a material fraction of URLs, the sitemap's freshness channel is inert and re-crawl scheduling degrades to organic rediscovery. Two specific detectable pathologies: (a) >90% of URLs share one identical lastmod equal to the last deploy date — a build stamp, not a content date, which per Google's 'copyright date is not significant' rule is exactly the disqualifying pattern; (b) lastmod in the future relative to crawl time — always invalid.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/feeds-indexing/sitemap-lastmod-verifiability-page-level-cross-validation.md',
      tags: ['proposed', 'feeds-indexing'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/feeds-indexing/sitemap-lastmod-verifiability-page-level-cross-validation.md',
      'TODO stub',
    );
  }
}
