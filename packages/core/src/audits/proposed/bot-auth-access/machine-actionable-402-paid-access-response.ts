import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Machine-actionable 402 paid-access response".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/bot-auth-access/machine-actionable-402-paid-access-response.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static-fetch, piggybacking on responses already captured by the edge-parity probe. 1) Collect
// every response with status 402 across the crawler-UA probe matrix and the baseline browser fetch.
// 2) A 402 is machine-actionable if ANY holds: (a) a `crawler-price` header matching
// /^[A-Z]{3}\s+\d+(\.\d+)?$/ with an ISO 4217 currency; (b) a `PAYMENT-REQUIRED` header whose
// base64 decodes to JSON containing `x402Version` and a non-empty `accepts` array, each item having
// scheme, network, amount, asset and payTo; (c) a `Link: rel=license; type=application/rsl+xml` (or
// a robots.txt `License:`) resolving to an RSL doc with `<payment type="crawl">` and a valid
// `<amount currency>` whose `<content url>` covers the 402'd path. 3) Fail when a 402 is returned
// with `content-type: text/html` and none of the three are present. 4) Secondary assertions worth
// their own sub-findings: the currency token is real ISO 4217; the amount parses as a decimal; a
// `Cache-Control` that would let a CDN cache the 402 across clients is flagged (a cached 402
// poisons paying crawlers); and a 402 returned to the *browser* baseline as well as to crawler UAs
// indicates a misapplied rule hitting humans. 5) Emit a distinct informational result — not a
// failure — when no 402 is observed anywhere, so free sites are not penalised.
export class MachineActionable402PaidAccessResponseAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/bot-auth-access/machine-actionable-402-paid-access-response',
    category: 'bot-auth-access',
    title: "Machine-actionable 402 paid-access response",
    failureTitle: "Machine-actionable 402 paid-access response",
    description: "When a site charges for crawler access, this verifies the 402 response carries a price a machine can read and act on, in one of the three deployed formats. A 402 with a human HTML error page is functionally a hard block: the crawler cannot compute an offer, so it drops the URL rather than paying.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Every deployed paid-crawl scheme puts the price in a machine-readable slot, never in the body prose. Cloudflare pay-per-crawl returns 402 with `crawler-price: USD XX.XX`, and the crawler retries with `crawler-exact-price` (or pre-declares `crawler-max-price`), receiving 200 + `crawler-charged` on success (s5). x402 v2 puts a base64-encoded PaymentRequired payload in the `PAYMENT-REQUIRED` response header, carrying `x402Version: 2` and an `accepts[]` array of {scheme, network, amount, asset, payTo, maxTimeoutSeconds, extra} (s19). RSL expresses it declaratively as `<payment type=\"crawl\"><amount currency=\"USD\">0.015</amount></payment>` (s12). Falsifiable: a 402 carrying none of these three signals contains no price any client can parse, so no retry is constructible.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/bot-auth-access/machine-actionable-402-paid-access-response.md',
      tags: ['proposed', 'bot-auth-access'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/bot-auth-access/machine-actionable-402-paid-access-response.md',
      'TODO stub',
    );
  }
}
