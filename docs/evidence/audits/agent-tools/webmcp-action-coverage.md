---
audit: agent-tools/webmcp-action-coverage
audit_id: "5.25"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/webmcp-action-coverage.ts
slug: webmcp-action-coverage
review_verdict: delete
severity: medium
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# webmcp-action-coverage (`5.25`)

> agent-tools · source `webmcp-action-coverage.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

For e-commerce sites, WebMCP tools should cover key commerce actions: product search, product detail, add to cart, checkout, and contact/support. Broader action coverage means AI agents can complete more user tasks without falling back to manual browsing.

## Code review findings (2026-08-20, 11-agent pass)

Inert on real input, and even on its own fixtures the keyword matcher cannot match camelCase tool names because signatures are lowercased before word-boundary regexes are applied. It also grades every site against an e-commerce funnel with no page-type gating, so a B2B SaaS or documentation site is failed for lacking 'Add to Cart'.

**Required fix:** Delete with the WebMCP cluster. If commerce-action coverage is revived against a real surface (OpenAPI operations or a live MCP tools/list), split camelCase into word tokens before matching, gate the audit on commerce page types via `applicablePageTypes`, and make the pass threshold and the `expected` string agree.

**False-positive risks:**
- `notApplicable` on every real scan (no manifest, no `form[toolname]`).
- Broken matcher: signatures are built with `.toLowerCase()` (line 137), then matched with `new RegExp(\`\\b${kw}\\b\`)`. `searchProducts` becomes `searchproducts`, and `\bsearch\b` does NOT match inside it. A manifest of well-named camelCase tools with no descriptions scores 0/6 coverage → FAIL. The suite's own test 'handles manifest tool with name but no description' confirms the behavior without recognizing it as a defect. Coverage effectively depends on prose descriptions, not tool names.
- No page-type or vertical gating: `COMMERCE_ACTIONS` (search, product detail, cart, checkout, auth, contact) is applied to every site. A SaaS product exposing `createTicket`/`runReport` tools is told it is missing Add to Cart and Checkout — irrelevant guidance presented as a deficiency. `AuditMeta.applicablePageTypes` exists in types.ts:73 and is not used.
- Inconsistent thresholds vs. reported expectations: pass needs `coverage >= 4` while `expected` says 'At least 2 commerce actions covered' (MIN_COVERAGE), and the warn branch's `expected` says 4. A user reading `expected` cannot tell what is required.
- Keyword collisions: `query`, `filter`, `browse`, `find`, `lookup` under 'Product Search' will match any tool description mentioning a database query or filter; `contact`/`support` under Contact/Support match any support-adjacent prose. Coverage is easily overstated for sites that do have descriptions.

**Test gaps:**
- No test exposing that `\bsearch\b` fails against lowercased `searchproducts` — the core matcher bug is invisible because every fixture supplies a prose description
- No non-commerce site fixture (SaaS/docs/media) demonstrating the irrelevant-failure case
- No test reconciling the `coverage >= 4` pass gate with the `MIN_COVERAGE = 2` text in `expected`

**Overlaps with:** `5.20`, `5.21`, `5.23`, `5.24`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/webmcp-action-coverage.md](../../deletions/agent-tools/webmcp-action-coverage.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
