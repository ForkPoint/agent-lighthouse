---
audit: machine-discovery/llms-txt-exists
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/llms-txt-exists.ts
slug: llms-txt-exists
evidence_grade: C
disposition: "merged 2026-08-22 (Plan 4, Task 4) — absorbs llms-txt-link (4.11)"
reviewed: 2026-10-18
recommended_tier: scored
tier_rationale: "Recommended scored; ships informative. The A was never argued: the frontmatter carried grade A while the file's own research signal read grade C, verdict REFUTED. Re-graded C / informative / weight 0 (evidence sweep, 2026-08-24)."
consumers:
  - "Google Lighthouse 13.3+ agentic-browsing audit (an auditor, not an agent)"
  - Dataprovider.com and SEO audit tools (observed in logs)
  - none-known among answer engines or LLM crawlers
  - "Google Lighthouse 13.3+ (llms-txt audit: H1, markdown-link, 50-char checks)"
  - DebugBear agentic-browsing suite
  - "none-known for blockquote, descriptions, or link validity"
  - Googlebot / Google AI Overviews
  - GPTBot
  - OAI-SearchBot
  - ClaudeBot
  - PerplexityBot
  - Agent Lighthouse itself (audit correctness precondition)
signals:
  - name: /llms.txt existence at domain root (llmstxt.org proposal)
    grade: C
    domain: llms-txt
  - name: "llms.txt content quality conventions (H1, blockquote summary, sectioned links with descriptions, link validity)"
    grade: B
    domain: llms-txt
  - name: Soft-404 / SPA catch-all rewrite (HTTP 200 for everything) as a false-result source
    grade: A
    domain: technical-infra
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
  - google-fix-search-javascript
  - google-http-status-codes
  - google-crawl-budget-docs
  - vercel-rise-of-ai-crawler
  - ahrefs-llmstxt-study
---

# llms-txt-exists (`1.1`)

> machine-discovery · source `llms-txt-exists.ts` · absorbs llms-txt-link (4.11) · evidence grade **C** · tier **informative** (weight 0)

## What it checks

`GET /llms.txt` returns 200 with a body that starts with `#`. The audit also reports whether a `<link rel="alternate">` or `<link rel="describedby">` in the first page's head points at that file. It is informative, so no outcome moves the score.

| State                                               | Result                      |
| :-------------------------------------------------- | :-------------------------- |
| 200, not an HTML page, body starts with `#`         | `pass`                      |
| 200, not an HTML page, body does not start with `#` | `pass`, gap named           |
| no file, and no head link points at it              | `notApplicable`             |
| no file, but a head link points at it               | `notApplicable`, link named |

"No file" means a non-200 status, no response, or an HTML page served at the path. An HTML page there is a site shell answering every URL, not the file.

The head link is reported in every branch, as `discovery <link> → <href>` or `no discovery <link> in <head>`. It changes the message in one case only: a link to a file that is not served.

## Why it matters

No AI vendor documents reading llms.txt or llms-full.txt from a website at runtime. An [Ahrefs study of 137,210 domains](https://ahrefs.com/blog/llmstxt-study/) (verified 2026-10-18) found that 97% of llms.txt files received no requests in a month. AI tools never asked for a missing file. Tools a user points at the file, such as documentation helpers in coding agents, can still read it. [Chrome Lighthouse](https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt) (verified 2026-10-18) is the one shipping checker of the file. It flags a file with no H1 heading or no links. Lighthouse is a checker, not a consumer, so it does not change the grade.

## How it scores

Informative, weight 0. Every result carries an `unconsumed` notice: no AI vendor documents reading this file. The audit never warns or fails. An absent file is not applicable. A file that is present passes, and a file that does not start with a # heading is named in the pass message, with the note that it does not affect AI agents.

## Evidence

### Signal: /llms.txt existence at domain root (llmstxt.org proposal) — grade C (llms-txt)

**Mechanism:** Publishing a well-formed /llms.txt at the domain root causes major AI crawlers and agents (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended) to fetch it and use it to navigate the site, measurably increasing retrieval coverage or citation rate. FALSIFIABLE TEST: AI-crawler request rate to /llms.txt in server logs, and matched-pair citation-rate lift.

**Evidence:** Refuted as a retrieval mechanism, and supported only as a signal of convention-following. The spec is real and actively maintained: llmstxt.org v2, 2026-08-10, about 2.6k GitHub stars. Adoption is non-trivial too — 8.7% of the Tranco top-1,000, or 15.8% of the 549 reachable, and about 10.13% across a 300k-domain SE Ranking sample. All four major AI labs publish one, with HTTP 200 verified on Anthropic, OpenAI, Perplexity, Cloudflare, Stripe, GitHub and Vercel. Google Chrome ships a real llms-txt audit in Lighthouse 13.3's Agentic Browsing category — the audit and gatherer source were read directly. But no vendor anywhere documents an agent consuming it. Four independent log studies converge on near-zero AI-crawler interest. Otterly saw 84 of 62,100 requests over 90 days (0.1%). Evil Martians saw about 770 fetches, of which only 37 came from named AI assistants, across 268k agent requests. Dries Buytaert saw 52 requests in a month, and 'every one came from SEO audit tools'. Wislr watched 48 days and 19 bots, and recorded 'zero hits from GPTBot, ClaudeBot, PerplexityBot, or any other AI crawler.' MaxAEO's 2,400-domain matched-pair study found citation rates of 11.8% with the file against 11.6% without — +0.2pp, inside the noise band.

**Counter-evidence:** Google Search Central explicitly names the file: 'LLMS.txt files and other special markup: You don't need to create new machine readable files... Doing so will neither harm nor help your site's visibility or rankings in Google Search, as Google Search ignores them.' John Mueller: 'it's purely speculative for now (the file has existed for years, yet none of the AI systems use it).' Gary Illyes: Google does not support it and has no plans to. Perplexity's crawler doc names only robots.txt. OpenAI's crawler doc never mentions it. No W3C or IETF standing — a search of w3.org found only unrelated AI groups. The widely-repeated 'June 2026 W3C proposal to standardize llms.txt' appears to be SEO blogspam with no primary source. Crucially, Lighthouse itself returns notApplicable (score 1) on HTTP 404 — even Google does not penalize absence. Beware the vendor-incentive trap: the main pro-adoption data comes from Mintlify and Profound, who sell llms.txt tooling, with no published methodology.

### Signal: llms.txt content quality conventions (H1, blockquote summary, sectioned links with descriptions, link validity) — grade B (llms-txt)

**Mechanism:** An llms.txt that conforms to structural conventions is machine-parseable and passes automated validation, whereas a malformed one fails. Split precisely: (a) H1 present, (b) at least one [text](url) markdown link, (c) length >= 50 chars are enforced by a real shipping consumer; (d) blockquote summary, (e) per-link descriptions, (f) link validity are spec-optional with no known enforcing consumer. FALSIFIABLE TEST: run the exact Lighthouse regexes against the file.

**Evidence:** This is the best-evidenced llms.txt signal because it has an exact, documented, shipping consumer whose rules were read in source rather than inferred. Lighthouse core/audits/agentic/llms-txt.js (Copyright 2026 Google LLC) applies three precise tests: hasH1 = /^\s*#\s+.+/m, hasLink = /\[.+\]\(.+\)/, and isTooShort = content.length < 50. It scores 1 only if all three pass. The failure strings are 'File is missing a required H1 header', 'File does not appear to contain any links' and 'File is suspiciously short'. This is verifiable and reproducible, independently corroborated by DebugBear and by an SEJ case where a file with working bare URLs failed until links were wrapped in markdown syntax. The spec backs (a): the H1 is 'the only required section'. Auditing conformance is therefore defensible even though the underlying file's value to agents is not — this signal grades the parseability claim, which is true, not the retrieval claim, which is refuted.

**Counter-evidence:** Sharply scope this signal. The blockquote convention is optional in the spec, unchecked by Lighthouse, and not universally followed even by exemplars. Across 7 major vendor files measured for this dossier, all 7 had an H1 and markdown links, but only 5 had a blockquote. Anthropic and Stripe both omit it, so failing sites for a missing blockquote would fail Anthropic's own file. Lighthouse checks no link validity, no per-link descriptions, and no section structure. SEJ's caveat is the honest frame: 'The audit checks whether your file is mechanically parseable. It does not check whether the file describes your website usefully.' And parseability is worth little when the consumer population is near-empty — Lighthouse is an auditor, not an agent, and it scores a 404 as notApplicable. Link-validity checking is also expensive at scale (Vercel's file has 1,872 links).

### Signal: Soft-404 / SPA catch-all rewrite (HTTP 200 for everything) as a false-result source — grade A (technical-infra)

**Mechanism:** A server that returns HTTP 200 with an application shell for URLs that do not exist causes two distinct harms. Crawlers spend capacity on valueless error pages, and may index them. And any automated audit that infers file existence from a 2xx status produces false positives — reporting llms.txt, robots.txt, feeds or .md mirrors as 'present' when the origin merely echoed the SPA shell. Falsifiable form: request a guaranteed-nonexistent path; if the response is 2xx with body content resembling the site shell, every existence check on that origin is unreliable until content-based verification is applied.

**Evidence:** Documented vendor behaviour, and additionally verifiable by construction. Google names the exact failure mode: 'When a SPA is using client-side JavaScript to handle errors they often report a 200 HTTP status code instead of the appropriate status code. This can lead to error pages being indexed and possibly shown in search results', with the prescribed fixes being a redirect to a URL that genuinely returns 404, or a robots noindex. Google's status-code reference defines a soft 404 as content that 'suggests an error... an empty page or an error message' returned with a 2xx code. The crawl-budget guide states flatly that 'Soft 404 pages will continue to be crawled, and waste your budget.' Vercel's measurements show AI crawlers are far more exposed to that waste than Googlebot: 34.82% of ChatGPT fetches and 34.16% of Claude fetches land on 404s, against 8.22% for Googlebot. For the audit tool itself the mechanism is not probabilistic at all — a 200-for-everything origin defeats status-based existence probes deterministically, so soft-404 detection must run as a precondition gate before any other file-presence audit is trusted.

**Counter-evidence:** No AI vendor publishes its own soft-404 heuristic. The specific detection thresholds are therefore Google-derived, and the claim that GPTBot or ClaudeBot penalise soft 404s is not directly documented. What is documented is that they waste a third of their fetches on error responses. Detection also has a false-positive risk of its own: a legitimately-configured site may return 200 for a probe path that happens to exist, and some CDNs return 200 with a custom error body by design. The audit should therefore verify via body content (shell fingerprint, absence of expected markers) and not by status code alone, and should report soft-404 as a confidence-degrading condition rather than a page-quality failure.

## Implementation deviations

- **Absorbs `llms-txt-link` (4.11).** Its dossier is kept at
  [merged/machine-discovery/llms-txt-link.md](../../merged/machine-discovery/llms-txt-link.md).
- **Grade C, informative, weight 0.** No AI vendor documents a consumer of
  `/llms.txt`. Publishing a file is not consuming one. No SDO hosts a draft,
  and the measured citation effect is inside noise.
- **Chrome Lighthouse checks the file; it does not consume it.** It fetches
  only `/llms.txt`, reads no `<link>`, and scores a 4xx as not applicable.
  Counting a linter as a consumer would make this project evidence for itself.
- **Outcomes.** A missing file is not applicable. A file advertised by a
  `<link>` but not served warns at `low`. A file without an H1 warns at `low`.
  A file with an H1 passes.
- **The head link never changes the status on its own.** No consumer of the
  link is documented, so its state goes into `found`.
- **Link detection** matches the resolved pathname against `/\/llms\.txt$/i`.
  Any content type is accepted. `rel` is a lower-cased token list, and
  `describedby` counts beside `alternate`.
- **Existence cannot be scored.** If a scored llms.txt signal is ever wanted,
  only the conformance rules (H1, one markdown link, over 50 characters) have a
  shipping checker. That signal would be conditional on the file existing.
- **Report only, from 2026-10-18.** The 2026-10-18 consumer review (policy.md, "Informative or obsolete") keeps this audit informative with an `unconsumed` notice and removes every warn and fail. A file with no # heading now passes with the gap named. A page that links to a missing llms.txt is now not applicable, because the file is absent; the message still names the dead link.
