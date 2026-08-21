import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "AI crawler edge-response parity".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/bot-auth-access/ai-crawler-edge-response-parity.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) Fetch /robots.txt with a neutral UA and parse per-agent groups (reuse _robots-txt-helpers). 2)
// Build a probe set: `/`, plus 2-3 content URLs sampled from sitemap.xml, plus /llms.txt if
// present. 3) For each probe URL, fetch with a baseline modern-Chrome UA, then with each published
// crawler UA string verbatim from vendor docs — GPTBot/1.4, OAI-SearchBot/1.4, ChatGPT-User/1.0
// (s18), ClaudeBot, Claude-User, PerplexityBot. Exclude Google-Extended: it is a robots.txt token
// with no user agent and cannot be probed. Keep identical Accept/Accept-Encoding headers across
// baseline and probe so only the UA varies. 4) Classify every non-2xx: `cf-mitigated: challenge` →
// Cloudflare challenge; 402 + `crawler-price` → pay-per-crawl (hand off to the 402 check); body
// contains `/.within.website/x/cmd/anubis/` or `Protected by Anubis` → PoW wall (s20); 429 → rate
// limit; 403 with `server: cloudflare` and no cf-mitigated → opaque WAF block. 5) Also classify
// soft blocks: status 200 but extracted main-text length < 40% of baseline. 6) Verdict matrix:
// robots-allows AND non-2xx → fail; robots-disallows AND non-2xx → pass (consistent); robots-allows
// AND 2xx → pass. 7) CRITICAL ambiguity handling: per s4, Cloudflare and Akamai deliberately block
// UA-spoofed AI bots arriving from unpublished IPs, so an opaque 403 cannot distinguish 'you block
// AI crawlers' from 'you correctly block impersonators'. Score cf-mitigated challenges, 402s,
// Anubis walls and soft-block truncation as hard failures; report opaque 403/429 as a warning that
// names the classification and tells the operator to confirm against edge logs. Report per-crawler,
// per-URL, never a single site-wide boolean.
export class AiCrawlerEdgeResponseParityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/bot-auth-access/ai-crawler-edge-response-parity',
    category: 'bot-auth-access',
    title: "AI crawler edge-response parity",
    failureTitle: "AI crawler edge-response parity",
    description: "Detects the single most common and most invisible AI-visibility failure: robots.txt grants an AI crawler access, but the CDN/WAF in front of the origin answers that crawler with a challenge, a 403, a 402, or a proof-of-work interstitial. The site owner reads their own robots.txt and believes they are open; the crawler never sees a byte.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "robots.txt (RFC 9309) is advisory metadata parsed by the crawler; the edge access decision is enforced independently by the WAF. Therefore a site can simultaneously publish `User-agent: PerplexityBot / Allow: /` and return a non-200 to every request carrying that user-agent. Falsifiable: fetch URL U with a browser UA and with crawler UA C; if robots.txt permits C for U and the C-request status is not 2xx while the browser-request is 200, the two policy layers contradict each other. Cloudflare makes one branch deterministically classifiable: a challenge response always carries `cf-mitigated: challenge` and `content-type: text/html` (s14).",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/bot-auth-access/ai-crawler-edge-response-parity.md',
      tags: ['proposed', 'bot-auth-access'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/bot-auth-access/ai-crawler-edge-response-parity.md',
      'TODO stub',
    );
  }
}
