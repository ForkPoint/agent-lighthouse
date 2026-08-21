import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Cart Handoff Reachability".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agentic-commerce/cart-handoff-reachability.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Fingerprint the platform from response headers and markup (Shopify: x-shopid header,
// cdn.shopify.com; WooCommerce: wp-content/plugins/woocommerce; BigCommerce: cdn11.bigcommerce.com;
// Magento: /static/version, Magento_ cookies) and derive candidate paths — Shopify /cart and
// /cart.js, WooCommerce /cart and /checkout, BigCommerce /cart.php and /checkout, Magento
// /checkout/cart. GET each with a browser UA and again with the ChatGPT-User UA. FAIL on: (a)
// redirect whose final path matches
// /login|/signin|/sign-in|/account\/login|/customer\/account\/login/i, indicating an account wall
// on the buy path; (b) the cart or checkout DOCUMENT (not a subresource on unrelated pages)
// referencing a challenge widget — challenges.cloudflare.com/turnstile, www.google.com/recaptcha,
// hcaptcha.com, or a data-sitekey attribute; (c) 403/429 under either UA; (d) cart path returning
// 404 under all candidates, meaning no discoverable cart surface. WARN when the checkout document
// is entirely JS-rendered with an empty <noscript> fallback. Strictly read-only: never POST to
// add-to-cart, never submit forms, honour robots.txt Disallow on cart paths and report a Disallow
// there as informational rather than as a fetch. Bound at one request per path per UA.
export class CartHandoffReachabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agentic-commerce/cart-handoff-reachability',
    category: 'agentic-commerce',
    title: "Cart Handoff Reachability",
    failureTitle: "Cart Handoff Reachability",
    description: "Tests whether the URL an agent would hand a buyer to — the ACP Cart API's continue_url, or the storefront cart for a computer-use agent — is actually reachable without an account and without a bot challenge.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: ACP 2026-04-17 adds a seller-hosted Cart API whose response carries a `continue_url` (e.g. https://seller.example.com/cart/cart_abc123) used to hand the buyer off to the seller's own checkout UI; this is the low-lift adoption path that requires no delegated payment. For merchants with no ACP integration at all, a computer-use shopping agent drives that same storefront cart directly. In both cases, if the cart or checkout URL 302s to a login page, or serves a CAPTCHA/bot-challenge on the checkout document, the handoff dead-ends at the final step after every upstream signal worked. ACP even reserves a message code `requires_sign_in` for the sign-in wall case. Disproof condition: agent handoffs completing normally through a login-walled cart.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agentic-commerce/cart-handoff-reachability.md',
      tags: ['proposed', 'agentic-commerce'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agentic-commerce/cart-handoff-reachability.md',
      'TODO stub',
    );
  }
}
