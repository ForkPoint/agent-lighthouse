import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Conditional-request support on discovery surfaces".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/feeds-indexing/conditional-request-support-on-discovery-surfaces.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// For each of /robots.txt, every Sitemap: target, each child sitemap (cap 3), and each discovered
// feed: (1) GET and record ETag, Last-Modified, Content-Length, Content-Encoding, Cache-Control,
// and a SHA-256 of the decoded body. (2) Immediately GET again with identical Accept-Encoding and
// assert the body hash is unchanged; if it is unchanged but the ETag differs, FAIL as 'unstable
// validator' and report both ETag values. (3) Issue a third GET with If-None-Match set to the first
// ETag (when present) and assert 304 with an empty body; FAIL on 200. (4) Issue a fourth GET with
// If-Modified-Since set to the Last-Modified value (when present) and assert 304; FAIL on 200. (5)
// When neither validator is emitted at all, FAIL as 'no revalidation possible' and report the
// uncompressed byte size that every poll therefore costs. (6) WARN when Cache-Control includes
// no-store or private on a public discovery surface, and when a sitemap exceeds 50MB uncompressed
// or 50,000 URLs (hard spec limits that also make the missing-validator cost concrete). (7) Report
// per-surface: validators_present, honours_inm, honours_ims, validator_stable, bytes_per_poll. Note
// in the finding text that the 304 semantics are documented for Googlebot and generalized here by
// analogy — the check itself is a pure HTTP conformance assertion and does not depend on that
// generalization.
export class ConditionalRequestSupportOnDiscoverySurfacesAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/feeds-indexing/conditional-request-support-on-discovery-surfaces',
    category: 'feeds-indexing',
    title: "Conditional-request support on discovery surfaces",
    failureTitle: "Conditional-request support on discovery surfaces",
    description: "Verifies that sitemaps and feeds — the two resources AI crawlers poll far more often than they fetch pages — emit stable revalidation validators and honour If-None-Match / If-Modified-Since with a 304, instead of shipping a full body on every poll.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Google documents that on a 304 'Google crawlers signal the next processing system that the content is the same as last time it was crawled', i.e. 304 is the supported mechanism for cheap freshness polling. Falsifiable claim: a sitemap or feed that emits no ETag and no Last-Modified, or that returns 200 with a full body in response to a correctly-formed conditional request, forces every polling agent to download the entire resource on every cycle; at 50,000-URL sitemap scale that is tens of megabytes per poll per agent, and repeated full transfers are what push origins into the 429/503 responses that Google explicitly documents as crawl-rate-reducing. A second, independently testable pathology: an ETag that differs between two byte-identical responses (commonly injected by a gzip/Brotli layer or a per-request CDN node id) makes revalidation permanently fail, producing the same full-transfer behaviour while appearing to be configured correctly.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/feeds-indexing/conditional-request-support-on-discovery-surfaces.md',
      tags: ['proposed', 'feeds-indexing'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/feeds-indexing/conditional-request-support-on-discovery-surfaces.md',
      'TODO stub',
    );
  }
}
