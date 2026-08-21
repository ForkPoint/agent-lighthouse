---
check: table-markdown-round-trip-loss
title: "Table Markdown Round-Trip Loss"
domain: answer-selection-forensics
status: proposed
evidence_grade: B
uniqueness: partial-overlap
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Table Markdown Round-Trip Loss

> Proposed check. Evidence grade **B** · partial overlap · implementation: `static-fetch`

## What it checks

Converts every main-content table to GFM markdown — the exact representation answer-engine readers emit — re-parses it, and diffs cell-for-cell against the source DOM. Any cell lost, merged, or de-associated is reported by coordinate. Layered on top of the WHATWG header-association check (th, scope, headers) so the finding distinguishes 'screen readers can't parse this' from 'the LLM will read the wrong number'.

## Claimed mechanism (falsifiable)

Production ingestion pipelines convert HTML to markdown before embedding (S10 Jina Reader, S11 Firecrawl). GFM tables cannot represent colspan/rowspan, cannot nest, cannot hold block content ('Block-level elements cannot be inserted in a table'), and silently discard excess cells ('the excess is ignored') (S8). So a spanned header, a nested table, or a ragged row does not degrade gracefully — it produces a well-formed markdown table containing values shifted into the wrong columns, which the model then reads as fact. Meanwhile WHATWG leaves header association undefined for tables built purely from td (S7), so headerless numeric tables have no machine-recoverable meaning at all. Falsifiable: round-trip the table and compare; the loss is deterministic and reproducible, not a judgement.

## Evidence

- **[MCP Security Best Practices (2026-07-28)](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices.md)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Token passthrough: 'MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server.' Scope minimization: 'Common Mistakes' list names publishing all possible scopes in scopes_supported and using wildcard/omnibus scopes (*, all, full-access). State handle hijacking replaces session hijacking now that MCP is stateless: servers MUST NOT treat possession of a state handle as authentication; SHOULD use non-deterministic handles bound server-side to the authenticated user. SSRF section: clients SHOULD require HTTPS for all OAuth-related URLs and block private/link-local ranges (169.254.0.0/16 etc.).
- **[MCP Specification 2026-07-28 — Authorization Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - PRM document returned by the MCP server MUST include authorization_servers with at least one entry (stronger than RFC 9728, where it is OPTIONAL). Two discovery mechanisms, both of which clients MUST support: WWW-Authenticate resource_metadata, then well-known probing in order — path-inserted (https://example.com/public/mcp -> https://example.com/.well-known/oauth-protected-resource/public/mcp) then root. AS metadata probing order for issuers with a path: /.well-known/oauth-authorization-server/{path}, /.well-known/openid-configuration/{path}, {path}/.well-known/openid-configuration; without a path: /.well-known/oauth-authorization-server then /.well-known/openid-configuration. Clients MUST reject a metadata doc whose issuer differs from the issuer used to build the URL.
- **[Lighthouse audit source: agent-accessibility-tree.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/agent-accessibility-tree.js)** — Google Chrome / Lighthouse (repo, URL verified 2026-08-20)
  - Implementation is a filter over artifacts.Accessibility.violations against ~37 TARGET_RULES from axe (button-name, link-name, input-button-name, label, autocomplete-valid, aria-allowed-attr, aria-required-attr, aria-valid-attr-value, tabindex, table/definition-list rules). Binary score: any violation scores 0. Crucially it inherits axe's blind spots — axe cannot fail an element that has no interactive semantics at all, and autocomplete-valid only validates tokens that are already present, never their absence.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).

## Competitor coverage

axe-core and Lighthouse's accessibility category check th presence, scope validity, and headers/id references — that overlap is real but framed for assistive tech, and they stop at the DOM. Nobody performs the markdown round-trip, which is the part that predicts LLM misreads. No competitor flags colspan-in-header, nested tables, ragged rows, or units-stranded-in-caption as extraction hazards.

## Implementation sketch

Static fetch. Per table in main content: 1) DOM-level flags — hasCaption, hasTh, thScopeCoverage (fraction of th with a valid scope when the table has both row and column headers), spannedHeader (any th with colspan or rowspan > 1), nestedTable, blockContentInCell (p/ul/ol/table/dl inside td or th), raggedRow (row cell count, expanded for spans, differs from header column count), headerlessNumeric (zero th and >= 2 numeric-majority columns), unitsStranded (currency or unit token present in <caption> or a footnote but absent from every header cell and every cell). 2) Round-trip: serialize with a GFM table serializer, re-parse with a GFM parser, rebuild the grid, and diff against the expanded source grid. Report lostCells, shiftedCells, and mergedCells with row/column coordinates and their text. 3) Fail the table on any nonzero round-trip loss, or on headerlessNumeric, or on unitsStranded. 4) Score = tables with zero loss / total main-content tables. 5) Suggested fix per finding: flatten spanned headers into repeated explicit th, move units into header cells, pull block content out of cells.

## Example failure

A pricing comparison table uses a two-row header where 'Monthly' and 'Annual' sit under a colspan=2 th labelled 'Price'. GFM has no colspan, so the serializer emits a single header row and every price column shifts left by one. The re-parsed grid associates the annual price with the feature-count column. A model asked 'what is the annual price of the Pro plan' answers with a seat count.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
