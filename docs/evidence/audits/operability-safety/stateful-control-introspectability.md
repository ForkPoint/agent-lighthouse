---
audit: operability-safety/stateful-control-introspectability
category: operability-safety
source_file: packages/core/src/audits/operability-safety/stateful-control-introspectability.ts
slug: stateful-control-introspectability
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - S12
  - S6
  - lh-a11ytree
  - S11
  - S19
---

# Stateful Control Introspectability

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Checks that every control whose purpose is to hold a state — toggles, switches, checkboxes, radio groups, tabs, accordions, disclosure triggers, sort direction, filter chips — exposes that state through a machine-readable attribute rather than a CSS class alone. Reports the count of state-bearing controls whose current value an agent cannot read.

## Claimed mechanism (falsifiable)

Falsifiable claim: an agent operates as observe → act → verify. If a toggle's only 'on' signal is class="is-active" plus a colour change, the agent's accessibility snapshot is byte-identical before and after the click, so it cannot verify the post-condition. It then either clicks again (flipping the state back) or asserts success without evidence. WebSP-Eval measures the consequence across 28 sites: toggles alone cause over 45% task failure across many models, and stateful UI elements are named the primary failure factor. Test: add aria-checked to the same toggle and re-run — the snapshot now differs pre/post and the double-toggle behaviour disappears.

## Evidence

- **[Text fragments](https://web.dev/articles/text-fragments)** — Google / web.dev (vendor-doc, URL verified 2026-08-20)
  - Confirms a shipped answer-surface consumer: "Clicking a featured snippet takes the user directly to the featured snippet text on the source web page. This works thanks to automatically created Text Fragments URLs." Support: Chrome 89+, Edge 89+, Firefox 131+, Safari 18.2+. Restates the boundary rule: "Each of prefix-, start, end, and -suffix can only match text within a single block-level element, but full start,end ranges can span multiple blocks." Opt-out header: Document-Policy: force-load-at-top.
- **[MCP Specification 2026-07-28 — Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'MCP servers MUST implement OAuth 2.0 Protected Resource Metadata (RFC9728).' Authorization servers MUST provide RFC8414 or OIDC Discovery. Servers SHOULD include a scope parameter in the WWW-Authenticate challenge. Example verbatim: `WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource", scope="files:read"`. Insufficient scope -> 403 with error="insufficient_scope". Servers SHOULD NOT include offline_access in WWW-Authenticate scope or in PRM scopes_supported. Canonical server URI rules: no fragment, scheme required, prefer no trailing slash. Servers MUST validate token audience; MUST NOT accept or transit other tokens.
- **[Lighthouse audit source: agent-accessibility-tree.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/agent-accessibility-tree.js)** — Google Chrome / Lighthouse (repo, URL verified 2026-08-20)
  - It filters the accessibility violations Lighthouse already collects down to about 37 axe rules: button-name, link-name, input-button-name, label, autocomplete-valid, aria-allowed-attr, aria-required-attr, aria-valid-attr-value, tabindex, and the table and definition-list rules. Binary score: any violation scores 0. Crucially it inherits axe's blind spots — axe cannot fail an element that has no interactive semantics at all, and autocomplete-valid only validates tokens that are already present, never their absence.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).
- **[Operator System Card](https://cdn.openai.com/operator_system_card.pdf)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Documents confirmation prompts before 'actions that affect the state of the world (e.g., before completing a purchase or sending an email)', with 92% recall on 607 risky-action tasks and a mistake-risk reduction of about 90%. It also documents watch mode, which forces supervision on high-impact sites, and proactive refusal of high-risk categories. Implication for site authors: an agent must be able to observe and verify state transitions before and after acting, which requires persistent, machine-readable confirmation of what changed.

## Example failure

A privacy settings page renders 'Share my data' as <div class="toggle toggle--on" onclick="flip()">. The task is 'turn off data sharing'. The agent cannot read the initial state from the snapshot. It clicks once, and sees an identical snapshot: the class changed, but nothing in the AX tree did. It concludes the click failed and clicks again. It leaves sharing enabled, while reporting the task complete.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The audit sits in `operability-safety`. The proposal's `agent-operability` domain is a research grouping, not a category.
- The state-class vocabulary and the click-signal test live in `_agent-affordances.ts`, shared with `ghost-clickable-element-ratio` so the two cannot drift.
- Native state counts as introspectable without ARIA: `<details>`, `<select>` and checkbox or radio inputs expose `open`, `selected` and `checked` in the DOM.
- A `<summary>` raises no finding of its own. Its state belongs to its parent `<details>`.
- A disclosure trigger is a clickable element with `aria-controls`, or one immediately followed by an element whose class matches `/accordion|collapse|panel|details-content/`. The wider "sits before a collapsible panel" would need layout.
- A control in more than one bucket is counted once, and opaque wins. A control that publishes one state and hides another is still not fully readable.

## Deferred

- **Sort and filter controls outside tables.** Only `<th>` sort controls are located structurally. A filter chip is caught only when its class carries the state.
- **State kept up to date.** Whether the handler also flips the attribute needs the control driven in a browser. The audit checks presence, not maintenance.
