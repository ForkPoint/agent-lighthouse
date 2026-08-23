---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": patch
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

Plan 5b Wave D: the injection-safety, mcp-server-quality and agentic-commerce
proposals land. Twelve graduate as new audits and one folds into another. The
registry grows from 203 to 215 audits, which completes Plan 5b.

New in `operability-safety`:

- `c2pa-manifest-survives-delivery` — reads up to six images as bytes and
  reports the ones whose C2PA manifest was stripped by an image CDN between the
  origin and the variant a crawler is served.
- `c2pa-signer-trust-status` — parses the manifest's signing certificate and
  reports self-signed versus CA-issued, expiry, and whether a timestamp token
  is present. It never claims trust-list membership.
- `organization-identifier-registry-resolution` — resolves a declared LEI
  against GLEIF and compares the registered name with the one the site
  publishes. One GET, cached per scan.
- `synthetic-media-disclosure-validity` — validates IPTC `digitalSourceType`
  values against the vendored concept list and reports a disclosure that
  contradicts the image's own C2PA manifest. It never claims to detect
  undisclosed AI imagery.
- `trust-txt-reciprocity-coherence` — parses `trust.txt`, follows at most three
  `belongto=` associations and checks that the AI-crawler posture agrees with
  robots.txt. Informative tier at weight 0; it never fails a scan.
- `wikidata-round-trip-verification` — checks that the Wikidata entity a site
  claims names this site back through `P856`.

New in `agent-interfaces`:

- `mcp-origin-validation-cors` — one preflight from a throwaway RFC 2606
  origin. Reflected origin with credentials, or a wildcard on a credentialed
  endpoint, fails; a permissive endpoint with no auth surface is a note.
- `mcp-registry-listing-ownership` — searches the official MCP Registry for
  servers whose `remotes[].url` lives on this domain, classifies the namespace
  and verifies the ownership proof at `/.well-known/mcp-registry-auth`.
- `mcp-tool-description-coverage` — description coverage over the tool surface:
  every tool, every required parameter, and 90% of all parameters, with
  offending paths named as `create_invoice.line_items[].tax_code`.

New in `agentic-commerce`:

- `buyable-variant-resolution` — establishes from the rendered HTML that a page
  offers a variant choice, then requires the markup to resolve each one to an
  addressable, priced unit.
- `cart-handoff-reachability` — reads the cart and checkout paths as a browser
  and as ChatGPT-User and reports an account wall, a bot challenge on the
  document, or a hard block. GET only; a robots.txt `Disallow` on a cart path
  is reported rather than fetched.
- `offer-truth-consistency` — reconciles the Offer in the markup against the
  price, currency and stock the same page renders. The
  `competitor-gap-verify/offer-dom-price-parity` proposal reconciled the same
  two artifacts and folds into this audit; the folded dossier is under
  `docs/evidence/merged/`.

What a scan now sends that it did not before: up to six image GETs for the
C2PA pair, one GET each to GLEIF and Wikidata, at most three `trust.txt`
association GETs, two MCP Registry searches plus one ownership-proof GET, one
CORS preflight, and two GETs per cart path. Every request is a GET, a HEAD or
an OPTIONS; every URL passes the SSRF gate; nothing is ever posted, purchased
or added to a cart.

Shared gatherers added: `gatherers/media.ts` (container parsing and C2PA
manifest extraction), `gatherers/commerce.ts` (price candidates, offer nodes
and platform fingerprints) and `gatherers/domains.ts`. The fetcher gained a
`binary` option, because a UTF-8 decode destroys image metadata. `listTools`
moves into the shared MCP client so the two tool-surface audits split one
`tools/list` read, and `sharedUaFetch` joins the ua-parity gatherer so an audit
that needs a response body shares the per-scan cache.
