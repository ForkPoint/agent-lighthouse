import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Profound — Agent Analytics (AI visibility + passive bot telemetry)".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → informative tier. Implementation difficulty: llm-assisted.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/competitor-gap-verify/profound-agent-analytics-ai-visibility-passive-bot-telemetry.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// n/a — competitor mapping. Strategic read: Profound owns the 'did the bot come, and what did the
// model say' half; Agent Lighthouse should own the 'what will the bot get when it arrives' half,
// and the two are complements, not substitutes.
export class ProfoundAgentAnalyticsAiVisibilityPassiveBotTelemetryAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/competitor-gap-verify/profound-agent-analytics-ai-visibility-passive-bot-telemetry',
    category: 'competitor-gap-verify',
    title: "Profound — Agent Analytics (AI visibility + passive bot telemetry)",
    failureTitle: "Profound — Agent Analytics (AI visibility + passive bot telemetry)",
    description: "Shipped surface: Answer Engine Insights (how AI describes the brand across Perplexity, ChatGPT, Claude, Gemini, Grok, Copilot, DeepSeek, AI Overviews), Prompt Volumes, Agent Analytics ('track how your site is interpreted and crawled by ChatGPT, Gemini, Claude, Perplexity'), Shopping (SKU visibility in AI answers), Agents (AEO FAQ generator, Demand Gen, Brand, Content agents), and Aim (weekly prioritised task list). Agent Analytics is derived from the customer's own request logs / edge integration — it observes bots that already arrived. There is no active site-side conformance audit anywhere in the product: no robots.txt parsing, no llms.txt validation, no schema conformance, no differential fetching.",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable: Profound's product surface requires either an account's log/edge feed or LLM querying; nothing in it can be run against an arbitrary third-party URL to produce a pass/fail technical finding. Therefore a check that is an unauthenticated, deterministic HTTP-level assertion about a stranger's site is structurally outside Profound's product, not merely absent from it.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/competitor-gap-verify/profound-agent-analytics-ai-visibility-passive-bot-telemetry.md',
      tags: ['proposed', 'competitor-gap-verify'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/competitor-gap-verify/profound-agent-analytics-ai-visibility-passive-bot-telemetry.md',
      'TODO stub',
    );
  }
}
