import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "robots-ai-group-shadowing".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/competitor-gap-verify/robots-ai-group-shadowing.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Pure robots.txt parse, no extra network beyond the sitemap we already fetch. Reuse
// packages/core/src/audits/crawler-permissions/_robots-txt-helpers.ts — but note its current
// categoryBlocked() flattens rules across DIFFERENT bots' groups, which is a convenience for
// governance reporting and must NOT be reused here; this audit needs strict per-token group
// isolation. Add a longest-match evaluator: for path p, select the rule with the longest pattern
// matching p (with '*' and '$' expanded); on equal length, Allow wins. New file
// packages/core/src/audits/crawler-permissions/ai-group-shadowing.ts, category crawler-permissions.
export class RobotsAiGroupShadowingAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/competitor-gap-verify/robots-ai-group-shadowing',
    category: 'competitor-gap-verify',
    title: "robots-ai-group-shadowing",
    failureTitle: "robots-ai-group-shadowing",
    description: "Detects the RFC 9309 group-precedence trap: adding ANY named group for an AI product token silently voids every rule in the `User-agent: *` group for that bot. Parse robots.txt into groups; merge groups sharing a product token (§2.2.1) but never merge a named group with `*`. For each AI token that has an explicit group (GPTBot, OAI-SearchBot, ChatGPT-User, OAI-AdsBot, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, CCBot, Bytespider, Amazonbot, meta-externalagent, meta-externalfetcher, Bravebot, DuckAssistBot, cohere-ai, MistralAI-User, Diffbot, AI2Bot, YouBot), build a probe path set P = every Allow/Disallow pattern literal appearing in ANY group, plus '/', plus up to 200 sitemap URLs. Evaluate each p in P twice — under the merged named group R_T and under the wildcard group R_star — using RFC 9309 longest-match-wins, Allow-wins-on-tie. Report three distinct failure classes. (a) SHADOWED-PROTECTION, high: p is Disallowed by R_star but Allowed by R_T — a path the operator meant to keep out of crawlers is open to this AI bot. (b) EMPTY-GROUP, critical: R_T contains zero Allow/Disallow rules (only Crawl-delay, Sitemap, or comments) — per §2.2.1 the bot matches this group, obeys its zero rules, and the wildcard is never consulted, so the entire site including every wildcard-disallowed path is open. (c) UNINTENDED-BLOCK, critical: R_star allows '/' but R_T disallows '/' — usually a copy-pasted block template that silently removed the site from that engine. Output a per-token table of divergent paths and the class.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "RFC 9309 §2.2.1 states the wildcard group is consulted only 'if no matching group exists'. Therefore, for any site with a named AI-bot group, the wildcard group's Disallow rules provably do not apply to that bot, and the operator's stated intent (expressed once in `*`) diverges from the enforced policy by exactly the symmetric difference of the two rule sets. Falsifiable by construction: given robots.txt R and token T, the set of paths where R_T and R_star disagree is computable and either empty or not.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/competitor-gap-verify/robots-ai-group-shadowing.md',
      tags: ['proposed', 'competitor-gap-verify'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/competitor-gap-verify/robots-ai-group-shadowing.md',
      'TODO stub',
    );
  }
}
