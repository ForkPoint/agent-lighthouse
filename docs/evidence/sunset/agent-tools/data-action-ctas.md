---
audit: agent-tools/data-action-ctas
category: agent-tools
audit_id: "5.17"
source_file: packages/core/src/audits/agent-tools/data-action-ctas.ts
slug: data-action-ctas
review_verdict: delete
severity: high
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# data-action-ctas — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

The audit's own description asserts that "data-action attributes help AI browser agents (like ChatGPT Browse and Google Mariner) identify clickable CTAs", and that data-action / data-action-type / data-action-label let an agent know which elements are interactive and what each does. For this to matter, at least one browsing agent vendor would have to document reading these data-* attributes when building its page representation — or an empirical study would have to show agents complete tasks more reliably on pages carrying them.

## What we searched

Four angles, all via direct fetch and GitHub API since WebSearch was exhausted. (1) Vendor docs: fetched OpenAI's tools/connectors-MCP guide (following the platform.openai.com -> developers.openai.com redirect) and Anthropic's Claude in Chrome support article to see whether either documents any data-* attribute in its page-perception pipeline. (2) Google: enumerated every guide in GoogleChrome/modern-web-guidance-src (accessibility, forms, html, js, ui-behaviors, webmcp, ...) — Google's authoritative published position on agent-ready markup — and ran a repo-scoped code search for `data-action`, which returned exactly 1 incidental hit while Google's actual agent-affordance guidance lives entirely under guides/webmcp. (3) Namespace collision: fetched the Stimulus/Hotwire reference to check what data-action already means on the open web. (4) Adoption: GitHub code search for the compound signal `"data-action-type" "data-action-label"` to see whether this is a community convention with any independent uptake.

## Best evidence found for the audit

None worth a grade above D. The only positive framing available is the generic and uncontroversial claim that machine-readable affordance hints help agents — which is true, but the mechanism the web platform actually chose for it is WebMCP's toolname/tooldescription attributes and the accessible name/role from the a11y tree, not data-action. No vendor doc, spec, or study names data-action, data-action-type or data-action-label. Searching for the compound convention returned 40 total GitHub code results, and the overwhelming majority are files inside a single repository (magnifito/website — the author's own AIO-framework site: HomePage.astro, ContactPage.astro, LeadMagnet.astro, ConversionBoosters.astro and ~15 more), i.e. the 'convention' is essentially self-citation rather than community adoption.

## Counter-evidence

Positive proof of harm, not just absence. (1) `data-action` is already owned by Stimulus/Hotwire (shipped with Rails) with completely unrelated semantics: per stimulus.hotwired.dev/reference/actions its value is an event descriptor `event->controller#method` (e.g. "click->gallery#next", "keydown.esc->modal#close", "resize@window->gallery#layout"). Every Rails/Hotwire site on the web carries many data-action attributes and would score partially on this audit while providing zero agent-facing semantics — the check is a false-positive generator on the single most common real-world use of the attribute. (2) OpenAI's tools/connectors documentation states capability exposure happens through remote MCP servers (server_url) and OpenAI-maintained connectors (connector_id) — "tools are discovered through explicit server configuration in API requests", with no HTML-attribute mechanism documented at all, contradicting the audit's "ChatGPT Browse reads data-action" claim. (3) Anthropic's Claude in Chrome support documentation describes reading text on webpages and console output and documents no data-* attribute handling. (4) Google's own published agent-readiness guidance corpus (GoogleChrome/modern-web-guidance-src) routes agent affordances exclusively through WebMCP declarative/imperative APIs and standard forms/accessibility guides; a repo-wide search for data-action yields 1 incidental hit and no guide. The audit's assertion that Google Mariner reads data-action is unsupported by any Google document I could locate.

## Verdict

**confirmed dead — delete** (grade D)

Grade D: speculative attribute with no documented consumer at any vendor, plus active namespace collision with Stimulus/Hotwire that makes the check unsound even as a heuristic (a Rails site passes for the wrong reason; a well-marked-up React site fails despite perfect semantics). Adoption of the compound data-action-type/data-action-label form is ~40 GitHub files dominated by the author's own site, so it does not clear the 'genuinely wide adoption' bar for dead-but-informative. The audit description also makes two concrete vendor claims (ChatGPT Browse, Google Mariner) that no vendor document supports — a correctness liability in shipped guidance. Delete; the legitimate version of this concern is already served by webmcp-declarative-forms plus standard accessible-name/role auditing.

## Sources

- **[Stimulus Reference — Actions](https://stimulus.hotwired.dev/reference/actions)** — Hotwired / Basecamp (vendor-doc, URL verified 2026-08-21)
  - data-action in Stimulus is an event-to-method binding: syntax `event->controller#method`, e.g. "click->gallery#next", with keyboard filters ("keydown.esc->modal#close"), global targets ("resize@window->gallery#layout") and options (":prevent", ":!passive"). Ships with Rails. Any Hotwire site is saturated with data-action attributes carrying zero agent semantics, making the audit's presence check unsound.
- **[Tools: Connectors and MCP](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - Capability exposure to OpenAI models is via remote MCP servers (server_url) and OpenAI-maintained connectors (connector_id); tools are discovered through explicit server configuration in API requests, not by parsing HTML. No data-* attribute or any HTML-based mechanism is documented, contradicting the audit's claim that ChatGPT Browse reads data-action.
- **[Getting started with Claude in Chrome](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - Describes Claude reading text on webpages and browser console output. Documents no handling of custom HTML data attributes and no data-action convention.
- **[GoogleChrome/modern-web-guidance-src — guides index](https://github.com/GoogleChrome/modern-web-guidance-src/tree/main/guides)** — Google Chrome (repo, URL verified 2026-08-21)
  - Google's published guidance corpus (accessibility, forms, html, js, ui-behaviors, ui-components, webmcp, ...) routes all agent-affordance guidance through guides/webmcp (agentic-forms, agentic-javascript-tools, webmcp). Repo-scoped code search for `data-action` returns 1 incidental hit and no guide — Google does not advise or consume data-action for agent readability.
- **[GitHub code search: "data-action-type" "data-action-label"](https://github.com/search?q=%22data-action-type%22+%22data-action-label%22&type=code)** — GitHub (repo, NOT verified)
  - (GitHub code-search query link — interactive only, result counts recorded at research time.) 40 total results; the large majority are files within a single repository (magnifito/website — the AIO framework's own site: HomePage.astro, ContactPage.astro, ServicesPage.astro, LeadMagnet.astro, ConversionBoosters.astro and others). No framework, vendor, or standards body among the results. Adoption is self-referential, not a community convention.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/agent-tools/data-action-ctas.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

data-action attributes help AI browser agents (like ChatGPT Browse and Google Mariner) identify clickable CTAs and understand what each button does. Without these hints, agents must guess which elements are interactive based on text alone.

### Code review findings (2026-08-20, 11-agent pass)

Invented convention that also collides with a widely deployed unrelated one. No AI agent reads `data-action`; meanwhile Stimulus/Hotwire (every modern Rails app) uses `data-action` as its own event-binding attribute, so those sites PASS for reasons unrelated to agents. The audit is wrong in both directions and its impact copy names specific products as consumers, which is fabricated.

**Required fix:** Delete. The real version of this signal — can an agent identify and name the interactive controls — is accessible-name coverage on buttons/links, which belongs in the accessibility category, not a bespoke attribute check here.

**False-positive risks:**
- FALSE PASS: `page.$('[data-action]')` matches Stimulus bindings (`data-action="click->modal#open"`), Turbo, Alpine-adjacent patterns, and countless bespoke analytics hooks. A Rails/Hotwire site scores a clean pass while exposing nothing whatsoever to an agent. The audit cannot tell an agent affordance from a JS event binding because no such distinction exists in the attribute.
- FALSE FAIL: every site not using this made-up convention fails, with impact text asserting that 'ChatGPT Browse and Google Mariner' need these attributes to identify CTAs. Neither product documents or consumes `data-action`; agentic browsers use the accessibility tree, ARIA roles, and visible text. This is fabricated attribution presented as product guidance.
- Counts elements globally (`totalDataAction`) with no restriction to buttons/links, so `data-action` on a wrapper div inflates the count.
- Pass requires `data-action` AND `data-action-type` anywhere on any page — not on the same element. One div with `data-action` on page A and an unrelated element with `data-action-type` on page B yields a full PASS.

**Test gaps:**
- No Stimulus/Hotwire fixture (`data-action="click->controller#method"`) — the false-pass case is entirely untested
- No test that data-action and data-action-type must co-occur on the same element
- No test that non-interactive elements are excluded

**Overlaps with:** `5.21`, `5.27`

### Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/agent-tools/data-action-ctas.md`; that copy removed (one dossier per removed audit, under `sunset/`).
