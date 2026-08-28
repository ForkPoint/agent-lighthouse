---
audit: content-extraction/extraction-determinism
category: content-extraction
source_file: packages/core/src/audits/content-extraction/extraction-determinism.ts
slug: extraction-determinism
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - trafilatura-eval
  - readability-repo
  - readability-src
  - jina-reader
  - firecrawl-scrape-api
  - almanac-markup-2024
---


# Extraction determinism (multi-extractor agreement)

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Run three structurally different main-content extractors against the same HTML and score how much they agree. Report minimum pairwise Jaccard similarity over 5-gram shingles of the extracted text, plus title agreement and a hard flag when readability returns null or under its 500-char threshold. Pass ≥ 0.75 minimum pairwise agreement; warn 0.5-0.75; fail < 0.5 or any extractor returning nothing. Output the diff of what one extractor kept and another dropped — that diff is the deliverable.

## Claimed mechanism (falsifiable)

There is no single 'the content of this page'; there is whatever the fetching agent's extractor decided. Benchmarked over 990 documents, open-source extractors span recall 0.714 to 0.991 and precision 0.534 to 0.936, and the major commercial readers each apply their own undisclosed pipeline. A page whose DOM makes the main region unambiguous (a real <main>/<article>, one dominant text block, low link density) yields near-identical text from all of them. A page built from sibling divs, sectioned card grids, or a content region interleaved with promo blocks yields materially different text per extractor. ChatGPT, Claude and Perplexity are then each answering from a different version of your page. Low-precision extractors additionally carry nav and promo text into the model's context. Falsifiable and stable: same HTML in, same agreement number out.

## Evidence

- **[Trafilatura — evaluation of web content extractors](https://trafilatura.readthedocs.io/en/latest/evaluation.html)** — Adrien Barbaresi / trafilatura docs (study, URL verified 2026-08-20)
  - Benchmark over 990 documents (run dated 2026-08-04): trafilatura 2.2.0 F=0.924 (P 0.906 / R 0.943), magic-html F=0.889, news-please F=0.836, readability-lxml F=0.826, goose3 F=0.810 with precision 0.936 but recall 0.714, inscriptis recall 0.991 with precision 0.534. Extractors disagree massively on what the main content of a page is — quantified spread that justifies an extractor-agreement metric.
- **[mozilla/readability](https://github.com/mozilla/readability)** — Mozilla (repo, URL verified 2026-08-20)
  - parse() returns title, content, textContent, length, excerpt, byline, dir, siteName, lang, publishedTime; charThreshold default 500 chars below which no article is returned; isProbablyReaderable uses minContentLength 140 and minScore 20. Gives concrete pass/fail hooks (null result, length, title) for an extractability check.
- **[Readability.js source — _isProbablyVisible](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js)** — Mozilla (repo, URL verified 2026-08-20)
  - Visibility test is literally: node.style.display != "none" && node.style.visibility != "hidden" && !node.hasAttribute("hidden") && aria-hidden!="true". Only inline styles and attributes are consulted — "It does not evaluate class-based CSS rules from stylesheets." Proof that content hidden by an external stylesheet class is ingested as if visible by the most widely deployed extractor.
- **[Jina Reader (r.jina.ai)](https://jina.ai/reader/)** — Jina AI (vendor-doc, URL verified 2026-08-20)
  - Converts URLs to "clean, LLM-ready" markdown because "raw HTML is cluttered with extraneous elements". Documents X-Target-Selector ("Only extract content matching these CSS selectors"), X-Remove-Selector ("Remove these elements before extraction"), X-Retain-Images ("Strip all images from the output" to reduce token usage), X-Return-Format, X-With-Images-Summary. Token cost of images/boilerplate is an explicit product knob.
- **[Scrape endpoint API reference](https://docs.firecrawl.dev/api-reference/endpoint/scrape)** — Firecrawl (vendor-doc, URL verified 2026-08-20)
  - onlyMainContent default: true (excludes headers, navs, footers via HTML-level filtering, no LLM); removeBase64Images default: true ("Removes all base 64 images from the markdown output"); blockAds default: true; the cleaned html format "Removes <script>, <style>, <noscript>, <meta>, and <head> tags". A commercial extraction vendor defaults to deleting base64 images and chrome — direct evidence these are treated as pure token waste.
- **[Web Almanac 2024 — Markup](https://almanac.httparchive.org/en/2024/markup)** — HTTP Archive (dataset, URL verified 2026-08-20)
  - The median mobile page carries 594 elements, and the 90th percentile 1,716. Median HTML transfer size is 33 kB on desktop and 32 kB on mobile, and 10.5% of mobile pages serve HTML uncompressed. 86% of mobile pages contain at least one HTML comment, and 26% still ship IE conditional comments. SVG is present on 51.6% of pages. Population baseline for calibrating per-page token budgets and for the claim that dead markup ships at scale.

## Competitor coverage

No tool ships extractor-agreement. Lighthouse's agentic checks look at declared affordances (llms.txt, WebMCP tools, a11y tree); AI-visibility platforms sample model outputs after the fact but cannot attribute a wrong answer back to extraction ambiguity. This check turns 'the model got my page wrong' into a reproducible, pre-publication structural number.

## Implementation sketch

Parse once into a DOM (linkedom). Extractor 1: @mozilla/readability. Extractor 2: semantic selector — first non-empty of main, [role=main], article, then largest text-density block — with nav/aside/footer/header removed. Extractor 3: an independent density heuristic (defuddle, or a text-to-link-density scorer in the boilerpipe/trafilatura style). Normalize each output (lowercase, collapse whitespace, strip punctuation), shingle at n=5, compute pairwise Jaccard. Fold in readability's own signals: null return, textContent length < charThreshold (500), and isProbablyReaderable false are automatic fails since they mean the most widely deployed extractor gives an agent nothing. Emit the symmetric difference of the largest disagreeing pair as evidence.

## Example failure

A product page wraps the description in <div class="pdp-col"> siblings alongside a 'customers also bought' grid with equal text volume and no <main>. Readability returns the recommendations carousel, the semantic extractor returns null and falls back to the whole body, the density extractor returns the spec table. Minimum pairwise agreement 0.21 — three answer engines quoting three different pages under the same URL.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

The shipped audit is `content-extraction/extraction-determinism`: the proposal's
`token-economics` domain is a research grouping, not one of the eight v2
categories, and its slug —
`extraction-determinism-multi-extractor-agreement` — produced a 67-character id,
over the 64-character cap `v2-meta.test.ts` enforces. The full name survives as
the audit's title.

The three extractors are `@mozilla/readability` over jsdom, a semantic-container
selector (`main` → `[role=main]` → `article` → `body`, chrome removed), and a
text-density scorer that picks the block with the most text that is not link
text. The proposal names `linkedom` for parsing and `defuddle` as the third
extractor; jsdom is already a dependency of this package and the density scorer
is the one load-bearing idea of the boilerpipe/trafilatura family, written in
place rather than added as a dependency.

Two conditions fail outright, before any comparison runs: readability declining
the document, and readability returning fewer than 500 characters — its own
`charThreshold`. Both mean the same thing, which is that the most widely
deployed extractor of the three hands an agent nothing.

`isProbablyReaderable` is not called separately. It answers a weaker version of
the same question that `parse()` already answers definitively, and calling it
would parse the document twice.

Agreement is pairwise Jaccard over five-word shingles. Above 0.8 all three are
reading the same article; below 0.6 two of them are reading different documents.
The 0.6–0.8 warn band is this implementation's, not the proposal's.

The applicability gate measures the page's whole visible text, not its main
content. Asking an extractor whether there is anything to extract would decide
the question with the tool under test.

Only the entry page is compared. Three extractions cost one jsdom parse and two
cheerio passes; running that per page would multiply the scan's cost to report
the same template property.
- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the first scanned page through three
  extractors, and `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on
  a parked domain a broker's page from another host, on a walled or throttled
  origin nothing at all. It now consults `scanReadTheSite()` and returns
  `notApplicable` carrying the gate's own reason.
  Verdicts that moved on the five nothing-obtained contract states: redirected
  away pass → na, HTTP 200 bot challenge unchanged. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Deferred

- **A fourth extractor.** Two heuristics plus readability already separate "one
  article" from "three answers". A fourth adds cost without adding a verdict.
- **Per-template sampling.** Extraction determinism is a property of the
  template. Sampling one page per detected template needs template detection,
  which this wave does not build.
