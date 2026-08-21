import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "content-signal-coherence".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/competitor-gap-verify/content-signal-coherence.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Pure robots.txt parse, zero extra requests, and it composes directly with ai-group-shadowing
// (check 3 is that audit's precedence rule applied to a different line type). Extend
// _robots-txt-helpers.ts to retain non-rule directive lines per group — the current parser almost
// certainly discards them. New file
// packages/core/src/audits/crawler-permissions/content-signals.ts. Grade B not A because the policy
// is a vendor-published convention with mass deployment, not an IETF standard, and no AI vendor has
// publicly committed to honouring it.
export class ContentSignalCoherenceAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/competitor-gap-verify/content-signal-coherence',
    category: 'competitor-gap-verify',
    title: "content-signal-coherence",
    failureTitle: "content-signal-coherence",
    description: "Parses and reconciles Cloudflare's Content Signals Policy directives in robots.txt. Grammar: a `Content-Signal:` line inside a User-agent group, comma-delimited `name=value` pairs, names restricted to search | ai-input | ai-train, values restricted to yes | no, omission meaning no preference expressed. Four checks. (1) SYNTAX: unknown signal name, value other than yes/no, missing '=', duplicate signal within one group, or a Content-Signal line appearing before any User-agent line. (2) ACCESS/USE CONTRADICTION: a group declaring `ai-input=yes` or `search=yes` whose own rules Disallow '/' — the operator permits the use but blocks the fetch that would enable it, so the signal is dead text. Do NOT flag `ai-train=no` alongside `Allow: /`; that combination is the entire point of the policy. (3) SCOPE GAP, the highest-value finding: signals declared only in the `*` group while named AI-bot groups exist. By RFC 9309 §2.2.1 those bots never consult the wildcard group, so their content signals are simply undeclared — the operator believes they opted out of training and did not. (4) INFORMATIONAL: `search=no` is surfaced as a business-consequence note (it withdraws consent for search-index and excerpt use, which is how ChatGPT/Perplexity citations work) rather than a failure, because it may be deliberate.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Cloudflare published the policy on 2025-09-24 and auto-injected `Content-Signal: search=yes, ai-train=no` into managed robots.txt across 3.8M+ domains, so a large population of sites now carries signals nobody on the site's team authored or audited. The policy governs USE after access while Allow/Disallow governs ACCESS, and the two are edited by different people at different times — which makes contradiction the default state, not the exception. Falsifiable: given robots.txt, the syntax is either conformant or not, and the intersection of {groups declaring a signal} with {groups a given AI token actually matches under RFC 9309} is either non-empty or not.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/competitor-gap-verify/content-signal-coherence.md',
      tags: ['proposed', 'competitor-gap-verify'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/competitor-gap-verify/content-signal-coherence.md',
      'TODO stub',
    );
  }
}
