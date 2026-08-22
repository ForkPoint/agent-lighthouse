---
audit: accessibility/skip-nav
category: accessibility
audit_id: "7.1"
source_file: packages/core/src/audits/accessibility/skip-nav.ts
slug: skip-nav
review_verdict: delete
severity: high
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# skip-nav — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned: agent browsers that read a page as an accessibility tree (Anthropic's browser-use `read_page`, Playwright/Playwright-MCP aria snapshots, browser-use) must spend tokens/latency on repeated navigation chrome before reaching primary content. A conventional skip link (`<a href="#main-content">Skip to main content</a>`) placed as the first focusable element would give such an agent a documented, cheap entry point to the article body — either by following the anchor to jump the DOM, or by using it as a boundary marker that separates nav boilerplate from content. If true, sites with skip links would give agents faster, more accurate main-content extraction.

## What we searched

WebSearch quota for this session was already exhausted (200/200), so I researched via direct primary-source WebFetch, authenticated GitHub code search, and a live browser experiment. I fetched Anthropic's computer-use tool doc and browser-use tool doc on platform.claude.com to establish what a named vendor agent actually perceives; Playwright's aria-snapshots doc for how agent snapshots are built; W3C ARIA-in-HTML and HTML-AAM for role mappings. I then ran a controlled experiment: served a probe page containing a standard visually-hidden skip link, nav, main, aside, address and decorative images, and captured the real Chromium accessibility snapshot through Playwright MCP (the same representation class that Claude's browser-use `read_page` returns). I searched browser-use's repo via `gh search code` for how it serializes the DOM. I also checked the Agent Lighthouse audit set for an existing `main-element` audit that would cover the same affordance.

## Best evidence found for the audit

The premise's first half is real and Grade-A documented: Anthropic's browser use tool doc states it works with the page "through its structure (the accessibility tree, elements, forms, and tabs)" and that `read_page` returns "the page's accessibility tree as text with each element tagged with a reference such as [ref_2]", and it tells developers to "Prefer references where the page has a usable accessibility tree." So agents genuinely do consume the a11y tree. That is the strongest evidence found — but it supports landmarks generally, not skip links. In my live snapshot the skip link appeared only as one more `link "Skip to main content"` node at the top of the tree; nothing in it functioned as a jump. No vendor doc, spec, or agent library found anywhere mentions skip links as an agent affordance.

## Counter-evidence

1) The audit's own description names Claude computer use as a consumer of the accessibility tree — that is affirmatively false. Anthropic's computer-use doc describes perception as "screenshot capabilities and mouse/keyboard control", with zoom for illegible regions, and contains no mention of an accessibility tree or DOM; it explicitly contrasts this with the separate browser use tool whose "member tools read and act on the page itself" (https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool). A screenshot-driven agent cannot see a skip link at all, because the canonical implementation positions it off-screen (`position:absolute;left:-9999px`) until focused. 2) The mechanism is structurally impossible for tree-reading agents: they receive the ENTIRE accessibility tree in one `read_page`/snapshot call, so there is no sequential traversal to skip and no latency to save. My live Chromium snapshot of the probe page proves the skip link is a net cost, not a saving — it added a node (`link "Skip to main content"` with `/url: "#main-content"`) ahead of the content, while the `main` landmark that actually delimits primary content (`- main [ref=e6]:`) was present and machine-addressable regardless of whether a skip link existed. 3) The affordance the audit claims is already delivered by the `main` landmark, which Agent Lighthouse audits separately at /Users/kirov/dev/forkpoint/agent-lighthouse/packages/core/src/audits/semantic-html/main-element.ts — making skip-nav redundant scoring of an already-scored signal. 4) Its cited docsUrl is W3C WCAG technique G1, a human keyboard-accessibility technique that makes no claim about machine agents.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. The a11y tree is genuinely read by named agents (Anthropic browser use tool), but nothing in that chain consumes a skip link: agents get the whole tree at once, so there is nothing to skip, and the `main` landmark already provides the addressable content boundary the audit says skip links provide. Worse, the audit's stated consumer — Claude computer use — is documented as screenshot-only and literally cannot see an off-screen skip link. Per the rubric, D => dead. Note for the maintainers: this is still a legitimate WCAG 2.4.1 human-accessibility check with genuinely wide real-world adoption, so if the project keeps a non-scored human-a11y bucket it belongs there — but the agent-readiness framing and the 'reduces agent latency' impact copy are not supportable and should not carry score weight.

## Sources

- **[Computer use tool](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - Claude's computer use tool perceives the screen exclusively via screenshots and zoom images with mouse/keyboard control; no accessibility tree, DOM, or semantic HTML is mentioned. Directly falsifies the audit's claim that 'Claude computer use parses the accessibility tree', and means a visually-hidden skip link is invisible to it.
- **[Browser use tool](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/browser-use-tool)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - States the tool works with the page 'through its structure (the accessibility tree, elements, forms, and tabs) and through pixels'; `read_page` returns 'the page's accessibility tree as text with each element tagged with a reference such as [ref_2]'. Establishes a named vendor agent that reads the a11y tree — but the doc never mentions skip links, and the whole tree is returned in one call, so there is no traversal to skip.
- **[Aria snapshots](https://playwright.dev/docs/aria-snapshots)** — Microsoft / Playwright (vendor-doc, URL verified 2026-08-21)
  - Aria snapshots capture the accessibility tree as YAML describing roles, attributes, values and text content, 'derived from ARIA attributes or calculated based on HTML semantics'. Confirms the representation class agents consume; makes no mention of skip links.
- **[Live Chromium accessibility snapshot of a probe page (own experiment)](https://playwright.dev/docs/aria-snapshots)** — Own experiment via Playwright MCP + Chromium (study, URL verified 2026-08-21)
  - On a probe page with a canonical off-screen skip link, the snapshot rendered it as a plain extra node: `link "Skip to main content"` with `/url: "#main-content"`, immediately followed by `navigation` and `main [ref=e6]`. The skip link added a token-costing node and conferred no jump capability; the `main` landmark already bounded primary content.
- **[WCAG Technique G1: Adding a link at the top of each page that goes directly to the main content area](https://www.w3.org/WAI/WCAG21/Techniques/general/G1)** — W3C WAI (spec, URL verified 2026-08-21)
  - The audit's own cited source is a human keyboard/screen-reader technique. It frames the benefit entirely in terms of users who navigate sequentially; it makes no claim about automated agents or crawlers.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/accessibility/skip-nav.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

Headless browser agents (Claude computer use, GPTBot with browser) parse the accessibility tree to navigate pages efficiently. A skip navigation link lets these agents jump directly to primary content without processing every nav element, reducing latency and improving content extraction accuracy.

### Code review findings (2026-08-20, 11-agent pass)

Checks for a 'skip to main content' link among the first 5 body links. The premise is cargo cult: an AI agent that parses the accessibility tree or DOM receives the whole document at once and has no tab order to bypass — no crawler or browser agent 'follows' a skip link to save latency, so the stated benefit ('reducing latency and improving content extraction accuracy' for GPTBot/Claude computer use) is invented. It is a human keyboard-navigation affordance. On top of a falsy premise the matcher is English-only and order-brittle, so it fails a large share of legitimate, correctly-built sites.

**Required fix:** Delete. If the team insists on keeping a keyboard-affordance signal, it should live outside the AI-agent scoring model, drop the token whitelist in favour of resolving the anchor target and checking it is (or contains) `<main>`/`role=main`, and stop claiming agent-latency benefits.

**False-positive risks:**
- English-only text matching: `text.includes('skip') || text.includes('jump to') || text.includes('go to main')` — a French ('Aller au contenu principal'), German ('Zum Inhalt springen'), Spanish or Japanese skip link fails despite being perfectly implemented.
- Href whitelist `href.includes('#main') || '#content' || '#skip'` rejects legitimate targets: `href="#primary"`, `href="#page"`, `href="#site-main"` is fine but `href="#hauptinhalt"`, `href="#contenido"`, `href="#top"`, `href="#article"` all fail.
- Only the first 5 anchors are inspected (`$('body a').slice(0, 5)`). Sites that emit a hidden 'accessibility statement' bar, a skip-menu group of 3-4 links (skip to nav / skip to search / skip to footer), or a cookie-banner anchor block before the skip link push it past index 4 → false fail.
- A skip link whose text lives in `aria-label` or a visually-hidden `<span>` sibling with an `<svg>` is missed — `$(el).text()` only sees text nodes.
- CSR SPA / hydration sites: the skip link is rendered by the framework, absent from the fetched HTML → guaranteed fail on every React/Vue SPA regardless of the shipped page.
- WAF interstitial served with HTTP 200 is audited as the real page → fail.
- The audit returns on the FIRST page that has a skip link (pass) but only fails after checking all pages — asymmetric, so a report can pass on a sub-page while the homepage has none.

**Test gaps:**
- No non-English skip-link fixture.
- No fixture where the skip link is the 6th+ anchor (the `slice(0,5)` cliff is untested).
- No fixture with a legitimate non-whitelisted href (`#primary`, `#top`).
- No SPA-shell / empty-body fixture.
- No multi-page fixture proving the first-page-wins short circuit.

**Overlaps with:** _none_

### Evidence

#### Signal: Skip links ("skip to content") as an AI-agent navigation aid — grade D (semantic-dom-a11y)

**Mechanism:** Falsifiable claim under test: the presence of a skip-to-content link measurably improves an AI agent's or crawler's ability to locate and reach a page's main content. REFUTED — no agent traverses tab order, so the affordance a skip link provides (bypassing repeated nav during sequential keyboard focus) has no analogue in any documented agent perception or action loop.

**Evidence:** No supporting evidence found. Exhaustive search of vendor agent docs, extraction-library source, W3C specs and the web-agent literature surfaced zero references to skip links as a machine-consumed signal. Mechanically the affordance cannot apply: a11y-tree agents address elements by opaque reference (ref_2 / e5 / uid) obtained from a full-page snapshot and jump straight to any node [anthropic-browser-use-tool, playwright-mcp-snapshots, chrome-devtools-mcp-tool-reference]; pixel agents click coordinates [openai-computer-use-guide, gemini-computer-use-docs]; extractors delete the nav region wholesale rather than skipping past it [mozilla-readability-source, trafilatura-xpaths]. The genuine machine-readable way to mark main content is the <main> landmark, which is a separate, well-evidenced signal.

**Counter-evidence:** Counter-evidence is the entire finding. Beyond the absence of any consumer, a visually-hidden skip link is a mild NEGATIVE for a11y-tree agents: it adds a link node near the top of every snapshot whose accessible name ('Skip to content') competes with real navigation targets. Adoption sits at ~24% of pages [web-almanac-2025-accessibility], and Google disclaims special AI optimizations entirely [google-ai-features-docs]. There is no draft spec or standards-track work pointing at machine consumption of skip links, so this does not qualify for the experimental tier. Recommendation: remove skip-nav from the AI-readiness score and keep it, if at all, as a pure human-accessibility/WCAG 2.4.1 check clearly labelled as not an agent signal.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) · [chrome-devtools-mcp tool reference (take_snapshot)](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md) · [Computer use — OpenAI API guide](https://developers.openai.com/api/docs/guides/tools-computer-use) · [Computer use — Gemini API](https://ai.google.dev/gemini-api/docs/computer-use) · [mozilla/readability Readability.js source](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js) · [trafilatura/xpaths.py (BODY_XPATH, OVERALL_DISCARD_XPATH)](https://raw.githubusercontent.com/adbar/trafilatura/master/trafilatura/xpaths.py) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/accessibility/skip-nav.md`; that copy removed (one dossier per removed audit, under `sunset/`).
