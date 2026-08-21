import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Google Lighthouse — ard-schema (ai-catalog.json) audit, OPEN PR #17168".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → informative tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/competitor-gap-verify/google-lighthouse-ard-schema-ai-catalog-json-audit-open-pr-1.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Track this PR. Our surviving differentiators after a merge are the ones the PR explicitly does
// NOT do: it never dereferences entry.url to check the target is live and returns the declared
// media type; it never cross-checks the catalog against robots.txt access rules; it validates only
// /.well-known/ai-catalog.json or the first signalled URL, never reconciling multiple contradictory
// discovery signals against each other. Reposition ai-catalog-urls onto liveness + type agreement,
// and add discovery-signal reconciliation.
export class GoogleLighthouseArdSchemaAiCatalogJsonAuditOpenPr1Audit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/competitor-gap-verify/google-lighthouse-ard-schema-ai-catalog-json-audit-open-pr-1',
    category: 'competitor-gap-verify',
    title: "Google Lighthouse — ard-schema (ai-catalog.json) audit, OPEN PR #17168",
    failureTitle: "Google Lighthouse — ard-schema (ai-catalog.json) audit, OPEN PR #17168",
    description: "An open PR (created 2026-08-10, branch agentic-resource-discovery, still unmerged at 2026-08-20) adds core/gather/gatherers/agentic/ard.js + core/audits/agentic/ard-schema.js and vendors the official ARD ConformanceTester into third-party/ard/ard.js. The gatherer implements a discovery precedence chain identical to what an ai-catalog audit would want: robots.txt `Agentmap:` line > `<link rel=\"ai-catalog\">` in the DOM > `Link: <...>; rel=ai-catalog` HTTP header > `/.well-known/ai-catalog.json` fallback. The audit is notApplicable unless an explicit signal exists or the well-known returns 200; it then runs validate_manifest and scores 1 (clean) / 0.5 (warnings only) / 0 (errors), plus a Lighthouse-specific warning for any entry missing representativeQueries.",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable: `gh api repos/GoogleChrome/lighthouse/pulls/17168/files` lists ard.js and ard-schema.js. If this PR merges, every ai-catalog.json existence/discovery/schema-conformance check becomes commodity overnight, including our ai-catalog-exists, ai-catalog-metadata, ai-catalog-urls and meta-tags/ai-catalog-link audits.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/competitor-gap-verify/google-lighthouse-ard-schema-ai-catalog-json-audit-open-pr-1.md',
      tags: ['proposed', 'competitor-gap-verify'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/competitor-gap-verify/google-lighthouse-ard-schema-ai-catalog-json-audit-open-pr-1.md',
      'TODO stub',
    );
  }
}
