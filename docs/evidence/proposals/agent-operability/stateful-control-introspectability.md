---
check: stateful-control-introspectability
title: "Stateful Control Introspectability"
domain: agent-operability
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Stateful Control Introspectability

> Proposed check. Evidence grade **B** · unique · implementation: `static-fetch`

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
  - Implementation is a filter over artifacts.Accessibility.violations against ~37 TARGET_RULES from axe (button-name, link-name, input-button-name, label, autocomplete-valid, aria-allowed-attr, aria-required-attr, aria-valid-attr-value, tabindex, table/definition-list rules). Binary score: any violation scores 0. Crucially it inherits axe's blind spots — axe cannot fail an element that has no interactive semantics at all, and autocomplete-valid only validates tokens that are already present, never their absence.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).
- **[Operator System Card](https://cdn.openai.com/operator_system_card.pdf)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Documents confirmation prompts before 'actions that affect the state of the world (e.g., before completing a purchase or sending an email)' — 92% recall on 607 risky-action tasks, reducing mistake risk ~90% — plus watch mode forcing supervision on high-impact sites, and proactive refusal of high-risk categories. Implication for site authors: an agent must be able to observe and verify state transitions before and after acting, which requires persistent, machine-readable confirmation of what changed.

## Competitor coverage

Not covered. axe (and therefore Lighthouse's agentic audit) has aria-required-attr, which fires only once an element already declares role=switch/checkbox — the overwhelmingly common CSS-class-only toggle declares no role and is silently passed. No SEO or answer-engine tool inspects state exposure at all.

## Implementation sketch

Static parse plus a lightweight CSS pass. Enumerate candidate state-bearing controls: (a) elements with role in {switch, checkbox, radio, tab, menuitemcheckbox, menuitemradio, option, treeitem} — fail any missing aria-checked / aria-selected as required by APG; (b) elements with role=button or a click signal whose class list contains a state token matching /(^|[-_])(is-)?(active|selected|on|off|open|expanded|checked|current|enabled)([-_]|$)/ and which carry no aria-pressed, aria-checked, aria-expanded, aria-selected or aria-current — these are CSS-only state; (c) disclosure triggers (a clickable element whose id is referenced by aria-controls, or that sits immediately before a collapsible panel matched by class /accordion|collapse|panel|details-content/) lacking aria-expanded; note that native <details>/<summary> passes automatically; (d) sort/filter controls in tables lacking aria-sort on the <th>. Score = 1 - opaque/(opaque+introspectable). Emit each opaque control with the CSS class that carries its state, since that class name is the exact remediation target.

## Example failure

A privacy settings page renders 'Share my data' as <div class="toggle toggle--on" onclick="flip()">. The task is 'turn off data sharing'. The agent cannot read the initial state from the snapshot, clicks once, sees an identical snapshot (the class changed but nothing in the AX tree did), concludes the click failed, clicks again — and leaves sharing enabled while reporting the task complete.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
