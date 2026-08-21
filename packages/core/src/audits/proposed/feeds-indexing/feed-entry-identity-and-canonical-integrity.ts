import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Feed entry identity and canonical integrity".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/feeds-indexing/feed-entry-identity-and-canonical-integrity.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) Autodiscover feeds via <link rel="alternate"
// type="application/rss+xml|application/atom+xml|application/feed+json"> on the homepage and one
// article page, plus conventional paths /feed, /rss.xml, /atom.xml, /index.xml (gated on the
// root-text-file integrity flag). 2) Assert Content-Type matches the declared type and the body
// parses as XML/JSON without a BOM or leading whitespace. 3) Per entry, for the 20 newest: Atom —
// exactly one atom:id, exactly one atom:updated, and atom:summary present whenever atom:content has
// a src attribute or non-text/non-XML type (RFC 4287 MUST); RSS — a <guid>, and if isPermaLink is
// absent or 'true' the guid must be an absolute resolvable URL. 4) Assert ids are unique within the
// feed (FAIL on any duplicate) and that item link hrefs are absolute HTTPS. 5) Fetch the 5 newest
// item URLs; compare each item link, after stripping nothing, to the target page's <link
// rel="canonical"> and to the final URL after redirects. FAIL when the feed link differs from
// canonical, or 3xx-redirects, or carries utm_*/ref/fbclid parameters absent from canonical. 6)
// Re-fetch the feed once at the end of the audit run and assert ids for unchanged entries are
// byte-identical (catches per-build id regeneration within a single session only when a deploy
// intervenes; otherwise report as advisory). 7) ADVISORY sub-signal (not scored): median ratio of
// content:encoded/atom:content length to the target page's extracted main-content length; flag
// <0.25 as a stub feed, and escalate to a finding only when the target page's main content is
// absent from the raw HTML (JS-rendered), because then the stub feed is the only text an agent can
// get and it is insufficient.
export class FeedEntryIdentityAndCanonicalIntegrityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/feeds-indexing/feed-entry-identity-and-canonical-integrity',
    category: 'feeds-indexing',
    title: "Feed entry identity and canonical integrity",
    failureTitle: "Feed entry identity and canonical integrity",
    description: "Validates that RSS/Atom entries carry stable, unique identifiers and that the URL each entry points at is the same URL the target page declares canonical — so an agent that cites a feed item cites a resolvable, non-deduplicated address.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "RFC 4287 makes atom:id mandatory, exactly one per entry, 'permanent, universally unique' and unchanging 'across different instantiations of the entry'; atom:updated is likewise mandatory and must mark the last significant modification. Ingestion pipelines dedupe and diff on these values. Falsifiable claim: when ids are unstable (regenerated per build, or derived from a URL that includes tracking parameters), every poll re-emits the whole feed as new, and consumers either re-ingest duplicates or rate-limit the feed away; and when an entry's <link>/atom:link href differs from the target page's rel=canonical, an agent quoting the feed cites a URL that redirects or is consolidated away, breaking attribution. Both are directly measurable without knowing anything about the consumer.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/feeds-indexing/feed-entry-identity-and-canonical-integrity.md',
      tags: ['proposed', 'feeds-indexing'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/feeds-indexing/feed-entry-identity-and-canonical-integrity.md',
      'TODO stub',
    );
  }
}
