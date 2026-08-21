import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Unsafe Agent-Triggerable Affordances".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/injection-safety/unsafe-agent-triggerable-affordances.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Never follow a flagged link — this check is purely markup analysis. Enumerate every <a href> and
// every <form method="get"> action URL on the sampled pages. Match against state-verb patterns:
// /([?&])(action|do|cmd|op|task)=(delete|remove|destroy|cancel|purge|reset|clear|unsubscribe|optout|revoke)/i,
// /add[-_]?to[-_]?cart/i,
// /\/(logout|signout|sign-out|unsubscribe|delete-account|checkout|confirm-order)(\/|$|\?)/i,
// /([?&])(confirm|approve|accept|apply)=(1|true|yes)/i. For each match, look for a confirmation
// affordance on the element or an ancestor: data-confirm/data-turbo-confirm attributes, an onclick
// containing confirm(, membership in a <form method="post">, or rel containing nofollow. FAIL on a
// state-verb GET link with none of those. WARN on <form method="get"> whose action matches a state
// verb (query-string mutation, trivially replayable). Separately report whether the site declares
// any of these paths in robots.txt Disallow — a partial mitigation for well-behaved crawlers but
// not for ChatGPT-User, which OpenAI documents as not necessarily bound by robots.txt for
// user-initiated fetches, nor for a computer-use agent driving a real browser. Present findings as
// 'agent tripwires' with the fix: POST plus a confirmation step, or rel="nofollow" as a minimum.
export class UnsafeAgentTriggerableAffordancesAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/injection-safety/unsafe-agent-triggerable-affordances',
    category: 'injection-safety',
    title: "Unsafe Agent-Triggerable Affordances",
    failureTitle: "Unsafe Agent-Triggerable Affordances",
    description: "Enumerate state-changing operations that a page exposes behind a plain GET — <a href> links and method=\"get\" forms matching delete/cancel/logout/unsubscribe/add-to-cart/checkout patterns — and check whether any confirmation affordance stands between the link and the effect.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "RFC 9110 defines GET as read-only ('they do not commit to any action on the origin server') and notes that spiders are configured to follow links while crawling the web as a hypertext graph. Agents that explore a page rely on that contract. If consequence sits behind a bare GET, an exploring agent — or an agent that has been prompt-injected elsewhere and instructed to click through — mutates account or cart state with no confirmation step and no CSRF token, and Anthropic's own guidance to require human confirmation for consequential actions becomes unenforceable because nothing in the markup signals consequence. Falsifier: if every state-changing operation is a POST behind a confirmation interstitial, no exploring agent can trip it.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/injection-safety/unsafe-agent-triggerable-affordances.md',
      tags: ['proposed', 'injection-safety'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/injection-safety/unsafe-agent-triggerable-affordances.md',
      'TODO stub',
    );
  }
}
