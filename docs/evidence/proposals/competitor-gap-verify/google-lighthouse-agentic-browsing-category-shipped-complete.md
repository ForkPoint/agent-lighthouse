---
check: google-lighthouse-agentic-browsing-category-shipped-complete
title: "Google Lighthouse — Agentic Browsing category (SHIPPED, complete list)"
domain: competitor-gap-verify
status: proposed
evidence_grade: A
uniqueness: commodity
difficulty: headless-browser
scoring_tier: informative (weight 0)
reviewed: 2026-08-20
---

# Google Lighthouse — Agentic Browsing category (SHIPPED, complete list)

> Proposed check. Evidence grade **A** · commodity · implementation: `headless-browser`

## What it checks

The entire shipped category is 6 auditRefs, read directly off main: (1) agent-accessibility-tree — filters the existing axe-core violations to a hardcoded 33-rule set (button-name, input-button-name, input-image-alt, label, link-name, select-name, document-title, 24 aria-* rules, duplicate-id-aria, definition-list, table-duplicate-name, tabindex, autocomplete-valid, presentation-role-conflict, svg-img-alt); (2) webmcp-form-coverage — INFORMATIVE, lists <form>s lacking toolname/tooldescription; (3) webmcp-registered-tools — INFORMATIVE, dumps imperative + declarative tools with source location and inputSchema; (4) webmcp-schema-validity — form-level toolname/tooldescription present, per-field name attribute on required/optional params, per-field description; (5) cumulative-layout-shift — the existing CLS metric, reused verbatim; (6) llms-txt — GET /llms.txt, then exactly three regexes: /^\s*#\s+.+/m for an H1, /\[.+\]\(.+\)/ for any markdown link, and content.length < 50. 4xx is notApplicable (a missing llms.txt is never penalised), 5xx scores 0. Two of six audits are informative-only and all three WebMCP audits return notApplicable when artifacts.WebMCP.isSupported is false, so on stock Chrome the category collapses to CLS + a11y-subset + three llms.txt regexes.

## Claimed mechanism (falsifiable)

Falsifiable: check out GoogleChrome/lighthouse@main, read core/config/agentic-browsing-config.js, and the auditRefs array will contain exactly these six ids and no others. Therefore any Agent Lighthouse check whose logic is 'does /llms.txt have an H1 and a link', 'do WebMCP forms carry toolname/tooldescription', or 'do interactive elements have accessible names' is reproducible for free with `lighthouse --preset=agentic-browsing` and is not a differentiator. Conversely, any check outside these six is absent from Lighthouse as of 2026-08-20.

## Evidence

- **[Lighthouse core/config/agentic-browsing-config.js (main branch)](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/config/agentic-browsing-config.js)** — GoogleChrome/lighthouse (repo, URL verified 2026-08-20)
  - Complete shipped list of the Agentic Browsing category: exactly 6 auditRefs — agent-accessibility-tree, webmcp-form-coverage, webmcp-registered-tools, webmcp-schema-validity, cumulative-layout-shift, llms-txt. Two groups (webmcp, agent-accessibility). Category description says 'still under development and subject to change'. Copyright 2026 Google LLC.
- **[Lighthouse core/audits/agentic/llms-txt.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/llms-txt.js)** — GoogleChrome/lighthouse (repo, URL verified 2026-08-20)
  - Entire llms.txt audit logic is three regexes on the body of GET /llms.txt: /^\s*#\s+.+/m (H1), /\[.+\]\(.+\)/ (any markdown link), content.length < 50 (too short). 4xx => notApplicable, 5xx => score 0. No section parsing, no link resolution, no link liveness, no blockquote summary, no discovery via <link> or robots.txt.
- **[Lighthouse core/gather/gatherers/agentic/llms-txt.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/gather/gatherers/agentic/llms-txt.js)** — GoogleChrome/lighthouse (repo, URL verified 2026-08-20)
  - Fetches only new URL('/llms.txt', finalDisplayedUrl) — hardcoded root path, single request, no llms-full.txt, no .md mirrors.
- **[Lighthouse core/audits/agentic/agent-accessibility-tree.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/agent-accessibility-tree.js)** — GoogleChrome/lighthouse (repo, URL verified 2026-08-20)
  - Pure re-slice of the existing axe-core Accessibility artifact: filters violations to a hardcoded 33-rule TARGET_RULES set (button-name, label, link-name, select-name, document-title, aria-*, tabindex, autocomplete-valid, svg-img-alt, ...). Binary score. No new gathering, no agent-specific semantics.
- **[Lighthouse webmcp-registered-tools / webmcp-form-coverage / webmcp-schema-validity audits](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/webmcp-form-coverage.js)** — GoogleChrome/lighthouse (repo, URL verified 2026-08-20)
  - registered-tools and form-coverage are INFORMATIVE (never fail the score). All three return notApplicable when artifacts.WebMCP.isSupported is false — i.e. on any Chrome without the WebMCP flag the whole WebMCP group silently scores nothing. schema-validity only checks form-level toolname/tooldescription attributes and per-field name/description presence.
- **[Lighthouse agentic browsing docs — llms.txt audit](https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt)** — Google / Chrome Developers (vendor-doc, URL verified 2026-08-20)
  - Confirms the shipped docs set: Scoring, Registered WebMCP tools, Forms missing declarative WebMCP, WebMCP schema validity, Accessibility for agents, Layout stability. Explicitly: a 404 on llms.txt is notApplicable because 'providing the file is optional at the moment' — Lighthouse never penalises a missing llms.txt.

## Competitor coverage

Google, shipped on main and documented at developer.chrome.com/docs/lighthouse/agentic-browsing/*, surfaced in DevTools and (after PR #17090) the PSI viewer.

## Implementation sketch

Replication requires a headless Chrome with the WebMCP flag for 3 of 6 audits; the llms.txt and CLS audits are trivial. Our llms-txt-exists / llms-txt-sections / llms-txt-blockquote / llms-txt-link-descriptions / llms-txt-links-valid / webmcp-* / accessibility audits all sit at least partly inside this footprint and must be positioned on depth (link liveness, section semantics, description quality) rather than on existence.

## Example failure

Claiming 'we validate llms.txt structure, Lighthouse doesn't' is false — Lighthouse ships llms-txt today. The defensible claim is narrower: Lighthouse never fails a site for a MISSING llms.txt (404 => notApplicable), never resolves or fetches the links inside it, and never looks for llms-full.txt or a <link rel> pointer.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade A does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
