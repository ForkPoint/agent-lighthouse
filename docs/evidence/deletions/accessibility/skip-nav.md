---
audit: accessibility/skip-nav
category: accessibility
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

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
