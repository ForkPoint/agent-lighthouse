---
audit: agent-tools/webmcp-action-coverage
category: agent-tools
audit_id: "5.25"
source_file: packages/core/src/audits/agent-tools/webmcp-action-coverage.ts
slug: webmcp-action-coverage
review_verdict: delete
severity: medium
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# webmcp-action-coverage — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

An e-commerce site should expose WebMCP tools spanning the full purchase journey (product search, product detail, add to cart, checkout, account, support). The audit reads a `/.well-known/webmcp` JSON manifest plus declarative `form[toolname]` elements, keyword-matches tool names/descriptions against six hardcoded commerce categories, and scores the coverage ratio. For this to matter, either (a) a `/.well-known/webmcp` manifest must be a real discovery surface some agent fetches, or (b) some consumer must reward breadth of exposed commerce actions in a measurable way.

## What we searched

I attacked this from four angles. (1) Spec surface: I downloaded README.md, declarative-api-explainer.md, index.bs and implementation-status.md from the WebMCP repo and grepped all four for "well-known" and "manifest" — zero hits except one 'Alternatives Considered' passage; the rendered spec at webmachinelearning.github.io/webmcp also shows no .well-known concept. (2) Adoption: GitHub code search for "well-known/webmcp" returned 370 hits, all small unaffiliated repos (portel-dev/ncp, basgr/cf-webmcp, ariffazil/arifOS, sslboard/throwaway) with no shared schema and no vendor among them. (3) Vendor guidance: I read Google's own best-practices file guides/webmcp/webmcp/guide.md and developer.chrome.com/docs/ai/webmcp to see whether Chrome prescribes which/how many tools to expose. (4) Adjacent commerce standards: I fetched OpenAI's Agentic Commerce Protocol feed spec and checkout spec to test whether any real agentic-commerce standard enumerates a merchant action set delivered as in-page tools.

## Best evidence found for the audit

Weak. The strongest thing found for it is that half of its input — declarative `form[toolname]` — is a genuine Chrome-implemented signal (see the webmcp-declarative-forms audit), and Google's Chrome WebMCP best-practices guide does give tool-design guidance: "Tools should be atomic, composable, and distinct", "Register/unregister tools dynamically depending on the current page context", "Use annotations: { readOnlyHint: true } for tools that do not modify state". That is the closest published thing to 'expose your key actions as tools'. But it is guidance about tool _quality and lifecycle_, not about a commerce-category coverage quota, and it explicitly pushes toward context-scoped registration (fewer tools per page), which the coverage metric penalizes. No document anywhere ties a coverage ratio to agent behavior, and no named agent reads a coverage signal.

## Counter-evidence

Positive proof, not mere absence. (1) The audit's canonical data source does not exist and was explicitly rejected: the WebMCP explainer's "Alternatives Considered" §2 "Static Declarative Manifests" states the group "considered declaring tools solely inside static manifest files (like the Web App Manifest)" and rejected it because "Static manifests prevent web developers from dynamically adding, updating, or removing tools based on the active page state or user authentication status" and "Manifests cannot contain executable code." Greps of README.md, declarative-api-explainer.md, index.bs and implementation-status.md return zero occurrences of "/.well-known". (2) Chrome's own guide states the architectural reason it can never exist: "WebMCP runs entirely client-side in the browser tab. It is not a backend server, and it does not use HTTP, Server-Sent Events (SSE), or stdio transports. The web page itself acts as the tool registry." A static file at /.well-known/webmcp is therefore fetched by nobody. (3) The one real agentic-commerce standard, OpenAI's Agentic Commerce Protocol, delivers commerce capability as a tab-delimited/CSV product feed plus five REST endpoints (POST /checkout_sessions, POST /checkout_sessions/{id}, /complete, /cancel, GET /checkout_sessions/{id}) — explicitly REST-only, scoped to checkout, and it never mentions WebMCP or in-page tools. So even the commerce domain the audit targets is served by an entirely different mechanism. (4) The six-category taxonomy and the >=2 / >=4 thresholds appear in no specification, vendor doc, or study; they are invented, and the keyword regex (`\bcart\b`, `\bsearch\b`) would score a site on incidental word matches.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. The audit's primary evidence source, /.well-known/webmcp, is not merely unspecified — it is a design the WebMCP explainer considered and rejected by name, and Chrome's docs state WebMCP is client-side-only with the page as the tool registry, making a static manifest structurally unreadable by any agent. The residual declarative-form input is already covered better by webmcp-declarative-forms. The commerce taxonomy, the keyword matcher and the 2/4 thresholds have no consumer and no empirical backing; the closest vendor guidance (atomic, page-context-scoped tools) actively argues against a breadth quota. Delete; if any part is worth keeping, fold 'does an e-commerce site expose a checkout/cart tool' into the declarative-forms audit as a qualitative note.

## Sources

- **[WebMCP explainer — Alternatives Considered §2: Static Declarative Manifests](https://raw.githubusercontent.com/webmachinelearning/webmcp/main/README.md)** — W3C Web Machine Learning Community Group (spec, URL verified 2026-08-21)
  - Static manifest files were considered and rejected: "Static manifests prevent web developers from dynamically adding, updating, or removing tools based on the active page state or user authentication status" and "Manifests cannot contain executable code, meaning developers would still need an imperative way to register execution handlers." Grep of README.md, declarative-api-explainer.md, index.bs and implementation-status.md finds zero occurrences of "/.well-known".
- **[Chrome modern-web-guidance: guides/webmcp/webmcp](https://raw.githubusercontent.com/GoogleChrome/modern-web-guidance-src/main/guides/webmcp/webmcp/guide.md)** — Google Chrome (GoogleChrome/modern-web-guidance-src) (vendor-doc, URL verified 2026-08-21)
  - "WebMCP runs entirely client-side in the browser tab. It is not a backend server, and it does not use HTTP, Server-Sent Events (SSE), or stdio transports. The web page itself acts as the tool registry." Best practices cover naming, schema design, reliability, and "Tools should be atomic, composable, and distinct" / "Register/unregister tools dynamically depending on the current page context" — no commerce-category coverage requirement anywhere. Also: WebMCP supports Tools only, not Resources or Prompts.
- **[Agentic Commerce Protocol — Agentic Checkout Spec](https://developers.openai.com/commerce/specs/checkout)** — OpenAI (spec, URL verified 2026-08-21)
  - Five REST endpoints: POST /checkout_sessions, POST /checkout_sessions/{id}, /complete, /cancel, GET /checkout_sessions/{id}. Scoped to checkout only, not search or catalog browsing. REST-only delivery; "In the future, the Agentic Checkout Spec will support MCP servers". No in-page tools, no HTML attributes, no WebMCP reference.
- **[Agentic Commerce Protocol — Product Feed Spec](https://developers.openai.com/commerce/specs/feed)** — OpenAI (spec, URL verified 2026-08-21)
  - Merchants expose catalog to ChatGPT via a UTF-8 tab-delimited .txt/.tsv or .csv feed, Google-Shopping-compatible fields. No REST discovery, no in-page tools, no WebMCP. Confirms the real agentic-commerce path is feeds + REST, not per-page WebMCP tool coverage.
- **[Web Model Context API (WebMCP) draft specification](https://webmachinelearning.github.io/webmcp/)** — W3C Web Machine Learning Community Group (spec, URL verified 2026-08-21)
  - Confirmed on fetch: no reference to a .well-known manifest file anywhere in the specification. Tool discovery is via document.modelContext / getTools() in the page, plus browser synthesis from annotated forms.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/agent-tools/webmcp-action-coverage.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

For e-commerce sites, WebMCP tools should cover key commerce actions: product search, product detail, add to cart, checkout, and contact/support. Broader action coverage means AI agents can complete more user tasks without falling back to manual browsing.

### Code review findings (2026-08-20, 11-agent pass)

Inert on real input, and even on its own fixtures the keyword matcher cannot match camelCase tool names because signatures are lowercased before word-boundary regexes are applied. It also grades every site against an e-commerce funnel with no page-type gating, so a B2B SaaS or documentation site is failed for lacking 'Add to Cart'.

**Required fix:** Delete with the WebMCP cluster. If commerce-action coverage is revived against a real surface (OpenAPI operations or a live MCP tools/list), split camelCase into word tokens before matching, gate the audit on commerce page types via `applicablePageTypes`, and make the pass threshold and the `expected` string agree.

**False-positive risks:**

- `notApplicable` on every real scan (no manifest, no `form[toolname]`).
- Broken matcher: signatures are built with `.toLowerCase()` (line 137), then matched with `new RegExp(\`\\b${kw}\\b\`)`. `searchProducts`becomes`searchproducts`, and `\bsearch\b` does NOT match inside it. A manifest of well-named camelCase tools with no descriptions scores 0/6 coverage → FAIL. The suite's own test 'handles manifest tool with name but no description' confirms the behavior without recognizing it as a defect. Coverage effectively depends on prose descriptions, not tool names.
- No page-type or vertical gating: `COMMERCE_ACTIONS` (search, product detail, cart, checkout, auth, contact) is applied to every site. A SaaS product exposing `createTicket`/`runReport` tools is told it is missing Add to Cart and Checkout — irrelevant guidance presented as a deficiency. `AuditMeta.applicablePageTypes` exists in types.ts:73 and is not used.
- Inconsistent thresholds vs. reported expectations: pass needs `coverage >= 4` while `expected` says 'At least 2 commerce actions covered' (MIN_COVERAGE), and the warn branch's `expected` says 4. A user reading `expected` cannot tell what is required.
- Keyword collisions: `query`, `filter`, `browse`, `find`, `lookup` under 'Product Search' will match any tool description mentioning a database query or filter; `contact`/`support` under Contact/Support match any support-adjacent prose. Coverage is easily overstated for sites that do have descriptions.

**Test gaps:**

- No test exposing that `\bsearch\b` fails against lowercased `searchproducts` — the core matcher bug is invisible because every fixture supplies a prose description
- No non-commerce site fixture (SaaS/docs/media) demonstrating the irrelevant-failure case
- No test reconciling the `coverage >= 4` pass gate with the `MIN_COVERAGE = 2` text in `expected`

**Overlaps with:** `5.20`, `5.21`, `5.23`, `5.24`

### Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/agent-tools/webmcp-action-coverage.md`; that copy removed (one dossier per removed audit, under `sunset/`).
