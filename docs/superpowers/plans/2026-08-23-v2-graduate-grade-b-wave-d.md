# Plan 5b Wave D — graduate the trust-provenance, mcp-server-quality and agentic-commerce proposals

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empty `packages/core/src/audits/proposed/` of every feasible stub. Thirteen proposals leave: twelve become audits — 6 in `operability-safety`, 3 in `agent-interfaces`, 3 in `agentic-commerce` — and one merges into another proposal in the same wave. The registry grows 203 → 215. What remains after this wave is 4 stubs, all blocked on infrastructure the tool does not have.

**Architecture:** The graduation recipe of Waves A–C, with four departures decided before the plan was written:

1. `competitor-gap-verify/offer-dom-price-parity` does **not** become its own audit. It and `agentic-commerce/offer-truth-consistency` check the same defect — JSON-LD offer values against the raw HTML that surrounds them — with overlapping sub-rules (price divergence, availability contradiction, stale `priceValidUntil`, conflicting duplicate Offer nodes). They ship as one audit, `agentic-commerce/offer-truth-consistency`, carrying every sub-rule from both dossiers; the parity dossier folds into `docs/evidence/merged/agentic-commerce/`.
2. `trust-provenance/c2pa-signer-chains-to-the-live-c2pa-trust-list` ships **reduced**. It parses the COSE signature and reports what the certificate itself says — self-signed versus CA-issued, validity window, whether a timestamp token is present. Chain-building to the C2PA Trust List needs a vendored trust-list JSON with a refresh job and an X.509 path builder; that arm and the CAWG identity assertion go under `## Deferred` with the reason.
3. Three audits read image bytes. `FetchResult.body` is a UTF-8 decoded string, which destroys binary content, so Task 1 adds a binary path to the fetcher. This is the only engine change in the wave.
4. Four audits query an external authority — GLEIF, Wikidata, the MCP Registry, and a declared association's own `trust.txt`. Wave C's origin-only rule is relaxed for exactly those hosts and no others.

**Tech Stack:** TypeScript, vitest, cheerio, undici, `node:crypto` (`X509Certificate`), zod, tsup, changesets, oxlint.

## Global Constraints

- **Meta law:** `weight = weightForGrade(grade, tier)`. Grade B → `scored` at 0.6; grade C → `informative` at 0 with `scoreDisplayMode: 'informative'`. `sunset.test.ts` enforces `tier !== 'scored' ⟺ weight === 0`.
- **Grade is fixed by the dossier.** Never re-grade while implementing. What the implementation cannot reach goes under `## Deferred` in the dossier.
- **Ids are at most 64 characters**, category prefix included. Task 0 lists every rename; use those exact slugs.
- **One audit = one file + one dossier.** `<category>/<slug>.ts`, `<slug>.test.ts` beside it, `docs/evidence/audits/<category>/<slug>.md`.
- **`notApplicable` is never a vacuous pass.** Every test file calls `expectNotApplicableOnEmpty(audit)`.
- **Every new URL fetch is `isSafeUrl()`-gated.** Test suites `vi.mock('../../fetcher')` — no real DNS in tests.
- **Read-only probes only.** Every request is a GET, a HEAD or a CORS preflight OPTIONS. No POST outside the MCP JSON-RPC path the existing `_mcp-client.ts` already uses, no authenticated request, no form submission, no add-to-cart.
- **Off-origin requests are allowed to four authorities only:** `api.gleif.org`, `www.wikidata.org` / `*.wikipedia.org`, `registry.modelcontextprotocol.io`, and the exact domain a `trust.txt` `belongto=`/`control=` line names. Each is a GET, each is cached per scan, and no user data ever appears in the query string.
- **The cart audit never buys anything.** It GETs candidate cart paths and reads the response. It never POSTs, never submits a form, and honours a robots.txt `Disallow` on a cart path by reporting it rather than fetching it.
- **The CORS probe uses a throwaway origin**, `https://al-probe-<random>.example`, never a real third-party domain.
- **Comments in English**, in every file.
- **Lint only via `rtk err pnpm lint`.** Never bare `pnpm lint`, never ESLint.
- **Four gates at every task boundary:** `AL_SKIP_NETWORK=1 pnpm test`, `pnpm typecheck`, `rtk err pnpm lint`, and `pnpm --filter @forkpoint/agent-lighthouse-core build && node scripts/check-dossiers.mjs`.
- **`details` values are scalars or arrays of strings.** A number array is dropped whole by the result schema.
- **The fourth argument of `fail()`/`warn()`** is a priority token or a remediation sentence; both work, and the sentence lands in `AuditResult.remediation`.
- **Check the dossier's Evidence section against its mechanism paragraph.** Several proposal dossiers carry an evidence block pasted from an unrelated proposal. Where the sources do not match the mechanism, the dossier is wrong: say so under `## Implementation deviations`.
- **Do not push.** The controller pushes after user approval.

---

## Task 0: the slug renames

| Proposal | Shipped id | Length |
| :-- | :-- | --: |
| `trust-provenance/c2pa-manifest-survives-the-delivery-pipeline` | `operability-safety/c2pa-manifest-survives-delivery` | 50 |
| `trust-provenance/c2pa-signer-chains-to-the-live-c2pa-trust-list` | `operability-safety/c2pa-signer-trust-status` | 43 |
| `trust-provenance/organization-identifier-resolves-in-the-authoritative-regist` | `operability-safety/organization-identifier-registry-resolution` | 61 |
| `trust-provenance/synthetic-media-disclosure-is-valid-and-self-consistent` | `operability-safety/synthetic-media-disclosure-validity` | 54 |
| `trust-provenance/trust-txt-reciprocity-and-ai-policy-coherence` | `operability-safety/trust-txt-reciprocity-coherence` | 50 |
| `trust-provenance/wikidata-round-trip-entity-verification` | `operability-safety/wikidata-round-trip-verification` | 51 |
| `mcp-server-quality/origin-validation-and-cors-coherence` | `agent-interfaces/mcp-origin-validation-cors` | 45 |
| `mcp-server-quality/registry-listing-and-namespace-ownership-proof` | `agent-interfaces/mcp-registry-listing-ownership` | 48 |
| `mcp-server-quality/tool-self-description-coverage` | `agent-interfaces/mcp-tool-description-coverage` | 47 |
| `agentic-commerce/buyable-variant-resolution` | `agentic-commerce/buyable-variant-resolution` | 43 |
| `agentic-commerce/cart-handoff-reachability` | `agentic-commerce/cart-handoff-reachability` | 42 |
| `agentic-commerce/offer-truth-consistency` | `agentic-commerce/offer-truth-consistency` | 40 |

`competitor-gap-verify/offer-dom-price-parity` ships no id of its own.

---

## File Structure

| File | Responsibility |
| :-- | :-- |
| `packages/core/src/fetcher.ts` | gains `binary?: boolean` on `FetchOptions` and `bytes?: Uint8Array` on `FetchResult` |
| `packages/core/src/gatherers/media.ts` | `imageCandidates`, `fetchImage`, `findC2paManifest`, `extractXmp`, `originOfVariant` — one image fetch per scan, cached |
| `packages/core/src/gatherers/commerce.ts` | `productRegion`, `priceCandidates`, `offerNodes`, `platformFingerprint` — the shared commerce reading the three agentic-commerce audits do |
| `packages/core/src/audits/operability-safety/*.ts` | six new audits + tests + dossiers |
| `packages/core/src/audits/agent-interfaces/mcp-*.ts` | three new audits + tests + dossiers |
| `packages/core/src/audits/agentic-commerce/*.ts` | three new audits + tests + dossiers |
| `docs/evidence/merged/agentic-commerce/offer-dom-price-parity.md` | the folded dossier + a row in `docs/evidence/merged/README.md` |

---

## Task 1: shared infrastructure

**Files:** `packages/core/src/fetcher.ts`, `packages/core/src/gatherers/media.ts`, `packages/core/src/gatherers/commerce.ts`, plus tests for both gatherers.

**Test must pin:**
- `fetch({ url, binary: true })` returns `bytes` as a `Uint8Array` and leaves `body` empty; without the flag, `bytes` is `undefined` and nothing about existing behaviour changes.
- The binary path honours the same size cap as the text path, and a truncated image reports `contentLength` as the bytes actually held.
- `imageCandidates(page)` collects `<img src>`, every `srcset` candidate, `og:image`, `twitter:image`, and JSON-LD `image`/`logo`/`primaryImageOfPage`, same-host only, deduplicated.
- `originOfVariant(url)` decodes `/_next/image?url=X` and `/cdn-cgi/image/<opts>/X` to `X`, and strips a WordPress `-WxH` suffix to the base upload. Returns `undefined` when the URL is not a known variant form.
- `findC2paManifest(bytes)` detects a manifest store in JPEG (APP11 `0xFFEB` carrying `JP` + a JUMBF box whose label contains `c2pa`), PNG (`caBX` chunk), WebP (RIFF `C2PA` chunk) and BMFF (`uuid` box with the C2PA UUID). Returns the byte range, not a parse.
- `extractXmp(bytes)` returns the XMP packet from JPEG APP1 `http://ns.adobe.com/xap/1.0/`, PNG `iTXt` keyed `XML:com.adobe.xmp`, or a raw `<?xpacket …?>` scan.
- `productRegion($)` returns the nearest common ancestor of the `<h1>` and the first offer-bearing node, and falls back to `<main>` then `<body>`.
- `priceCandidates(text, currency)` extracts currency-anchored numbers, tolerating thousands separators, decimal commas and non-breaking spaces, and marks a candidate inside `<del>`/`.was-price`/`s` as struck-through.
- `platformFingerprint(page)` names Shopify, WooCommerce, BigCommerce or Magento from headers and markup, or `undefined`.

---

## Task 2: `operability-safety/c2pa-manifest-survives-delivery`

Class `C2paManifestSurvivesDeliveryAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

**Test must pin:**
- Samples at most 3 images per page template, capped at 6 images per scan, each fetched once through the shared cache.
- An image whose bytes carry a manifest store counts toward `manifestCoverage`; one that does not, does not.
- A variant/origin pair where the origin carries a manifest and the served variant does not → `fail`, naming both URLs. This is `strippedInTransit`.
- A site with zero manifests anywhere → `notApplicable`, never a failure: there is nothing to strip.
- A site whose variants keep their manifests → `pass`.
- An image over the byte cap is skipped and reported as skipped, not counted as unsigned.
- No image is fetched twice, and every image URL is `isSafeUrl()`-gated.

---

## Task 3: `operability-safety/c2pa-signer-trust-status`

Class `C2paSignerTrustStatusAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'complex'`.

**Test must pin:**
- Reuses the manifest stores Task 2's gatherer found; it fetches no image of its own.
- Extracts the x5chain from the COSE `_Signature` structure and reads the leaf certificate with `node:crypto`'s `X509Certificate`.
- A leaf whose subject equals its issuer → `fail` as self-signed: no conforming validator trusts it.
- A leaf outside its validity window → `fail`, naming `validTo`.
- A CA-issued leaf inside its window → `warn` with the issuer named, because trust-list membership is not checked and the audit says so in the finding text.
- A manifest whose COSE structure does not parse → reported, never thrown.
- No manifest anywhere → `notApplicable`.
- The finding text never claims the certificate is trusted or untrusted by the C2PA Trust List.

---

## Task 4: `operability-safety/organization-identifier-registry-resolution`

Class `OrganizationIdentifierRegistryResolutionAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

**Test must pin:**
- Reads `leiCode` and `iso6523Code` off Organization nodes on the homepage and an about page.
- LEI shape `/^[A-Z0-9]{18}[0-9]{2}$/` plus the ISO/IEC 7064 MOD 97-10 check digit, computed locally, before any request.
- A `leiCode` with no `0199:` `iso6523Code` twin → advisory line, citing Google's documented preference; same for `duns` and `0060:`.
- One GET of `https://api.gleif.org/api/v1/lei-records?filter[lei]=<LEI>`, cached per LEI per scan.
- `attributes.entity.status !== 'ACTIVE'` or `attributes.registration.status !== 'ISSUED'` → `warn` naming the status.
- No record → `fail`.
- Registered `legalName` compared against schema `legalName`/`name` after normalizing case, punctuation and legal suffixes; below threshold → `fail` quoting both names.
- No identifier at all → `notApplicable`.
- With `AL_SKIP_NETWORK=1` the audit performs no lookup and reports the local checks only.

---

## Task 5: `operability-safety/synthetic-media-disclosure-validity`

Class `SyntheticMediaDisclosureValidityAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

**Test must pin:**
- Reads `Iptc4xmpExt:DigitalSourceType` out of the XMP packet Task 1's gatherer extracts.
- The IPTC NewsCodes vocabulary is a vendored constant, not a fetch. The dossier records the vendoring and the refresh path.
- Each near-miss class is its own finding: a bare conceptId with no URI prefix, `https://` where the vocabulary uses `http://`, a trailing slash, and free text.
- An exact vocabulary member → no finding.
- XMP asserting `digitalCapture` while the asset's C2PA manifest asserts `trainedAlgorithmicMedia` (or the reverse) → `fail` as a contradiction, naming the asset.
- `declaredCoverage` across sampled images is reported as a detail, never scored.
- No XMP on any image → `notApplicable`.
- The description never claims to detect undisclosed synthetic imagery.

---

## Task 6: `operability-safety/trust-txt-reciprocity-coherence`

Class `TrustTxtReciprocityCoherenceAudit` · `scoreDisplayMode: 'informative'` · `tier: 'informative'` · grade **C** · `weight: 0` · `defaultPriority: 'low'` · `effort: 'easy'`.

**Test must pin:**
- Reads `/trust.txt` and `/.well-known/trust.txt`; absence → `notApplicable`, never a penalty.
- Parses `name=value` lines with `#` comments and flags attribute names outside the spec set.
- For each `belongto=`, one GET of that domain's `trust.txt`, and a `member=` line pointing back at the audited domain is required; an unreciprocated association is reported by name. Same in reverse for `control=`/`controlledby=`.
- `datatrainingallowed=no` while robots.txt leaves GPTBot/ClaudeBot/PerplexityBot unrestricted → reported as a contradiction, in either direction.
- At most 3 association fetches per scan.
- No code path returns `fail`; the test asserts it across every input, and the description carries the adoption caveat.

---

## Task 7: `operability-safety/wikidata-round-trip-verification`

Class `WikidataRoundTripVerificationAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

**Test must pin:**
- Collects `sameAs` from Organization/Person/NewsMediaOrganization nodes across all JSON-LD blocks including `@graph`.
- Extracts the Q-id from `/wiki/Q\d+` or `/entity/Q\d+`.
- One GET per Q-id of `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=<Qid>&property=P856&format=json`, cached, at most 2 Q-ids per scan.
- Statement rank respected: `preferred` wins, `deprecated` ignored.
- Comparison is on the registrable domain, not string equality; a different TLD for the same brand → `warn`, not `fail`.
- P856 pointing at an unrelated registrable domain → `fail`, quoting both.
- The entity exists but declares no P856 → `warn` as unverifiable.
- No Wikidata `sameAs` → `notApplicable`.
- With `AL_SKIP_NETWORK=1` no lookup is performed.

---

## Task 8: `agent-interfaces/mcp-origin-validation-cors`

Class `McpOriginValidationCorsAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'moderate'`.

**Test must pin:**
- No MCP endpoint → `notApplicable`. Endpoint discovery reuses `_mcp-client.ts`.
- Probe A: the existing discover POST repeated with `Origin: https://al-probe-<random>.example`, compared against the same request with no Origin.
- Probe B: one OPTIONS preflight carrying `Origin`, `Access-Control-Request-Method: POST` and `Access-Control-Request-Headers: content-type, mcp-protocol-version, authorization`.
- ACAO reflecting the throwaway origin verbatim **and** `Access-Control-Allow-Credentials: true` → `fail` at critical severity, whatever the auth posture.
- `ACAO: *` on an endpoint that answers 401 with `WWW-Authenticate` or admits `authorization` in `Access-Control-Allow-Headers` → `fail`.
- No Origin differentiation on a credential-accepting endpoint → `warn`.
- Permissive CORS on an endpoint with no auth surface → reported as informational and explicitly not scored.
- `X-Accel-Buffering: no` on an SSE response is recorded as a detail.
- At most 3 requests beyond what the shared MCP probe already sent.

---

## Task 9: `agent-interfaces/mcp-registry-listing-ownership`

Class `McpRegistryListingOwnershipAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

**Test must pin:**
- No MCP endpoint → `notApplicable`.
- At most 2 GETs of `https://registry.modelcontextprotocol.io/v0.1/servers?search=…`, one per search term, no pagination beyond the first page.
- A candidate matches only when a `server.remotes[].url` host equals the audited apex or is a subdomain of it; names are never the join key.
- Namespace classification: reverse-DNS of the audited domain → first-party; `io.github.<user>/…` → account-bound; anything else → third-party aggregator, reported with the proxying host named.
- `_meta["io.modelcontextprotocol.registry/official"].status !== 'active'` or `.isLatest !== true` → reported.
- One GET of `https://<apex>/.well-known/mcp-registry-auth`, body matched against `/^v=MCPv1;\s*k=(ed25519|ecdsap384);\s*p=[A-Za-z0-9+\/]+={0,2}\s*$/`; a `com.*` listing with no proof → `fail`.
- A listing offering only `type: "sse"` → `warn`.
- No listing at all → `fail`, since clients resolving "the MCP server for this domain" find nothing.
- DNS TXT lookup is deferred: the scanner has no resolver. The dossier records it.

---

## Task 10: `agent-interfaces/mcp-tool-description-coverage`

Class `McpToolDescriptionCoverageAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

**Test must pin:**
- Reuses the `tools/list` result the shared MCP probe already holds; it sends no request of its own.
- `toolDescriptionCoverage` must be 100% to pass; descriptions under 40 characters are counted and reported separately as stubs.
- `paramDescriptionCoverage` walks `inputSchema.properties` recursively, and into `items.properties` for arrays of objects; threshold 90%.
- `requiredParamDescriptionCoverage` over parameters named in `required`; threshold 100%.
- `constrainedStringRatio`, `outputSchemaCoverage` and `titleCoverage` are reported, never gated.
- `instructions` missing or empty → reported with its length.
- Offending paths are named in the form `create_invoice.line_items[].tax_code`.
- No tools → `notApplicable`.

---

## Task 11: `agentic-commerce/buyable-variant-resolution`

Class `BuyableVariantResolutionAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'complex'`.

**Test must pin:**
- Runs on product pages only; no product page → `notApplicable`.
- Variants are established from raw HTML: a `<select>` whose name/id/class matches `/(size|colour|color|variant|option|style|width|length)/i` with ≥2 non-placeholder options, or ≥2 elements carrying `data-variant-id`/`data-option-value`/`data-product-variant`, or a platform fingerprint.
- Resolution passes on either a `ProductGroup` with `productGroupID`, `variesBy` and `hasVariant[]` where every entry has sku-or-gtin plus its own `offers.price`, `priceCurrency` and `availability`; or ≥2 distinct `Product` nodes each with a unique sku-or-gtin and a complete Offer.
- ≥2 detected variants with exactly one Offer, or an `AggregateOffer` carrying only `lowPrice`/`highPrice` → `fail`.
- A variant count in markup that differs from the count in the DOM → `warn` as a partially generated ProductGroup.
- The finding names the exact missing per-variant field.
- No request is sent: the audit reads pages the scan already fetched.

---

## Task 12: `agentic-commerce/cart-handoff-reachability`

Class `CartHandoffReachabilityAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'moderate'`.

**Test must pin:**
- Candidate paths derive from the platform fingerprint: Shopify `/cart`, WooCommerce `/cart` and `/checkout`, BigCommerce `/cart.php`, Magento `/checkout/cart`. No fingerprint and no candidate answering → `notApplicable`.
- Each path is fetched at most once per user agent, with the scanner UA and with `ChatGPT-User`, and never with a POST.
- A redirect whose final path matches `/login|/signin|/sign-in|/account\/login|/customer\/account\/login/i` → `fail` as an account wall on the buy path.
- The cart or checkout **document** referencing `challenges.cloudflare.com/turnstile`, `www.google.com/recaptcha`, `hcaptcha.com` or a `data-sitekey` attribute → `fail`.
- 403 or 429 under either UA → `fail`, naming the UA.
- Every candidate 404 → `fail`: no discoverable cart surface.
- A checkout document that is entirely JS-rendered with an empty `<noscript>` → `warn`.
- A robots.txt `Disallow` covering a cart path → that path is reported as disallowed and **not fetched**.

---

## Task 13: `agentic-commerce/offer-truth-consistency`

Class `OfferTruthConsistencyAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'complex'`.

Carries every sub-rule of both dossiers. `competitor-gap-verify/offer-dom-price-parity` folds into it.

**Test must pin, each as its own finding:**
- STOCK CONTRADICTION — `offers.availability` in-stock while the product region says sold out, or the primary add-to-cart button carries `disabled`.
- STALE OFFER — `priceValidUntil` earlier than today.
- PRICE DIVERGENCE — no raw-HTML price candidate within 1% of `offers.price`, after normalizing separators. A struck-through candidate is an acceptable non-match.
- CURRENCY MISMATCH — the rendered symbol or code disagrees with `offers.priceCurrency`.
- SALE INVERSION — a sale price at or above the regular price.
- DUPLICATE CONFLICT — two Product nodes sharing a `url` or `@id` with different price or availability.
- UNMACHINE-READABLE — a price visible in raw HTML with no `offers.price`.
- JS-ONLY PRICE — no price in either the raw HTML or the JSON-LD → `warn`, reported separately, never a failure.
- Extraction is restricted to the product region so carousels and related products cannot fire it.
- Not a product page → `notApplicable`. The audit sends no request.

---

## Task 14: close the wave

- [ ] **Step 1: Verify the counts moved together**

```bash
pnpm --filter @forkpoint/agent-lighthouse-core build
node scripts/check-dossiers.mjs
grep -c "^  '" packages/core/src/tests/new-in-v2.ts
head -3 packages/core/src/audits/proposed/README.md
find packages/core/src/audits/proposed -name '*.ts' | wc -l
```

Expected: `check-dossiers` reports **215 audits OK … no orphans**; `NEW_IN_V2` carries 67 ids; both proposal READMEs say **4**; the stub file count is 4.

- [ ] **Step 2: Run every gate**, then `npx changeset status`.
- [ ] **Step 3: Write `.changeset/v2-graduate-grade-b-wave-d.md`** — major on core, patch on the rest. State the merge, the reduced C2PA signer audit, the fetcher's binary path, and every off-origin authority the wave queries.
- [ ] **Step 4: Regenerate the website** — `npx tsx scripts/build-docs-data.ts`.
- [ ] **Step 5: Update `docs/superpowers/HANDOFF-v2.md`** — Wave D into the executed table, Plan 5b marked complete, the 4 remaining stubs named with their blockers, gate line at the new counts.
- [ ] **Step 6: Commit.** Do not push; report to the user.

---

## Self-review

**Spec coverage.** All 13 feasible stubs have a disposition: 12 graduate, 1 merges. `trust-provenance`, `mcp-server-quality`, `agentic-commerce` and `competitor-gap-verify` are then empty of feasible stubs, and `proposed/` holds only the 4 infra-blocked ones.

**Placeholder scan.** Every task names its class, its meta values and its acceptance list. Task 1 gives the exact interfaces Tasks 2, 3, 5, 11, 12 and 13 consume.

**Type consistency.** `imageCandidates`, `fetchImage`, `findC2paManifest`, `extractXmp` and `originOfVariant` are defined once in Task 1 and consumed unchanged in Tasks 2, 3 and 5. `productRegion`, `priceCandidates`, `offerNodes` and `platformFingerprint` likewise for Tasks 11–13. `discoverMcpEndpoint`, `sharedProbe` and `discoverProbe` come from the existing `_mcp-client.ts` and are not redefined.

**Ordering.** Task 1 blocks Tasks 2, 3, 5 and 11–13. Task 2 lands before Task 3, which reads the manifest stores Task 2's gatherer finds. Task 13 lands after Task 11 because both read the product region. Task 14 is last because it pins the final counts.
