import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Agent-UA Content Divergence Diff".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/injection-safety/agent-ua-content-divergence-diff.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// For each of N sampled URLs (homepage, top nav targets, one product/article, one UGC-bearing
// page), issue parallel GETs with identical Accept, Accept-Language and no cookies, varying only
// User-Agent across: current Chrome UA, 'GPTBot/1.2 (+https://openai.com/gptbot)', 'ClaudeBot/1.0',
// 'PerplexityBot/1.0', 'OAI-SearchBot/1.0', and one nonsense-UA control. Additionally probe content
// negotiation: Accept: text/markdown, and <url>.md if llms.txt or a link rel=alternate advertises
// one. Run readability-style main-content extraction on each, normalize whitespace and case, and
// compute token-level Jaccard similarity plus a SimHash distance against the Chrome baseline. FAIL
// when Jaccard < 0.85 against any agent UA, or when an agent variant contains instruction-lexicon
// hits absent from the Chrome variant, or when a JSON-LD block differs between variants. Report
// status-code divergence separately and non-punitively (403 to agents is a deliberate opt-out, not
// a safety defect). Emit a word-level diff of the largest divergent block. Use the nonsense-UA
// control to distinguish genuine UA branching from bot-management noise and cache variance;
// re-fetch once before failing to rule out A/B tests and cache races.
export class AgentUaContentDivergenceDiffAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/injection-safety/agent-ua-content-divergence-diff',
    category: 'injection-safety',
    title: "Agent-UA Content Divergence Diff",
    failureTitle: "Agent-UA Content Divergence Diff",
    description: "Fetch each sampled URL with a real browser UA and with each major AI fetcher UA, extract main content from each, and diff. Surface any text served to agents that is not served to humans — including the diff hunks, so the owner can see what agents are being told.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "AI fetchers identify themselves (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot) and no vendor documents JavaScript execution for them, so server-side or edge logic can trivially branch on user agent. Any such branch — a compromised plugin, a rogue ad or tag-manager container, or a 'GEO optimization' vendor — creates content the owner will never see in their own browser, which is the ideal place to park injected instructions or manipulative claims. Google already classifies UA-conditional content divergence as cloaking and penalizes it, so the check carries a second, independent consequence. Falsifier: main-content text equivalence across UAs proves no agent-only channel exists.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/injection-safety/agent-ua-content-divergence-diff.md',
      tags: ['proposed', 'injection-safety'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/injection-safety/agent-ua-content-divergence-diff.md',
      'TODO stub',
    );
  }
}
