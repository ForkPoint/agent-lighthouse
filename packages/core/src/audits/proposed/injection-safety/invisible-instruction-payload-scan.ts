import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Invisible Instruction Payload Scan".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/injection-safety/invisible-instruction-payload-scan.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Parse HTML into a DOM. Fetch same-origin <link rel=stylesheet> sheets and build a flat
// selector->declaration map for simple class/id/tag selectors (skip combinators; accept the
// fidelity loss at this tier). For each text node resolve effective color and nearest literal
// ancestor background-color; flag ΔE(CIE76, sRGB) < 5. Flag inline or resolved style matching
// /font-size:\s*0/, /opacity:\s*0(\.0+)?[^0-9]/, /(left|top):\s*-\d{3,}px/,
// /text-indent:\s*-\d{3,}px/, /clip(-path)?:\s*(rect\(0)|inset\(50%\)/, visibility:hidden,
// display:none, the `hidden` attribute, and aria-hidden="true" wrapping non-trivial text. Score
// each hidden node against an instruction lexicon:
// /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
// /\byou are (an?\s+)?(AI|assistant|language model|agent|chatbot)\b/i,
// /^\s*(system|assistant|user|human)\s*:/im,
// /\b(when|if)\s+(you\s+are\s+)?(asked|summari[sz]ing|responding|answering)\b/i,
// /\b(always|never|you must|do not)\s+(recommend|mention|include|say|output|reply|cite)\b/i,
// /<\/?(system|instructions?|prompt)>/i,
// /\b(send|post|forward|exfiltrat\w*)\b.{0,40}\b(email|otp|token|cookie|api[_ -]?key|password)\b/i.
// FAIL on any hidden node with >=1 lexicon hit; WARN on hidden text >200 chars with zero hits
// (unexplained payload). Allowlist the sr-only/visually-hidden clip idiom under 120 chars with no
// lexicon hit, skip-links, and aria-live regions. Report the decoded hidden string verbatim in the
// audit output. Headless-browser tier upgrades this to real computed styles plus JS-inserted nodes
// and post-hydration DOM.
export class InvisibleInstructionPayloadScanAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/injection-safety/invisible-instruction-payload-scan',
    category: 'injection-safety',
    title: "Invisible Instruction Payload Scan",
    failureTitle: "Invisible Instruction Payload Scan",
    description: "Detect text that is present in the byte stream or DOM but not perceivable by a human, and that reads like an instruction addressed to an AI. Covers CSS-hidden text (color ≈ background, font-size:0, opacity:0, off-screen absolute positioning, zero-size + overflow:hidden, visibility:hidden, display:none), plus channels that never render at all: HTML comments, <noscript>, <template>, oversized data-* attribute values, <script type=\"text/plain\">/application/json blobs, non-standard <meta name> content, and inline <svg><text> with fill-opacity:0 or display:none.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "If a page carries text nodes that a sighted human cannot perceive but that survive DOM-to-text serialization, an LLM browsing agent ingests them with the same weight as body copy and can act on them. Brave demonstrated exactly this against Comet (white-on-white text, HTML comments, invisible elements hidden in a Reddit spoiler tag) and confirmed Opera Neon was exploitable through 'hidden HTML elements and other non-rendered markup'. Falsifier: an agent that ingests only visually perceivable, rendered text would be immune — the disclosed incidents show current agents are not. Google's spam policy independently enumerates the same hiding techniques and their legitimate exceptions, giving the detector a canonical technique list and a false-positive allowlist.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/injection-safety/invisible-instruction-payload-scan.md',
      tags: ['proposed', 'injection-safety'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/injection-safety/invisible-instruction-payload-scan.md',
      'TODO stub',
    );
  }
}
