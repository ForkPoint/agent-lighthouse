import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "trust.txt reciprocity and AI-policy coherence".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade C → informative tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/trust-provenance/trust-txt-reciprocity-and-ai-policy-coherence.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) GET /trust.txt and /.well-known/trust.txt (the .well-known location was added to the spec in
// Sept 2020); absence is INFO, never a penalty. 2) Parse name=value lines, one per line, '#'
// comments; validate names against the spec set (member, belongto, control, controlledby, vendor,
// customer, disclosure, contact, social, datatrainingallowed) and flag unknown attributes. 3)
// Reciprocity: for each belongto=<url>, fetch that domain's trust.txt and assert a member= entry
// pointing back at the audited domain; report each unreciprocated association. Do the same in
// reverse for control=/controlledby=. 4) AI-policy coherence: parse robots.txt user-agent groups
// for the major AI crawlers and compare against datatrainingallowed=yes/no; emit a WARN on
// contradiction in either direction. 5) social= verification uses a trust://<domain>! string that
// must appear on the linked social profile — that requires fetching third-party profiles and is
// explicitly deferred to a headless-browser roadmap item. 6) scoreable=false: surface as an
// informational trust-signals panel with the adoption caveat stated in the UI, so users are not
// pushed to implement a standard with no proven consumer.
export class TrustTxtReciprocityAndAiPolicyCoherenceAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/trust-provenance/trust-txt-reciprocity-and-ai-policy-coherence',
    category: 'trust-provenance',
    title: "trust.txt reciprocity and AI-policy coherence",
    failureTitle: "trust.txt reciprocity and AI-policy coherence",
    description: "ROADMAP / UNSCORED. Parses trust.txt for publishers who maintain one, validating attribute names, resolving the reciprocal member=/belongto= relationships across domains, and cross-checking the datatrainingallowed= declaration against what robots.txt actually tells AI crawlers. Reported as an informational trust signal, never scored.",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "trust.txt's association attributes are defined as reciprocal: belongto=<association> is only meaningful if that association's own trust.txt lists member=<this domain>. That reciprocity is mechanically checkable across two HTTP fetches, which makes the association claim falsifiable rather than self-asserted. Independently, datatrainingallowed= and robots.txt AI-bot directives express the same policy through two channels, so a site declaring datatrainingallowed=no while leaving GPTBot/ClaudeBot/PerplexityBot unrestricted in robots.txt is stating contradictory policy — the machine-readable channel that actually gates crawlers says the opposite of the human-facing declaration. HONEST LIMITATION: I found no evidence that any AI engine, answer engine or crawler consumes trust.txt, and the JournalList reference document itself publishes no adoption statistics and names no consumer. The mechanism is internally sound; the consumer does not demonstrably exist.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/trust-provenance/trust-txt-reciprocity-and-ai-policy-coherence.md',
      tags: ['proposed', 'trust-provenance'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/trust-provenance/trust-txt-reciprocity-and-ai-policy-coherence.md',
      'TODO stub',
    );
  }
}
