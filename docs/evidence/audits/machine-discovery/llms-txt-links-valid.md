---
audit: machine-discovery/llms-txt-links-valid
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/llms-txt-links-valid.ts
slug: llms-txt-links-valid
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-24
recommended_tier: scored
tier_rationale: "Recommended scored; ships informative. The B rested on a signal whose mechanism covers checks this audit does not perform. Re-graded C / informative / weight 0 (evidence sweep, 2026-08-24)."
consumers:
  - "Google Lighthouse 13.3+ (llms-txt audit: H1, markdown-link, 50-char checks)"
  - DebugBear agentic-browsing suite
  - "none-known for blockquote, descriptions, or link validity"
signals:
  - name: /llms.txt existence at domain root (llmstxt.org proposal)
    grade: C
    domain: llms-txt
  - name: "llms.txt content quality conventions (H1, blockquote summary, sectioned links with descriptions, link validity)"
    grade: B
    domain: llms-txt
sources:
  - llmstxt-spec-link
  - llmstxt-repo
  - lighthouse-llms-txt-audit-source
  - lighthouse-llms-txt-gatherer-source
  - chrome-lighthouse-llms-txt-doc
  - google-ai-optimization-mythbusting
  - google-ai-features-trust
  - sej-google-llms-txt-speculative
  - sel-google-llms-txt-no-effect
  - perplexity-crawlers-docs
  - s18
  - rankability-adoption-tracker
  - otterly-llmstxt-experiment
  - evil-martians-llm-traffic
  - dries-buytaert-markdown-llmstxt
  - wislr-48day-log-study
  - maxaeo-citation-study
  - chrome-lighthouse-agentic-browsing
  - debugbear-llms-txt-audit-doc
  - sej-lighthouse-markdown-links
---

# llms-txt-links-valid (`1.5`)

> content-discoverability · source `llms-txt-links-valid.ts` · review verdict **fix** · evidence grade **C** · tier **informative** (weight 0) · disposition: **keep — fix required**

## What it checks

Valid links in llms.txt ensure AI agents can navigate to your content without encountering dead ends.

## Evidence

### Signal: /llms.txt existence at domain root (llmstxt.org proposal) — grade C (llms-txt)

**Mechanism:** Publishing a well-formed /llms.txt at the domain root causes major AI crawlers and agents (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended) to fetch it and use it to navigate the site, measurably increasing retrieval coverage or citation rate. FALSIFIABLE TEST: AI-crawler request rate to /llms.txt in server logs, and matched-pair citation-rate lift.

**Evidence:** Refuted as a retrieval mechanism, and supported only as a signal of convention-following. The spec is real and actively maintained: llmstxt.org v2, 2026-08-10, about 2.6k GitHub stars. Adoption is non-trivial too — 8.7% of the Tranco top-1,000, or 15.8% of the 549 reachable, and about 10.13% across a 300k-domain SE Ranking sample. All four major AI labs publish one, with HTTP 200 verified on Anthropic, OpenAI, Perplexity, Cloudflare, Stripe, GitHub and Vercel. Google Chrome ships a real llms-txt audit in Lighthouse 13.3's Agentic Browsing category — the audit and gatherer source were read directly. But no vendor anywhere documents an agent consuming it. Four independent log studies converge on near-zero AI-crawler interest. Otterly saw 84 of 62,100 requests over 90 days (0.1%). Evil Martians saw about 770 fetches, of which only 37 came from named AI assistants, across 268k agent requests. Dries Buytaert saw 52 requests in a month, and 'every one came from SEO audit tools'. Wislr watched 48 days and 19 bots, and recorded 'zero hits from GPTBot, ClaudeBot, PerplexityBot, or any other AI crawler.' MaxAEO's 2,400-domain matched-pair study found citation rates of 11.8% with the file against 11.6% without — +0.2pp, inside the noise band.

**Counter-evidence:** Google Search Central explicitly names the file: 'LLMS.txt files and other special markup: You don't need to create new machine readable files... Doing so will neither harm nor help your site's visibility or rankings in Google Search, as Google Search ignores them.' John Mueller: 'it's purely speculative for now (the file has existed for years, yet none of the AI systems use it).' Gary Illyes: Google does not support it and has no plans to. Perplexity's crawler doc names only robots.txt. OpenAI's crawler doc never mentions it. No W3C or IETF standing — a search of w3.org found only unrelated AI groups. The widely-repeated 'June 2026 W3C proposal to standardize llms.txt' appears to be SEO blogspam with no primary source. Crucially, Lighthouse itself returns notApplicable (score 1) on HTTP 404 — even Google does not penalize absence. Beware the vendor-incentive trap: the main pro-adoption data comes from Mintlify and Profound, who sell llms.txt tooling, with no published methodology.

### Signal: llms.txt content quality conventions (H1, blockquote summary, sectioned links with descriptions, link validity) — grade B (llms-txt)

**Mechanism:** An llms.txt that conforms to structural conventions is machine-parseable and passes automated validation, whereas a malformed one fails. Split precisely: (a) H1 present, (b) at least one [text](url) markdown link, (c) length >= 50 chars are enforced by a real shipping consumer; (d) blockquote summary, (e) per-link descriptions, (f) link validity are spec-optional with no known enforcing consumer. FALSIFIABLE TEST: run the exact Lighthouse regexes against the file.

**Evidence:** This is the best-evidenced llms.txt signal because it has an exact, documented, shipping consumer whose rules were read in source rather than inferred. Lighthouse core/audits/agentic/llms-txt.js (Copyright 2026 Google LLC) applies three precise tests: hasH1 = /^\s*#\s+.+/m, hasLink = /\[.+\]\(.+\)/, and isTooShort = content.length < 50. It scores 1 only if all three pass. The failure strings are 'File is missing a required H1 header', 'File does not appear to contain any links' and 'File is suspiciously short'. This is verifiable and reproducible, independently corroborated by DebugBear and by an SEJ case where a file with working bare URLs failed until links were wrapped in markdown syntax. The spec backs (a): the H1 is 'the only required section'. Auditing conformance is therefore defensible even though the underlying file's value to agents is not — this signal grades the parseability claim, which is true, not the retrieval claim, which is refuted.

**Counter-evidence:** Sharply scope this signal. The blockquote convention is optional in the spec, unchecked by Lighthouse, and not universally followed even by exemplars. Across 7 major vendor files measured for this dossier, all 7 had an H1 and markdown links, but only 5 had a blockquote. Anthropic and Stripe both omit it, so failing sites for a missing blockquote would fail Anthropic's own file. Lighthouse checks no link validity, no per-link descriptions, and no section structure. SEJ's caveat is the honest frame: 'The audit checks whether your file is mechanically parseable. It does not check whether the file describes your website usefully.' And parseability is worth little when the consumer population is near-empty — Lighthouse is an auditor, not an agent, and it scores a 404 as notApplicable. Link-validity checking is also expensive at scale (Vercel's file has 1,872 links).

## Re-grade (evidence sweep, 2026-08-24)

**B → C. Scored → informative. Weight 0.6 → 0.**

### The audit was graded on evidence for checks it does not perform

The B came from the "content quality conventions" signal, whose own mechanism
paragraph splits the checks explicitly: (a) H1 present, (b) at least one
`[text](url)` markdown link and (c) length over 50 characters **are enforced by
a real shipping consumer**; (d) blockquote summary, (e) per-link descriptions
and **(f) link validity are spec-optional with no known enforcing consumer**.

This audit implements (f). Its own counter-evidence already said so —
_"Lighthouse checks **no** link validity."_ The Lighthouse audit source was
re-read on 2026-08-24 and that is still exactly true: three regex and length
tests, no link is ever fetched.

So the audit was scored at weight 0.6 on a grade earned by different checks,
for a signal its own dossier records as having no known consumer, inside a file
whose existence has no known consumer either — see the parallel re-grade in
[llms-txt-exists](llms-txt-exists.md#re-grade-evidence-sweep-2026-08-24), which
covers the eleven-vendor sweep behind that last clause.

**Grade C, tier informative, weight 0.** Together with `llms-txt-exists`, 1.6 of
weight leaves the scored set.

### What the audit does now

- No llms.txt at the site root → **not applicable**. Whether the file exists is
  `machine-discovery/llms-txt-exists`; reporting it here too made one absent
  file cost two rows, one of them a `critical` failure telling the site to go
  create the file.
- Broken links inside a published file → **warn** at `low`, was `fail` at
  `high`.
- An llms.txt with no links at all → **warn** at `low`, was `medium`.
- Guidance no longer claims broken links waste an agent's context window or
  degrade answers about the site. No agent is documented to read the file.

## Limits

The audit checks at most 20 links, taken evenly from the start to the end of
the file, with 4 requests in flight at a time. Each link is fetched with
redirects followed. A link that answers 401, 403 or 429, or does not answer,
is reported as unverifiable, not broken: the answer is about the scanner, not
the link. When no checked link can be verified, the result is not applicable.

## Link-burst fix (2026-10-17)

A corpus scan of a site whose llms.txt lists about 300 pages in four
languages sent every link at once: 304 page requests in 16 s. The site's WAF
answered 403 to the rest of that scan, and later scans from the same address
could not connect at all. The audit carries weight 0, so the burst cost the
other audits their evidence and bought nothing.

Changes, all from the required fix of the 2026-08-20 review:

- At most 20 links are checked, 4 at a time (was every link, all at once).
- 401, 403, 429 and no answer are unverifiable, not broken.
- Redirects are followed before a link is judged.
- The broken list names the right URLs. The old code filtered the results and
  then took each URL from the filtered index, so it named the link before the
  broken one.

## Deferred

- Relative links. `extractMarkdownLinks` keeps absolute links only, so a file
  of relative links still reads as "No links found". Not changed here.
- `ctx.wafProtection` is not read. The unverifiable class covers the same
  answers link by link.
