import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Data-URI and inline-SVG token bloat".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/token-economics/data-uri-and-inline-svg-token-bloat.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Regex the decoded body for /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+\/=]{200,}/ and for
// data: URIs inside style attributes and <style> blocks; tokenize each match at o200k_base. Parse
// the DOM and sum token counts of d/points attributes on svg descendants. Compare against total
// document tokens from the Signal Density check so the numbers reconcile across the report.
// Recommendation text should be agent-specific: move the asset to a real URL with descriptive alt
// text, since a URL plus alt costs ~15 tokens and conveys strictly more to a model than 4,000
// tokens of base64 ever will.
export class DataUriAndInlineSvgTokenBloatAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/token-economics/data-uri-and-inline-svg-token-bloat',
    category: 'token-economics',
    title: "Data-URI and inline-SVG token bloat",
    failureTitle: "Data-URI and inline-SVG token bloat",
    description: "Sum the tokens consumed by base64/data: URIs (img src, srcset, CSS url() in inline styles and inline <style>, <use href>, favicon links) and by inline SVG geometry (path d=, points=, and long transform/filter chains). Fail on any of: total data-URI tokens > 5% of document tokens, any single data URI > 1,000 tokens, or inline SVG path data > 2,000 tokens. Report the top offenders by token count with their source location.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Base64 and SVG path data are the most token-hostile byte sequences on the web: they are high-entropy ASCII with no lexical structure, so BPE compresses them barely at all — roughly one token per 2-3 characters, far worse than prose. A single 40 kB inlined logo can cost more tokens than an entire article. Two extraction vendors independently treat this as pure waste and delete it by default (removeBase64Images defaults to true; a header exists specifically to strip images 'to reduce token usage'), which proves the cost is real — but those defaults protect only agents that route through those vendors. A crawler using a plain HTTP client, or a generic HTML→markdown converter that passes img src through, ingests every byte. Falsifiable per page by tokenizing the matched substrings.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/token-economics/data-uri-and-inline-svg-token-bloat.md',
      tags: ['proposed', 'token-economics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/token-economics/data-uri-and-inline-svg-token-bloat.md',
      'TODO stub',
    );
  }
}
