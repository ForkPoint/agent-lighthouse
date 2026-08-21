import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Open-source agent-readiness tooling on GitHub — generators, not auditors".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → informative tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/competitor-gap-verify/open-source-agent-readiness-tooling-on-github-generators-not.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// n/a — competitor mapping. Practical consequence: llms.txt existence/format checks are saturated
// (dozens of validators plus Lighthouse), so llms.txt should be a low-weight commodity block in our
// score, and weight should move to the active-probe and cross-artifact-reconciliation checks below,
// which have literally no maintained implementation.
export class OpenSourceAgentReadinessToolingOnGithubGeneratorsNotAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/competitor-gap-verify/open-source-agent-readiness-tooling-on-github-generators-not',
    category: 'competitor-gap-verify',
    title: "Open-source agent-readiness tooling on GitHub — generators, not auditors",
    failureTitle: "Open-source agent-readiness tooling on GitHub — generators, not auditors",
    description: "A GitHub REST search census of the field. The high-star projects are all generators or the spec itself: AnswerDotAI/llms-txt (2575 stars, the llms.txt spec repo), firecrawl/llmstxt-generator (537), delucis/starlight-llms-txt (109), SecretiveShell/Awesome-llms-txt (107), thedaviddias/mcp-llms-txt-explorer (76). Every auditor-shaped project is a sub-5-star weekend build: hanselhansel/context-cli (robots.txt + llms.txt + Schema.org + content density scored 0-100, with an MCP server), agentmarkup/agentmarkup (22 stars, build-time llms.txt/JSON-LD/markdown-mirror generation plus validation for Vite/Astro/Next/Nuxt), portdeveloper/llms-txt-check (1 star, 'validate a site's llms.txt against what the site actually serves'), mikiships/agent-trust-scan (1, A2A + MCP + llms.txt endpoint validation as a GitHub Action), abhi725/growth-mcp (1, GEO readiness audits over MCP), javaidnaik/llmstxt-kit (1), JerryZhi/AI-Crawler-Detector (5, detects server-side AI crawler blocking beyond robots.txt), arturseo-geo/mcp-crawl-parity (1, Googlebot vs AI crawler parity computed from Nginx logs + GSC).",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable: run the search and sort by stars. The distribution — thousands of stars for generation, single digits for auditing — shows the market has tooling to PRODUCE llms.txt and none to VERIFY that the resulting site actually serves agents correctly. Two repos nibble at our differentiators (AI-Crawler-Detector at active block detection, mcp-crawl-parity at crawl parity) but neither reconciles an active probe against the site's own declared robots.txt policy, and mcp-crawl-parity requires the operator's server logs.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/competitor-gap-verify/open-source-agent-readiness-tooling-on-github-generators-not.md',
      tags: ['proposed', 'competitor-gap-verify'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/competitor-gap-verify/open-source-agent-readiness-tooling-on-github-generators-not.md',
      'TODO stub',
    );
  }
}
