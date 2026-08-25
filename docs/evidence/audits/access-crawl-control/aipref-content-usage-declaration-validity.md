---
audit: access-crawl-control/aipref-content-usage-declaration-validity
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/aipref-content-usage-declaration-validity.ts
slug: aipref-content-usage-declaration-validity
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - s10
  - s11
  - s8
  - s9
  - s7
---


# AIPREF Content-Usage declaration validity

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Checks whether the site expresses AI usage preferences in the IETF AIPREF form that standards-conformant crawlers will actually parse — `Content-Usage` in robots.txt and/or as an HTTP response header — and validates syntax, vocabulary, and whether the declared preferences are attached to paths where they legally have effect.

## Claimed mechanism (falsifiable)

draft-ietf-aipref-attach-05 defines the only two attachment points a conformant crawler reads: the `Content-Usage` HTTP response header and the `Content-Usage:` robots.txt directive with optional path prefix (s11). draft-ietf-aipref-vocab-07 fixes the value grammar: an RFC 8941 structured-field dictionary over the categories `train-ai` and `search`, with token values `y` and `n`. Anything absent is *unknown*, and crawlers resolve unknown using their own default rather than yours (s10). Three falsifiable consequences follow. First, a site publishing only Cloudflare's legacy `Content-Signal: search=yes, ai-train=no` emits zero AIPREF preference: an AIPREF parser sees `unknown` for every category. Second, `yes` and `no` are not valid AIPREF tokens, so `Content-Usage: train-ai=no` fails structured-field parsing. Third, attach-05 states that 'Disallowed paths have no associated usage preferences', so a `Content-Usage` scoped to a path the same agent group Disallows is inert by specification.

## Evidence

- **[A Vocabulary For Expressing AI Usage Preferences (draft-ietf-aipref-vocab-07)](https://datatracker.ietf.org/doc/draft-ietf-aipref-vocab/)** — IETF aipref WG (Paul Keller, Open Future; Martin Thomson, Mozilla) (draft-spec, URL verified 2026-08-20)
  - ACTIVE, version 07, 2026-08-19, intended status Proposed Standard, WG-adopted. Categories: `train-ai` (modify learned parameters of a generative model) and `search` (select assets and direct users to their location, with excerpt conditions). Values are single-character tokens: `y` = allow, `n` = disallow, absent = unknown. Expressed as an RFC 8941 Structured Field dictionary, e.g. `train-ai=y, search=n`. Three-value outcome model: allowed / disallowed / unknown.
- **[Attaching AI Usage Preferences to Content (draft-ietf-aipref-attach-05)](https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/)** — IETF aipref WG (draft-spec, URL verified 2026-08-20)
  - ACTIVE, version 05, 2026-08-18. Two attachment mechanisms: (1) HTTP response header `Content-Usage: train-ai=n`; (2) robots.txt directive `Content-Usage: train-ai=n` with optional path prefix, e.g. `Content-Usage: /ai-ok/ train-ai=y`, using the same path-prefix matching as Allow/Disallow. Precedence rules: preferences apply only to crawlable resources — "Disallowed paths have no associated usage preferences"; longest matching path prefix wins. No well-known location is defined.
- **[Content Signals Policy (announcement)](https://blog.cloudflare.com/content-signals-policy/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Defines the `Content-Signal:` robots.txt directive with signals `search`, `ai-input`, `ai-train` and values `yes`/`no` (omission = no preference). Canonical example: `User-Agent: *` / `Content-Signal: search=yes, ai-train=no` / `Allow: /`. Deployed as default on ~3.8M Cloudflare domains. Cloudflare deliberately does not emit an `ai-input` signal.
- **[Content Signals (AIPREF guide)](https://contentsignals.org/)** — Cloudflare / contentsignals.org (article, URL verified 2026-08-20)
  - Resolves HTTP 200. Page now self-describes as "An up-to-date guide to the IETF's proposed new AI Preferences (aipref)" — i.e. the Content-Signal vocabulary is being folded into the IETF AIPREF work (s10/s11). Body is JS-rendered behind Cloudflare, so scrape the meta description or the drafts directly.
- **[Managed robots.txt — Cloudflare Bots](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Cloudflare PREPENDS its own block to the origin's robots.txt: `User-Agent: *` / `Content-signal: search=yes, ai-train=no, use=reference` / `Allow: /`. When the origin already serves robots.txt it combines both files, Cloudflare's block first. This is the mechanism by which a site's own AI policy gets silently overridden at the edge — directly auditable by diffing declared vs. served robots.txt.

## Competitor coverage

Nobody ships AIPREF validation. Lighthouse's agentic category covers llms.txt quality and WebMCP, not licensing signals. Semrush/Ahrefs AI toolkits parse robots.txt for AI user-agent Disallow lines only. Dark Visitors generates robots.txt AI blocks but does not emit or validate `Content-Usage`. Cloudflare emits `Content-Signal` but ships no validator, and its own managed output is not yet AIPREF-conformant.

## Implementation sketch

Static-fetch only. 1) GET /robots.txt; tokenise line-wise, collecting `Content-Usage:` (case-insensitive) both at file scope and within each `User-agent` group, and separately collecting legacy `Content-Signal:`. 2) Each Content-Usage value may be preceded by a path prefix (`Content-Usage: /ai-ok/ train-ai=y`); split the optional leading path token, then parse the remainder as an RFC 8941 dictionary (a ~60-line parser, or the `structured-headers` npm package). 3) Validate keys against {train-ai, search} plus any newer registered categories, and values against tokens y|n. Reject bare strings `yes`/`no` with a distinct 'legacy Content-Signal syntax in an AIPREF directive' message. 4) GET the homepage and 2 sampled content pages; read the `Content-Usage` response header and parse identically. 5) Apply attach-05 precedence: for each declared (path-prefix, category) pair, resolve which User-agent group applies and check the longest-matching Allow/Disallow; if the path is disallowed for that group, flag the preference as inert. 6) Cross-check the robots.txt directive against the HTTP header for the same path and flag disagreement. Verdict: pass when at least one valid, non-inert declaration exists and header/robots agree; warn when only legacy `Content-Signal` is present (migration gap); fail on structured-field syntax errors, unknown category tokens, or preferences attached only to disallowed paths.

## Example failure

A publisher wants an opt-out of AI training. Their robots.txt (or Cloudflare's prepended managed block) reads `Content-Signal: search=yes, ai-train=no` and nothing else. An AIPREF-conformant crawler looks for `Content-Usage`, finds none, resolves `train-ai` to *unknown*, and applies its own permissive default. The opt-out the operator believes they published is unenforceable under the very standard the industry is converging on. A second variant: `Content-Usage: train-ai=no` — `no` is not a valid token, the dictionary fails to parse, and the whole directive is dropped.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

The sketch's six steps ship: collection at file scope and per group, the leading
path token split off before parsing, RFC 8941 parsing, category and value
validation with a distinct message for legacy `Content-Signal` syntax, the
attach-05 inertness rule, and the robots-versus-header cross-check.

Three decisions the sketch leaves open.

**`ai-input` is not an AIPREF category.** It is Cloudflare's Content-Signal
vocabulary. Accepting it inside a `Content-Usage` line would pass exactly the
migration mistake this audit exists to catch, so it is reported as an unknown
category. The cross-channel audit still reads it, because there it arrives on
the directive that defines it.

**The parser is RFC 8941, not AIPREF.** `parseDictionary` in
`gatherers/structured-fields.ts` accepts `train-ai=yes` — `yes` is a
syntactically valid token — and this audit rejects it against the vocabulary
with a message naming the directive it belongs to. Putting the vocabulary in
the parser would have made a general header parser refuse a legal structured
field.

**Inertness is only reported for robots.txt declarations.** attach-05 gives the
rule for the robots.txt attachment, where the same file carries the
`Allow`/`Disallow` that decides it. A `Content-Usage` response header arrives
with the resource, so a crawler that received it was allowed to fetch it.

Status bands follow the sketch's verdict list: a syntax or vocabulary error, a
channel disagreement, or every declaration inert fails; only legacy
`Content-Signal`, or a valid declaration beside an inert one, warns; a valid,
crawlable, consistent declaration passes. No declaration at all is
`notApplicable` — AIPREF is a draft, and not publishing a preference is not a
defect.

## Deferred

- **Longest-prefix resolution between two declarations.** attach-05 says the
  longest matching prefix wins, so two declarations for nested paths are not a
  contradiction. This audit compares only declarations with the same scope, which
  under-reports rather than inventing a conflict the spec resolves.
- **Newer registered categories.** The vocabulary draft may register more than
  `train-ai` and `search`. Until it does, an unregistered token is more likely a
  typo than a forward reference, and the finding says which categories exist.
