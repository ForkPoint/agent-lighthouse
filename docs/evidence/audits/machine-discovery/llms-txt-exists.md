---
audit: machine-discovery/llms-txt-exists
audit_id: "1.1, 4.11"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/llms-txt-exists.ts
slug: llms-txt-exists
review_verdict: fix
severity: medium
evidence_grade: C
disposition: "merged 2026-08-22 (Plan 4, Task 4) — absorbs llms-txt-link (4.11)"
reviewed: 2026-08-24
---

# llms-txt-exists (`1.1`)

> machine-discovery · source `llms-txt-exists.ts` · absorbs llms-txt-link (4.11) · evidence grade **C** · tier **informative** (weight 0)

## What it checks

`GET /llms.txt` returns 200 with a markdown body, plus — reported, not scored — whether a `<link>` in the page head points at that file.

| State | Result |
| :--- | :--- |
| 200 with a body starting with `#` | `pass` |
| 200 but no markdown heading | `warn`, priority `high` |
| non-200 or no response | `fail`, priority `critical` |

The discovery `<link>` is appended to `found` in every branch (`discovery <link> → <href>` or `no discovery <link> in <head>`), and when the file is missing *and* a link points at it the message says so — a link to a file that is not served is the one case where the absorbed signal changes what the user reads.

## Code review findings (2026-08-20, 11-agent pass)

Checks GET /llms.txt returns 200 and the body starts with '#'. The signal is defensible in 2026 (llms.txt is widely published — Anthropic, Stripe, Cloudflare, Mintlify auto-generation), but no major agent vendor has confirmed consuming it, so labelling it 'the primary way AI agents discover your site content' at CRITICAL priority overstates the evidence and mis-ranks the user's fix queue. Implementation is status-only with no content-type check, so SPA catch-all HTML soft-404s are graded as a malformed llms.txt rather than a missing one.

**Required fix:** Add a content-type/body sniff to a shared `_root-file.ts` helper: treat 200 + `text/html` or a body starting with `<` as NOT FOUND rather than malformed. Accept front-matter and setext headings before requiring '#'. Downgrade defaultPriority from critical to medium and rewrite the impact copy to 'a growing convention some agent tooling reads' instead of asserting agents depend on it.

**False-positive risks:**
- `isOk` is `result.status === 200` with no content-type check. Netlify/Vercel/Next.js SPA rewrites return 200 + `<!doctype html>` for /llms.txt; the audit then reports WARN 'llms.txt missing markdown heading' — telling the user to fix a file that does not exist.
- `result.body.trimStart().startsWith('#')` accepts `#` with no space (`#Site`, or a `#comment` line) but rejects a valid file that opens with YAML front-matter (`---`), an HTML comment, or a setext H1 (`Site\n====`).
- No handling of a 200 that is a CDN interstitial/challenge page, nor of servers that return 403/503 to the scanner UA — those become 'llms.txt not found', identical messaging to a genuine 404.
- Case/path variants (`/LLMS.txt`, `/.well-known/llms.txt`) and llms.txt referenced from robots.txt or a `<link>` are never consulted.

**Test gaps:**
- 200 response serving an HTML SPA shell (the dominant real-world false result)
- 403/503/challenge page from a WAF instead of 404
- Body with YAML front-matter, BOM, CRLF line endings, or leading blank lines
- Non-UTF8 / gzip-encoded body
- llms.txt declared at a non-root path or via robots.txt

**Overlaps with:** `1.2`, `1.3`, `1.4`, `1.5`

## Evidence

### Signal: /llms.txt existence at domain root (llmstxt.org proposal) — grade C (llms-txt)

**Mechanism:** Publishing a well-formed /llms.txt at the domain root causes major AI crawlers and agents (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended) to fetch it and use it to navigate the site, measurably increasing retrieval coverage or citation rate. FALSIFIABLE TEST: AI-crawler request rate to /llms.txt in server logs, and matched-pair citation-rate lift.

**Evidence:** REFUTED on the retrieval mechanism; SUPPORTED only as a compliance/convention signal. The spec is real and actively maintained (llmstxt.org v2, 2026-08-10, ~2.6k GitHub stars) and adoption is non-trivial: 8.7% of Tranco top-1,000 (15.8% of the 549 reachable), ~10.13% across a 300k-domain SE Ranking sample, and all four major AI labs publish one (I verified HTTP 200 on Anthropic, OpenAI, Perplexity, Cloudflare, Stripe, GitHub, Vercel). Google Chrome ships a real llms-txt audit in Lighthouse 13.3's Agentic Browsing category — I read the audit and gatherer source directly. BUT no vendor anywhere documents an agent consuming it, and four independent log studies converge on near-zero AI-crawler interest: Otterly 84/62,100 requests over 90 days (0.1%); Evil Martians ~770 fetches of which only 37 came from named AI assistants across 268k agent requests; Dries Buytaert 52 requests in a month, 'every one came from SEO audit tools'; Wislr 48 days/19 bots, 'zero hits from GPTBot, ClaudeBot, PerplexityBot, or any other AI crawler.' MaxAEO's 2,400-domain matched-pair study found citation rates of 11.8% (with) vs 11.6% (without) — +0.2pp, inside the noise band.

**Counter-evidence:** Google Search Central explicitly names the file: 'LLMS.txt files and other special markup: You don't need to create new machine readable files... Doing so will neither harm nor help your site's visibility or rankings in Google Search, as Google Search ignores them.' John Mueller: 'it's purely speculative for now (the file has existed for years, yet none of the AI systems use it).' Gary Illyes: Google does not support it and has no plans to. Perplexity's crawler doc names only robots.txt. OpenAI's crawler doc never mentions it. No W3C or IETF standing — I searched w3.org and found only unrelated AI groups; the widely-repeated 'June 2026 W3C proposal to standardize llms.txt' appears to be SEO blogspam with no primary source. Crucially, Lighthouse itself returns notApplicable (score 1) on HTTP 404 — even Google does not penalize absence. Beware the vendor-incentive trap: the main pro-adoption data comes from Mintlify and Profound, who sell llms.txt tooling, with no published methodology.
**Consumers:** Google Lighthouse 13.3+ agentic-browsing audit (an auditor, not an agent), Dataprovider.com and SEO audit tools (observed in logs), none-known among answer engines or LLM crawlers · **Recommended tier:** informative

**Sources:** [The /llms.txt file, v2](https://llmstxt.org/) · [AnswerDotAI/llms-txt repository](https://github.com/AnswerDotAI/llms-txt) · [Lighthouse core/audits/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/agentic/llms-txt.js) · [Lighthouse core/gather/gatherers/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/gather/gatherers/agentic/llms-txt.js) · [llms.txt | Lighthouse | Chrome for Developers](https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt) · [AI features and your website — AI optimization guide (mythbusting section)](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) · [Google Confirms LLMs.txt Has No Current Implementation / 'purely speculative for now'](https://www.searchenginejournal.com/google-says-llms-txt-is-purely-speculative-for-now/577576/) · [Google says llms.txt files won't harm or help your search rankings](https://searchengineland.com/google-says-llms-txt-files-wont-harm-or-help-your-search-rankings-480264) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [LLMS.txt Adoption Tracker (Tranco top 1,000)](https://www.rankability.com/data/llms-txt-adoption/) · [llms.txt and AI Visibility: Results from OtterlyAI's GEO Study](https://otterly.ai/blog/the-llms-txt-experiment/) · [Which AI actually reads your site? Two months of LLM traffic, measured](https://evilmartians.com/chronicles/which-ai-actually-reads-your-site-two-months-of-llm-traffic-measured) · [Markdown, llms.txt and AI crawlers](https://dri.es/markdown-llms-txt-and-ai-crawlers) · [AI Bot Traffic Is Accelerating Fast. 48 Days of Server Logs Expose What GPTBot, ChatGPT, ClaudeBot, and 16 Others Are Doing](https://www.wislr.com/articles/ai-bot-behavior-log-analysis/) · [Does llms.txt Work? Evidence From AI Citation Data](https://maxaeo.ai/blog/does-llms-txt-work/) · [Direct measurement of vendor llms.txt files and markdown content negotiation (2026-08-20)](https://llmstxt.org/)

### Signal: llms.txt content quality conventions (H1, blockquote summary, sectioned links with descriptions, link validity) — grade B (llms-txt)

**Mechanism:** An llms.txt that conforms to structural conventions is machine-parseable and passes automated validation, whereas a malformed one fails. Split precisely: (a) H1 present, (b) at least one [text](url) markdown link, (c) length >= 50 chars are enforced by a real shipping consumer; (d) blockquote summary, (e) per-link descriptions, (f) link validity are spec-optional with NO known enforcing consumer. FALSIFIABLE TEST: run the exact Lighthouse regexes against the file.

**Evidence:** This is the best-evidenced llms.txt signal because it has an exact, documented, shipping consumer whose rules I read in source rather than inferring. Lighthouse core/audits/agentic/llms-txt.js (Copyright 2026 Google LLC) applies precisely: hasH1 = /^\s*#\s+.+/m, hasLink = /\[.+\]\(.+\)/, isTooShort = content.length < 50, scoring 1 only if all three pass, with failure strings 'File is missing a required H1 header', 'File does not appear to contain any links', 'File is suspiciously short'. This is verifiable and reproducible, independently corroborated by DebugBear and by an SEJ case where a file with working bare URLs failed until links were wrapped in markdown syntax. The spec backs (a): the H1 is 'the only required section'. Auditing conformance is therefore defensible even though the underlying file's value to agents is not — this signal grades the parseability claim, which is true, not the retrieval claim, which is refuted.

**Counter-evidence:** Sharply scope this signal. The blockquote convention is optional in the spec, unchecked by Lighthouse, and not universally followed even by exemplars: in my measurement of 7 major vendor files, 7/7 had an H1 and markdown links but only 5/7 had a blockquote — Anthropic and Stripe both omit it, so failing sites for a missing blockquote would fail Anthropic's own file. Lighthouse checks NO link validity, NO per-link descriptions, and NO section structure. SEJ's caveat is the honest frame: 'The audit checks whether your file is mechanically parseable. It does not check whether the file describes your website usefully.' And parseability is worth little when the consumer population is near-empty — Lighthouse is an auditor, not an agent, and it scores a 404 as notApplicable. Link-validity checking is also expensive at scale (Vercel's file has 1,872 links).
**Consumers:** Google Lighthouse 13.3+ (llms-txt audit: H1, markdown-link, 50-char checks), DebugBear agentic-browsing suite, none-known for blockquote, descriptions, or link validity · **Recommended tier:** scored

**Sources:** [Lighthouse core/audits/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/agentic/llms-txt.js) · [Lighthouse core/gather/gatherers/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/gather/gatherers/agentic/llms-txt.js) · [llms.txt | Lighthouse | Chrome for Developers](https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt) · [Agentic Browsing category | Lighthouse | Chrome for Developers](https://developer.chrome.com/docs/lighthouse/agentic-browsing) · [Lighthouse: llms.txt does not follow recommendations](https://www.debugbear.com/docs/agentic-browsing/llms-txt-does-not-follow-recommendations) · [Lighthouse Fails Your llms.txt Without Markdown Links](https://www.searchenginejournal.com/lighthouse-fails-your-llms-txt-without-markdown-links/577590/) · [The /llms.txt file, v2](https://llmstxt.org/) · [Direct measurement of vendor llms.txt files and markdown content negotiation (2026-08-20)](https://llmstxt.org/)

### Signal: Soft-404 / SPA catch-all rewrite (HTTP 200 for everything) as a false-result source — grade A (technical-infra)

**Mechanism:** A server that returns HTTP 200 with an application shell for URLs that do not exist causes two distinct harms: crawlers spend capacity on and may index valueless error pages, and any automated audit that infers file existence from a 2xx status produces false positives — reporting llms.txt, robots.txt, feeds or .md mirrors as 'present' when the origin merely echoed the SPA shell. FALSIFIABLE FORM: request a guaranteed-nonexistent path; if the response is 2xx with body content resembling the site shell, every existence check on that origin is unreliable until content-based verification is applied.

**Evidence:** Documented vendor behaviour, and additionally verifiable by construction. Google names the exact failure mode: 'When a SPA is using client-side JavaScript to handle errors they often report a 200 HTTP status code instead of the appropriate status code. This can lead to error pages being indexed and possibly shown in search results', with the prescribed fixes being a redirect to a URL that genuinely returns 404, or a robots noindex. Google's status-code reference defines a soft 404 as content that 'suggests an error... an empty page or an error message' returned with a 2xx code, and the crawl-budget guide states flatly that 'Soft 404 pages will continue to be crawled, and waste your budget.' Vercel's measurements show AI crawlers are far more exposed to this waste than Googlebot: 34.82% of ChatGPT fetches and 34.16% of Claude fetches land on 404s versus 8.22% for Googlebot. For the audit tool itself the mechanism is not probabilistic at all — a 200-for-everything origin defeats status-based existence probes deterministically, so soft-404 detection must run as a precondition gate before any other file-presence audit is trusted.

**Counter-evidence:** No AI vendor publishes its own soft-404 heuristic, so the specific detection thresholds are Google-derived and the claim that GPTBot or ClaudeBot penalise soft 404s is not directly documented — what IS documented is that they waste a third of their fetches on error responses. Detection also has a false-positive risk of its own: a legitimately-configured site may return 200 for a probe path that happens to exist, and some CDNs return 200 with a custom error body by design. The audit should therefore verify via body content (shell fingerprint, absence of expected markers) and not by status code alone, and should report soft-404 as a confidence-degrading condition rather than a page-quality failure.
**Consumers:** Googlebot / Google AI Overviews, GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Agent Lighthouse itself (audit correctness precondition) · **Recommended tier:** scored

**Sources:** [Fix Search-related JavaScript problems](https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript) · [How HTTP status codes, and network and DNS errors affect Google Search](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) · [Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)

## Absorbed evidence — llms-txt-link (4.11)

4.11 checked for `<link rel="alternate" type="text/plain" title="…llms…">` in the head. It is the same claim as this audit's ("an agent can find your llms.txt"), one hop earlier, so the C3 collapse makes it one audit: the file is the signal, the link is a hint about the file.

Its dossier is kept verbatim at [merged/machine-discovery/llms-txt-link.md](../../merged/machine-discovery/llms-txt-link.md) (grade **C**).

### Grade decision: was **A**, corrected to **C** on 2026-08-24 — see [Re-grade](#re-grade-evidence-sweep-2026-08-24)

#### The 2026-08-22 reasoning, kept as history

4.11 graded **C**: the llms.txt v2 spec (2026-08-10) does define `rel="alternate" type="text/markdown"` and `rel="describedby"`, and Cloudflare deploys the former, but the `describedby → llms.txt` half has *no known consumer at all* — Lighthouse's own gatherer resolves `new URL('/llms.txt', finalDisplayedUrl)` and never looks at link tags. Weaker evidence than the target's and not proven for the merged signal, so nothing is raised: the audit keeps grade **A**, `tier: scored`, `weight 1.0`.

### Why the link never fails a site

v1 failed at priority `high` on a site that correctly served /llms.txt at the well-known path — the exact path the spec defines for discovery — because no `<link>` advertised it. With no documented consumer for that link, charging a passing site for its absence is unsupported guidance. The link state is therefore reported in `found` and never changes the status, which is the fold's version of the review's "at most a warn, not a high fail".

### Required fixes from 4.11 — landed 2026-08-22

- **Match the href, not the title.** `title.toLowerCase().includes('llms')` made an optional, language-dependent attribute mandatory; detection now tests the resolved pathname against `/\/llms\.txt$/i`.
- **No MIME requirement.** `type === 'text/plain'` rejected `text/markdown` (arguably the correct type), `text/plain; charset=utf-8` and an omitted type. Any type is accepted.
- **No cross-file false positive.** `includes('llms')` matched `title="LLMs-full.txt"`, so a site publishing only llms-full.txt passed the llms.txt link check. The filename anchor removes it.
- **Normalized `rel`.** `rel === 'alternate'` was an exact, case-sensitive compare; `rel` is now lower-cased and split into tokens, and the spec's `describedby` is accepted alongside `alternate`.
- **The well-known path is consulted first.** The file's own status drives the result; the link is reported against it.


## Re-grade (evidence sweep, 2026-08-24)

**A → C. Scored → informative. Weight 1.0 → 0.**

### Why the A was wrong

The A was never argued. This file carried `evidence_grade: A` in frontmatter
while its own embedded research signal read **grade C**, verdict **REFUTED on
the retrieval mechanism**, `Consumers: none-known`, `Recommended tier:
informative`. The "Grade decision: stays A" section above does not defend the A
either — it only argues that the absorbed 4.11 link signal is too weak to
*raise* the grade. The A was inherited from the pre-review v1 audit and survived
the merge unexamined. `POLICY.md` meanwhile used llms.txt existence as its
worked example of grade **C**.

### The re-sweep, 2026-08-24

The question asked was narrow: has any AI vendor documented a *consumer* of
`/llms.txt`? Primary sources only.

**No.** Checked and empty at: Anthropic's crawler article and web-fetch tool
reference (the fetch tool cannot reach a URL that has not appeared in context,
so root-path discovery is architecturally excluded); OpenAI's crawler overview
and Codex `AGENTS.md` docs; Google Search Central's AI-optimization guide;
Google's crawler-infrastructure list; Perplexity's crawler doc; Mistral's
`/robots`; Meta's web-crawlers doc — including `Meta-ExternalFetcher`, the
agentic one; xAI (no crawler policy published at all); Microsoft Learn and the
Bing Webmaster Blog; Cursor's `@Docs` docs and its own feature-request thread;
Cloudflare's AI Index announcement and AI Crawl Control tracking; llmstxt.org
v2 and the AnswerDotAI reference repo; the IANA Well-Known URIs and Link
Relations registries; the IETF Datatracker across four query formulations.

Six of the eleven vendors publish an `llms.txt` for their own documentation.
None documents reading one. That distinction is what the A collapsed.

Google Search Central, updated 2026-07-10, still states it verbatim: *"You
don't need to create new machine readable files, AI text files, markup, or
Markdown to appear in Google Search … as Google Search itself doesn't use
them."*

Two claims that circulate in secondary coverage are refuted, not merely
unproven. **Cursor does not consume llms.txt** — a Cursor staff member replied
to the feature request on 2025-06-25 with *"does seem like something we should
support!"*, and nothing shipped since. **Cloudflare is a generator, not a
consumer** — AI Index produces the file for customers, and Cloudflare's own
crawler-behaviour tracking watches `robots.txt` only.

### Lighthouse checks the file; it does not consume it

Chrome's Lighthouse gatherer resolves `new URL('/llms.txt', finalDisplayedUrl)`
and issues one fetch. It reads no `<link>`, follows no link inside the file, and
never fetches `llms-full.txt`. The audit applies three tests — an H1, one
markdown link, and a length over 50 characters — and **treats HTTP 4xx as
`notApplicable` with score 1**. Google's own prose calls llms.txt *"an emerging
convention"*, says it is *"optional at the moment"*, and names no agent that
reads it.

A site-quality linter fetching a file to grade it is the same act as this
project fetching it. Counting that as consumption would make Agent Lighthouse
evidence for its own audit.

The sharpest fact in the sweep: the only documented fetcher of llms.txt in the
world returns not-applicable when the file is missing, while this audit returned
`fail` at `critical` priority and weight 1.0.

### Against the policy bar

Grade **A** requires a vendor doc stating that a named agent reads the signal.
None exists. Grade **B** requires a draft standard with meaningful adoption, or
strong empirical evidence of effect. There is no draft at any SDO — verified at
IANA and IETF on 2026-08-24 — publisher adoption is not evidence of
consumption, and the measured effect is +0.2pp, inside noise. **Grade C, tier
informative, weight 0.**

### What the audit does now

- Missing file → **not applicable**, matching the one shipping checker. It is
  no longer a `critical` failure.
- File advertised by a `<link>` but not served → **warn** at `low`. A site that
  made the promise itself is the one llms.txt state worth reporting as wrong.
- File served without an H1 → **warn** at `low`.
- File served with an H1 → **pass**.
- Description and guidance no longer claim the file is "the primary way AI
  agents discover your site content" or that ChatGPT, Perplexity and Claude
  "must crawl your entire site blindly" without it. Both statements are refuted
  by the sweep above.

### What is deliberately not lost

The *conformance* rules (H1, one markdown link, over 50 characters) do have an
exact shipping checker whose source was re-read on 2026-08-24. If a scored
llms.txt signal is ever wanted, that is the only defensible one, and it must be
scored as "the file you published is mechanically parseable", conditional on the
file existing. The existence of the file cannot be scored.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources) on both source audits.
- 2026-08-21 — dispositions approved: 1.1 keep-with-fixes, 4.11 folds in (C3 collapse).
- 2026-08-22 — 4.11 folded in with its required fixes (Plan 4, Task 4); registry 172 → 171.
- 2026-08-24 — evidence sweep: grade A → C, tier scored → informative, weight 1.0 → 0. Absence is now not applicable. No AI vendor documents a consumer; Chrome Lighthouse checks the file as an auditor and scores a missing one not-applicable.
