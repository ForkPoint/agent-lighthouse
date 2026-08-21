import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Enterprise SEO suites (Semrush, Conductor, seoClarity) — log-based bot analytics".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → informative tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/competitor-gap-verify/enterprise-seo-suites-semrush-conductor-seoclarity-log-based.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// n/a — competitor mapping. Their moat is longitudinal log data we will never have; ours is the
// point-in-time, pre-deploy, CI-runnable assertion they cannot make. This is why the
// differentiating checks below are all active-probe checks.
export class EnterpriseSeoSuitesSemrushConductorSeoclarityLogBasedAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/competitor-gap-verify/enterprise-seo-suites-semrush-conductor-seoclarity-log-based',
    category: 'competitor-gap-verify',
    title: "Enterprise SEO suites (Semrush, Conductor, seoClarity) — log-based bot analytics",
    failureTitle: "Enterprise SEO suites (Semrush, Conductor, seoClarity) — log-based bot analytics",
    description: "Semrush AI Visibility Toolkit ships Visibility Overview, Brand Performance, Competitor Research, Prompt Tracking, AI-Cited Media, Prompt Research; the classic Site Audit is cross-sold separately for generic 'technical health' and the AI toolkit page documents no AI-bot-specific check. Conductor ships Conductor Intelligence (multi-engine visibility), Creator, AgentStack, and Conductor Monitoring — '24/7 always-on monitoring tracks how AI bots crawl your site' with alerts and prioritised fixes, i.e. telemetry on arrived bots. seoClarity's Clarity ArcAI ships 12 modules: Track Visibility, Research Prompts, Analyze Sentiment, Optimize Content, Measure Performance, Discover Bot Activity ('know if AI bots access your pages'), Monitor Accuracy, MCP Server and API, Accelerate Indexation, Monitor Web Mentions, Track AI Shopping, Product Feed Optimizer.",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable: the closest thing any of the three ships to our category is bot-activity tracking, which answers 'did GPTBot fetch /pricing last week' from server logs. It cannot answer 'would GPTBot be allowed to fetch /pricing right now, and would the CDN honour that', because that requires an outbound request the platform does not make. A site whose AI bots have never once arrived produces an empty Conductor/seoClarity bot report and no diagnosis.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/competitor-gap-verify/enterprise-seo-suites-semrush-conductor-seoclarity-log-based.md',
      tags: ['proposed', 'competitor-gap-verify'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/competitor-gap-verify/enterprise-seo-suites-semrush-conductor-seoclarity-log-based.md',
      'TODO stub',
    );
  }
}
