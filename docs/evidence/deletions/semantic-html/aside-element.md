---
audit: semantic-html/aside-element
category: semantic-html
status: kept-rewrite
verdict: redeemable
evidence_grade: B
reviewed: 2026-08-21
---

# aside-element — redeemed — keep with rewrite

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **B**.

## Claimed mechanism (steelmanned)

Steelmanned: content-extraction pipelines that feed LLMs and answer engines must separate primary article text from boilerplate (sidebars, promos, related links). If those pipelines key on `<aside>` specifically, then marking supplementary content with `<aside>` causes it to be excluded from what the model ingests, and leaving it in undifferentiated `<div>`s causes promos and tangential text to be blended into the model's view of the page — exactly the dilution the audit describes. Separately, agents that read the accessibility tree would see `<aside>` as a `complementary` landmark and could skip it.

## What we searched

WebSearch quota was exhausted, so I went to source. I fetched the raw source of Mozilla Readability (Readability.js on GitHub) and grepped its treatment of `aside`, `unlikelyCandidates`, and `DEFAULT_TAGS_TO_SCORE`. I fetched trafilatura's raw settings.py to read its MANUALLY_CLEANED / MANUALLY_STRIPPED tag lists. I fetched W3C ARIA-in-HTML for the implicit role of `aside`, and Anthropic's browser-use doc to confirm a named vendor agent reads the a11y tree. I then ran a live Chromium accessibility snapshot via Playwright MCP on a probe page containing both a top-level and a nested `<aside>` to see whether the landmark actually reaches an agent. Finally I used authenticated `gh search code` to measure adoption of @mozilla/readability inside LLM/agent tooling.

## Best evidence found for the audit

Two independent, verified consumers act on `<aside>` by name, and the a11y-tree path is confirmed empirically. (1) Mozilla Readability's source contains the literal call `this._clean(articleContent, "aside");` — every `<aside>` is deleted from extracted article content — and `aside` is deliberately absent from `DEFAULT_TAGS_TO_SCORE: "section,h2,h3,h4,h5,h6,p,td,pre"`, so it cannot contribute to content score. (2) trafilatura's `MANUALLY_CLEANED` list begins `"aside", "embed", "fencedframe", "footer", "form", "head", "iframe", "menu", "object", "script", ...` — aside content is dropped wholesale before extraction. Readability powers Firefox Reader Mode and Jina Reader's default pipeline (its README documents `x-respond-with: markdown` as returning markdown "without going through readability", i.e. readability is the default path for the LLM-facing service), and `gh search code` shows @mozilla/readability as a direct dependency of LLM/agent tools including ChatGPTBox-dev/chatGPTBox, CherryHQ/cherry-studio-app, TaxyAI/browser-extension, nhaouari/obsidian-textgenerator-plugin, webwhiz-ai/webwhiz and Bitterbot-AI/bitterbot-desktop. (3) My live Chromium snapshot confirms the a11y-tree path: both the top-level and the nested `<aside>` surfaced as `complementary [ref=e10]` / `complementary [ref=e14]` inside `main`, so an agent using Anthropic's `read_page` sees supplementary blocks explicitly labelled as complementary and can skip them by role.

## Counter-evidence

No positive proof of uselessness was found — no deprecation, no vendor statement of ignoring `<aside>`, and it is a fully ratified HTML/ARIA element (W3C ARIA-in-HTML gives `aside` implicit `role=complementary`). The real weakness is in the audit's implementation, not its mechanism: it passes if ANY scanned page contains at least one `<aside>` anywhere and warns otherwise, with no check that supplementary content actually exists. A page with no sidebar is penalised for correctly having no `<aside>`, and a page whose promo sidebar sits in a bare `<div>` passes as long as one other page used an `<aside>`. There is also a mild counter-nuance worth documenting: because Readability and trafilatura DELETE aside content, wrapping something in `<aside>` guarantees it never reaches the model — correct for promos, destructive if an author wraps genuinely citable content (author bios, key facts) in `<aside>`. The audit's guidance does not warn about this.

## Verdict

**redeemed — keep with rewrite** (grade B)

Grade B => redeemable, and the audit's stated mechanism is essentially verbatim correct. Which consumer reads the signal, and where documented: (a) Mozilla Readability removes `<aside>` via `this._clean(articleContent, "aside")` in Readability.js — the extractor behind Firefox Reader Mode, Jina Reader's readability path, and a long tail of LLM/agent tools; (b) trafilatura removes `<aside>` via its MANUALLY_CLEANED list in trafilatura/settings.py — a standard extractor in LLM corpus pipelines; (c) Chromium exposes `<aside>` as a `complementary` landmark in the accessibility tree that Anthropic's browser use tool returns from `read_page`, which I verified directly by snapshotting a probe page. Save this audit, but fix the check: it should be conditional (only evaluate pages that plausibly HAVE supplementary content — detect sidebar/promo/related-links containers by class/id/position that are not wrapped in `<aside>`), never penalise a page that legitimately has none, and its guidance should state the extraction consequence explicitly (content inside `<aside>` is discarded by Readability and trafilatura, so never put citable facts there).

## Sources

- **[Readability.js (source)](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js)** — Mozilla (repo, URL verified 2026-08-21)
  - Explicitly deletes asides from extracted article content: `this._clean(articleContent, "aside");`. `aside` is excluded from `DEFAULT_TAGS_TO_SCORE: "section,h2,h3,h4,h5,h6,p,td,pre"`, so it cannot contribute to content scoring. The `unlikelyCandidates` regex additionally matches `sidebar|skyscraper|supplemental|related`, and the negative-class-weight regex penalises `sidebar`. Direct, named consumer behavior acting on the <aside> element.
- **[trafilatura/settings.py — MANUALLY_CLEANED / MANUALLY_STRIPPED](https://raw.githubusercontent.com/adbar/trafilatura/master/trafilatura/settings.py)** — Adrien Barbaresi / trafilatura (repo, URL verified 2026-08-21)
  - MANUALLY_CLEANED begins with "aside", followed by footer, form, iframe, menu, nav, script etc. — <aside> subtrees are removed as boilerplate before extraction. trafilatura is a standard HTML-to-text extractor in LLM corpus construction, so aside content is systematically excluded from text that trains and grounds models.
- **[Jina Reader (r.jina.ai) README](https://raw.githubusercontent.com/jina-ai/reader/main/README.md)** — Jina AI (repo, URL verified 2026-08-21)
  - An LLM/agent-facing URL-to-markdown service ('Your LLMs deserve better input'). Documents `x-respond-with: markdown` as returning markdown 'without going through readability', establishing that Readability is the default main-content pipeline for agent-consumed page text.
- **[ARIA in HTML](https://www.w3.org/TR/html-aria/)** — W3C (spec, URL verified 2026-08-21)
  - Ratified spec assigning `aside` the implicit `role=complementary` (and `address` the implicit `role=group`). Gives <aside> a standardised landmark identity that accessibility-tree-reading agents receive.
- **[Live Chromium accessibility snapshot of a probe page (own experiment)](https://playwright.dev/docs/aria-snapshots)** — Own experiment via Playwright MCP + Chromium (study, URL verified 2026-08-21)
  - Both a top-level and a nested <aside> surfaced in the agent-facing snapshot as `complementary [ref=e10]` and `complementary [ref=e14]`, nested inside `main [ref=e6]`. Confirms an agent reading the a11y tree can distinguish supplementary blocks by role; the same content in a bare <div> would have appeared as an undifferentiated `generic` node.
- **[Browser use tool](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/browser-use-tool)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - `read_page` returns 'the page's accessibility tree as text with each element tagged with a reference'; the doc instructs developers to prefer accessibility-tree references over pixel coordinates. Establishes the named vendor agent that receives the `complementary` landmark my experiment observed.
- **[WHATWG HTML — 4.3 Sections (aside, address)](https://html.spec.whatwg.org/multipage/sections.html)** — WHATWG (spec, URL verified 2026-08-21)
  - 'The aside element represents a section of a page that consists of content that is tangentially related to the content around the aside element, and which could be considered separate from that content' — typically sidebars, pull quotes, advertising, navigation groups. The spec definition matches exactly what the extraction libraries strip.

## Review history

- 2026-08-22 — required rework executed (Plan 4, Task 11); the check is now conditional on detected supplementary content, a page that legitimately has none is `notApplicable`, and the guidance states that Readability and trafilatura discard `<aside>` content. `TODO(redeem)` marker removed from the source file.

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **kept-rewrite** (kept, rewrite required per dossier).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
