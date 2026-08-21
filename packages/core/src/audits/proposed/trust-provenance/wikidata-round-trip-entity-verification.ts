import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Wikidata round-trip entity verification".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/trust-provenance/wikidata-round-trip-entity-verification.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) Parse all JSON-LD blocks including @graph, collect Organization/Person/NewsMediaOrganization
// nodes and their sameAs values. 2) Filter to authority hosts: wikidata.org, *.wikipedia.org,
// gleif.org, LinkedIn company pages, GitHub orgs. 3) Wikidata: extract the Q-id from /wiki/Q\d+ or
// /entity/Q\d+, then GET
// https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=<Qid>&property=P856&format=json and
// read claims.P856[*].mainsnak.datavalue.value — use the per-property endpoint, not
// Special:EntityData, whose full export is enormous for popular entities. 4) Respect statement
// rank: prefer 'preferred', ignore 'deprecated'. 5) Compare using the Public Suffix List
// registrable domain, NOT string equality — Q95 (Google) resolves to https://about.google/, so also
// accept a configured alias set and treat a same-organization-different-TLD result as WARN rather
// than FAIL. 6) Wikipedia sameAs: resolve the article to its Q-id via the Wikipedia API sitelinks,
// then run the same round trip. 7) Verdicts: PASS = P856 registrable domain matches; WARN = entity
// exists but has no P856 (unverifiable); FAIL = P856 points at a different organization's domain.
// Cache per Q-id for 30 days.
export class WikidataRoundTripEntityVerificationAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/trust-provenance/wikidata-round-trip-entity-verification',
    category: 'trust-provenance',
    title: "Wikidata round-trip entity verification",
    failureTitle: "Wikidata round-trip entity verification",
    description: "Turns the self-asserted sameAs array into a two-way, machine-verifiable identity proof. Extracts the Wikidata Q-id a site claims in its Organization/Person JSON-LD, then asks Wikidata whether that entity points back at this domain via P856 (official website). One-way claims are unverifiable by construction; only the round trip is evidence.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "schema.org sameAs is a self-asserted outbound link — Google documents it purely as 'a URL of a page on another website with additional information about your organization', with no reciprocity requirement, so any site can claim any entity. A knowledge-graph consumer that grounds a brand to an entity needs corroboration from the authority side. Wikidata exposes exactly that corroboration for free via P856. FALSIFIABLE: for each claimed Q-id, fetch P856 and compare registrable domains; a claim whose authority record points to an unrelated registrable domain is either the wrong entity or an unbacked identity claim. The check would be wrong if Wikidata P856 were absent or unreliable for the general population of notable organizations.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/trust-provenance/wikidata-round-trip-entity-verification.md',
      tags: ['proposed', 'trust-provenance'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/trust-provenance/wikidata-round-trip-entity-verification.md',
      'TODO stub',
    );
  }
}
