import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "WebSub hub advertisement and self-link correctness".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade C → informative tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/feeds-indexing/websub-hub-advertisement-and-self-link-correctness.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// For each discovered feed: (1) inspect HTTP Link response headers first (per the spec's precedence
// order) for rel=hub and rel=self; (2) fall back to <link rel="hub"> / <atom:link rel="self">
// elements inside the feed document, and for HTML pages accept them only within <head>. (3) Assert
// exactly one rel=self and that its href is absolute and, after normalization, equal to the URL the
// feed was fetched from (FAIL on relative hrefs, http-vs-https mismatch, or a self-link pointing at
// a different path). (4) Assert at least one rel=hub with an absolute HTTPS href; HEAD the hub URL
// and accept 2xx/400/405 as alive, FAIL on DNS failure, connection refused, or 5xx. (5) When no hub
// is declared, emit INFO with a remediation pointing at hosted hubs, never a FAIL. Report as an
// advisory badge outside the scored total until an AI-side subscriber is documented.
export class WebsubHubAdvertisementAndSelfLinkCorrectnessAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/feeds-indexing/websub-hub-advertisement-and-self-link-correctness',
    category: 'feeds-indexing',
    title: "WebSub hub advertisement and self-link correctness",
    failureTitle: "WebSub hub advertisement and self-link correctness",
    description: "Checks whether feeds advertise a push hub per the WebSub Recommendation, and — more importantly — whether the mandatory rel=self link is present, absolute, and equal to the URL the feed was actually fetched from, since a wrong self-link breaks hub verification even when a hub is configured.",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "WebSub is a W3C Recommendation requiring publishers to advertise at least one rel=hub and exactly one rel=self via Link headers or embedded link elements, with Link headers taking discovery precedence. Falsifiable claim: a feed declaring a hub but carrying a missing, relative, or non-canonical rel=self cannot complete hub subscription verification, so the push path silently degrades to whatever polling cadence subscribers happen to use — the failure is invisible to the publisher because the hub appears configured. This check is scored as advisory only: the WebSub conformance assertion is exact and standards-backed, but no AI answer engine is documented as a WebSub subscriber, so the consumer-side benefit is a plausible convention rather than documented behaviour.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/feeds-indexing/websub-hub-advertisement-and-self-link-correctness.md',
      tags: ['proposed', 'feeds-indexing'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/feeds-indexing/websub-hub-advertisement-and-self-link-correctness.md',
      'TODO stub',
    );
  }
}
