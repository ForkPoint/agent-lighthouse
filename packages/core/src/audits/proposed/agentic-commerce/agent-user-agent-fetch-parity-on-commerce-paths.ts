import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Agent User-Agent Fetch Parity on Commerce Paths".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agentic-commerce/agent-user-agent-fetch-parity-on-commerce-paths.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Target set: homepage, 2 sampled PDPs, /cart (platform-fingerprinted), and the terms_of_use +
// privacy_policy URLs from the link-surface check. For each target issue paired GETs — baseline
// modern Chrome UA, then `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible;
// ChatGPT-User/1.0; +https://openai.com/bot`, then the OAI-SearchBot UA. Fail conditions, evaluated
// per (target, agent-UA): (a) status class differs from baseline; (b) agent UA gets 403/429/503;
// (c) body matches challenge fingerprints — 'Just a moment...', cf-chl-, __cf_chl, _Incapsula_,
// px-captcha, /akam/ ; (d) extracted-text length ratio agent/baseline < 0.6, which catches soft
// cloaking where a stub page is served. Separately parse robots.txt with correct per-token
// longest-match semantics for all four OpenAI tokens plus wildcard, and report the ASYMMETRY
// explicitly: GPTBot disallowed while OAI-SearchBot allowed is an intentional, legitimate posture
// (opt out of training, stay in search); OAI-SearchBot or ChatGPT-User disallowed on PDP paths is a
// commerce-fatal misconfiguration. When a block is found, fetch https://openai.com/searchbot.json
// and https://openai.com/chatgpt-user.json and emit the exact CIDR list the merchant should
// allowlist. Throttle to <=1 req/s per host and honour Retry-After.
export class AgentUserAgentFetchParityOnCommercePathsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agentic-commerce/agent-user-agent-fetch-parity-on-commerce-paths',
    category: 'agentic-commerce',
    title: "Agent User-Agent Fetch Parity on Commerce Paths",
    failureTitle: "Agent User-Agent Fetch Parity on Commerce Paths",
    description: "Issues paired live requests to PDPs, cart and policy URLs with a baseline browser UA versus each documented OpenAI agent UA, detecting WAF/CDN blocks and bot challenges that robots.txt-only audits are structurally blind to.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: OpenAI operates four separately-tokened agents with separately published IP ranges — OAI-SearchBot (ChatGPT search indexing), ChatGPT-User (user-initiated fetches, i.e. the shopper's agent), GPTBot (training), OAI-AdsBot (ad landing-page validation). If a PDP returns 403/429/503 or a bot-challenge interstitial to ChatGPT-User or OAI-SearchBot while returning 200 to a browser UA, ChatGPT cannot read live price and availability nor follow the buy link, so the product cannot be surfaced or transacted regardless of feed quality. This block lives at the WAF/CDN edge and is therefore invisible to any audit that only parses robots.txt. Disproof condition: a site 403ing ChatGPT-User on its PDPs still showing live, accurate prices in ChatGPT.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agentic-commerce/agent-user-agent-fetch-parity-on-commerce-paths.md',
      tags: ['proposed', 'agentic-commerce'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agentic-commerce/agent-user-agent-fetch-parity-on-commerce-paths.md',
      'TODO stub',
    );
  }
}
