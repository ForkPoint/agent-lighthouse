---
audit: agent-tools/webmcp-action-coverage
category: agent-tools
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

Weak. The strongest thing found for it is that half of its input — declarative `form[toolname]` — is a genuine Chrome-implemented signal (see the webmcp-declarative-forms audit), and Google's Chrome WebMCP best-practices guide does give tool-design guidance: "Tools should be atomic, composable, and distinct", "Register/unregister tools dynamically depending on the current page context", "Use annotations: { readOnlyHint: true } for tools that do not modify state". That is the closest published thing to 'expose your key actions as tools'. But it is guidance about tool *quality and lifecycle*, not about a commerce-category coverage quota, and it explicitly pushes toward context-scoped registration (fewer tools per page), which the coverage metric penalizes. No document anywhere ties a coverage ratio to agent behavior, and no named agent reads a coverage signal.

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

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
