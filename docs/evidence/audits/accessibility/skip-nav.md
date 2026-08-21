---
audit: accessibility/skip-nav
audit_id: "7.1"
category: accessibility
source_file: packages/core/src/audits/accessibility/skip-nav.ts
slug: skip-nav
review_verdict: delete
severity: high
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# skip-nav (`7.1`)

> accessibility · source `skip-nav.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

Headless browser agents (Claude computer use, GPTBot with browser) parse the accessibility tree to navigate pages efficiently. A skip navigation link lets these agents jump directly to primary content without processing every nav element, reducing latency and improving content extraction accuracy.

## Code review findings (2026-08-20, 11-agent pass)

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

## Evidence

### Signal: Skip links ("skip to content") as an AI-agent navigation aid — grade D (semantic-dom-a11y)

**Mechanism:** Falsifiable claim under test: the presence of a skip-to-content link measurably improves an AI agent's or crawler's ability to locate and reach a page's main content. REFUTED — no agent traverses tab order, so the affordance a skip link provides (bypassing repeated nav during sequential keyboard focus) has no analogue in any documented agent perception or action loop.

**Evidence:** No supporting evidence found. Exhaustive search of vendor agent docs, extraction-library source, W3C specs and the web-agent literature surfaced zero references to skip links as a machine-consumed signal. Mechanically the affordance cannot apply: a11y-tree agents address elements by opaque reference (ref_2 / e5 / uid) obtained from a full-page snapshot and jump straight to any node [anthropic-browser-use-tool, playwright-mcp-snapshots, chrome-devtools-mcp-tool-reference]; pixel agents click coordinates [openai-computer-use-guide, gemini-computer-use-docs]; extractors delete the nav region wholesale rather than skipping past it [mozilla-readability-source, trafilatura-xpaths]. The genuine machine-readable way to mark main content is the <main> landmark, which is a separate, well-evidenced signal.

**Counter-evidence:** Counter-evidence is the entire finding. Beyond the absence of any consumer, a visually-hidden skip link is a mild NEGATIVE for a11y-tree agents: it adds a link node near the top of every snapshot whose accessible name ('Skip to content') competes with real navigation targets. Adoption sits at ~24% of pages [web-almanac-2025-accessibility], and Google disclaims special AI optimizations entirely [google-ai-features-docs]. There is no draft spec or standards-track work pointing at machine consumption of skip links, so this does not qualify for the experimental tier. Recommendation: remove skip-nav from the AI-readiness score and keep it, if at all, as a pure human-accessibility/WCAG 2.4.1 check clearly labelled as not an agent signal.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) · [chrome-devtools-mcp tool reference (take_snapshot)](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md) · [Computer use — OpenAI API guide](https://developers.openai.com/api/docs/guides/tools-computer-use) · [Computer use — Gemini API](https://ai.google.dev/gemini-api/docs/computer-use) · [mozilla/readability Readability.js source](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js) · [trafilatura/xpaths.py (BODY_XPATH, OVERALL_DISCARD_XPATH)](https://raw.githubusercontent.com/adbar/trafilatura/master/trafilatura/xpaths.py) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/accessibility/skip-nav.md](../../deletions/accessibility/skip-nav.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
