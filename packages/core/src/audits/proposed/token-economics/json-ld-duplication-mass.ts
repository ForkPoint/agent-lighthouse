import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "JSON-LD duplication mass".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade C → informative tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/token-economics/json-ld-duplication-mass.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Collect all <script type="application/ld+json">, tokenize each raw block at o200k_base. Parse
// each; walk to collect (@type, @id) pairs and hash canonicalized JSON of each node to find
// cross-block duplicates. For body duplication, take string-valued properties over ~500 chars
// (articleBody, text, description, acceptedAnswer.text, reviewBody), strip HTML entities, 5-gram
// shingle, and intersect with main-content shingles. Present as 'X tokens of your Y-token page are
// structured data; Z of those repeat text already in the DOM'.
export class JsonLdDuplicationMassAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/token-economics/json-ld-duplication-mass',
    category: 'token-economics',
    title: "JSON-LD duplication mass",
    failureTitle: "JSON-LD duplication mass",
    description: "Measure the token cost of structured data and how much of it is a verbatim second copy of content already in the DOM. Report three numbers: JSON-LD token share of the document; body-duplication ratio (fraction of main-content shingles that also appear inside ld+json, driven mostly by articleBody / description / FAQPage acceptedAnswer); and redundant-graph count (the same @type+@id entity emitted by multiple script blocks, the classic WordPress plugin-stack signature). Flags at > 20% token share, > 0.8 body duplication, or ≥ 2 identical entity graphs. Report-only — never scored, and never phrased as 'remove your schema'.",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "Structured data must mirror visible page content by policy, so some duplication is mandatory and correct. The defect is unbounded duplication: articleBody is a defined Text property in use on 1M-10M domains that, when populated with a full article, ships the entire body a second time inside a script tag, and plugin stacks routinely emit the same Organization/WebSite graph three times. A non-rendering agent tokenizes all of it. The cost claim is arithmetic and verifiable; what stops this from being scoreable is that no vendor documents a consumer that penalizes it, and the correct remediation (drop articleBody, dedupe graphs into one @graph, keep every required property) is a judgement call rather than a rule.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/token-economics/json-ld-duplication-mass.md',
      tags: ['proposed', 'token-economics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/token-economics/json-ld-duplication-mass.md',
      'TODO stub',
    );
  }
}
