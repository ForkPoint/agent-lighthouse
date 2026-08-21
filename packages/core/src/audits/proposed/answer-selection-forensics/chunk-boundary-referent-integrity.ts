import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Chunk-Boundary Referent Integrity".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/answer-selection-forensics/chunk-boundary-referent-integrity.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static fetch of HTML. 1) Isolate main content (<main>/<article>, else Readability). 2) Segment:
// walk h2/h3; chunk_i = heading_i plus all nodes until the next heading of level <= level_i. 3)
// Build entity set E from h1 text, og:title, and JSON-LD name/headline, plus derived aliases
// (longest shared noun phrase, acronym form, first token). 4) Per chunk compute three deterministic
// flags: (a) anaphoraOpen — first sentence matches
// /^(This|That|These|Those|It|They|He|She|Such|Here|There|Both|Either)\b/ AND the demonstrative is
// not followed within 3 tokens by a content word that also appears in heading_i; (b) entityAbsent —
// chunk body >= 40 words and no member of E appears (case-insensitive, light stemming); (c)
// positionalRefs — count matches of /\b(as (mentioned|described|noted|shown)
// (above|below|earlier|previously)|see (above|below|the previous|the next)|the
// (table|figure|image|list|section|chart) (above|below)|in the previous section|as we saw|click
// here|read more here|the former|the latter)\b/gi. 5) Chunk passes if all three are clean. Score =
// passing chunks / total chunks; audit fails below 0.8. 6) Report the failing heading, the flag,
// and the offending sentence verbatim so the fix is a one-line edit.
export class ChunkBoundaryReferentIntegrityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/answer-selection-forensics/chunk-boundary-referent-integrity',
    category: 'answer-selection-forensics',
    title: "Chunk-Boundary Referent Integrity",
    failureTitle: "Chunk-Boundary Referent Integrity",
    description: "Splits the page the way a real RAG pipeline does (at h2/h3) and measures, per resulting chunk, whether the chunk still makes sense alone: does it open with a dangling anaphor, does it ever name the entity it is about, and does it contain positional cross-references that become nonsense once the surrounding page is gone. Emits a per-section pass/fail list with the exact offending sentence, not a page-level vibe score.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Retrieval systems embed and retrieve chunks, not pages. A chunk whose subject is only recoverable from a preceding chunk has an embedding that does not encode the entity, so it fails to match entity-bearing queries, and if retrieved it is unciteable because the generator cannot attribute the claim. Anthropic measured this exact failure and showed that injecting the missing context cut retrieval failure rate by 35-49% (S1). Falsifiable prediction: for two pages with identical facts, the one whose h2 sections each re-state the primary entity and avoid chunk-initial anaphora will be retrieved for entity+attribute queries at a strictly higher rate; the other's tail sections will be retrieved only for generic queries.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/answer-selection-forensics/chunk-boundary-referent-integrity.md',
      tags: ['proposed', 'answer-selection-forensics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/answer-selection-forensics/chunk-boundary-referent-integrity.md',
      'TODO stub',
    );
  }
}
