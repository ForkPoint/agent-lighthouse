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
  - Implementation is a filter over artifacts.Accessibility.violations against ~37 TARGET_RULES from axe (button-name, link-name, input-button-name, label, autocomplete-valid, aria-allowed-attr, aria-required-attr, aria-valid-attr-value, tabindex, table/definition-list rules). Binary score: any violation scores 0. Crucially it inherits axe's blind spots — axe cannot fail an element that has no interactive semantics at all, and autocomplete-valid only validates tokens that are already present, never their absence.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).
- **[Text fragments](https://web.dev/articles/text-fragments)** — Google / web.dev (vendor-doc, URL verified 2026-08-20)
  - Confirms a shipped answer-surface consumer: "Clicking a featured snippet takes the user directly to the featured snippet text on the source web page. This works thanks to automatically created Text Fragments URLs." Support: Chrome 89+, Edge 89+, Firefox 131+, Safari 18.2+. Restates the boundary rule: "Each of prefix-, start, end, and -suffix can only match text within a single block-level element, but full start,end ranges can span multiple blocks." Opt-out header: Document-Policy: force-load-at-top.
- **[browser-use DOM extraction: enhanced_snapshot.py](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/enhanced_snapshot.py)** — Browser Use (repo, URL verified 2026-08-20)
  - Parses CDP DOMSnapshot for exactly these computed styles: display, visibility, opacity, overflow, overflow-x, overflow-y, cursor, pointer-events, position, background-color — plus bounding boxes, client rects, scroll rects, paint order and stacking contexts, and a CDP isClickable flag. Confirms production agents infer interactivity from cursor style and occlusion/paint order, so cursor:pointer-without-role and overlay occlusion are first-class, measurable inputs to a real agent's world model.

## Competitor coverage

Directory sites (Smithery, PulseMCP, Glama) list servers but do not audit whether a given domain has a first-party, ownership-proven listing, and have an obvious incentive not to flag their own republishes — hence partial-overlap rather than unique. No SEO/AEO tool queries the MCP Registry. The DNS-TXT / .well-known/mcp-registry-auth verification leg appears in no third-party scanner we could identify.

## Implementation sketch

1. Query the live public API: GET https://registry.modelcontextprotocol.io/v0.1/servers?search=<apex-domain> and again with ?search=<brand-token>, paginating on metadata.nextCursor. Response shape is {servers:[{server:{...},_meta:{...}}],metadata:{nextCursor,count}}.
2. Select candidate entries where any `server.remotes[].url` has a host equal to, or a subdomain of, the audited apex domain — this is the reliable join key, since names are attacker-chooseable.
3. Classify each match by the namespace prefix of `server.name`: (a) reverse-DNS of the audited domain (com.example/...) = FIRST-PARTY, domain-proof required; (b) io.github.<user>/... = GitHub-account-bound, not brand-bound; (c) anything else = THIRD-PARTY AGGREGATOR republish. Report (c) explicitly, including whether the aggregator's remotes[].url proxies through its own host.
4. Freshness/liveness: assert `_meta["io.modelcontextprotocol.registry/official"].status === "active"` and `.isLatest === true`; compare `server.version` and `.updatedAt` against the version reported by server/discover's serverInfo, and flag drift.
5. Verify the ownership proof independently of the registry: GET https://<apex>/.well-known/mcp-registry-auth expecting a body line matching /^v=MCPv1;\s*k=(ed25519|ecdsap384);\s*p=[A-Za-z0-9+\/]+={0,2}\s*$/, and resolve TXT at the apex looking for the same grammar. Presence of neither, on a domain claiming a com.* namespace, means the proof has been rotated away or was never re-provisioned after a DNS migration.
6. Transport hygiene on the listing: assert at least one remotes[] entry has `type: "streamable-http"`; flag a listing that offers only the deprecated `type: "sse"`. Then feed each remotes[].url through the Modern-Era Reachability probe — the registry requires that a remote server 'MUST be publicly accessible at its specified URL', so an unreachable registered URL is a listing defect.

## Example failure

A B2B analytics vendor runs a solid MCP server at https://analytics.example.com/mcp. Searching the registry for 'example.com' returns exactly one match: `ai.smithery/example-analytics`, whose remotes[].url is https://server.smithery.ai/@example/analytics/mcp and whose headers[] demand a Smithery API key. The vendor has no first-party listing, serves no /.well-known/mcp-registry-auth, and has no apex TXT proof. Agents resolving 'the MCP server for example.com' from the canonical registry are routed through a third party the vendor has no contractual relationship with, cannot revoke, and cannot update when the endpoint moves.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

- **The Evidence block above does not belong to this check.** Its four sources — the Lighthouse `agent-accessibility-tree` audit, the WebSuite agent study, the web.dev text-fragments article and browser-use's DOM extractor — are about accessibility trees and agent DOM parsing. None of them says anything about the MCP Registry, namespaces or ownership proofs. The block was mis-pasted during the proposal pass; the mechanism, the sketch and the failure example are the ones that were reviewed, and they are what the implementation follows. The evidence grade is held at **B** on the strength of the registry API itself being directly observable, not on the strength of the block above.
- **Slug renamed** from `registry-listing-and-namespace-ownership-proof` to `mcp-registry-listing-ownership`: the audit id is capped at 64 characters, and the `mcp-` prefix groups it with the other MCP audits in `agent-interfaces`.
- **No pagination.** The sketch paginates on `metadata.nextCursor`. The implementation reads only the first page of each of at most two searches — `<apex>` and the brand token. A server that a search ranks below the first page is one an agent resolving the same query would also miss.
- **Version drift is not compared.** Step 4 of the sketch compares `server.version` against the version `server/discover` reports. That comparison needs a second live call to the endpoint on top of the registry calls, so the implementation reports the registry's own `status` and `isLatest` and leaves drift alone.
- **Remote reachability is not probed.** Step 6 feeds each `remotes[].url` through a reachability probe. The audit does not: the URLs come from a third-party document, and the other MCP audits already probe the endpoint the site itself declares.
- **The aggregator arm fails, the GitHub arm warns.** An entry under a third-party aggregator namespace leaves the brand unable to update or revoke its own listing, which is the failure the example describes. An `io.github.<user>` entry is at least held by somebody who can update it, so it is reported as a warning rather than a failure.
- **The proof is fetched from the apex, not read from the scan's root files.** A scan of `www.example.com` collects root files for the `www` host; the namespace is bound to the apex, so the proof is fetched at `https://<apex>/.well-known/mcp-registry-auth`.

## Deferred

- **The DNS TXT leg of the proof.** The mechanism accepts either an apex TXT record or the `.well-known` file. The scanner has no DNS resolver, so only the file is checked. A domain that proves control by TXT alone is reported as having no proof — the audit says which file it looked for, and the remediation names it.
- **Trust in the registry's own answer.** The audit reports what the registry says about `status` and `isLatest`. It does not verify the registry's signature over the entry.
