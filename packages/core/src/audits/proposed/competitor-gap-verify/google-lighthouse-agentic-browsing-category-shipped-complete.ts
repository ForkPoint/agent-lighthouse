import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Google Lighthouse — Agentic Browsing category (SHIPPED, complete list)".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → informative tier. Implementation difficulty: headless-browser.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/competitor-gap-verify/google-lighthouse-agentic-browsing-category-shipped-complete.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Replication requires a headless Chrome with the WebMCP flag for 3 of 6 audits; the llms.txt and
// CLS audits are trivial. Our llms-txt-exists / llms-txt-sections / llms-txt-blockquote /
// llms-txt-link-descriptions / llms-txt-links-valid / webmcp-* / accessibility audits all sit at
// least partly inside this footprint and must be positioned on depth (link liveness, section
// semantics, description quality) rather than on existence.
export class GoogleLighthouseAgenticBrowsingCategoryShippedCompleteAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/competitor-gap-verify/google-lighthouse-agentic-browsing-category-shipped-complete',
    category: 'competitor-gap-verify',
    title: "Google Lighthouse — Agentic Browsing category (SHIPPED, complete list)",
    failureTitle: "Google Lighthouse — Agentic Browsing category (SHIPPED, complete list)",
    description: "The entire shipped category is 6 auditRefs, read directly off main: (1) agent-accessibility-tree — filters the existing axe-core violations to a hardcoded 33-rule set (button-name, input-button-name, input-image-alt, label, link-name, select-name, document-title, 24 aria-* rules, duplicate-id-aria, definition-list, table-duplicate-name, tabindex, autocomplete-valid, presentation-role-conflict, svg-img-alt); (2) webmcp-form-coverage — INFORMATIVE, lists <form>s lacking toolname/tooldescription; (3) webmcp-registered-tools — INFORMATIVE, dumps imperative + declarative tools with source location and inputSchema; (4) webmcp-schema-validity — form-level toolname/tooldescription present, per-field name attribute on required/optional params, per-field description; (5) cumulative-layout-shift — the existing CLS metric, reused verbatim; (6) llms-txt — GET /llms.txt, then exactly three regexes: /^\\s*#\\s+.+/m for an H1, /\\[.+\\]\\(.+\\)/ for any markdown link, and content.length < 50. 4xx is notApplicable (a missing llms.txt is never penalised), 5xx scores 0. Two of six audits are informative-only and all three WebMCP audits return notApplicable when artifacts.WebMCP.isSupported is false, so on stock Chrome the category collapses to CLS + a11y-subset + three llms.txt regexes.",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable: check out GoogleChrome/lighthouse@main, read core/config/agentic-browsing-config.js, and the auditRefs array will contain exactly these six ids and no others. Therefore any Agent Lighthouse check whose logic is 'does /llms.txt have an H1 and a link', 'do WebMCP forms carry toolname/tooldescription', or 'do interactive elements have accessible names' is reproducible for free with `lighthouse --preset=agentic-browsing` and is not a differentiator. Conversely, any check outside these six is absent from Lighthouse as of 2026-08-20.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/competitor-gap-verify/google-lighthouse-agentic-browsing-category-shipped-complete.md',
      tags: ['proposed', 'competitor-gap-verify'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/competitor-gap-verify/google-lighthouse-agentic-browsing-category-shipped-complete.md',
      'TODO stub',
    );
  }
}
