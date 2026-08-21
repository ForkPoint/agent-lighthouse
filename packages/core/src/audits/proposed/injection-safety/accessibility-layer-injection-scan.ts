import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Accessibility-Layer Injection Scan".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/injection-safety/accessibility-layer-injection-scan.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Extract: all alt values; aria-label; text of aria-labelledby/aria-describedby targets;
// aria-description; title; placeholder; input[type=hidden] value; <option> text; <title>; <meta
// property=og:title|og:description>. Run the instruction lexicon from the Invisible Instruction
// Payload Scan over each => FAIL on any hit. FAIL when an input[type=hidden] value parses as a
// natural-language sentence (>=5 tokens containing a finite verb) rather than an identifier, token,
// nonce, or numeric id. WARN on alt or aria-label exceeding 250 characters — the canonical
// smuggling slot, since long alt is already an a11y anti-pattern. WARN when an interactive
// element's aria-label shares under 30% token overlap (Jaccard on lowercased alphanumeric tokens)
// with its own rendered text content, and FAIL when the two contain opposing action verbs
// (confirm/cancel, pay/back, delete/keep) — an agent selecting by accessible name will fire the
// wrong action. Also flag <a> whose href path or query contains lexicon hits (URL-text injection,
// as Anthropic describes).
export class AccessibilityLayerInjectionScanAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/injection-safety/accessibility-layer-injection-scan',
    category: 'injection-safety',
    title: "Accessibility-Layer Injection Scan",
    failureTitle: "Accessibility-Layer Injection Scan",
    description: "Audit the text that reaches an agent through the accessibility tree and non-visual attributes rather than through body copy: alt, aria-label, aria-labelledby targets, aria-description, title, placeholder, hidden input values, <option> labels, document title and og:* metadata. Flag instruction-shaped content, anomalously long values, and aria-label/visible-text divergence.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Computer-use and browser agents drive pages through the DOM and accessibility tree, not pixels, so a11y attributes enter the model context with the same weight as visible text while remaining invisible to a sighted human. Anthropic names the vector explicitly: 'hidden malicious form fields in a webpage's DOM invisible to humans, and other hard-to-catch injections such as through the URL text and tab title that only an agent might see.' The divergence sub-check is a defect in its own right independent of injection: an agent that clicks by accessible name will actuate an aria-label that contradicts the rendered label. Falsifier: if every a11y attribute is short, descriptive, and token-consistent with its element's visible text, this channel carries no payload.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/injection-safety/accessibility-layer-injection-scan.md',
      tags: ['proposed', 'injection-safety'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/injection-safety/accessibility-layer-injection-scan.md',
      'TODO stub',
    );
  }
}
