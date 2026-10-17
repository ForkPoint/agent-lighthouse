---
audit: agent-interfaces/mcp-registry-listing-ownership
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-registry-listing-ownership.ts
slug: mcp-registry-listing-ownership
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - lh-a11ytree
  - S11
  - S12
  - S15
---

# Registry Listing and Namespace Ownership Proof

> Shipped in v2. Evidence grade **B** · scored tier · partial overlap · implementation: `multi-page`

## What it checks

Checks three things about the site's MCP server. Whether it is discoverable in the official MCP Registry. Whether it is listed under a namespace cryptographically bound to the audited domain. And whether the ownership proof that namespace requires is actually being served. Together they distinguish a first-party listing from a third-party aggregator's republish of the same server.

## Claimed mechanism (falsifiable)

The registry grants a `com.example.*` namespace only on proof of domain control, and the proof is externally observable: either an apex DNS TXT record of exact form `v=MCPv1; k=ed25519; p=<base64>` or a file at exactly `/.well-known/mcp-registry-auth` with the same payload. A listing under `io.github.<user>/*` is bound to an individual's GitHub account, and a listing under an aggregator namespace (observed live in the registry as e.g. `ai.smithery/<Org>-<repo>` with `remotes[].url` pointing at server.smithery.ai) is bound to neither the brand nor its infrastructure — the brand cannot update or revoke it, and agents routed through it reach a proxy rather than the origin. The falsifiable claim: a domain with no first-party registry entry is absent from the canonical index clients use to resolve 'the MCP server for example.com', so the only path to the server is a URL the user pastes by hand.

## Evidence

- **[Lighthouse audit source: agent-accessibility-tree.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/agent-accessibility-tree.js)** — Google Chrome / Lighthouse (repo, URL verified 2026-08-20)
  - It filters the accessibility violations Lighthouse already collects down to about 37 axe rules: button-name, link-name, input-button-name, label, autocomplete-valid, aria-allowed-attr, aria-required-attr, aria-valid-attr-value, tabindex, and the table and definition-list rules. Binary score: any violation scores 0. Crucially it inherits axe's blind spots — axe cannot fail an element that has no interactive semantics at all, and autocomplete-valid only validates tokens that are already present, never their absence.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).
- **[Text fragments](https://web.dev/articles/text-fragments)** — Google / web.dev (vendor-doc, URL verified 2026-08-20)
  - Confirms a shipped answer-surface consumer: "Clicking a featured snippet takes the user directly to the featured snippet text on the source web page. This works thanks to automatically created Text Fragments URLs." Support: Chrome 89+, Edge 89+, Firefox 131+, Safari 18.2+. Restates the boundary rule: "Each of prefix-, start, end, and -suffix can only match text within a single block-level element, but full start,end ranges can span multiple blocks." Opt-out header: Document-Policy: force-load-at-top.
- **[browser-use DOM extraction: enhanced_snapshot.py](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/enhanced_snapshot.py)** — Browser Use (repo, URL verified 2026-08-20)
  - Parses CDP DOMSnapshot for exactly these computed styles: display, visibility, opacity, overflow, overflow-x, overflow-y, cursor, pointer-events, position, background-color — plus bounding boxes, client rects, scroll rects, paint order and stacking contexts, and a CDP isClickable flag. Confirms production agents infer interactivity from cursor style and occlusion/paint order, so cursor:pointer-without-role and overlay occlusion are first-class, measurable inputs to a real agent's world model.

## Example failure

A B2B analytics vendor runs a solid MCP server at https://analytics.example.com/mcp. Searching the registry for 'example.com' returns exactly one match: `ai.smithery/example-analytics`, whose remotes[].url is https://server.smithery.ai/@example/analytics/mcp and whose headers[] demand a Smithery API key. The vendor has no first-party listing, serves no /.well-known/mcp-registry-auth, and has no apex TXT proof. Agents resolving 'the MCP server for example.com' from the canonical registry are routed through a third party the vendor has no contractual relationship with, cannot revoke, and cannot update when the endpoint moves.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The `## Evidence` block does not support this check. Its four sources cover accessibility trees and agent DOM parsing, not the MCP Registry. The grade B rests on the registry API being directly observable.
- No pagination. The audit reads the first page of at most two searches, the apex and the brand token.
- Version drift against `server/discover` is not compared. The audit reports the registry's own `status` and `isLatest`.
- `remotes[].url` is not probed. Those URLs come from a third-party document.
- Only the aggregator case fails. An `io.github.<user>` listing is held by someone who can update it, so it does not fail.
- The proof is fetched at `https://<apex>/.well-known/mcp-registry-auth`, not read from the scan's root files. The namespace binds to the apex, not the scanned host.

## Deferred

- The DNS TXT leg of the proof. The audit queries no TXT records, so a domain that proves control by TXT alone reads as having no proof.
- Verifying the registry's signature over the entry.
