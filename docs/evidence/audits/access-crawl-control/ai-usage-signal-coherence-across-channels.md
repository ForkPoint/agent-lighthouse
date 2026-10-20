---
audit: access-crawl-control/ai-usage-signal-coherence-across-channels
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/ai-usage-signal-coherence-across-channels.ts
slug: ai-usage-signal-coherence-across-channels
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-10-19
graduated: 2026-08-23
sources:
  - s7
  - s8
  - s10
  - s11
  - s12
  - w3c-tdmrep-final-report
  - anthropic-crawlers
  - perplexity-crawlers-doc
  - mistral-robots-docs
  - youbot-docs
  - diffbot-robots-txt
---

# AI usage signal coherence across channels

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Normalises every AI-usage signal the site emits — robots.txt Allow/Disallow, AIPREF Content-Usage, legacy Content-Signal, TDMRep in its three transports, RSL permits/prohibits, and noai robots directives — into one comparable model and reports where they contradict each other. Different crawlers read different channels, so contradictory signals mean different AI systems reach opposite conclusions about the same content.

## Claimed mechanism (falsifiable)

There is no defined precedence _between_ these standards; each specifies only its own parsing. The channels differ:

- TDMRep is carried in a well-known JSON array, an HTTP header and a meta tag (s17).
- AIPREF is carried in robots.txt and an HTTP header (s11).
- RSL is carried in robots.txt, a Link header, an HTML link and an inline script (s12).
- Content-Signal is carried in robots.txt (s8).

Falsifiable. Normalise each channel to (path-scope, usage-category, allow|deny) triples, then compare. Two channels asserting opposite values for the same category and overlapping path scope is a mechanically detectable contradiction. It provably yields divergent outcomes, because a TDMRep-aware crawler and an AIPREF-aware crawler read disjoint inputs. The highest-value instance is documented directly. Cloudflare's managed robots.txt prepends `Content-signal: search=yes, ai-train=no, use=reference` above the operator's own file, so the operator's stated policy can be contradicted at the edge without their knowledge (s7).

## Evidence

- **[Managed robots.txt — Cloudflare Bots](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Cloudflare prepends its own block to the origin's robots.txt: `User-Agent: *` / `Content-signal: search=yes, ai-train=no, use=reference` / `Allow: /`. When the origin already serves robots.txt it combines both files, Cloudflare's block first. This is the mechanism by which a site's own AI policy gets silently overridden at the edge — directly auditable by diffing declared vs. served robots.txt.
- **[Content Signals Policy (announcement)](https://blog.cloudflare.com/content-signals-policy/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Defines the `Content-Signal:` robots.txt directive with signals `search`, `ai-input`, `ai-train` and values `yes`/`no` (omission = no preference). Canonical example: `User-Agent: *` / `Content-Signal: search=yes, ai-train=no` / `Allow: /`. Deployed as default on ~3.8M Cloudflare domains. Cloudflare deliberately does not emit an `ai-input` signal.
- **[A Vocabulary For Expressing AI Usage Preferences (draft-ietf-aipref-vocab-07)](https://datatracker.ietf.org/doc/draft-ietf-aipref-vocab/)** — IETF aipref WG (Paul Keller, Open Future; Martin Thomson, Mozilla) (draft-spec, URL verified 2026-08-20)
  - ACTIVE, version 07, 2026-08-19, intended status Proposed Standard, WG-adopted. Categories: `train-ai` (modify learned parameters of a generative model) and `search` (select assets and direct users to their location, with excerpt conditions). Values are single-character tokens: `y` = allow, `n` = disallow, absent = unknown. Expressed as an RFC 8941 Structured Field dictionary, e.g. `train-ai=y, search=n`. Three-value outcome model: allowed / disallowed / unknown.
- **[Attaching AI Usage Preferences to Content (draft-ietf-aipref-attach-05)](https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/)** — IETF aipref WG (draft-spec, URL verified 2026-08-20)
  - ACTIVE, version 05, 2026-08-18. Two attachment mechanisms: (1) HTTP response header `Content-Usage: train-ai=n`; (2) robots.txt directive `Content-Usage: train-ai=n` with optional path prefix, e.g. `Content-Usage: /ai-ok/ train-ai=y`, using the same path-prefix matching as Allow/Disallow. Precedence rules: preferences apply only to crawlable resources — "Disallowed paths have no associated usage preferences"; longest matching path prefix wins. No well-known location is defined.
- **[RSL 1.0 Standard Specification](https://rslstandard.org/rsl)** — RSL Collective (spec, URL verified 2026-08-20)
  - robots.txt directive `License: https://example.com/license.xml` — "The value MUST be an absolute URI"; may be global or inside a User-agent group; multiple allowed. HTTP discovery: `Link: <https://example.com/license.xml>; rel="license"; type="application/rsl+xml"`. HTML: `<link rel="license" type="application/rsl+xml" href="...">` or inline `<script type="application/rsl+xml">`. no default/well-known location is mandated. XML: root `<rsl xmlns="https://rslstandard.org/rsl" max-age>`, `<content url required, server, encrypted>`, `<license>`, `<permits|prohibits type="usage|user|geo">`, `<payment type="purchase|subscription|crawl|use|attribution|free">`, `<amount currency=ISO4217>`, `<standard>`, `<copyright type contactEmail contactUrl>`, `<legal type="warranty|disclaimer|attestation|contact|proof">`.
- **[TDM Reservation Protocol (TDMRep) — W3C CG Final Report](https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240202/)** — W3C Community Group (spec, URL verified 2026-08-20)
  - Four techniques, not three: (1) `/.well-known/tdmrep.json` — an ARRAY of objects each with `location`, `tdm-reservation`, `tdm-policy`; (2) HTTP response headers `tdm-reservation: 1` and `tdm-policy: <url>`; (3) HTML `<meta name="tdm-reservation" content="1">` / `<meta name="tdm-policy" ...>`; (4) EPUB `tdm:reservation`/`tdm:policy`. Note the well-known file is an array of rules — a bare object is non-conformant.

## Example failure

A publisher adds `<meta name="tdm-reservation" content="1">` site-wide to claim an EU DSM Art. 4 opt-out, while robots.txt (unchanged for years) still carries `User-agent: GPTBot` / `Allow: /` with no Content-Usage directive, and Cloudflare has prepended `Content-signal: search=yes, ai-train=no, use=reference`. Three channels, three different answers for train-ai. A TDMRep-aware crawler skips the site, an AIPREF-aware crawler reads Cloudflare's block rather than the publisher's intent, and a robots-only crawler trains on everything.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

A site that publishes no AI-usage signal in any channel is not applicable: with nothing declared there is nothing to contradict. The AIPREF vocabulary reads an absent preference as unknown and Content Signals reads omission as no preference, so neither documents a cost for silence.

## Implementation deviations

- The audit sends no request. It reads `/robots.txt` and `/.well-known/tdmrep.json` from `ctx.rootFiles`, and headers and meta tags from the sampled pages.
- RSL is read from inline `<script type="application/rsl+xml">` blocks only. Resolving `License:` and `Link: rel=license` is a fetch that `access-crawl-control/rsl-licensing-terms-conformance` already makes.
- A contradiction needs two channels. A disagreement inside one channel belongs to the audit that owns it: `robots-ai-group-shadowing` for robots.txt rules, `aipref-content-usage-declaration-validity` for `Content-Usage`.
- Path scopes overlap by prefix: two declarations are compared when either prefix contains the other.
- `Content-Signal` maps into the same category space (`ai-train` to `train-ai`, `search`, `ai-input`). A line inside a named group binds only that group.
- A `Content-Signal` block above every directive the operator wrote is reported as an edge override, with its own remedy.
- A robots.txt root block counts as a `train-ai` denial only for tokens whose operator says the crawler collects training data: the `TRAINING_CRAWLERS` table in `_robots-txt-helpers.ts`. Since 2026-10-19 that table names `ClaudeBot`, the token Anthropic documents (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler, verified 2026-10-19), instead of the undocumented `anthropic-ai`. It adds `MistralAI-Training` (https://docs.mistral.ai/robots, verified 2026-10-19). It drops PerplexityBot, which "is not used to crawl content for AI foundation models" (https://docs.perplexity.ai/docs/resources/perplexity-crawlers, verified 2026-10-19). It drops YouBot, documented as a search crawler (https://you.com/docs/youbot, verified 2026-10-19). It drops Diffbot, which "does not crawl pages for training generative AI foundation models" (https://www.diffbot.com/docs/crawl/faq/robots-txt, verified 2026-10-19). A block of one of those three is no longer read as a training denial.
- The `TRAINING_CRAWLERS` table is read from the bot registry, `packages/core/src/bot-registry.ts`, since 2026-10-19. The registry counts only rows an operator page documents. `Bytespider` and `cohere-ai` have no operator page, so a block of either is no longer read as a `train-ai` denial. The scenario this closes: `User-agent: Bytespider` / `Disallow: /` beside `Content-Usage: train-ai=y` used to fail on a contradiction no operator documents. A test pins the pass.
- Silence is not applicable. No source documents a cost for declaring nothing. Notes such as a non-array `tdmrep.json` still ride in `details.notes`.

## Deferred

- **EPUB TDM-Rep.** The report defines a fourth transport, `tdm:reservation` in
  EPUB metadata. A web scan never sees it.
- **Per-agent AIPREF scoping.** `Content-Usage` inside a `User-agent` group is
  read as that group's, but AIPREF itself does not define per-agent
  preferences. If the draft grows agent scoping, the comparison needs
  revisiting.
- **Diffing declared against served robots.txt.** Cloudflare's prepend is
  detected by position. Proving it came from the edge would need the origin's
  own copy, which only the operator has.
