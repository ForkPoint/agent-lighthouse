import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Organization identifier resolves in the authoritative registry".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/trust-provenance/organization-identifier-resolves-in-the-authoritative-regist.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) Locate the Organization node (Google recommends home page or a single about-us page — check
// both). 2) Read leiCode and iso6523Code. Encoding check: iso6523Code must match /^\d{4}:/; if
// leiCode is present without an iso6523Code '0199:<LEI>' twin, emit an ADVISORY citing Google's
// documented preference; same for duns vs '0060:'. 3) Syntactic pre-filter on the LEI:
// /^[A-Z0-9]{18}[0-9]{2}$/ plus the ISO/IEC 7064 MOD 97-10 check digit — treat this only as a cheap
// local filter, since GLEIF publishes no algorithm detail on its intro page. 4) Authoritative
// lookup, no API key required: GET https://api.gleif.org/api/v1/lei-records?filter[lei]=<LEI>. 5)
// Assert exactly one record; attributes.entity.status === 'ACTIVE'; attributes.registration.status
// === 'ISSUED' (WARN on LAPSED/RETIRED/ANNULLED — a lapsed LEI signals an organization that stopped
// maintaining its registration). 6) Name agreement: normalize case, punctuation and legal suffixes
// (Inc/Ltd/GmbH/L.P.), then compare attributes.entity.legalName.name against schema legalName,
// falling back to name; below a similarity threshold emit FAIL. 7) Optionally surface
// registration.corroborationLevel and nextRenewalDate as trust context. Cache per LEI for 30 days.
export class OrganizationIdentifierResolvesInTheAuthoritativeRegistAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/trust-provenance/organization-identifier-resolves-in-the-authoritative-regist',
    category: 'trust-provenance',
    title: "Organization identifier resolves in the authoritative registry",
    failureTitle: "Organization identifier resolves in the authoritative registry",
    description: "Validates the machine-verifiable legal identity of the publishing organization end to end: correct modern encoding of the identifier, live resolution against GLEIF's public registry, active registration status, and agreement between the registered legal name and the name in the markup. This is the identity signal that matters for shopping and payment agents transacting with an unfamiliar merchant.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "leiCode / iso6523Code 0199: is the only organization identifier in schema.org backed by a free, authoritative, queryable registry, so it is the only one whose truth an auditor can independently establish. Google separately documents a specific encoding preference: it 'encourage[s] using the iso6523Code field with prefix 0199: instead' of leiCode, and 0060: instead of duns. FALSIFIABLE on three axes: (a) the identifier is syntactically invalid, (b) GLEIF returns no record or a non-ISSUED registration, (c) GLEIF's registered legalName disagrees with the schema.org name/legalName. Each is a hard pass/fail against an external authority, not an opinion.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/trust-provenance/organization-identifier-resolves-in-the-authoritative-regist.md',
      tags: ['proposed', 'trust-provenance'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/trust-provenance/organization-identifier-resolves-in-the-authoritative-regist.md',
      'TODO stub',
    );
  }
}
