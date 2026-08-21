import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "AI-visibility monitors (Otterly.ai, Peec AI, Ahrefs Brand Radar, HubSpot AI Search Grader)".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → informative tier. Implementation difficulty: llm-assisted.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/competitor-gap-verify/ai-visibility-monitors-otterly-ai-peec-ai-ahrefs-brand-radar.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// n/a — competitor mapping. Only Otterly's vague 'crawlability checks' is a possible collision; it
// is undocumented, so treat any specific, named, reproducible crawl assertion as safe to claim.
export class AiVisibilityMonitorsOtterlyAiPeecAiAhrefsBrandRadarAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/competitor-gap-verify/ai-visibility-monitors-otterly-ai-peec-ai-ahrefs-brand-radar',
    category: 'competitor-gap-verify',
    title: "AI-visibility monitors (Otterly.ai, Peec AI, Ahrefs Brand Radar, HubSpot AI Search Grader)",
    failureTitle: "AI-visibility monitors (Otterly.ai, Peec AI, Ahrefs Brand Radar, HubSpot AI Search Grader)",
    description: "Four products, one shape: prompt-rank and citation monitoring with zero technical crawl. Otterly.ai — 7 engines monitored, AI Prompt Research, AI Search Analytics, GEO Optimization, and a 'Content Audit' that advertises unspecified 'crawlability checks' plus a predictive citation score; no named technical check anywhere in its docs. Peec AI — Prompt Management, per-model trackers, competitor benchmarking, Visibility/Position/Sentiment, geo tracking, source detection, CSV export, Looker connector, API; explicitly no site audit. Ahrefs Brand Radar — AI visibility tracking, citation discovery, YouTube/TikTok/Reddit monitoring, custom prompts; explicitly no llms.txt, no AI-bot robots.txt rules, no agent schema. HubSpot AI Search Grader — a 100-point score over Sentiment Results (40), Presence Quality (20), Brand Recognition (20), Share of Voice (10), Market Competition (10), computed entirely by prompting ChatGPT/Perplexity/Gemini; it never fetches the graded site.",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable: point any of these four at a domain that returns HTTP 403 to every AI crawler UA while serving 200 to browsers. All four will still produce a full report, and none will report the block, because none of them issue a request to the site under a crawler user-agent. Their inputs are model outputs, not the origin server.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/competitor-gap-verify/ai-visibility-monitors-otterly-ai-peec-ai-ahrefs-brand-radar.md',
      tags: ['proposed', 'competitor-gap-verify'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/competitor-gap-verify/ai-visibility-monitors-otterly-ai-peec-ai-ahrefs-brand-radar.md',
      'TODO stub',
    );
  }
}
