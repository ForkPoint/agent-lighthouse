---
audit: access-crawl-control/ai-usage-signal-coherence-across-channels
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/ai-usage-signal-coherence-across-channels.ts
slug: ai-usage-signal-coherence-across-channels
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - s7
  - s8
  - s10
  - s11
  - s12
  - w3c-tdmrep-final-report
---


# AI usage signal coherence across channels

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Normalises every AI-usage signal the site emits — robots.txt Allow/Disallow, AIPREF Content-Usage, legacy Content-Signal, TDMRep in its three transports, RSL permits/prohibits, and noai robots directives — into one comparable model and reports where they contradict each other. Different crawlers read different channels, so contradictory signals mean different AI systems reach opposite conclusions about the same content.

## Claimed mechanism (falsifiable)

There is no defined precedence *between* these standards; each specifies only its own parsing. The channels differ:
  - TDMRep is carried in a well-known JSON array, an HTTP header and a meta tag (s17).
  - AIPREF is carried in robots.txt and an HTTP header (s11).
  - RSL is carried in robots.txt, a Link header, an HTML link and an inline script (s12).
  - Content-Signal is carried in robots.txt (s8).

Falsifiable. Normalise each channel to (path-scope, usage-category, allow|deny) triples, then compare. Two channels asserting opposite values for the same category and overlapping path scope is a mechanically detectable contradiction. It provably yields divergent outcomes, because a TDMRep-aware crawler and an AIPREF-aware crawler read disjoint inputs. The highest-value instance is documented directly. Cloudflare's managed robots.txt prepends `Content-signal: search=yes, ai-train=no, use=reference` above the operator's own file, so the operator's stated policy can be contradicted at the edge without their knowledge (s7).

## Evidence

- **[Managed robots.txt — Cloudflare Bots](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Cloudflare PREPENDS its own block to the origin's robots.txt: `User-Agent: *` / `Content-signal: search=yes, ai-train=no, use=reference` / `Allow: /`. When the origin already serves robots.txt it combines both files, Cloudflare's block first. This is the mechanism by which a site's own AI policy gets silently overridden at the edge — directly auditable by diffing declared vs. served robots.txt.
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

## Competitor coverage

No tool cross-references these standards. Agent Lighthouse already ships a TDMRep audit, but it checks only the meta tag and the well-known file in isolation — it misses the HTTP `tdm-reservation` transport and never compares TDMRep against robots.txt, Content-Signal, or RSL. This check is the aggregation layer over the existing single-signal audits and is where the differentiated insight lives.

## Implementation sketch

Static-fetch, reusing artefacts already fetched by the other checks. 1) Gather: /robots.txt (per-agent Allow/Disallow, Content-Usage, Content-Signal, License); homepage + sampled pages' response headers (Content-Usage, tdm-reservation, tdm-policy, X-Robots-Tag incl. the noai/noimageai convention); HTML meta tdm-reservation / tdm-policy and `<meta name="robots" content="noai">`; /.well-known/tdmrep.json (validate it is an ARRAY of {location, tdm-reservation, tdm-policy} — a bare object is non-conformant per s17); the discovered RSL document's permits/prohibits. 2) Map each into the AIPREF category space: TDMRep `tdm-reservation: 1` → train-ai=n site-wide (or for `location`); RSL `<prohibits type="usage">ai-input</prohibits>` → ai-input=n; Content-Signal `ai-train=no` → train-ai=n; a blanket `Disallow: /` for GPTBot → train-ai=n for that agent; noai → train-ai=n. 3) For each (category, overlapping path scope) emit a contradiction finding when two channels disagree, naming both channels and the exact conflicting lines. 4) Emit a separate 'edge override' finding when robots.txt contains a Content-Signal/Content-Usage block above the operator's own directives that disagrees with a signal they publish elsewhere — the managed-robots.txt trap. 5) Emit a distinct 'no signal in any channel' warning, which is a different remediation from a contradiction. 6) Verdict: fail on contradiction, warn on total silence, pass on coherent (or coherently silent-plus-one-declaration).

## Example failure

A publisher adds `<meta name="tdm-reservation" content="1">` site-wide to claim an EU DSM Art. 4 opt-out, while robots.txt (unchanged for years) still carries `User-agent: GPTBot` / `Allow: /` with no Content-Usage directive, and Cloudflare has prepended `Content-signal: search=yes, ai-train=no, use=reference`. Three channels, three different answers for train-ai. A TDMRep-aware crawler skips the site, an AIPREF-aware crawler reads Cloudflare's block rather than the publisher's intent, and a robots-only crawler trains on everything.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Absorbed proposal

`competitor-gap-verify/content-signal-coherence` folded into this audit on
2026-08-23 rather than shipping beside it. It read one channel — the
`Content-Signal` lines of robots.txt, with RFC 9309 group precedence applied to
them the way `access-crawl-control/robots-ai-group-shadowing` applies it to
rules — and this audit reads five, that one included. Two audits would have
reported the same Cloudflare edge-override twice, under two names, and a
contradiction spanning `Content-Signal` and any other channel would have
belonged to neither. Its dossier is kept at
[merged/access-crawl-control/content-signal-coherence.md](../../merged/access-crawl-control/content-signal-coherence.md).

Its mechanism ships whole: `Content-Signal` values map into the same category
space as everything else (`ai-train` → `train-ai`, `search` → `search`,
`ai-input` → `ai-input`), a line written inside a named group binds only that
group, and a `Content-Signal` block sitting above every directive the operator
wrote is reported as an edge override rather than as an inconsistent policy.

## Implementation deviations

The audit sends no request. Every channel it reads was already fetched by the
scan: `/robots.txt` and `/.well-known/tdmrep.json` from `ctx.rootFiles`, the
response headers and meta tags from the sampled pages, and RSL from the inline
`<script type="application/rsl+xml">` blocks those pages carry.

**RSL by inline script only.** The sketch also resolves the `License:` directive
and the `Link: rel=license` header to a document and reads its
permits/prohibits. That is a fetch, and
`access-crawl-control/rsl-licensing-terms-conformance` already makes it. Reading
the same document twice in one scan to answer two questions is a request this
audit does not need to spend.

**A contradiction needs two channels.** Two lines of one channel disagreeing is
that channel's own precedence question, and the audit that owns the channel
answers it — `robots-ai-group-shadowing` for robots.txt rules,
`aipref-content-usage-declaration-validity` for `Content-Usage`. Only
cross-channel disagreement is reported here.

**Path scopes overlap by prefix.** attach-05 defines longest-prefix matching for
`Content-Usage`; TDM-Rep's `location` and RSL's `<content url>` are also
prefixes. Two declarations are compared when either prefix contains the other,
which is the same test in all three vocabularies.

**Silence warns, it does not fail.** A site that declares nothing is not
misconfigured — it has left every crawler to its own default, which is a real
cost but not a contradiction. A scan that read neither a page nor a robots.txt
is `notApplicable`: nothing could have carried a signal.

## Deferred

- **EPUB TDM-Rep.** The report defines a fourth transport, `tdm:reservation` in
  EPUB metadata. A web scan never sees it.
- **Per-agent AIPREF scoping.** `Content-Usage` inside a `User-agent` group is
  read as that group's, but AIPREF itself does not define per-agent
  preferences — attach-05 attaches them to resources. If the draft grows agent
  scoping, the comparison here needs revisiting.
- **Diffing declared against served robots.txt.** Cloudflare's prepend is
  detected by position, which is what a scanner can see from outside. Proving it
  came from the edge would need the origin's own copy, which only the operator
  has.
