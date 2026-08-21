---
audit: content-discoverability/commerce-links
audit_id: "1.23"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/commerce-links.ts
slug: commerce-links
review_verdict: fix
severity: high
evidence_grade: D
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# commerce-links (`1.23`)

> content-discoverability · source `commerce-links.ts` · review verdict **fix** · evidence grade **D** · disposition: **keep — fix required**

## What it checks

AI agents must provide transparency on shipping and returns to help users make buying decisions. Finding and verifying these links is essential for "Instant Checkout" readiness.

## Code review findings (2026-08-20, 11-agent pass)

Scans the homepage's anchors for return/shipping/seller keywords. English-only substring matching with no page-type gating: it fails every non-English store, fails the DEFAULT SHOPIFY STORE (whose footer says 'Refund policy' at /policies/refund-policy — no 'return' anywhere), and fails every blog, docs site and SaaS landing page for lacking commerce links they have no reason to have. High false-result rate across the most common real inputs.

**Required fix:** Gate the audit on commerce detection (Product/Offer structured data or a product/category pageType present) and return notApplicable() otherwise. Replace single-keyword substring tests with a multilingual term table (return/refund/retour/rücksendung/devolución, shipping/versand/livraison/envío, impressum/about/contact/seller) plus platform-specific path patterns (/policies/refund-policy, /policies/shipping-policy). Scan the footers of all scanned pages, not just pages[0]. Read link text from aria-label/title when the text node is empty. Ignore query-string matches like ?returnUrl=.

**False-positive risks:**
- `link.href.includes('return') || link.text.includes('return policy')` — Shopify's default is `/policies/refund-policy` with the anchor text 'Refund policy'. Neither contains 'return'. The single most common commerce platform's out-of-the-box configuration is graded as missing its return policy.
- English-only throughout ('return', 'shipping', 'delivery', 'about us', 'contact', 'seller'). A German (`/versand`, `/ruecksendungen`, `/impressum`), French (`/livraison`, `/retours`), or Spanish (`/envios`, `/devoluciones`) store fails all three checks and receives 'Missing all critical commerce links'.
- No page-type or site-type gating: `ctx.pages[0]` only, and every non-commerce site — a blog, a docs portal, a personal site — is failed at medium priority for not having a return policy. The audit does not check whether any Product schema or commerce page type was detected.
- False positives in the other direction: `href.includes('return')` matches `/blog/the-return-of-x` and any URL carrying `?returnUrl=`; `href.includes('contact')` sets `seller = true` from a generic contact link, which is a very weak proxy for verifiable seller identity.
- Homepage-only and static-HTML-only: stores that render the footer client-side (headless React/Vue storefronts) expose no anchors in the SSR HTML → false FAIL.
- `$(el).text().toLowerCase()` returns empty for icon-only or aria-labelled links, so accessible-but-iconographic footers are invisible to the text branch.
- 'Instant Checkout readiness' is asserted in the description, but nothing here verifies any checkout-protocol requirement — the conclusion drawn from three keyword matches vastly overstates what was measured.

**Test gaps:**
- Default Shopify footer ('Refund policy' at /policies/refund-policy) — currently a false FAIL on the most common storefront
- Non-English stores (German/French/Spanish policy paths and labels)
- A blog or docs site (should be N/A, currently a FAIL)
- False positive from /blog/return-of-x or ?returnUrl=
- Icon-only / aria-labelled footer links
- Client-rendered footer absent from SSR HTML

**Overlaps with:** _none_

## Evidence

### Signal: Commerce deep links — crawlable add-to-cart / prefilled-cart / deep checkout URLs for shopping agents — grade D (discovery-infra)

**Mechanism:** Exposing machine-readable add-to-cart or deep checkout URLs on product pages (as raw links or via schema.org BuyAction/potentialAction target EntryPoints) causes shopping agents to discover and invoke them to transact. Falsifiable: if no documented shopping agent reads add-to-cart URLs or BuyAction markup and transacts through them, the claim fails — and this is precisely what the primary sources show.

**Evidence:** The evidence REFUTES this signal as stated, and the refutation is unusually clean because all three major agentic-commerce stacks are publicly specified. OpenAI and Stripe's Agentic Commerce Protocol repository defines the checkout and delegated-payment OpenAPI specs but contains no website-side discovery mechanism whatsoever — no well-known URL, no HTML link tag, no sitemap- or markup-based endpoint discovery; merchant endpoints are registered out-of-band. OpenAI's Product Feed Spec has exactly two URL fields, 'url' ('Product detail page URL', which 'must resolve with HTTP 200; HTTPS preferred') and 'seller_url' derived from that link's scheme and authority — and no add-to-cart, cart, or checkout field at all. Feeds are pushed as uploaded TSV/CSV to a secure endpoint, not crawled; OpenAI's key-concepts guide describes daily snapshots plus API updates, with checkout state and payment processing occurring on the merchant's ACP endpoints while ChatGPT renders the UI. Google's AP2 is orthogonal: it standardizes payment AUTHORIZATION via signed Intent/Cart/Payment mandates as W3C Verifiable Credentials, and likewise defines no deep links or web-discovery affordance. Perplexity's Buy with Pro operates through an equivalent merchant-feed program. schema.org BuyAction exists as a core type with a target EntryPoint, but no AI or shopping-agent vendor documents consuming it.

**Counter-evidence:** The counter-evidence IS the finding. Every published shopping-agent architecture in 2026 — ACP (OpenAI + Stripe), AP2 (Google), Perplexity's merchant program — is feed-plus-API with out-of-band merchant registration, explicitly not crawl-and-deep-link. Third-party guidance claiming 'BuyAction is the Add to Cart button for AI agents' and that agents read urlTemplate cart endpoints is SEO-vendor invention with no vendor confirmation; schema.org's own usage counter (1M–10M domains, Google July 2026 aggregation) reflects incidental Action markup, not agentic cart integration. The one salvageable, genuinely A-grade sub-claim is narrow and worth keeping: the ACP feed spec REQUIRES the product detail page URL to resolve with HTTP 200, so stable, canonical, non-404 product URLs are a hard prerequisite for ChatGPT commerce. Recommend retargeting the audit from 'add-to-cart deep links' to 'product-detail URLs resolve 200, are canonical and stable, and the merchant has an ACP feed path' — and dropping BuyAction scoring entirely.
**Consumers:** none-known · **Recommended tier:** experimental

**Sources:** [Agentic Commerce Protocol (ACP) specification repository](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol) · [Product Feed Spec — Agentic Commerce | OpenAI Developers](https://developers.openai.com/commerce/specs/feed) · [Key concepts — Agentic Commerce | OpenAI Developers](https://developers.openai.com/commerce/guides/key-concepts) · [Agentic Commerce Protocol | Stripe Documentation](https://docs.stripe.com/agentic-commerce/acp) · [AP2 — Agent Payments Protocol](https://github.com/google-agentic-commerce/AP2) · [BuyAction — schema.org Type](https://schema.org/BuyAction) · [Google's Guide to Optimizing for Generative AI Features on Google Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
