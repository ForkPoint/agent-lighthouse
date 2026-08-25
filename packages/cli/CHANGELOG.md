# @forkpoint/agent-lighthouse

## 2.0.0

### Major Changes

- b0adaf5: v2 taxonomy: 8 agent-journey categories, `category/slug` ids, 8 more sunsets.

  **Breaking: the 10 v1 categories are replaced by 8 built around what an agent
  actually does with a site.** Gone: `content-discoverability`,
  `crawler-permissions`, `meta-tags`, `semantic-html`, `technical-readiness`,
  `answer-engine`, `generative-engine`, `agent-tools`, `accessibility`,
  `structured-data` as v1 defined it. In their place:

  | category               | what it answers                                   |
  | ---------------------- | ------------------------------------------------- |
  | `access-crawl-control` | can an agent reach the site at all                |
  | `content-extraction`   | can it get clean content out of a page            |
  | `machine-discovery`    | can it find the machine-readable surfaces         |
  | `structured-data`      | is the meaning explicit rather than inferred      |
  | `answer-readiness`     | is a page answerable without the rest of the site |
  | `agent-interfaces`     | is there something an agent can call              |
  | `agentic-commerce`     | can an agent transact                             |
  | `operability-safety`   | is the site safe and stable to operate against    |

  Membership changed with the names: an audit keeping its slug did not
  necessarily keep its home (`technical-readiness/https-enabled` is scored under
  `access-crawl-control`, `semantic-html/image-alt-text` under
  `content-extraction`, `generative-engine/descriptive-urls` under
  `answer-readiness`). Category scores are not comparable across the major.

  **Breaking: numeric ids are gone.** v1 identified audits by a `major.minor`
  number whose major half encoded the old taxonomy. `CheckResult.id` is now a
  `category/slug` path — `machine-discovery/llms-txt-exists` — validated by
  `AUDIT_ID_PATTERN`. Nothing in a v2 report, CLI output or MCP payload carries a
  numeric id, and `--debug-audit` takes a slug id.

  **Translate v1 ids with the shipped map.**
  `@forkpoint/agent-lighthouse-core/migration-map.json` is keyed by v1 numeric id
  and carries all 207 of them: 181 `renamed` (use `to`, which is registered and
  running in this release) and 26 `removed` (nothing to re-point at). Every
  surviving entry links its evidence dossier. Note that the 181 `renamed` entries
  point at only 148 distinct v2 ids — several v1 series collapse onto one — see
  the merge-wave note in this release.

  ```js
  import map from "@forkpoint/agent-lighthouse-core/migration-map.json";

  const v2IdFor = (v1Id) => {
    const e = map[v1Id];
    if (!e || e.status === "removed") return null; // gone, drop the series
    return e.to; // live in this release
  };
  ```

  **Breaking: 8 more audits are removed as not-a-factor**, on top of the 18 sunset
  in 1.0.0 — 26 v1 audits are now gone in total. The 2026-08-21 grading pass
  graded these D (or, for `1.18` mobile-friendly, `unrated`), and the adversarial
  evidence review could not name a consumer:

  `1.18` mobile-friendly, `1.23` commerce-links, `7.22` marquee, `8.14`
  no-render-blocking, `8.15` image-dimensions, `8.16` lcp-not-lazy, `8.19`
  privacy-policy, `8.20` terms-of-service.

  They no longer run, no longer appear in any report, and no longer emit a
  `CheckResult`. Dashboards keyed on those ids need the series dropped. Rationale
  and sources:
  [docs/evidence/sunset/](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/sunset/README.md).

  **Breaking: `SECTION_GROUPS` is regrouped** onto the v2 categories. The three
  group keys and labels are unchanged, but membership and the flattened
  `CATEGORY_ORDER` every surface renders from are not — notably `structured-data`
  now reports under **AI Search Optimization** rather than Technical Foundation:

  - **Agentic Readiness** — `access-crawl-control`, `machine-discovery`,
    `agent-interfaces`, `agentic-commerce`
  - **AI Search Optimization** — `content-extraction`, `structured-data`,
    `answer-readiness`
  - **Technical Foundation** — `operability-safety`

  Consumers pinning section membership or category ordering must be updated.

  The full upgrade guide is
  [MIGRATION.md](https://github.com/ForkPoint/agent-lighthouse/blob/main/MIGRATION.md);
  the audit-by-audit v1 → v2 table, with the reasoning behind every move, merge
  and split, is in
  [docs/evidence/v2-audit-map.md](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/v2-audit-map.md).

### Minor Changes

- 40064df: A scan can now emit one record per audit, so a verdict can be traced back to
  the evidence it came from.

  A report says what each audit concluded. It does not say which audits never ran
  and why, how long each took, or what a verdict was drawn from — and an audit
  that produced nothing looks the same in a report as one that considered the
  question and answered "not applicable".

  `--trace [path]` writes one NDJSON record per registered audit, including the
  ones skipped before running and the ones that errored. Each record carries the
  outcome (`ran`, `skipped`, `error`), the status, score, weight, tier and grade,
  the wall time inside `audit()`, and the structured evidence behind the verdict.
  The file is truncated at the start of a scan and appended to as it runs, so a
  crash still leaves everything up to the point it stopped. Two runs produce two
  comparable files.

  Programmatically, `runScan` takes an `onAuditTrace` handler that receives the
  same records. With neither, `LOG_LEVEL=debug` logs one line per audit; with
  none of the three, nothing is built.

### Patch Changes

- 3d23272: Rename the shouted documentation filenames to lowercase (`docs/CLI.md` →
  `docs/cli.md` and ten others). Published site routes are unchanged; only the
  source filenames and the links between them move.
- 3d23272: Correct the audit count in the CLI README. It said 172; the registry ships 215.
- b0adaf5: v2 grade-A graduation wave: the registry grows from 148 to 172 audits.

  24 checks from the 2026-08-20 research pass move out of the proposed folder
  into the live registry. Every one carries evidence grade A — a proven consumer
  path, documented in its dossier under `docs/evidence/audits/` — so every one
  lands in the scored tier at weight 1.0, except
  `structured-data/claimreview-advisory`, which is informative at weight 0
  because its honest finding is that fact-check markup is not an AI-readiness
  lever.

  New in this release, by category:

  - **access-crawl-control**: ai-crawler-edge-parity, bot-content-delta-declared,
    robots-ai-group-shadowing
  - **content-extraction**: css-hidden-ghost-content, hydration-payload-share
  - **machine-discovery**: agent-commerce-feed-parity,
    ai-crawler-surface-reachability, sitemap-lastmod-verifiability
  - **answer-readiness**: snippet-gate-coverage, text-fragment-addressability
  - **agent-interfaces**: mcp-modern-era-reachability, mcp-oauth-discovery-chain,
    mcp-tool-contract-validity, mcp-tools-list-determinism, mcp-version-downgrade
  - **agentic-commerce**: acp-policy-link-surface, agent-ua-commerce-parity,
    checkout-offer-field-mapping, landed-cost-and-returns
  - **operability-safety**: aria-layer-injection-scan,
    form-autofill-token-coverage, invisible-instruction-scan,
    native-control-substitution
  - **structured-data**: claimreview-advisory

  Category evidence mass moves with the audits, so overall scores shift: a site
  that scored well on the 148-audit registry is not guaranteed the same number
  here. That is the intended effect of adding proven checks, not a regression.

  **Breaking: `probeAsBot`, `BotProbeResult` and `BotProbeSignal` are removed**
  from `@forkpoint/agent-lighthouse-core`. They collapsed every non-2xx crawler
  response into a single "blocked" signal, which cannot distinguish a Cloudflare
  challenge from pay-per-crawl, a proof-of-work wall, a rate limit, or an opaque
  403 that may be correct impersonation defence. Use `probeUaParity` and the
  `UaProbe` block classification instead.

  Also fixed: `fetcher` collapsed repeated response headers, so a site sending
  two `X-Robots-Tag` lines had one of them silently discarded. Repeated headers
  are now joined per RFC 9110 §5.3, which also corrects doubled `nosniff` and
  multi-`Link` canonical handling.

- b0adaf5: Plan 5b Wave A: 12 grade-B proposals graduate into `operability-safety`. The
  registry grows from 172 to 184 audits.

  Each carries evidence grade B — a documented consumer path, proved in its
  dossier under `docs/evidence/audits/operability-safety/` — so each lands in the
  scored tier at weight 0.6, except
  `operability-safety/first-contact-consent-gate-operability`, which is
  informative at weight 0: its honest finding is an action cost, not a defect.

  New in this release:

  - **Agent operability**: drag-and-slider-dependency,
    ghost-clickable-element-ratio, hover-only-content-and-navigation,
    stateful-control-introspectability,
    url-addressable-state-and-pagination-fallback,
    first-contact-consent-gate-operability
  - **Injection safety**: agent-ua-content-divergence-diff,
    reflected-parameter-injection-canary, third-party-dom-write-blast-radius,
    ugc-trust-boundary-markers, unicode-covert-channel-scan,
    unsafe-agent-triggerable-affordances

  `operability-safety` gains 6.6 evidence mass, so its share of the overall score
  rises and every other category's share falls. A site that scored well on the
  172-audit registry is not guaranteed the same number here. That is the intended
  effect of adding proven checks, not a regression.

  `operability-safety/reflected-parameter-injection-canary` sends at most five
  read-only GET probes to the scanned origin, carrying a random per-scan canary
  token, to find out whether a query parameter is reflected into the fields an AI
  answer lifts verbatim. It never probes an authenticated path and never sends
  anything but GET.

  `operability-safety/agent-ua-content-divergence-diff` adds one request per
  compared URL: an unrecognised control bot, so a reduced page served to every
  unknown client is reported as bot management rather than as AI-crawler
  branching. Its crawler-UA probes reuse the per-scan cache the
  `access-crawl-control` audits already fill.

- b0adaf5: Plan 5b Wave B: the token-economics and answer-selection-forensics proposals
  land. Nine graduate as new audits and three fold into audits that already
  shipped. The registry grows from 184 to 193 audits.

  New in `content-extraction`:

  - **preamble-tax** — how many tokens an agent reads before the page says
    anything about its subject.
  - **boilerplate-tax** — across the crawl, how much of what an agent fetches it
    has already read.
  - **extraction-determinism** — whether three extractors reading the same page
    agree on what the page says.
  - **json-ld-duplication-mass** — how many tokens the structured data repeats
    from the body. Informative at weight 0: repeating a description in JSON-LD is
    a cost, not a defect, and the audit never fails a page for it.

  New in `answer-readiness`:

  - **chunk-boundary-referent-integrity** — pronouns and positional references
    that stop resolving once a retriever cuts the page into chunks.
  - **extractor-survival-recall** — the share of a page's key spans that survive
    extraction, and the ancestor chain that deleted the ones that did not.
  - **section-split-risk-profile** — how the page survives being cut into
    512-token windows: headings separated from their bodies, sections with no
    heading, sections too thin to answer anything, and tables cut in half.
  - **site-wide-passage-uniqueness-ratio** — the share of each page's sentences
    that are its own, and near-duplicate clusters whose members all name
    themselves canonical, which leaves the canonical election with no answer.
  - **table-markdown-round-trip-loss** — every main-content table converted to
    GFM markdown and read back, with each lost cell reported by coordinate.

  Three proposals folded into audits that already shipped, rather than landing
  beside them:

  - `content-extraction/token-ratio` now measures signal density the way the
    signal-density-index proposal specifies: real `o200k_base` tokens, a
    readability-extracted numerator, and a bucket breakdown of where the rest of
    the payload went.
  - `content-extraction/svg-bloat` now also counts base64 `data:` URIs, which
    cost an agent tokens the same way an inline SVG path does.
  - `content-extraction/markdown-alternate` now verifies the alternate it finds:
    it fetches the file, checks the RFC 7763 media type, and measures how much of
    the HTML's headings and prose the markdown actually carries. A declared
    alternate that 404s fails; one that is served but unreadable passes with
    `details.verified = false`.

  Two new runtime dependencies of `@forkpoint/agent-lighthouse-core`, which
  consumers will install:

  - `gpt-tokenizer` — real `o200k_base` token counts. Every token number this
    release reports is a tokenizer count, never `chars / 4`.
  - `@mozilla/readability` — the main-content extractor, run over jsdom, that the
    new audits measure against.

  `answer-readiness` gains 3.0 evidence mass and `content-extraction` 1.8, so both
  categories take a larger share of the overall score and every other category's
  share falls. A site that scored well on the 184-audit registry is not
  guaranteed the same number here.

  No audit in this wave sends a request that the previous release did not, except
  `content-extraction/markdown-alternate`, which fetches the markdown alternate a
  page declares — a same-origin GET of a file the site advertises.

- b0adaf5: Plan 5b Wave C: the bot-auth-access, competitor-gap-verify and feeds-indexing
  proposals land. Ten graduate as new audits and one folds into another. The
  registry grows from 193 to 203 audits.

  New in `access-crawl-control`:

  - `ai-usage-signal-coherence-across-channels` — reads every channel a site can
    declare AI usage in (robots.txt AI groups, robots.txt `Content-Signal`, the
    `Content-Usage` header, TDM Reservation Protocol, inline RSL) and reports the
    ones that disagree. The `competitor-gap-verify/content-signal-coherence`
    proposal covered the same defect on one channel and folds into this audit;
    the folded dossier is under `docs/evidence/merged/`.
  - `aipref-content-usage-declaration-validity` — validates `Content-Usage`
    syntax, category names and scope paths, and reports a declaration made inert
    by the robots.txt rule that decides the same path.
  - `rsl-licensing-terms-conformance` — checks Really Simple Licensing documents
    across four discovery channels for a usable permit and payment shape.
  - `machine-actionable-402-paid-access` — when an origin answers 402, checks
    that the response is machine-actionable. It never completes a payment and
    never retries with a price.
  - `web-bot-auth-request-tolerance` — signs one request with a per-scan
    ephemeral Ed25519 key and reports whether the origin tolerates HTTP Message
    Signatures. It claims nothing about identity and presents no agent.

  New in `machine-discovery`:

  - `conditional-request-support` — four requests per discovery surface: two
    identical GETs to see whether the validator is stable, then `If-None-Match`
    and `If-Modified-Since`.
  - `feed-entry-identity-and-canonical-integrity` — per-entry id and timestamp
    conformance, duplicate ids, and the five newest item URLs compared against
    the `rel="canonical"` of the pages they open.
  - `root-text-file-resolution-integrity` — two GETs of random 32-hex `.txt`
    names that must 404, plus `/robots.txt` as the positive control. Emits
    `details.discoveryProbeReliable`.
  - `three-way-freshness-lag` — the newest page date against the newest sitemap
    `<lastmod>` and the newest feed entry. Only the freshness half of the
    proposal ships; the orphan half stays with `discovery-index-coverage` rather
    than being scored twice.
  - `websub-hub-advertisement` — WebSub discovery-link conformance. Informative
    tier at weight 0; it never fails a scan.

  What a scan now sends that it did not before: up to four extra GETs per
  discovery surface for the conditional-request probe, five item-page GETs for
  the feed canonical comparison, five sitemap-URL GETs for the dead-entry check,
  three GETs for the root `.txt` probe, one signed GET for the web-bot-auth
  probe, and one HEAD per declared WebSub hub — the only cross-origin request
  the wave adds. Every request is a GET or a HEAD, every URL passes the SSRF
  gate, and no probe writes anything.

  Shared gatherers added: `gatherers/feeds.ts`, `gatherers/conditional.ts`,
  `gatherers/structured-fields.ts` and `gatherers/currency.ts`, so the eleven
  audits share one fetch per surface.

  Also fixes a latent defect in the audit base class: a `fail()` or `warn()`
  whose fourth argument is a remediation sentence rather than a priority token
  threw a `ZodError` at report time. Thirty-two call sites were affected. The
  result now carries `remediation`, and `answer-readiness/section-split-risk-profile`
  no longer emits a number array in `details`, which the result schema rejects.

- b0adaf5: Plan 5b Wave D: the injection-safety, mcp-server-quality and agentic-commerce
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

- b0adaf5: v2 merge wave: the registry lands at 148 audits, and every one the evidence
  review flagged for rework was rewritten against its evidence dossier.

  **Breaking: the registry is 148 audits, down from 181.** The v2 taxonomy note
  described 181 v1 ids carried forward; carrying them forward is not the same as
  keeping 181 separate checks. 57 of those ids resolve onto just 24 v2 audits —
  33 fewer checks than ids — so the shipped registry is:

  | category               |  audits |
  | ---------------------- | ------: |
  | `access-crawl-control` |      29 |
  | `answer-readiness`     |      26 |
  | `operability-safety`   |      24 |
  | `content-extraction`   |      21 |
  | `machine-discovery`    |      16 |
  | `agent-interfaces`     |      16 |
  | `structured-data`      |      13 |
  | `agentic-commerce`     |       3 |
  |                        | **148** |

  The collapse is 2 consolidations and 22 merge folds, plus 2 splits that move a
  signal rather than remove one (one of the two splits, `webmcp-tool-naming`, is
  already counted among the 22 folds — its id stops emitting):

  - **2 consolidations** — 5 per-bot audits (`bytespider`, `cohere-ai`, `youbot`,
    `diffbot`, `ai2bot`) become one `access-crawl-control/ai-bot-directives`, and
    4 header audits (`hsts-header`, `csp-header`, `content-type-options`,
    `security-txt`) become one `operability-safety/security-header-hygiene`.
    Both are new ids that no v1 audit owned.
  - **22 merge folds** — a signal moves into an existing audit and its own id
    stops emitting: `no-noindex` and `meta-robots` into
    `access-crawl-control/robots-directives`, `og-site-name` and `twitter-card`
    into `answer-readiness/core-open-graph`, `fast-response-time` into
    `content-extraction/server-responsiveness`, `cache-headers` into
    `machine-discovery/ai-file-delivery`, and so on.
  - **2 splits** — `structured-data/service-schema` keeps the Service half and
    hands the Product half to `structured-data/advanced-product-details`;
    `webmcp-tool-naming` hands its naming rule to
    `agent-interfaces/openapi-operation-ids` and defers its runtime half out of
    v2.0.

  A dashboard keyed on a folded id must re-point at the merge target, and several
  old series now share one new one. Look every id up in the shipped map rather
  than guessing.

  **Breaking: `migration-map.json` is all-`renamed`.** The interim `merging`
  status and its `interim` field are gone: every surviving v1 id now carries
  `status: "renamed"` and a `to` that is registered and running in this release.
  Consumers read `to` directly.

  ```js
  import map from "@forkpoint/agent-lighthouse-core/migration-map.json";

  const v2IdFor = (v1Id) => {
    const e = map[v1Id];
    if (!e || e.status === "removed") return null; // gone, drop the series
    return e.to; // live in this release
  };
  ```

  The census is unchanged — 207 v1 ids, 26 `removed`, 181 `renamed` — but those
  181 point at only 148 distinct v2 ids.

  **Breaking: every remaining audit was rewritten to evidence-backed pass
  conditions.** A v1 audit passed when a pattern matched; a v2 audit passes when
  the dossier says the agent-visible signal is actually present. Pass conditions,
  thresholds, `na` handling and priorities all moved, so **the same site will
  score differently on the same audit id**. There are no holdovers: the last six
  — `agent-interfaces/webmcp-registered-tools`,
  `access-crawl-control/ai-content-declaration`, `access-crawl-control/tdm-rep`,
  `operability-safety/form-error-messages`, `answer-readiness/direct-definitions`
  and `agent-interfaces/cors-api-routes` — were rewritten too, and four of them
  changed shape enough to be worth calling out:

  - `agent-interfaces/webmcp-registered-tools` no longer reads
    `/.well-known/webmcp`, an invented path with no spec and no IANA
    registration; it reports tools registered at runtime through
    `navigator.modelContext` and returns `na` when it cannot see any, since it
    has no JavaScript runtime. A guaranteed high-priority zero on nearly every
    site becomes `na`. The exported class is renamed `WebmcpManifestAudit` →
    `WebmcpRegisteredToolsAudit`, and `/.well-known/webmcp` is dropped from the
    root-file fetch list, so scans issue one fewer request.
  - `access-crawl-control/ai-content-declaration` stops demanding a meta tag that
    does not exist and stops claiming GPTBot and ClaudeBot read it. It passes on
    an AIPREF `Content-Usage` header or robots.txt rule, warns on
    `noai`/`noimageai` with the "no documented consumer" caveat, and is `na`
    otherwise.
  - `access-crawl-control/tdm-rep` reports `tdm-reservation` 1 (rights reserved)
    and 0 (mining permitted) as distinct outcomes rather than one shared pass,
    validates the well-known file against the spec's array-of-objects shape
    behind a content-type and leading-`<` guard, reads the `tdm-reservation`
    response header, and returns `na` when nothing is declared instead of a
    `warn` on nearly every scan (the audit is weight 0, so no score moved).
    `audit()` is now synchronous.
  - `agent-interfaces/cors-api-routes` probes the endpoints the OpenAPI document
    declares (`servers[].url` plus concrete paths, `isSafeUrl()`-gated) instead of
    a hardcoded `/api/`, requires an `Access-Control-Allow-Origin` that admits a
    third-party origin, and is `na` for any site that publishes no OpenAPI
    document.

  `operability-safety/form-error-messages` and `answer-readiness/direct-definitions`
  moved too — see the list below.

  The changes that move the most results:

  - `access-crawl-control/robots-directives` now warns on `nosnippet`,
    `noarchive` and `max-snippet:0` — no v1 audit did. Sites with a deliberate
    AI-snippet policy will see a new warn.
  - `access-crawl-control/sensitive-paths` fails, instead of warning, when the
    crawl observed low-value URL families (cart, checkout, search, login,
    account, admin) and none of them is disallowed for AI crawlers — including
    when no `robots.txt` is served at all; warning would have scored deleting the
    file above shipping an empty one. A site whose crawl surfaced no such family
    returns `na` before `robots.txt` is read, so a missing file alone never
    fails this audit.
  - `answer-readiness/dates-on-content` warns on publication-only dates that
    claim to be current, and `answer-readiness/review-signals` warns when review
    counts come from a third-party widget rather than markup.
  - `agent-interfaces/openapi-exists` returns `na` (not `fail`) when a site
    exposes no API surface at all, and ships informative at weight 0 until a
    documented consumer exists. `agent-interfaces/ai-catalog-metadata` and
    `ai-catalog-urls` return `na` when there is no manifest, which removes two
    guaranteed zeros from every no-catalog scan and raises `agent-interfaces`
    scores accordingly.
  - `content-extraction/server-responsiveness` scores TTFB on pinned 800 ms /
    2500 ms bands, absorbing the old `fast-response-time` signal.
  - `content-extraction/aside-element` goes from a binary to a three-state
    result, and `operability-safety/security-header-hygiene` never returns
    `fail` — it is informative at weight 0 by design.
  - `operability-safety/form-error-messages` stops passing a whole site on one
    input carrying `aria-describedby`. It reports coverage as a ratio over the
    fields the server rendered as `aria-invalid`, or — the normal case on a GET —
    over the required fields, accepts `aria-errormessage` on equal terms, counts
    fields outside a `<form>`, and is `na` when nothing declares a constraint. A
    site with one wired input among many now warns; a site using
    `aria-invalid` + `aria-errormessage` now passes instead of being warned.
  - `answer-readiness/direct-definitions` drops its bold-colon branch, which
    every `<strong>Note:</strong>` satisfied, gates on definitional intent
    detected structurally and in eleven languages, counts CJK definitions
    correctly, and reports prose definitions instead of failing them. It never
    returns `fail`.

  **Breaking: `_a11y.ts` is gone, split into 17 per-rule audit files.** The
  accessibility rules were a single module behind a shared base class; each rule
  is now its own file under `operability-safety/` with its own dossier, and the
  exported audit classes lost their `A11y` prefix (`A11yLandmarkUniqueAudit` →
  `LandmarkUniqueAudit`, and so on). Audit ids and metadata are unchanged — only
  importers of the class symbols are affected.

  Every id, every fold and the reasoning behind each one is in the audit-by-audit
  table at
  [docs/evidence/v2-audit-map.md](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/v2-audit-map.md);
  the per-audit evidence, grades and sources are in
  [docs/evidence/audits/](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/README.md);
  the upgrade guide is
  [MIGRATION.md](https://github.com/ForkPoint/agent-lighthouse/blob/main/MIGRATION.md).

- b0adaf5: v2 polish wave: engine fixes, tier surfacing, two live CLI flags.

  **Scoring change.** A category where every check is notApplicable now leaves the
  overall denominator. A site with no commerce surface is no longer scored down
  for having no checkout, so narrow sites score higher than they did on the same
  registry. That is the intended correction.

  **Security fix.** `isSafeUrl` now gates every hop of a redirect chain, not just
  the URL the caller passed — a site could previously redirect the scanner into
  link-local or RFC 1918 space. `FetchResult.finalUrl` is now the URL that
  actually answered.

  **Fixed:** `AuditResult.details` no longer silently drops unknown keys, so an
  audit's structured evidence reaches the report; `fail()` and `warn()` no longer
  discard a per-result fix snippet in favour of the generic one.

  **New:** advisory and experimental checks are badged in the HTML report, marked
  in terminal output, counted in the markdown summary and filterable in the audit
  explorer, so a weight-0 check no longer reads as a defect. `--categories <list>`
  finally filters the registry and rejects unknown ids; `--experimental` opts in
  to experimental-tier audits, which are excluded by default.

  Also: nine audit-behavior defects, five strengthened tests, and the website
  audit explorer regenerated from the live 172-audit registry.

- b0adaf5: v2 registry: evidence-mass overall score and an enforced audit contract.

  **Breaking: `CATEGORY_WEIGHTS` is gone.** A category's share of the overall score is no longer a hand-tuned percentage; it is the category's _evidence mass_ — the summed weight of its registered audits — exported as `CATEGORY_MASS` and derived from the registry:

  ```
  overall = Σ(categoryScore × categoryMass) / Σ(categoryMass)
  ```

  A category made only of informative/experimental audits has mass 0 and cannot move the overall score. Scores shift accordingly: influence now follows proven evidence (e.g. Access & Crawl Control carries 29 mostly grade-A audits and weighs far more than its old 0.08).

  **Breaking: `AuditMetaSchema` enforces the v2 contract.** `evidenceGrade`, `tier` and `dossier` are required — an audit must state where its weight comes from and which dossier proves it — and `id` must match `AUDIT_ID_PATTERN` (`/^[a-z-]+\/[a-z0-9-]+$/`, i.e. `category/slug`), so numeric v1 ids no longer validate. Translating an existing id is covered in the taxonomy note.

  **Breaking: `buildCategoryResult(id, checks, mass?)`** takes the category's evidence mass instead of looking up a weight table; omitted, the category weighs nothing.

  The registry itself is now sourced from the eight category `index.ts` files, so adding an audit to a category folder registers it. Readiness vitals were remapped onto v2 ids: `botAccessibility` reads the `access-crawl-control` category and `technical` reads `content-extraction`.

- b0adaf5: Weighted category scoring, plus the gatherer helpers the v2 audits are built on.

  **Breaking: a category score is now a weighted mean, not a flat average.**

  `calculateCategoryScore` previously averaged the `score` of every applicable check equally. It now weights each check by the `weight` declared in its audit meta:

  ```
  score = Σ(check.score × check.weight) / Σ(check.weight)
  ```

  Not-applicable checks (`status === 'na'`) stay out of the denominator, as before. What changed is that evidence strength now moves the number.

  **New: an audit's weight is derived, not chosen.** Every audit declares an `evidenceGrade` (`A` | `B` | `C` | `D`, taken from its evidence dossier) and a `tier` (`scored` | `informative` | `experimental`), and its weight is a pure function of the two — exported as `weightForGrade(grade, tier)`:

  - `scored` + grade `A` → `1.0`; `scored` + grade `B` → `0.6`; `scored` + grade `C` or `D` → `0`.
  - `informative` and `experimental` → `0` at any grade. These audits still run and still report their findings, but they are deliberately unable to move a score, and every surface that ranks or scores checks filters them out of recommendations, top fixes/passes and readiness vitals.

  `CheckResult` now carries `evidenceGrade` and `tier` alongside `weight`, so a consumer can see why a check weighed what it did without reaching back into the registry. **Expect published scores to shift for the same site**; they are not comparable to scores from a previous release.

  Two consequences worth calling out for anyone constructing `CheckResult` objects directly rather than via `Audit`:

  - A check with no `weight` contributes nothing to either side of the ratio. A category whose checks all lack a weight totals zero weight and scores `0`.
  - `AuditMetaSchema.weight` now accepts `0` (it required a positive number before), which is what makes the informative tier expressible.

  **New in `CheckResult`:** an optional `weight` field, stamped from `AuditMeta.weight` when the audit produces the check, so a consumer can see the weight that scoring actually applied.

  **New in `FetchOptions`:** a `userAgent` option that overrides the default scanner User-Agent for a single request — used to probe a site as a specific AI crawler.

  **Newly exported gatherer helpers**, previously internal:

  - `./gatherers/fetch-classify` — `classifyFetch`, `isRealFile`, `stripBom`, `normalizeNewlines`, and the `FetchClass` / `ExpectedKind` types. Classifies a fetched root file as `ok`, `soft-404`, or `error` from body evidence rather than trusting status 200.
  - `./gatherers/robots` — `parseRobots`, `matchesUserAgent`, `groupsForBot`, `isPathAllowed`, `isBlanketBlocked`, and the `RobotsRule` / `RobotsGroup` types.
  - `./gatherers/bot-probe` — `probeAsBot`, `BotProbeResult`, and `BotProbeSignal`, for detecting edge blocking that targets AI crawler user agents. A result reports `signal: 'ok' | 'blocked' | 'inconclusive'`, where `inconclusive` means the probe never completed and is explicitly not a pass; the `edgeBlocked` boolean is a convenience mirror of `signal === 'blocked'`.
  - `./gatherers/pages` — `pagesOfType`, `judgePages`, and `PageJudgement`, for judging every crawled page instead of generalizing from the first one.
  - `topLevelJsonLd` and `allJsonLdNodes` — JSON-LD traversal with an explicit depth contract. `topLevelJsonLd` expands arrays and `@graph` while propagating `@context`, but does not hoist nested property objects; `allJsonLdNodes` walks the whole graph for audits that legitimately search deep.

- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [40064df]
- Updated dependencies [40064df]
- Updated dependencies [d2d16ba]
- Updated dependencies [3d23272]
- Updated dependencies [d2d16ba]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [40064df]
- Updated dependencies [40064df]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [3d23272]
- Updated dependencies [b0adaf5]
- Updated dependencies [b0adaf5]
- Updated dependencies [b0adaf5]
- Updated dependencies [b0adaf5]
- Updated dependencies [b0adaf5]
- Updated dependencies [b0adaf5]
- Updated dependencies [b0adaf5]
- Updated dependencies [b0adaf5]
- Updated dependencies [b0adaf5]
- Updated dependencies [3d23272]
- Updated dependencies [b0adaf5]
  - @forkpoint/agent-lighthouse-core@2.0.0
  - @forkpoint/agent-lighthouse-report@2.0.0

## 1.0.0

### Patch Changes

- 5c84ed9: **Removed 18 audits with no proven consumer ("not a factor").** They no longer
  run, no longer appear in any report, and no longer emit a `CheckResult` under
  their old id. An adversarial evidence review — one researcher per audit, tasked
  with _redeeming_ it by naming a consumer with grade A/B evidence — could not
  find one for any of these: either nothing reads the signal, or the only thing
  that ever did publicly stopped (OpenAI archived the ai-plugin.json spec; Google
  states it no longer uses rel=prev/next). Shipping them as informative would
  have kept noise on the report with a badge attached, so they are deleted.

  Removed audit ids: 1.21, 3.10, 3.16, 4.12, 4.14, 4.17, 5.4, 5.11, 5.17, 5.25,
  6.12, 6.16, 7.1, 8.5, 8.6, 8.17, 8.21, 10.12.

  **Expect scores to move for the same site.** Every category score, the overall
  score, and `readinessVitals` / the derived `readinessScore` can come out
  different — the removed checks are gone from the denominators. Audit 8.21
  (framework-detection) in particular used to feed a near-constant pass into the
  technical vital, propping it up regardless of the site; that unearned signal is
  gone, so the new number can be lower and is the honest one.

  **Consumers keying on these check ids must migrate via `migration-map.json`,**
  shipped in the core package and keyed by v1 audit id. Each entry carries
  `slug`, `status: "removed"`, `reason: "not-a-factor"`, and a `link` to that
  audit's rationale anchor. Look every missing id up there before treating its
  absence as a scan failure; a `"removed"` id has no replacement to re-point a
  dashboard at. See `MIGRATION.md`.

  Full rationale — steelmanned claim, why it is not a factor, verdict and sources
  per audit, plus the complete research dossiers — lives in
  `docs/evidence/sunset/not-a-factor.md`.

  Also in this release: the exported `calculateCategoryScore` now excludes
  informative checks from its mean, so its return value changes for any input
  containing them (previously they counted like any other check). Callers
  constructing `CheckResult` objects directly should expect a different result
  for the same array. The deprecation machinery — `AuditMeta.deprecated` /
  `CheckResult.deprecated` (`DeprecationNotice { notice, link }`), the
  `isInformative` predicate, and the report's deprecation-notice rendering — is
  kept for future deprecations and the planned informative tier.

- Updated dependencies [5c84ed9]
  - @forkpoint/agent-lighthouse-core@1.0.0
  - @forkpoint/agent-lighthouse-report@1.0.0

## 0.4.0

### Minor Changes

- 7fe831f: Add structured scan progress events:
  - Core: typed `ScanEvent` stream via `runScan(url, { onEvent })` — phase/unit events with computed monotonic `fraction` and `elapsedMs`, per-audit progress, and `unit:fail` visibility for errored audits
  - CLI: interactive progress renderer (spinner, progress bar, ETA, per-phase summary lines) and `--progress-json` NDJSON event stream on stderr
  - MCP: `notifications/progress` forwarded when the request carries a `progressToken`

  Breaking (pre-1.0): the legacy progress callback forms were removed, not just deprecated —
  - `runScan(url, onProgress, pageOverrides, signal)` → use `runScan(url, { onEvent, pages, signal })`
  - `runAudits(ctx, config, (completed, total) => …)` → use `runAudits(ctx, config, (event: AuditProgressEvent) => …)`; an optional precomputed `AuditPlan` from `planAudits` can be passed as a fourth argument
  - The `ProgressCallback` and `AuditProgressFn` types are no longer exported

### Patch Changes

- Updated dependencies [7fe831f]
  - @forkpoint/agent-lighthouse-core@0.4.0
  - @forkpoint/agent-lighthouse-report@0.4.0

## 0.3.0

### Patch Changes

- 5569df0: Add 8 new AI-readiness audits:
  - SVG context bloat — detects inline SVGs bloating agent context (6.18)
  - Token-to-content ratio — flags pages where markup tokens dwarf actual content (6.19)
  - Fake headings — detects heading-styled elements that skip semantic `<h1>`–`<h6>` tags (6.20)
  - Form backend actionability — checks forms expose actionable backends agents can submit to (5.27)
  - Product transactional certainty — verifies Product schema carries machine-readable offer/price/availability signals (3.24)
  - TDM-Rep data-mining rights — detects declared text-and-data-mining usage rights (2.27)
  - AI crawler vs conversational agent separation — checks robots.txt distinguishes training crawlers from user-driven agents (2.28)
  - OpenAPI description quality — scores endpoint descriptions for LLM tool-calling usability (5.26)
- Updated dependencies [5569df0]
  - @forkpoint/agent-lighthouse-core@0.3.0
  - @forkpoint/agent-lighthouse-report@0.3.0

## 0.2.4

### Patch Changes

- 23ad2b8: Relicense the project and published packages from GPL-3.0-only to Apache-2.0.
- Updated dependencies [23ad2b8]
  - @forkpoint/agent-lighthouse-core@0.2.4
  - @forkpoint/agent-lighthouse-report@0.2.4

## 0.2.3

### Patch Changes

- c845f40: Use package metadata for generated report and MCP version labels, and avoid stale static docs version badges.
- Updated dependencies [c845f40]
  - @forkpoint/agent-lighthouse-core@0.2.3
  - @forkpoint/agent-lighthouse-report@0.2.3

## 0.2.2

### Patch Changes

- 229c08b: Add launch, showcase, and badge assets, and refresh generated report and MCP version labels.
- Updated dependencies [229c08b]
  - @forkpoint/agent-lighthouse-core@0.2.2
  - @forkpoint/agent-lighthouse-report@0.2.2

## 0.2.1

### Patch Changes

- 939a2c6: Improve package discoverability with clearer descriptions, npm README pages, expanded keywords, promotion assets, and an accurate CLI version banner.
- Updated dependencies [939a2c6]
  - @forkpoint/agent-lighthouse-core@0.2.1
  - @forkpoint/agent-lighthouse-report@0.2.1

## 0.2.0

### Minor Changes

- 54ef55c: Initial release of Agent Lighthouse:
  - Core gatherer & audit engine with 10 audit categories for agentic readiness
  - Standalone zero-dependency HTML report generator with SVG score gauges
  - Zero-config terminal CLI (`@forkpoint/agent-lighthouse`)
  - Model Context Protocol (MCP) server

### Patch Changes

- Updated dependencies [54ef55c]
  - @forkpoint/agent-lighthouse-core@0.2.0
  - @forkpoint/agent-lighthouse-report@0.2.0
