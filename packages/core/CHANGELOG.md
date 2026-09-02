# @forkpoint/agent-lighthouse-core

## 4.0.0

### Major Changes

- 2dbff0b: Four OpenAPI audits no longer fail a site for publishing no OpenAPI document.

  **What was wrong.** `agent-interfaces/openapi-servers`, `openapi-endpoints`,
  `openapi-schemas` and `openapi-operation-ids` are each grade B, tier `scored`,
  weight 0.6 — 2.4 combined. All four are about a document's contents, and all
  four returned `fail` at high or medium priority when there was no document at
  all. Nothing gated them: `requires: ['origin-reachable']` and no
  `applicablePageTypes`, so every site that answers a 200 and has no API — a
  bakery, a blog, a law firm — took four high-priority failures telling it to add
  a `servers` array to a spec it had never written. Measured `fail` on 41 of 41
  corpus fixtures.

  `agent-interfaces/openapi-exists` already declined the identical absence, and
  `openapi-servers`' own dossier records counter-evidence arguing that an absent
  `servers` array is legal under OpenAPI 3.1 and resolvable against the
  document's own location. Where the dossier and the code disagree, the dossier
  governs.

  **What changed.** No document read means `notApplicable`, and no weight. Two of
  the four also decline a document that declares no operations, which is the same
  absence one level down — `openapi-endpoints` is the audit that reports an empty
  document, and it now reports it once.

  **Absent means absent; broken means broken.** A `paths` member that is present
  and yields nothing readable — `paths` is not an object at all, or every entry
  under it is defective — is a defective document, not an absent one.
  `openapi-endpoints`, `openapi-schemas` and `openapi-operation-ids` fail it and
  name the defect in `found`, where all three previously reported "0 operations".
  A defect counts at either level: a non-object where a Path Item Object belongs
  and a non-object where an Operation Object belongs are the same error. An empty
  `paths` object, no `paths` key, and a path item that declares no method are
  legal and declare nothing, so they still decline.

  **A broken entry does not erase the operations beside it.** A document with
  twenty readable operations and one `null` path item is graded on its twenty:
  `openapi-endpoints` counts them, `openapi-schemas` measures coverage over them,
  `openapi-operation-ids` checks their ids. The entries that could not be read are
  named in the message and counted in `found`, and they do not change the verdict.

  **What did not change.** Every verdict on a document that exists and is
  defective. A missing `servers` array, entries with no `url`, an unreachable
  server URL, low schema coverage, an unregistrable or duplicated `operationId` —
  all still fail or warn exactly as before. That is the finding the grade B was
  earned for. A document that declares no operations is still failed, by
  `openapi-endpoints`, which is the audit whose subject it is.

  **Also.** The seven byte-identical copies of `getOpenApiSpec`, and the four of
  the `paths` traversal, collapse into `packages/core/src/gatherers/openapi.ts`,
  which now owns the read, the traversal and the precondition.
  `agent-interfaces/search-endpoint` and `operability-safety/contact-form` keep
  judging a site that publishes no document — they have other evidence — and no
  verdict of theirs moved. `agent-interfaces/openapi-description-quality` already
  declined the absence and still does; only the wording of its decline changed,
  so that it says what the rest of the family says.

  The shared decline now reads "No readable OpenAPI document at /openapi.json"
  rather than "No OpenAPI document is published at /openapi.json". The read also
  comes back empty for a 200 whose body will not parse, and a site that publishes
  a broken document has not published none.

  `operability-safety/contact-form` and `agent-interfaces/search-endpoint` read
  the same document without judging it, and they keep the traversal they had: a
  site with a `POST /contact` and one malformed sibling entry still has a contact
  endpoint. They do stop counting a `x-` specification extension as a path item,
  which OpenAPI 3.1 §4.8.8 says it never was. Both are informative, so no score
  moves either way.

- 9caf97b: Audit boundary enforcement & gatherer uniformity (Phase 4 of audit architecture migration):

  - Enforced architectural boundary: zero direct `ctx.fetch`, bare `fetch()`, or HTTP client imports in `packages/core/src/audits/`.
  - Created AST contract script `scripts/check-audit-boundaries.mjs` and added `"check:audit-boundaries"` script to `package.json`.
  - Created dedicated gatherer modules `gatherers/mcp.ts`, `gatherers/discovery.ts`, `gatherers/rsl.ts`, `gatherers/security.ts`, and `gatherers/author.ts` with WeakMap per-scan fetch caching.
  - Moved `_mcp-client.ts` out of `audits/` into `gatherers/mcp.ts`.
  - Refactored all 235 production audits across 8 categories to consume gatherers exclusively.
  - Updated `scripts/lib/requires-analysis.mjs` with gatherer evidence mappings.

- 9c0f4b8: refactor(core)!: perform four-way read of sitemaps and decline on absence

  An absent sitemap now returns `notApplicable` for `sitemap-lastmod` and `sitemap-absolute-urls` instead of failing the site for an unwritten document.

- a719d16: An informative check reports the score it measured. `toCheckResult` overwrote it with 0, so JSON and SDK consumers saw 0 for every informative check regardless of the measurement. `weight` stays 0 and keeps the check out of every sum; the score in the report changes.
- 64c23e7: One URL, One Score, The Origin Cached (Phase 5 of audit architecture migration):

  - Fixed `MAX_PAGES_PER_SCAN = 1` and `DEFAULT_SCAN_LIMIT = 1`, removing legacy multi-page discovery heuristics and regex guessers.
  - Scans now evaluate the exact target URL as the single page unit while preserving explicit page overrides (`options.pages`).
  - Introduced `OriginCache` module (`computeOriginCacheKey`, `shouldBypassOriginCache`, TTL eviction, and credential stripping) with versioned cache keys (`${origin}|${ORIGIN_EVIDENCE_VERSION}`).
  - Scans on the same origin reuse cached origin evidence (root files and homepage), making multi-page evaluations fast, isolated, and idempotent.
  - Authenticated scans (`Authorization`, `Cookie`, or basic-auth credentials) automatically bypass the shared origin cache to guarantee secret isolation.
  - Stamped `originEvidence` metadata (`origin`, `version`, `readAt`, `cached`) into `ScanReport`.
  - Added comprehensive unit tests in `packages/core/src/tests/origin-idempotence.test.ts` verifying all three Phase 5 gates: Idempotence across URLs, Cache Isolation & Credential Protection, and Version Invalidation.

- a719d16: The overall score weights each category by the mass it assessed. `runAudits` now sets `assessedMass` and `registryMass` on every category it builds, so `calculateOverallScore` no longer falls back to registry mass on every scan. A category that could assess little of its registry moves the overall score by what it assessed, as `conditions.coverage` already reported. Overall scores change on any site where a category's assessed mass differs from its registry mass, which is most sites.
- 111cdbf: Page type becomes consent (Phase 3 of audit architecture migration):

  - Added `ScanOptions.pageType?: PageType` and CLI `--page-type` flag.
  - Added `PageContext.pageTypeSource: 'declared' | 'detected'`.
  - Renamed `AuditMeta.applicablePageTypes` to `AuditMeta.pageTypes`.
  - Introduced runner scope function: typed audits matching detected page types run in `informative` mode (unscored); only user-declared page types authorize scoring.
  - Category mass calculations updated to use `assessedMass`.
  - Removed direct `page.pageType` accesses across all 17 audit sources.

- cebbba0: The Score States Its Conditions & The Warrant Expires (Phase 6 of audit architecture migration):

  - Added `conditions` to `ScanReport` and `ScanConditionsSchema`: transparently reports the target URL, page type (`declared` vs `detected`), origin evidence status (`cached` vs `fresh`, version, and `readAt`), evidence coverage breakdown (`registryMass`, `assessedMass`, `pageMass`, `originMass`, `gatedMass`), and unscored audit breakdown.
  - Updated all report renderers (`terminal`, `markdown`, `html`) to display the Scan Conditions block beside and beneath the headline score.
  - Implemented `scripts/sweep-audit-reviews.mjs` and scheduled GitHub workflow `.github/workflows/audit-review-sweep.yml` to track evidence dossiers older than 6 months (180 days).

- a719d16: The sitemap walk reads every sitemap robots.txt declares, and a broken sitemap is reported as broken.

  - Every `Sitemap:` line in robots.txt is read. The walk used to stop at the first file that parsed, so a site declaring three sitemaps was judged on one. The conventional paths (`/sitemap.xml`, `/sitemap-index.xml`, `/sitemap_index.xml`) are probed only when no declared sitemap answers, and the first that does is taken.
  - `readSitemap` follows the walk, not the first root file. A site whose only sitemap is a broken `/sitemap-index.xml`, or a broken file declared in robots.txt, now reads `malformed` instead of `absent`. `sitemap-exists`, `sitemap-lastmod` and `sitemap-absolute-urls` change verdict on such a site.
  - A sitemap index may no longer pull in a child from a parent domain. `foo.github.io` reads children on `foo.github.io` and its subdomains only, never on `github.io`.
  - `SitemapTree` gains `readableFiles` and `malformedFiles`; `collectSitemapEntries` gains `opts.fallbackRoots`.

- 5f612b6: A scan that could not read the site now runs no audit at all.

  The rule previously depended on separate mechanisms. The `requires` gate
  skipped 211 of 215 audits. The other four declared no requirements and checked
  the unread state inside `audit()`. In total, 42 audit files carried a local copy
  of that check, while 142 of 215 audits had no test that would catch a missing
  declaration.

  `planAudits` now applies the check once, above every audit's own `requires`, and
  `unreachable-contract.test.ts` holds the whole registry to it with no exemption
  list. The 42 copies are gone.

  What changes for a `runScan` caller: every audit on an unread scan now carries
  the runner's `na` stub. This replaces more than the four local `na`
  explanations. It also suppresses direct-audit WAF failures, cross-origin
  redirect failures, and plain-HTTP failures because none may verdict when the
  scan read no attributable site response. These changes affect the findings and
  any score derived from them. Each stub names the scan reason, for example
  `Not assessed: The homepage could not be fetched: ENOTFOUND.`

  What changes for an SDK caller: the `requires` gate in `planAudits` is now on by
  default. `PlanOptions.enforceEvidence` previously defaulted to `false`, so
  `planAudits(ctx, config)` ran audits without checking their declared evidence.
  Pass `{ enforceEvidence: false }` as the third argument to bypass only those
  `requires` checks. `runAudits` has no `PlanOptions` argument. A caller that needs
  that diagnostic mode first builds a plan with `planAudits`, then passes the
  precomputed plan as the fourth `runAudits` argument. Without a plan, `runAudits`
  uses the default gated plan.

  `runScan`'s `enforceEvidenceGate` option stays available as the explicit
  diagnostic opt-out for `requires`, and it already defaulted to `true`. Passing
  `false` never bypasses the unread-scan precondition. The only full bypass of
  every gate is a test-only helper that is not exported from the package.

### Minor Changes

- 67876d7: Hardened CSS selector escaping in parser and operability audits, eliminated false positives/negatives in WAF bot wall detector, and added true offline safety for corpus tests:

  - Exported and applied `escapeAttrValue` to prevent Cheerio syntax crashes when HTML attributes (such as form element IDs, `aria-controls`, `aria-describedby`, and `aria-labelledby`) contain quotes or backslashes.
  - Fixed 3 WAF classifier defects: prevented `attack-challenge-mode` prose from falsely tripping Kasada, prevented normal PerimeterX telemetry scripts on 200 OK pages from falsely tripping PerimeterX blocks, and added Akamai HTTP 200 soft-block detection for reference-numbered error pages.
  - Corrected corpus fixture kinds for `vercel-com-wall-200` (`page`), `walmart-com-wall-200` (`page`), and `tirerack-com-soft-block-200` (`wall`).
  - Hermetically stubbed DNS in corpus test suites, guaranteeing offline test reproducibility under `AL_SKIP_NETWORK=1`.
  - Resolved documented architectural debts in `docs/architecture/debt.md`.

- 1a20739: Scoped all root-file audits to require `unblocked-fetches`:

  - Updated `ORIGIN_ONLY_REQUIRES` in `scripts/lib/requires-analysis.mjs` to require `unblocked-fetches`, removing the blanket category drop in `access-crawl-control`.
  - Updated all 65 root-file and crawler-token audits across `access-crawl-control`, `agent-interfaces`, `machine-discovery`, and `operability-safety` to declare `unblocked-fetches`.
  - Guarantees that when a site is blocked by a bot wall or WAF at HTTP 200, all root-file audits gracefully decline with `notApplicable` rather than emitting false failure or warning verdicts.
  - Fixed emphasis regex in `dossier-public.test.ts` for Prettier formatting resilience.

- 18c3416: Hardened script typechecking, bot wall evidence gating, and API deprecation:

  - Added `tsconfig.scripts.json` and integrated script typechecking into root `pnpm typecheck`.
  - Corrected evidence requirements for `access-crawl-control/sensitive-paths` and `access-crawl-control/rsl-licensing-terms-conformance` to require `unblocked-fetches`, preventing false scored `fail` verdicts when a scan is blocked by a bot wall.
  - Marked `MAX_CONCURRENT_REQUESTS` in `constants.ts` as `@deprecated`.

### Patch Changes

- adf2bce: Consolidate legacy v1 audit map into canonical `docs/evidence/audit-map.json`, add automated rebuild and verification script (`pnpm check:audit-map`), and enrich `migration-map.json` notes.
- 5e9b931: Follow redirects in `machine-discovery/no-broken-links` so HTTP 3xx responses are not treated as broken, and guard `displayValue` and `explanation` against schema overflow in `Audit.toCheckResult`.
- a719d16: `conditions.pageType` describes the target URL. When the target did not answer 200 and a page override did, the first surviving page was the override and the conditions block described it under the target's URL. The page type now comes from the target's own entry, or from the explicit fallback when the target was not read.
- 4cce959: A failed fetch logs one warning line instead of the error object with its stack. The object is still there at `LOG_LEVEL=debug`. A scan of a walled site no longer prints a screen of frames per request.
- 8b5e768: Hardened corpus nightly scan workflow and site-list runner:

  - Sized the nightly site scan window against the 240-minute deadline (200 sites per run at the time; the curated list later made the window the whole list).
  - Added `--allow-partial` flag to `scripts/scan-site-list.ts` and enabled it in `.github/workflows/corpus-nightly.yml`, separating timeout capacity from invariant violations so partial runs complete with code 0 and preserve their uploaded summaries.

- 7dea552: Added `text-bearing-wall` to hostile-state contract suite:

  - Extended `NOTHING_OBTAINED` with a text-bearing HTTP 200 bot wall containing full site template navigation and branding (>50 words, >200 characters).
  - Proved that `planAudits` properly enforces the evidence gate across all 215 audits when faced with a text-rich interstitial bot wall, guaranteeing `notApplicable` verdicts rather than false findings.

- 85e77e1: Moved corpus analysis script from test suite to `scripts/analyze-corpus.ts`:

  - Migrated `packages/core/src/tests/analyze-corpus.test.ts` to `scripts/analyze-corpus.ts`.
  - Eliminates CI `ENOENT` failure caused by the test attempting to write an analysis report to a local workstation artifact path.
  - Removes 75 seconds of redundant corpus re-execution from vitest test runs while preserving on-demand corpus diagnostic reporting via `pnpm exec tsx scripts/analyze-corpus.ts`.

- 88cb080: Code hygiene and linter zero-warning hardening:

  - Configured `.oxlintrc.json` with ignore pattern for `.astro` templates (which are compiled and verified by `astro check`).
  - Resolved all unsafe optional chaining operations, redundant fallbacks in object spreads, and regex character escapes across core audits and test suites.
  - Removed unused imports and eliminated all compiler warnings in `content.config.ts`.
  - Brought `pnpm lint` and `pnpm typecheck` to 0 errors, 0 warnings, and 0 hints across the entire codebase.

- dcef5af: Resolve architecture debt item 1: accessibility audits on real-page corpus:

  - Added dedicated conformance test suite `packages/core/src/tests/a11y-corpus.test.ts`.
  - Exercises all 17 `A11yBackedAudit`s over representative real-world HTML documents across public sector, public health, forum, storefront, and SPA shell pages in ~3.2 s.
  - Proves schema compliance, node target findings on failures, and valid transitions between pass, fail, warn, and na states on real DOMs without inflating the 120 s runtime cap of `real-page-corpus.test.ts`.
  - Updated `docs/architecture/debt.md` closing debt item 1.

- 56ab5ea: Refactor audit source extraction to eliminate code duplication across contract tests and CI scripts:

  - Exported canonical `auditSourceFiles` and `declaredIds` helpers from `packages/core/src/tests/audit-sources.ts`.
  - Migrated `scripts/lib/requires-analysis.mjs` and `scripts/check-requires.mjs` to fully-typed TypeScript (`.ts`) consuming `audit-sources.ts`.
  - Eliminated 15 lines of duplicated filesystem traversal and regex extraction code.
  - Updated `docs/architecture/debt.md` closing the audit-sources reflection debt item.

- e86bf9a: Add corpus evidence gate test suite (`packages/core/src/tests/corpus-evidence-gate.test.ts`):

  - Exercises `buildScanEvidence()` and `planAudits()` over all 41 real-page fixtures in the corpus.
  - Proves real bot walls are classified as unjudgeable and run zero page-fed audits.
  - Proves real JavaScript shells gate `rendered-body` and skip text-reading audits.
  - Proves real content pages clear all evidence gates and plan runnable audits.
  - Closes the final standing debt item in `docs/architecture/debt.md`.

- a719d16: Audits no longer throw on a page whose JSON-LD carries an object-valued `@context` (`{ "@vocab": "https://schema.org/" }`). The deep node walk inherited that object into every child, then walked into it and stamped it with itself, recursing until the stack ran out. Two audits reported `[scanner] Audit error` on zapier.com instead of a result. The walk now treats `@context` as a vocabulary, not a node.
- a719d16: The live site corpus is curated. `sites.json` shrinks from 1913 blind entries to 414 categorised domains across 13 categories plus an unknown slice, with a smoke tier of two per category. A new `status.json` records what each domain did last time, and both live runners skip dead and robots-blocked domains by default. `pnpm corpus:status`, `pnpm corpus:probe` and `pnpm build:sites` maintain it. Scan output is unchanged; only test data and scripts move.
- a719d16: The origin cache is bounded and keyed by request headers. It sweeps expired entries on every write and drops the oldest when it holds more than `DEFAULT_ORIGIN_CACHE_MAX_ENTRIES` origins, so a long-lived process cannot grow it without limit. `computeOriginCacheKey` folds non-credential request headers into the key, so a scan with a bot user agent never reads what a default scan wrote. Credential headers still bypass the cache and never enter a key.
- a719d16: Origin evidence is delivered and cached in one order. The origin homepage a non-homepage scan fetched never reached the audits, and a homepage scan wrote `undefined` into the origin cache before repairing it, so whether a later scan of the origin saw a homepage depended on which URL was scanned first. The cache is now written after the page fetch, and `CheckContext.originEvidence` carries the origin, version, read time, cache status and homepage.
- 2cbdd13: Widen the oxlint surface from `correctness` alone to `correctness` plus
  `suspicious`, and add the `import` and `promise` plugins.

  `.oxlintrc.json` previously declared nothing but an ignore pattern, so oxlint
  ran its default set: the `correctness` category over the default plugins. The
  config now names the plugin list explicitly — `eslint`, `typescript`,
  `unicorn`, `oxc`, `import`, `promise` — enables `suspicious` as an error
  category, and turns on three rules that the categories leave off:
  `no-return-await`, `unicorn/no-unnecessary-await` and
  `unicorn/prefer-regexp-test`. Rule count rises from 96 to 113.

  The five findings the wider set surfaced are fixed, none of them behavioural:

  - `agent-interfaces/openapi-servers`, `operability-safety/engine/dom` and
    `operability-safety/engine/table` each imported one module twice. The second
    import in the two engine files carried a comment calling itself lazy; an ESM
    import is hoisted either way, so the comment described something the module
    graph never did. Merged into the single import at the top.
  - `getGaugeColor` in the HTML renderer was declared inside
    `generateHtmlReport` and captured nothing from it. Moved to module scope.
  - `isValidUrl` in the CLI constructed a `URL` purely for its throw. The
    construction is now `void`-marked so the intent reads as a parse probe.
  - `metaRefresh` in the a11y engine called `String#match` on a non-global regex
    and used only its truthiness. Now `RegExp#test`.

  `pnpm lint` stays at 0 errors and 0 warnings.

  `promise/prefer-await-to-then` was evaluated and left off: its 16 hits are
  almost all top-level `main().catch()` entry points, where `then`/`catch` is the
  correct shape. `import/no-cycle` was also left off; the a11y engine has 7
  deliberate cycles that need untangling before the rule can be an error.

- a719d16: Request header layers merge by case-insensitive name. A caller's `user-agent` or `authorization` in another casing was sent beside the scanner's own header as one joined value; it is now replaced. `mergeHeaders` and `setHeader` are exported from the fetcher.
- a719d16: Gatherer caches survive audit scoping. The runner hands every audit a scoped copy of the scan context, and the sixteen per-scan gatherer caches were keyed on that copy, so each audit missed the cache and repeated its fetch: three quarters of a scan's audit-time requests were duplicates. The copy now carries a `cacheOwner` stamp pointing at the scan's context, and every gatherer keys on it. One scan, one walk of the sitemap tree, one probe per feed.
- 4cce959: An unscored scan's reason names each cause once. Two evidence keys carried the same sentence when nothing was fetched, and the report read "The scan fetched no pages. The scan fetched no pages." on every walled site.

## 3.1.0

### Minor Changes

- 90d815b: A bot wall served at HTTP 200 is treated as a wall, not as the site's own
  markup. Nine checks stop reporting a verdict about a challenge page, and one
  starts reporting the wall.

  **What was wrong.** The attribution guard 36 audits consult,
  `scanReadTheSite()`, read `evidence.met['origin-reachable']` — "the response
  came from the host the user asked for, with a 2xx and an HTML content type". A
  Cloudflare managed challenge satisfies every part of that: it is served at HTTP
  200, `text/html`, from the requested host. `origin-reachable` is true, the
  interstitial arrives as a `PageContext`, and the audits read it as the owner's
  page. `unblocked-fetches` is the key that knows better, and nothing consulted
  it: `unblocked-fetches` is dropped from every `access-crawl-control` audit by
  design, since being refused is what that category reports.

  `scanReadTheSite()` now returns `evidence.judgeable` —
  `origin-reachable && unblocked-fetches` — which is the predicate the scan
  already used to decide whether to publish a score at all.

  **Measured**, released 3.0.0 to this release, on a scan of a site behind a
  Cloudflare managed challenge (HTTP 200, `text/html`, `cf-mitigated: challenge`,
  requested host), with the evidence gate on as every scan runs it:

  - **3 pass → na.** `no-blanket-block` (0.6), `crawl-delay` (informative) and
    `llms-full-txt` (informative) were reading the challenge page served at
    `/robots.txt` and `/llms-full.txt` and reporting what they found there as the
    site's.
  - **1 na → fail.** `no-bot-detection` names the firewall. It could not before:
    its own gate exemption is what makes the wall branch reachable, and that
    branch now runs on a 200 wall as it does on a 403.
  - **9 stay `na` and change their wording**, from the gate's "Not assessed: this
    scan has no … evidence" stub to the audit's own sentence naming the wall:
    `https-enabled`, `no-nofollow`, `no-redirect-chains`,
    `robots-ai-group-shadowing`, `robots-directives`, `descriptive-urls`,
    `language-attribute`, `server-responsiveness` and
    `third-party-dom-write-blast-radius`.

  The scan reports no overall score on that state before and after — `judgeable`
  was already false there, and the gated evidence-mass share is 0.643 before and
  0.599 after, both far past the 0.35 threshold. What changes is the checks
  inside the categories: `access-crawl-control` moves 52 → 46 on that state.

  Two verdicts this change specifically prevents, both measured on the same
  state and neither ever released: `robots-directives` reporting **"1 content
  page(s) carry a blocking robots directive, including the homepage"** at
  critical priority, and `no-nofollow` reporting **"All 1 scanned page(s) have
  nofollow directives"**. The `<meta name="robots" content="noindex,nofollow">`
  they were reading is Cloudflare's, on the interstitial — the corpus fixtures
  `stackoverflow-thread-wall` and `ebay-com-category-wall` both carry it. Those
  two audits dropped `rendered-body` in this release, and `origin-reachable` was
  all the protection they had left.

  `operability-safety/ghost-clickable-element-ratio` gains the same guard. Its
  survey counted the challenge page's one `role="main"` wrapper as a semantic
  click target and passed the interstitial at a ratio of 1.00. No released
  verdict moves — it declares every evidence key, so the gate already skipped it
  there — and the guard is what makes it correct when it is called directly.

  **The same wall, with a body.** A wall that answers 200 does not have to
  answer with an empty page. A site-templated one — the corpus holds eBay's,
  which is eBay's own error template — renders enough prose that `rendered-body`
  and `sample-adequate` are met, and then the gate lets through every audit whose
  `requires` is satisfied by an origin that answered. `unblocked-fetches` is
  dropped from every `access-crawl-control` audit by design, so on that wall the
  category ran against markup and headers the wall attached: the site's head
  fragment, kept by the edge, and the site-wide response headers its edge rules
  add to every response.

  Five more checks now decline there, each measured merge-base to this release on
  a text-rich HTTP 200 wall carrying a self-referential canonical, a
  `Content-Usage: train-ai=n` header and a `tdm-reservation: 1` header:

  - **`canonical` (1.0), pass → na.** "All 1 page(s) declare a canonical URL that
    resolves to themselves" — about a canonical the site's template left on the
    interstitial.
  - **`aipref-content-usage-declaration-validity` (0.6), pass → na**, and
    **`ai-usage-signal-coherence-across-channels` (0.6), pass → na.** Both
    validated the edge's own `Content-Usage` header as this site's declaration;
    the second added that its channels agreed, which is what a wall answering
    every path identically will always look like.
  - **`tdm-rep` (informative), pass → na**, and **`ai-content-declaration`
    (informative), pass → na.** Same header, same wall.

  Counting the checks that already declined on the empty-bodied wall, 13 verdicts
  move on that state between the merge base and this release, and its
  `access-crawl-control` score goes from 57 to 46.

  `machine-discovery/no-broken-ai-endpoints` (1.0) is fixed in the same pass and
  for the same reason, without a guard: it answered "All 0 AI endpoint URL(s) are
  reachable" whenever every URL it collected was refused by the SSRF gate — a
  pass for a census that never ran. On the wall, the wall's own markup was where
  the URL came from. It now warns and says how many URLs it could not request.

  **How this is kept true.** `packages/core/src/tests/hostile-states.ts` gains a
  sixth state: a Cloudflare managed challenge at HTTP 200 from the requested
  host, with the WAF verdict derived from the real `detectWafProtection` rather
  than stated. It joins the nothing-obtained tier, where no audit may return
  `pass`. Written before the fix, it convicted 14 audits; 13 were fixed by the
  predicate and the fourteenth by the guard above.

  That state now carries what a real 200 wall carries — the head fragment and the
  site-wide response headers the edge keeps attaching — which is what convicted
  the five checks above and `no-broken-ai-endpoints`. The contract suite's
  exemption allowlist is still empty.

  The shell tier of the same suite stopped guessing which audits it must hold.
  It filtered on the literal string `fetchResult.body`, which missed
  `third-party-dom-write-blast-radius`: it censuses origins through the parsed
  DOM, dropped `rendered-body` in this release, and grew a guard nothing checked.
  Every audit exempted from `rendered-body` now declares what a shell proves
  about it — `envelope` for the ones reading the `lang` attribute, a robots meta
  tag or TTFB, which a shell serves whole, and `body` for the ones whose "found
  nothing" depends on a rendered document. An exemption added without that
  declaration fails the suite.

- 90d815b: A scan can bring its own undici dispatcher, so a caller can bound how many
  connections it opens per origin.

  `ScanOptions` gains `dispatcher`, `createFetcher` takes an optional
  `{ dispatcher }`, and `boundedDispatcher(connections)` is exported for callers
  that would rather not depend on undici to express one line of politeness.

  Nothing changes for a caller that passes none. The scanner keeps its shared
  `new Agent()`, whose per-origin connection count is unlimited: a scan issues its
  ~28 root-file requests in one `Promise.all` and then up to five pages in
  parallel, and for a site owner scanning their own site finishing quickly is the
  right trade.

  It is the wrong trade for a caller scanning origins that did not invite it. That
  28-socket burst is what a per-IP WAF counts, and the nightly corpus job
  (`scripts/scan-site-list.ts`) now passes `boundedDispatcher(2)` so the 400
  strangers in a night's window each see at most two connections at a time.

  **A bounded dispatcher alone measures the wrong thing**, which is why
  `ScanOptions` and `createFetcher` also gain `maxConcurrent`. `Agent({
connections: 2 })` accepts all 26 root-file requests the scan fires in one
  `Promise.all` and queues 24 of them inside undici — while the 10-second
  per-request deadline and the `ttfbMs` clock both start when `fetch()` is
  called. On an origin averaging more than ~770 ms per file the tail aborts on
  the scanner's own queue and the report records those root files as unreachable,
  and the same queueing inflates `ttfbMs` for the later sampled pages and the
  UA-parity refetches — enough to move `content-extraction/server-responsiveness`,
  which bands at 800 ms and 2500 ms, on a healthy origin.

  `maxConcurrent` holds a request in a FIFO queue in front of the fetcher, before
  either clock starts, so what the deadline and `ttfbMs` measure is the origin.
  The library's own default is unchanged: omit it and every request is issued as
  it arrives, with the timeout it always had. The nightly job passes it alongside
  the dispatcher, at the same number, so a bounded run never queues inside undici.

  `ScanOptions` also gains `robotsTxt`, a `robots.txt` response the caller
  already holds, used in place of fetching it again. It is for a caller that must
  read the file before it decides to scan at all — the nightly job asks
  permission first, and without this every site it visits is asked twice for the
  one file its owner watches. It must be the response to `<baseUrl>/robots.txt`
  fetched with this scanner's own user agent; a caller that passes something else
  makes the scan judge a file it was not served. Omitted, the scan fetches it as
  before.

- 90d815b: Audits no longer report a verdict about a response the scan cannot attribute to
  the site, and four audits whose subject is the failed response can now reach the
  finding they exist for.

  **Why any of this changed.** `ctx.pages` was never "this site's pages". The
  orchestrator admits any response that answered 200 with a body — no
  content-type gate, no attribution check — so a domain broker's parking page
  reached through a temporary redirect, and a PDF served at the homepage, both
  arrive as a `PageContext` an audit reads as though the site had written it.
  `ctx.rootFiles` is the same: a parking host answers every path, so
  `/robots.txt` and `/llms-full.txt` come back 200 and belong to the broker. On a
  walled or throttled origin there is nothing at all, and an audit looping an
  empty list found no fault and said so.

  **36 audits now decline instead.** Each already named `origin-reachable` in its
  `requires` and then assumed the answer. They now read it, via new
  `scanReadTheSite()` and `unreadSiteReason()` in `scan-evidence`, and return
  `notApplicable` carrying the gate's own reason.

  Measured with the gate held open — the contract suite calls every audit
  directly, which is what a caller passing `enforceEvidenceGate: false` gets —
  across the five nothing-obtained scan states: **90 pass → na**, **33 fail →
  na**, **9 warn → na**. Those are the vacuous congratulations and the invented
  faults this work set out to remove: "no `lang` attribute" on a page that never
  arrived, "no llms-full.txt" on a scan that was refused.

  **Almost none of that is visible in a released report, and this is the honest
  version of a claim an earlier draft of this changeset got wrong.** The evidence
  gate has been on for every scan since 3.0.0, and in each of these states it
  already skipped those audits before they ran: the same `na`, tagged
  `skipped:no-evidence`, with a different sentence attached. What actually moves
  in a report, measured 3.0.0 to this release with the gate on, is seven cells
  across the five states:

  - **4 na → fail.** `no-bot-detection` on a 403 wall and on a 200 challenge,
    `no-blocking-captcha` on a 403 wall, `no-redirect-chains` on a scan
    redirected to another domain. These are the findings recovered below.
  - **3 pass → na**, all on a 200 bot challenge, and all from the predicate
    change described in the sibling changeset about a wall served at 200.
  - **18 cells keep the status `na` and change their wording**, from the gate's
    "Not assessed: this scan has no … evidence" stub to the audit's own sentence.

  An `na` leaves the score denominator either way, so what a walled or parked
  scan reports is unchanged in shape: fewer scored checks, and no overall score.

  **Four audits gain a finding they could not previously reach.** `origin-reachable`
  is denied by exactly the conditions these audits report, so
  `planAudits({ enforceEvidence: true })` — on by default since 3.0.0 — was
  skipping them before they ran. The wall-reporting `fail` released in 3.0.0 was
  unreachable for the 403 that produces it. Their `requires` and their entries in
  `GATE_EXEMPTIONS` now drop `origin-reachable`:

  - `operability-safety/no-blocking-captcha` and
    `access-crawl-control/no-bot-detection` now **fail** a 403-walled scan and
    name the firewall, where both previously reported `na`.
  - `access-crawl-control/no-redirect-chains` now **fails** a scan redirected to
    another domain and names the hop. Leaving the site is what denies
    `origin-reachable`, so the one audit whose subject is the redirect was the one
    silenced by it.
  - `access-crawl-control/https-enabled` still **fails** a plain-HTTP site whose
    homepage never answered: the scheme is proven by the request. Its
    "Site uses HTTPS but homepage returned status unknown. Possible TLS or server
    error" warn is gone for a scan with no attributable homepage — the
    orchestrator only admits pages that answered 200, so that branch could never
    name a status, and on a bot wall it named a fault that does not exist. That
    branch is now reached in one state, and it says what that state is: the
    homepage answered over HTTPS and the response carried no document, so nothing
    could be read over a connection that was itself fine. It names no status:
    `origin-reachable` accepts any 2xx while the orchestrator admits a page only
    at 200, so a homepage answering 204, 203 or 206 lands there too, and the
    audit holds no homepage response to read the real status from.

  `GATE_EXEMPTIONS` also had a dead key: the entry for `no-bot-detection` was
  filed under `operability-safety/`, a category that does not hold it, so it had
  been matching nothing.

  `content-extraction/server-rendered` is unchanged: its exemption was already
  correct, and the client-rendered shell it reports still meets `origin-reachable`.

  **How this is now kept true.** A registry-driven suite,
  `hostile-state-contract.test.ts`, runs every registered audit against the five
  nothing-obtained states and forbids `pass`. Its exemption allowlist is empty.
  Per-audit tests pin the ordering for the five audits whose subject is the
  failed response, so a guard placed above their wall branch fails the build.

- 90d815b: A page-reading audit no longer congratulates a site whose page rendered no
  text, and eight audits that never needed rendered text stop claiming they do.

  **What a JS shell is, and why it is not an empty scan.** The page arrives from
  the right host, with a 200, a complete `<head>`, real headers and root files
  that fetch and parse. What it withholds is the rendered document: the tables,
  figures, headings, links, forms and accessible names an audit walks. An audit
  whose population lives in the body therefore finds none of it and, unguarded,
  reports the absence as cleanliness — "no data tables found", "no fake headings
  detected", "no link changes state when it is fetched" — about a body holding
  one empty `<div>`. The measured case is `gymshark.com`, whose `<body>` carries
  one word.

  **Eleven audits now decline instead.** `scan-evidence` gains
  `scanReadPageText()` and `unreadPageTextReason()`, and each audit consults them
  in the branch where it would otherwise have said "found nothing, so nothing is
  wrong":

  - `content-extraction/data-tables`, `content-extraction/figure-figcaption`,
    `content-extraction/fake-headings`,
    `answer-readiness/content-without-clickthrough`,
    `operability-safety/aria-layer-injection-scan`,
    `operability-safety/unicode-covert-channel-scan` and
    `operability-safety/unsafe-agent-triggerable-affordances` return
    `notApplicable` on a page that served no readable text. **7 pass → na**
    when the audit is called on the shell scan state; no other verdict moves.
  - `access-crawl-control/no-bot-detection` and
    `operability-safety/no-blocking-captcha` do the same, and theirs is the one
    pair a user sees change on an ordinary client-rendered scan — see below.
  - `answer-readiness/unique-meta` returned `pass` while its message read
    "uniqueness check not applicable". It now returns `notApplicable` whenever
    the scan holds fewer than two distinct canonical pages — **pass → na on every
    such scan**, not only on a shell. Its dossier's 2026-08-20 code review had
    already recorded this fix as needed.
  - `operability-safety/third-party-dom-write-blast-radius` declines a
    zero-origin census on a page that served no readable text. It is one of the
    two whose guard runs under the evidence gate — see below.

  **Two weight-1.0 vacuous passes on every client-rendered site.**
  `no-bot-detection` and `no-blocking-captcha` both decide by substring search
  over `page.fetchResult.body`. A shell's body is a mount point and a bundle, so
  both found nothing and said so: `pass "No aggressive bot-detection scripts
found on scanned pages."` and `pass "No blocking CAPTCHA scripts detected on
scanned pages."` — about sites whose Turnstile loader is inside the bundle and
  whose forms do not exist in the markup at all. Neither is gated out of that
  state: both declare `requires: []` so their wall branch stays reachable behind
  a 403, which means the gate cannot decline the case for them.

  Both now return `notApplicable` when the scanned page served no readable text.
  The wall and detection branches still run first, so a 403 is still reported and
  a shell that ships a challenge loader statically is still reported.
  `no-blocking-captcha` was the only `operability-safety` check that scored on a
  shell, so that category's score on such a scan moves **100 → 0** — which is
  what `calculateCategoryScore` returns when a category has nothing assessed, not
  a judgement about the site. A shell scan carries no overall score either way.

  **Eight audits drop `rendered-body` and `sample-adequate` from `requires`, and
  that is a scoring change on client-rendered scans.** `check-requires` derives
  those keys from the source touching `ctx.pages`, but these read the response
  envelope — head markup, response headers, robots.txt, transport timing, the
  URL, the script and frame origins — all of which a shell serves in full. Each
  is recorded as a gate exemption with its reason:
  `access-crawl-control/no-nofollow`, `access-crawl-control/robots-directives`
  and `access-crawl-control/robots-ai-group-shadowing` become
  `['origin-reachable']`; `access-crawl-control/no-redirect-chains` becomes `[]`;
  `content-extraction/language-attribute`,
  `content-extraction/server-responsiveness`,
  `answer-readiness/descriptive-urls` and
  `operability-safety/third-party-dom-write-blast-radius` become
  `['origin-reachable', 'unblocked-fetches']`.

  **Measured**, released 3.0.0 to this release, over all 215 audits on the shell
  scan state with the evidence gate on — which is how every scan runs:

  - runnable **54 → 64**, skipped **161 → 151**
  - report-wide statuses **5 pass → 12 pass**, **184 na → 177 na**; fail (11) and
    warn (15) unchanged
  - category math on that state: `content-extraction` **0 → 73**,
    `access-crawl-control` **59 → 69**, `operability-safety` **100 → 0**, and the
    weighted roll-up **48 → 46**

  **Ten audits widen onto a shell scan, and one narrows.** The ten stop being
  skipped before they run. Eight of them then report — `https-enabled`,
  `no-nofollow`, `no-redirect-chains`, `robots-ai-group-shadowing`,
  `robots-directives`, `language-attribute` (all weight 1.0),
  `server-responsiveness` (0.6) and `descriptive-urls` (informative), every one
  of them `pass` on the measured shell. The other two enter the run and decline
  their own empty result, so they add no credit:
  `third-party-dom-write-blast-radius` (0.6) and `no-bot-detection` (1.0).
  `https-enabled` and `no-bot-detection` widen for a different reason from the
  other eight — their `requires` dropped `origin-reachable` so their wall
  findings could be reached — and they are the pair the sibling changeset
  describes only in the walled direction. The one that narrows is
  `no-blocking-captcha`, `pass → na`.

  **A shell scan still reports no overall score, before and after.** The 48 → 46
  above is the category roll-up, not what a user sees: a shell gates 0.578 of the
  registry's evidence mass, over `GATED_MASS_UNSCORED_THRESHOLD`, so the report
  carries `overallScore: null` and `scoreTier: null` either way. What a user sees
  change is inside the categories — nine checks that read "not assessed" now
  report, seven of them scoring, and one that scored now reads "not assessed" —
  and one number in the scan validity block. `ScanValidity` carries no ratio
  field, so that share reaches a user only as the percentage inside
  `unscoredReason`: **"could not feed 64% of the registry's evidence mass"**
  becomes **"…58%"**, because the ten take 8.2 of the registry's 134.0
  non-informative mass out of the gated set. It stays far above the 0.35
  threshold, so the null score is not at risk. What they report is true of what
  the site served; what changed is that the scan stops withholding it.

  `third-party-dom-write-blast-radius` keeps a guard for the half a shell cannot
  support: same-origin resources are discarded from the census, a shell's script
  tags are its own bundle, and the vendors an agent meets are injected by that
  bundle at runtime — which its own `found` string already says the census does
  not count. A zero-origin census on a page that served no readable text returns
  `notApplicable` rather than certifying that nothing but the site writes what an
  agent reads. Every origin the served HTML does name is still reported.

  The seven guards in the first group are not visible in a gated scan of a
  shell — those audits still declare `rendered-body`, so the gate skips them
  before `audit()` runs, and no production report reaches either their guard or
  the reporting branches above it. What the guard buys is a correct verdict when
  the audit is called directly, which is how the contract suite calls it, and
  when a caller sets `enforceEvidenceGate: false`. The ordering within each — an
  instruction planted in a shell's `<title>` or `og:*` value still fails
  `aria-layer-injection-scan`, a Unicode Tags run in a robots.txt served beside a
  shell still fails `unicode-covert-channel-scan` — is pinned by tests and is
  what those audits do under a direct call, not what a gated scan reports.
  `unique-meta`'s change is the one in that group with no such condition: it
  moves on every scan holding fewer than two distinct canonical pages.

  Found by `packages/core/src/tests/hostile-state-contract.test.ts`, which runs
  every audit that reads a scanned page against a shell built from the real
  `buildScanEvidence` and forbids `pass`. It selects that population from the
  source rather than from `requires`: an audit exempted from `rendered-body`
  because its subject is the wall was, by declaration alone, excused from the one
  test that would have caught its vacuous pass — which is exactly how
  `no-bot-detection` and `no-blocking-captcha` shipped theirs.

- 90d815b: `answer-readiness/extractor-survival-recall` reports a verdict on pages whose
  structured data contains a bracket, instead of reporting nothing at all.

  **What it did.** The audit measures which of a page's key spans survive the
  extractors an answer engine uses. One of those spans is a JSON-LD string the
  prose repeats, and to name the element it lives in the audit built a CSS
  selector out of the string itself: `:contains("<the first 40 characters>")`.
  Page content is not a selector. gov.uk publishes the service name "Register
  your vehicle as off the road (SORN)", and 40 characters in the closing bracket
  is gone, so css-what threw `Parenthesis not matched` before the audit ever
  reached a verdict. A throw is not a verdict: the scan runner replaces the
  result with a `scan-error` stub, so a page the audit had already measured got
  no report at all — no pass, no fail, nothing for the site owner to act on.
  Brackets, quotes and backslashes are ordinary things for a site to publish, so
  the lookup no longer builds a selector: it walks the DOM in reverse and takes
  the last element whose text carries the string, which is what the selector was
  asked for.

  **Measured.** Over the 41 real-page fixtures in
  `packages/core/test-data/corpus/real/`, running all 215 registered audits
  against each: one throw before, none after. The single fixture affected _by
  this fix_ is `gov-uk-vehicle-tax`, whose verdict moves `scan-error` → `fail` —
  the audit now says what it found. No other audit changed by this fix moves on
  any fixture.

  One other cell moves across the same corpus, from a different change in this
  release and disclosed in its own changeset: `answer-readiness/unique-meta`
  moves **pass → na on 41 of 41 fixtures**, because a one-page scan holds fewer
  than two distinct canonical pages and the audit no longer reports `pass` with a
  message that reads "uniqueness check not applicable". Whoever regenerates this
  snapshot should expect exactly those 42 cells to move against 3.0.0 and nothing
  else.

  Scores move only for a page in that shape. `scan-error` scored nothing, so a
  site publishing bracketed structured data now carries this audit's weight
  (grade B, 0.6) in its answer-readiness score for the first time, in whichever
  direction the audit's real verdict falls.

## 3.0.0

### Major Changes

- 13082c6: Every audit now receives the scan's evidence record.

  `CheckContext` gains a required `evidence` field, built once per scan before
  any audit runs. It records whether the origin answered, whether anything
  blocked the scan, which fetched pages served readable text, and which page
  types are usable. Nothing is gated on it yet — audits that want it can read it.

  The field is required rather than optional on purpose: an optional field fails
  open, and a caller that forgets it is exactly the silent-nothing verdict the
  record exists to remove. Code that builds a `CheckContext` by hand must pass
  one; `allEvidenceMet()` is exported for callers that do not exercise the gate.

- 13082c6: A scan that saw too little now says so, instead of scoring the site anyway.

  **The gate is on.** An audit whose required evidence the scan never obtained is
  skipped, reports `na` tagged `skipped:no-evidence` with the reason attached, and
  is never constructed. Pass `enforceEvidenceGate: false` to `runScan` to run
  every audit regardless.

  **The score can be absent.** `ScanReport.overallScore` and `scoreTier` are now
  `number | null` and `ScoreTier | null`. They are null when the scan never
  reached the site, was refused, or lost so much of the registry's evidence mass
  to the gate that what remains is not a reading of the site. The report carries a
  new `scanValidity` block saying which evidence classes were obtained, why the
  missing ones are missing, and — when suppressed — why there is no score. Every
  surface renders that as "Not scored" with the reason, never as `0`.

  **Two audits stop lying about being blocked.** `no-blocking-captcha` reported a
  pass on a site that walled the scanner: it looked for CAPTCHA markup in pages it
  never received. It now fails and names the wall, and returns `notApplicable`
  when no page was fetched. A rate limit is excluded — that is the scan asking too
  fast, not the site refusing agents.

  **A homepage 429 is retried once**, after `Retry-After` when the site sends one,
  before the scan concludes it was blocked.

  **`na` no longer leaks into `recommendations`.** Core now filters to `fail` and
  `warn`, which is what `packages/report` always did.

- 13082c6: `content-extraction/server-rendered` now judges every fetched page, not just
  the first.

  The audit reads the per-page record the scan already built and reports a ratio:
  pass when every page served readable text, warn when some did not (the empty
  URLs are listed in `details.emptyPages`), fail at critical priority when none
  did. Its `message` and `found` strings changed shape accordingly.

  A scan that fetched no page reports `notApplicable` instead of `warn`. Warning
  was a claim about the site; the truth is that nothing was seen.

- 13082c6: The text metric behind `content-extraction/server-rendered` now reads the served HTML body instead of the first `<main>` element.

  The audit used to measure `getMainContentText`, which returns a page's main content region. That helper took the first `<main>` whenever any existed, so a site that ships an empty `<main>` wrapper, or several `<main>` elements of which the first is a stub, was measured as serving no content at all. Two real storefronts in the benchmark were failed at critical priority on that basis: one with a single empty `<main>` and 194 words elsewhere in its body, one with four `<main>` elements the first of which held 49 characters. Both now pass.

  The audit reads a new exported helper, `getRenderedText`, which returns the whole `<body>` minus `script`, `style`, `noscript` and `template`. Its word count comes from that same text. The pass threshold is unchanged: more than 50 words or more than 200 characters.

  `getMainContentText` keeps its job of describing the main content region, with its selection corrected. Among several `<main>` elements it now returns the one holding the most text rather than the first, and it falls back to `<body>` only when no `<main>` holds any text. A `<main>` inside a `<template>` is never counted: the page does not render it. Pages with a single non-empty `<main>` are measured exactly as before, so navigation, headers and footers stay out of the content audits that read it — dates, numbers, unique data, publication dates, content depth, hydration payload share and the user-agent parity gatherer.

  The `<body>` fallback is the one place that changes for those audits. A page whose every `<main>` is empty used to measure as zero words; it now measures its body text, page chrome included. That is the correction `velasca.com` needed, and it is also why a chrome-only shell can now clear a word-count threshold it used to fail. `answer-readiness/content-without-clickthrough` carried a private copy of the old first-`<main>` rule and now reads the shared helper, so it stops warning about low content on pages whose real content sits in a later `<main>`.

  Scan output changes for any site whose `<main>` is empty or fragmented: it stops being reported as serving no content.

### Minor Changes

- 13082c6: Audits declare which scan evidence they need, and a scan can act on it.

  `AuditMeta` gains `requires`: the classes of evidence an audit needs to say
  anything true. An audit that reads the sampled pages — directly or through a
  page-fed gatherer — needs all four; one that reads only root files needs the
  origin to have answered. Of 215 registered audits, 161 are page-fed.

  `scripts/check-requires.mjs` (`pnpm check:requires`, wired into CI) proves each
  declaration against what the source actually reads, and fails the build when a
  new gatherer is not classified. Audits whose subject _is_ the missing evidence —
  `server-rendered`, `no-blocking-captcha`, `no-bot-detection` and the
  `access-crawl-control` category — are exempt through an allowlist, not through
  a missing rule.

  The gate itself is off by default. `runScan({ enforceEvidenceGate: true })`
  turns it on: an audit the scan cannot feed reports `na` tagged
  `skipped:no-evidence`, with the reason attached, and is never constructed.
  `AuditTrace.outcome` gains `'gated'` for those.

- 13082c6: `FetchResult` now records the redirect chain it walked.

  Each hop carries its status, the URL it left and the URL it went to. `finalUrl`
  alone cannot say whether a host change was permanent: a scan has to tell a
  domain migration (301/308) from a temporary hop to somebody else's domain, and
  only the per-hop status answers that.

  The field is optional and absent when the response was not a redirect, so
  nothing that reads a `FetchResult` today changes.

## 2.0.0

### Major Changes

- 3d23272: `access-crawl-control/agent-governance` no longer fails a site whose
  robots.txt names no AI agents but grants access through its catch-all group.

  RFC 9309 §2.2.1 makes a crawler obey the group matching its own product token
  and fall back to `*` only when no such group exists, so an open catch-all
  already grants every named agent the full access that writing the groups out
  would. The audit's own evidence recorded this and stated that the grade
  "does not support the audit's pass criterion"; the rule now matches the
  standard it cites.

  The audit still fails a blanket block with no per-agent exceptions, which is
  the one case the sources support: the fallback carries that block onto the
  live retrieval agents as well.

- 3d23272: `agent-interfaces/agents-json` no longer fails a site for not serving
  `/.well-known/agents.json`, and no longer reports any parseable JSON at that
  path as adoption.

  The audit's own evidence records `Consumers: none-known` and recommends
  deleting the signal: the agents.json specification never moved past v0.1.0, its
  repository has been dormant since 2025-08-21, both of its project domains are
  offline, and the path is absent from the IANA Well-Known URIs registry. The
  audit nonetheless failed every site at medium priority and prescribed a schema
  (`protocols`, `authentication`, `rate_limits`, `endpoints`) that no agents.json
  consumer can read, behind a documentation link whose domain no longer resolves.
  Anyone who followed that advice wrote an unusable file.

  Absence is now reported as not-applicable, which leaves it out of scoring
  entirely. A published file is validated against the shape the specification
  actually defines — an `info` object plus a `sources` or `flows` array — so `[]`,
  `{}` and unrelated config files no longer pass. A path answering HTTP 200 with
  the site's HTML shell is named as what it is, a well-known path claiming
  adoption the site does not have, rather than reported as invalid JSON; a clean
  404 is treated as honest and is never penalised. A valid document served with a
  `text/html` content type gets its own, milder warning about the media type
  instead of being accused of containing HTML. The audit can no longer return a
  failure of any kind, its default priority drops from medium to low, and the
  remediation snippet and documentation link now point at the real specification.

  No score moves in either direction: the audit was already informative at weight
  0, and the evidence does not support raising it — grade C carries no scoring
  weight under the evidence policy. What changes is what reports say. Every
  scanned site without the file loses an `agents.json` failure row, and any site
  publishing placeholder JSON at that path loses a pass it should never have had.

- 3d23272: `access-crawl-control/anthropic-ai` now scores ClaudeBot only, and scores the access robots.txt grants rather than the shape of the file.

  The check used to treat `anthropic-ai` and `ClaudeBot` as one bot family and pass if either token was allowed. Its own evidence never supported that. Anthropic's current crawler documentation names only ClaudeBot, Claude-User and Claude-SearchBot; the audit's research grades the legacy `anthropic-ai` token C with no known consumer and states that no points should be awarded or deducted for it. The combination rule moved points in both directions anyway: a site with `User-agent: anthropic-ai` / `Allow: /` beside `User-agent: ClaudeBot` / `Disallow: /` scored full marks while Anthropic's only documented training crawler was completely blocked, and a stale legacy-only `Disallow: /` line produced a high-priority failure on a site ClaudeBot was free to crawl.

  ClaudeBot alone now decides the result for this audit. A `User-agent: anthropic-ai` or `User-agent: Claude-Web` group is still detected and reported — the result carries a note saying the group is not a documented Anthropic access control, and `details.legacyTokens` lists what was found — but it no longer moves this audit's status or score in either direction. Note that `access-crawl-control/agent-governance` still recognises the legacy spelling when it counts named training crawlers; that is tracked separately in its own dossier.

  The pass condition changed at the same time, for the same reason `access-crawl-control/meta-external-agent` changed earlier: the grade-A evidence is that Anthropic honours robots.txt, which is a fact about whether a disallow takes effect, not about whether a group names the token. Under RFC 9309 §2.2.1 an open catch-all grants a named crawler exactly the access a named group would, so both now pass. The `warn` band is gone.

  **Which direction scores move.** Most sites go up. Any site whose robots.txt leaves ClaudeBot able to fetch `/` — through its own group, through an open `User-agent: *` group, or because no group applies to it — now scores 1.0 where an unnamed crawler previously took 0.5. Sites that block ClaudeBot still score 0, but the failure drops from `high` priority to `medium`, and its text no longer claims the block costs you visibility in AI search: Cloudflare Radar measures Anthropic's crawl-to-refer ratio at roughly 50,000:1, so what a block actually costs is inclusion in the training corpus. Sites that score 0 solely because of a stale `User-agent: anthropic-ai` / `Disallow: /` line, with ClaudeBot unrestricted, now pass. Sites that scored 1.0 on an `anthropic-ai` allow while blocking ClaudeBot now fail, which is the result that was always correct.

  Sites that serve no robots.txt, serve a non-200, serve an empty body, or serve an HTML error page at `/robots.txt` are now **not applicable** instead of `warn`. A not-applicable check is excluded from scoring entirely, so the access-crawl-control category score for those sites is computed over one fewer check rather than being dragged toward 0.5 by a fact about a missing file.

  The audit id, `access-crawl-control/anthropic-ai`, is unchanged, so nothing referencing it breaks. Its title, description and fix guidance now lead with ClaudeBot.

- 3d23272: `content-extraction/image-alt-text` now measures the accessible name rather than
  the `alt` attribute alone.

  The audit's grade A rests on a standard: accname ranks `aria-labelledby` and
  `aria-label` _above_ `alt` as text-alternative sources, and HTML-AAM maps
  `title` below it. The rule tested only for a non-empty `alt`, so it failed
  images that carry an accessible name by the very document the grade cites. An
  `<img aria-label="Sales by quarter">` was scored as a missing alternative at
  weight 1.0.

  Coverage is now computed over `aria-labelledby` (ids resolved against the page),
  `aria-label`, `alt` and `title`, in that order. Three further changes, each
  asked for by the audit's own recorded review:

  - Images marked `aria-hidden="true"` leave the denominator. They are not in the
    accessibility tree, so no snapshot consumer can see them.
  - A site with no images needing a name is reported not-applicable instead of
    passing. The old rule handed a free scored 1.0 to image-free pages and to
    every client-rendered site whose served HTML carries no `<img>`.
  - Warnings and failures name the worst offending page URLs and carry the worst
    page's URL on the result. Coverage is pooled across pages, so one gallery page
    could sink a site with no indication of where the problem was.

  A global ARIA name defeats a decorative marker: `<img alt="" aria-label="…">`
  counts as a named image. `title` does not — it names an image that already
  counts, but does not pull a decorative one back into the denominator.

  The description and failure copy no longer claim that "Most AI agents are
  text-only and rely entirely on alt text" or that missing alt text makes content
  "invisible to AI systems". The audit's own counter-evidence rejects that: the
  grade rests on Google's explicit statement about Google Images plus the
  accessibility-tree snapshot consumers, not on a general claim about all AI.

  Sites using ARIA naming or `title` stop failing. Image-free and all-decorative
  sites leave the category denominator instead of collecting a free full mark.
  Grade, tier and weight are unchanged at A, scored, 1.0.

  `extractImages` gains three optional fields — `ariaLabel`, `ariaLabelledby` and
  `title`. Additive; no existing field changes.

- 3d23272: The two scored `llms.txt` audits are re-graded to C / informative / weight 0
  after a fresh evidence sweep. `machine-discovery/llms-txt-exists` moves from
  A / scored / 1.0 and `machine-discovery/llms-txt-links-valid` from
  B / scored / 0.6, so 1.6 of weight leaves the scored set and every site's
  machine-discovery and overall score is recomputed against it.

  `docs/evidence/policy.md` already used llms.txt existence as its worked example
  of grade **C** — "published widely, no documented consumer, Google states Search
  ignores it" — while the audit shipped grade A. The sweep asked which of the two
  was wrong. It was the audits.

  No AI vendor documents a consumer of `/llms.txt`. Checked and empty across
  Anthropic, OpenAI, Google, Perplexity, Mistral, Meta, xAI, Microsoft, Cursor and
  Cloudflare, plus llmstxt.org v2, the IANA Well-Known URIs and Link Relations
  registries, and the IETF Datatracker. Six of those vendors publish an llms.txt
  for their own documentation; none documents reading one, and that distinction is
  what the A collapsed. Google Search Central, updated 2026-07-10, still states
  that Search does not use the file. Chrome's Lighthouse does fetch it — as an
  auditor, applying three conformance rules, and scoring a missing file
  `notApplicable`.

  The pass rules move with the grades. A missing llms.txt is now **not
  applicable** in both audits instead of a `critical` failure in one and a `fail`
  in the other: the file is optional and its absence is not a defect. A site that
  advertises the file with a `<link>` and does not serve it warns at `low` — that
  promise is the site's own. Broken links inside a published file warn at `low`
  instead of failing at `high`. Descriptions and guidance no longer claim the file
  is how AI agents discover a site, or that ChatGPT, Perplexity and Claude must
  crawl a site blindly without it.

  `machine-discovery/llms-full-txt` was re-checked and is unchanged at
  C / informative / 0. `agent-interfaces/openapi-exists` was re-checked and is
  unchanged at B / informative / 0; `/.well-known/api-catalog` still has no
  documented consumer.

  `policy.md`'s grade-**D** example changes too. `ai-catalog.json` is no longer
  speculative: since 2026-06-17 it is the file defined by the Agentic Resource
  Discovery specification, and it has a documented first-party consumer client in
  `huggingface/hf-discover`. The D row now cites security headers as "AI trust
  signals", `agents.txt`, and invented "AI trust score" meta tags.

- 3d23272: `content-extraction/markdown-alternate` no longer fails a site that serves no
  markdown alternate, and the `<link rel="alternate">` declaration can no longer
  decide the result on its own.

  The audit's grade-A evidence is explicit that the grade "applies to interactive
  coding agents, NOT to search crawlers or consumer chat". What the sources
  document is consumption when a markdown alternate is served; none measures a
  cost to a site that serves none, and three point the other way — ChatGPT-User
  takes markdown on 0.1% of fetches, a 14-day controlled test found 0 crawler
  visits and 0 citations for `.md` against 137 to matched HTML, and Google states
  markdown is not needed for Search or its AI features. Absence now returns
  not-applicable and leaves the score denominator. Every site that was failing
  this check for having no markdown alternate gains the weight back; no site that
  serves one sees its result change for that reason.

  The audit bundled two separately graded signals and let the weaker one decide.
  The link relations carry `Recommended tier: experimental` — one single-sourced
  consumer for `rel="alternate"`, none known for `rel="describedby"` — while the
  markdown representation reached by a `.md` URL or `Accept: text/markdown`
  carries `Recommended tier: scored`. A declared link whose document could not be
  read used to return a full pass at weight 1.0, and a declared link that 404'd a
  full fail. Both are gone: the declaration is a discovery route and a reported
  detail, never an outcome.

  Two supporting changes. Probing no longer stops at a declared document that
  fails the fidelity floors, so a site-wide `index.md` declared from every page
  cannot fail a site for the per-page alternate it actually serves. And "this is
  the HTML page again" is decided from the body rather than the content type, so a
  `.md` URL answering with the HTML document is not an alternate, while a markdown
  document served as `text/html` or `text/plain` still fails under RFC 7763.

  Page selection now prefers a page that declares an alternate, then any
  non-homepage, closing a long-recorded homepage bias: a marketing homepage almost
  never has a markdown twin even on sites where every content page does.

  Grade, tier and weight are unchanged at A, scored, 1.0. The scored population is
  now the one the evidence covers.

- 3d23272: `agent-interfaces/mcp-discovery` drops from grade A / scored / weight 1.0 to
  grade C / informative / weight 0, and stops failing sites that publish nothing.

  Four of the audit's five researched signals record `Consumers: none-known` and
  recommend `informative` or `delete`. Neither `/.well-known/mcp/servers.json` nor
  `/.well-known/ucp` is a registered or specified discovery path, and no shipping
  MCP client is documented as fetching either. The audit nonetheless failed every
  site without one at weight 1.0 — including every site running a real MCP server
  at `/mcp`, through the registry, or via `/.well-known/oauth-protected-resource`.
  Its own code review calls that "a false FAIL on precisely the sites that are
  most agent-ready". Publishing no MCP discovery document is now not-applicable.

  The fifth signal — the one recommending `scored` — is not split into a new
  audit, because it is already implemented. It describes itself as "a meta-signal
  about how the other audits must be implemented": do not read an HTTP 200
  carrying HTML as evidence of a document. `agent-interfaces/openapi-exists`
  enforces exactly that at the ratified path, rejecting a `text/html` body at
  `/.well-known/api-catalog` and requiring the linkset to parse. A second audit
  would have duplicated it, contradicted the tier `openapi-exists` deliberately
  carries, and needed a pass condition under which serving `{}` at a well-known
  path bought a weight-1.0 win.

  Two vacuous passes are also gone. `{}` at `/.well-known/ucp` returned a
  confident pass reading "0 services and 0 capabilities"; `{"servers": []}`
  returned a pass for a discovery file that discovers nothing. Both now fail — a
  document that is published and says nothing is a defect, unlike a document that
  was never published.

  Every site previously failing this check gains weight 1.0 back in the Agent
  Interfaces category. The scored set drops from 167 audits to 166 and the total
  evidence mass from 137.4 to 136.4; `docs/scoring.md` is refreshed to match. No
  audit is added or removed — the registry stays at 215.

- 3d23272: `access-crawl-control/meta-external-agent` no longer scores a site down for
  failing to name Meta-ExternalAgent in robots.txt.

  The audit inherited a rule that passed only when a named
  `User-agent: Meta-ExternalAgent` group allowed `/`, and warned at score 0.5 on
  everything else that was nonetheless allowed. A robots.txt reading
  `User-agent: *` / `Allow: /` — every crawler welcome, nothing blocked — scored
  half marks at weight 1.0. Its own dossier calls that criterion "the cargo-cult
  'explicit Allow: /'", and RFC 9309 §2.2.1 contradicts it: a crawler obeys the
  group matching its product token and falls back to `*` only when no such group
  exists, so an open catch-all grants exactly the access a named group would.

  The audit now asks whether the rules that apply to the token permit `/`.
  Allowed by its own group, allowed through the catch-all, and allowed because no
  group applies all pass. A disallow that reaches the token still fails. The warn
  band is gone. An unreadable robots.txt — missing, non-200, empty, or a 200 that
  parses to no rules at all — is not applicable rather than a warn.

  The failure text no longer claims that blocking this agent "prevents your
  content from appearing in AI-powered search results and answers". The dossier
  assigns that role to Meta-WebIndexer; Meta-ExternalAgent is the training-side
  token. The failure now states the effect the sources support — exclusion from
  Meta's training corpus and from direct product indexing — and its priority drops
  from high to medium accordingly.

  Sites allowed only through a wildcard move from 0.5 to 1.0 on this check. Sites
  with no robots.txt leave the denominator instead of scoring 0.5. Grade, tier and
  weight are unchanged at A, scored, 1.0.

  The change is confined to this audit. The twenty sibling `CrawlerBotAudit`
  checks keep the inherited rule, so the robots differential baseline is
  unaffected.

- 40064df: A scan that gets HTTP 429 now reports a rate limit, not a bot wall.

  `detectWafProtection` mapped 429 onto whichever provider fronted the site, so a
  throttled scan came back as "Cloudflare Turnstile / Managed Challenge", and
  `access-crawl-control/no-bot-detection` failed the site at critical priority
  with "Bot-defense firewall detected blocking AI crawler connections". HTTP 429
  means "too many requests" — a statement about the rate this scan asked at, not
  about who the site admits.

  Found by scanning 48 live Shopify storefronts back to back: 36 were reported as
  behind a Cloudflare managed challenge, and a single-request `curl` carrying the
  same user-agent got HTTP 200 from every one of them.

  429 is now diagnosed before any provider is, since every provider serves it for
  throttling. It carries `provider: 'rate-limited'` and a new `isRateLimit` flag,
  and `no-bot-detection` returns not-applicable rather than failing — a scan that
  never saw the site cannot judge its bot defenses.

- 3d23272: `structured-data/speakable-schema` and `agent-interfaces/webmcp-declarative-forms`
  both drop from evidence grade **A** to **B**, and from weight 1.0 to 0.6. Both
  stay scored, both keep every detection rule and every not-applicable
  precondition. Only the price changes.

  Both were on the retirement shortlist and neither is retired: their consumers
  were re-verified on 2026-08-24 and are live and documented. Google Search
  Central's speakable page still names Google Assistant as the agent that reads
  marked sections aloud with TTS. Chrome's declarative-API page still states that
  the browser interprets an annotated form as a tool and populates its fields when
  an agent calls it.

  What the re-verification also surfaced is what each vendor says about its own
  feature. Google: "This feature is in beta and subject to change", limited to
  U.S. English Google Home users and English-language news publishers. Chrome: an
  origin-trial badge, and "WebMCP is under active discussion and subject to change
  in the future."

  `docs/evidence/policy.md` reserves grade A for documented consumer behaviour or
  a ratified standard with known consumers, and gives grade B to a draft standard
  with meaningful adoption. A beta feature with a one-country, one-language,
  one-content-type scope and an origin trial are both grade B.

  0.8 of weight leaves the scored set. Structured Data falls from 10.0 to 9.6 of
  evidence mass and Agent Interfaces from 12.4 to 12.0; the registry total falls
  from 134.8 to 134.0. Sites carrying either signal keep the credit, worth
  proportionally less; sites missing either lose proportionally less.

- 3d23272: `answer-readiness/review-signals` no longer accepts the review vocabulary as
  proof of reviews, and no longer lets out-of-scope pages decide a commerce
  verdict.

  Four narrowings, each grounded in the audit's own recorded evidence.

  **Hollow markup stops counting.** Google prohibits review markup that is not
  "sourced directly from users", so the dossier records that "the existence of
  review markup is not itself evidence of social proof". The audit already
  rejected `"review": []` and a zero `reviewCount` on that reasoning but stopped
  there, so `"aggregateRating": {}`, `"aggregateRating": true`, a bare
  `{"@type":"Review"}` and `[{"@type":"Review"}]` all passed. A rating node now
  needs a rating value or a positive count; a review node needs a body, a named
  author, or a rating.

  **The commerce branches now respect the commerce scope.** The audit declared
  `applicablePageTypes: ['homepage', 'product']` but looped over every scanned
  page, so in a mixed scan a blog post's `star-rating` div could satisfy it. The
  review vocabulary, the widget fallback and the "N reviews" text are read only
  from homepage and product pages — the population Google's review rich results
  and OpenAI's `review_count`/`star_rating` cover. The quotation branch keeps its
  wider scope: its evidence is a GEO measurement of generative-answer citation,
  not a commerce one.

  **An unattributed pull-quote sets no status.** It was a scored warn. The
  dossier states that "nothing in any source supports counting an unattributed
  blockquote as a review signal". It is now reported in `found` and nothing more,
  so an editorial pull-quote alone fails where it used to warn, and the warn copy
  no longer claims review signals were found on a page that has none.

  **Attribution has to name someone.** Any `cite` attribute counted, including
  prose like `cite="see our press page"`, and an empty `<cite></cite>` counted. A
  `cite` value must now name a document — relative references count — and the
  attribution elements must carry text.

  Two supporting fixes: the "N reviews" test runs against text with `script`,
  `style`, `noscript` and `template` stripped, so an inline JSON payload reading
  `"1234 reviews"` no longer counts as visible review UI; and a widget element
  must carry text or children, so an empty `star-rating` placeholder that may
  never populate is not review UI.

  `findReviewNodes` is exported and `answer-readiness/trust-signals` defers its
  social-proof factor to it, so that audit stops deferring on hollow markup —
  which moves its denominator and its pass bar. Intended, and pinned by a test.

  Grade, tier and weight are unchanged at B, scored, 0.6.

- 3d23272: `operability-safety/security-header-hygiene` is narrowed to the one signal its
  evidence supports: `/.well-known/security.txt`. The Strict-Transport-Security,
  Content-Security-Policy and X-Content-Type-Options rows are gone from the report,
  and the audit no longer reads response headers at all.

  The audit's own research grades those three headers **D**, with
  `Consumers: none-known` and `Recommended tier: delete`. The two other headers in
  that same researched signal — Referrer-Policy and Permissions-Policy — were
  already removed outright in v2 for exactly that reason, so keeping three of the
  five was an inconsistency. The grade the audit shipped, **B**, belonged to the
  HTTPS/TLS signal, which this audit never measured and which already ships scored
  as `access-crawl-control/https-enabled`.

  What survives is the security.txt check, at the grade its own research records:
  **C**, informative, weight 0. Its detection is unchanged — the well-known
  location with a legacy top-level fallback, a soft-404 guard, and RFC 9116
  `Contact` plus an unexpired `Expires`.

  The pass rule narrows with it. A site that publishes no security.txt is now
  reported as **not applicable** rather than warned: RFC 9116 is an Informational
  document, publishing the file is optional, and adoption is about 1.25% of the
  top 1M domains. Only a published file that fails RFC 9116 warns, at priority
  `low`. A valid file passes. The audit still never returns `fail`.

  No score moves. The audit was weight 0 before and is weight 0 after, so every
  category score and the overall score are unchanged, and the scored set is the
  same size. What changes is the report. Most sites lose a warning they could not
  usefully act on; sites that were warned only for missing security headers now
  pass; and the check's title, description and remediation now describe
  security.txt instead of a header checklist.

  The check id `operability-safety/security-header-hygiene` is unchanged in this
  release, so nothing keyed on it breaks — but the name no longer describes what
  the check measures, and a rename to `operability-safety/security-txt` is
  expected in a later release.

- 3d23272: Two audits drop from grade A scored to grade C informative, because the
  project's own evidence research recommended informative for both and the
  shipped tier did not follow it.

  `access-crawl-control/chatgpt-user` scored the presence of a robots.txt
  disallow for ChatGPT-User. OpenAI documents that "because these actions are
  initiated by a user, robots.txt rules may not apply", and field measurement
  found ChatGPT-User reaching disallowed pages on more sites than any other
  bot, so the directive does not predict agent behaviour in either direction.

  `agent-interfaces/ai-catalog-exists` scored the presence of
  `/.well-known/ai-catalog.json`. The SEP that defines the path is unmerged,
  the path is absent from the IANA Well-Known URIs registry, and no shipping
  MCP client documents fetching it.

  Both remain in the report as informative signals at weight 0. Overall scores
  will rise on sites that were failing them and fall on sites that were
  passing them.

- 3d23272: `answer-readiness/trust-signals` no longer counts comparison content toward its score. The audit now scores exactly the two page factors the study behind it measured: quantified social proof, and claims paired with evidence.

  The audit's own evidence table gave the third factor, comparison content, the measured effect "named in the paper's practical implications" — a sentence in a discussion section, with no odds ratio and no model count, sitting beside two rows carrying OR 2.14 (significant in 4 of 6 models) and OR 2.09 (5 of 6). The project had already researched that signal separately for `answer-readiness/comparison-tables` and recorded "Consumers: none-known · Recommended tier: informative", where it ships at weight 0. The same page fact was being priced at two grades at once, and under the old "2 of 3" rule the unmeasured one could decide a pass.

  The pass bar moves with the factor list. A pass now means both measured factors are present, a warning means one, and a failure means neither. A homepage that passed on a comparison table plus one measured factor will now warn, and a homepage whose only signal was a comparison table or an "X vs Y" heading will now fail instead of warning. Overall, answer-readiness and content-readiness scores fall for those sites. Homepages that already carried a quantified rating or review count together with outbound citations or attributed sources are unaffected, and no page that was passing on the two measured factors changes.

  The evidence grade is unchanged at B, the audit stays scored at weight 0.6, and the deferral to `answer-readiness/review-signals` is unchanged: publishing valid Review or AggregateRating markup still removes the social-proof factor from both sides of the tally, so correct markup can never lower a homepage's result. Comparison content continues to be reported, unscored, by `answer-readiness/comparison-tables`.

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

- 3d23272: Every audit result now carries `details.evidenceUrl`, the address of that audit's
  evidence dossier on the documentation site, and the HTML report links it. The
  address is also available on its own: `evidenceUrl(id)` is a new public export of
  `@forkpoint/agent-lighthouse-core`, so a consumer can build the dossier link for
  any audit id without running a scan.

  The 68 audits whose `docsUrl` pointed at raw markdown on GitHub now point at the
  rendered page; the 92 that point at an external specification are unchanged.

  Those addresses are served by the documentation site, which is now an Astro build
  publishing all 215 dossiers as their own pages rather than a single hand-maintained
  HTML file.

### Patch Changes

- 40064df: `operability-safety/stateful-control-introspectability` no longer errors out on
  a page whose controls each carry their own state class.

  Its summary line named every distinct state class it found. That list comes
  from the page, so a storefront whose components each declare their own class
  pushed `displayValue` past the schema's 1000-character cap, and the runner
  replaced the whole audit with a `scan-error` stub. The line now names three
  classes and counts the rest.

  Found on a live storefront. The audit-result contract fixture now gives every
  element its own class name, so the same overflow fails in CI rather than on a
  site.

- d2d16ba: Four audits no longer error out on the storefronts where they find the most to
  report.

  `AuditResultSchema.details` admits scalars and bounded string arrays: at most
  100 entries of at most 1000 characters. `ghost-clickable-element-ratio` and
  `stateful-control-introspectability` attached their own finding objects,
  `section-split-risk-profile` emitted one entry per section on pages with more
  than 100 of them, and `trust-txt-reciprocity-coherence` quoted remote attribute
  values of unbounded length. The runner validates every result and turns a
  rejection into a `scan-error` stub, so each of these reported nothing at all on
  exactly the pages that tripped it — `ghost-clickable-element-ratio` on 28 of 30
  live Shopify stores.

  All four now render their findings through a shared helper that applies both
  caps, and a contract test runs every registered audit against a deliberately
  oversized page and validates the result against the schema, so the failure mode
  cannot return unnoticed.

- 3d23272: Fixes two unbounded loops in the provenance path, both reachable from ordinary
  site-controlled image bytes.

  `riffChunks` read a WebP chunk size with `<< 24`, which returns a negative
  number once the high bit is set. A negative length walked the cursor backwards
  and the loop never terminated, so one malformed or hostile WebP hung the scan
  indefinitely. The size is now read as an unsigned 32-bit value.

  `certificatesIn` tried a DER parse at every offset that looked like a
  certificate header. A blob of repeated `30 82` bytes bought one parse attempt
  per byte — 2 s of CPU per megabyte, up to six images per scan. Attempts are now
  capped at 256, well above the 2–4 certificates a real chain carries.

- d2d16ba: `operability-safety/aria-layer-injection-scan` and
  `operability-safety/native-control-substitution` no longer error out on a page
  whose ids the CSS identifier grammar rejects.

  Both resolved an `aria-labelledby`, `aria-describedby` or `aria-controls`
  reference by interpolating the id into a `#id` selector. An id is any
  non-whitespace string, and React's `useId` emits ids like `:r0:`, which parse
  as a pseudo-class: a live storefront killed `aria-layer-injection-scan` with
  `Unknown pseudo-class :-tab-0`, and the runner turned the throw into a
  `scan-error` stub, so the audit reported nothing for that store. Both now
  resolve the reference through an attribute selector, which has no identifier
  grammar to violate.

- 3d23272: Rename the shouted documentation filenames to lowercase (`docs/CLI.md` →
  `docs/cli.md` and ten others). Published site routes are unchanged; only the
  source filenames and the links between them move.
- 3d23272: Stops `content-extraction/markdown-alternate` reporting a component tag that the
  document only quotes.

  The component scan read the raw markdown, so a capitalised tag inside a fenced
  example or an inline code span counted as a component the renderer had failed to
  resolve. A markdown alternate of a documentation page is the likeliest place to
  quote JSX, which meant the audit reported the faithful case as the broken one —
  `warn`, score 0.5, with the quoted tag named in `found`.

  The scan now runs over the document with fenced blocks and inline code spans
  removed. Indented code blocks are deliberately left in place: four leading
  spaces is also how a list item continues, and dropping list bodies would hide
  real unresolved components in order to fix a rarer false positive.

  Sites whose alternate quotes JSX move from `warn`/0.5 to `pass`/1. Nothing else
  changes: no evidence, grade, tier or weight moves, and a component tag that is
  genuinely unresolved is still reported.

- 3d23272: A not-applicable check now carries the audit's plain title instead of its
  failure title.

  `failureTitle` names what went wrong, and `toCheckResult` was giving it to every
  non-passing status — including `na`. A not-applicable check did not go wrong:
  its precondition was absent. The result was a report row that read
  "Meta-ExternalAgent disallowed by robots.txt" over a site that serves no
  robots.txt at all, or "The markdown alternate this site serves is not usable"
  over a site that serves none.

  Reports and the JSON output carry the corrected titles. No score changes: `na`
  was already excluded from scoring.

- 40064df: A `scan-error` now says which field failed instead of pasting the whole
  validation tree.

  When an audit's result is rejected by `AuditResultSchema`, the runner records
  it as a `scan-error` stub whose explanation carried `err.message`. For a Zod
  rejection that is the entire issue tree — several hundred lines of JSON for one
  bad field, written into every report the scan produces. The explanation now
  names at most three field paths and their reasons
  (`details.ghosts: Expected string, received object`), and any other long
  message is truncated rather than pasted whole.

- 3d23272: Fix `operability-safety/stateful-control-introspectability` erroring on every
  page that holds a state-bearing control. `details.opaque` carried objects,
  which `AuditResultSchema` rejects; each finding is now one line of text.

## 1.0.0

### Major Changes

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

## 0.3.0

### Minor Changes

- 5569df0: Add 8 new AI-readiness audits:
  - SVG context bloat — detects inline SVGs bloating agent context (6.18)
  - Token-to-content ratio — flags pages where markup tokens dwarf actual content (6.19)
  - Fake headings — detects heading-styled elements that skip semantic `<h1>`–`<h6>` tags (6.20)
  - Form backend actionability — checks forms expose actionable backends agents can submit to (5.27)
  - Product transactional certainty — verifies Product schema carries machine-readable offer/price/availability signals (3.24)
  - TDM-Rep data-mining rights — detects declared text-and-data-mining usage rights (2.27)
  - AI crawler vs conversational agent separation — checks robots.txt distinguishes training crawlers from user-driven agents (2.28)
  - OpenAPI description quality — scores endpoint descriptions for LLM tool-calling usability (5.26)

## 0.2.4

### Patch Changes

- 23ad2b8: Relicense the project and published packages from GPL-3.0-only to Apache-2.0.

## 0.2.3

### Patch Changes

- c845f40: Use package metadata for generated report and MCP version labels, and avoid stale static docs version badges.

## 0.2.2

### Patch Changes

- 229c08b: Add launch, showcase, and badge assets, and refresh generated report and MCP version labels.

## 0.2.1

### Patch Changes

- 939a2c6: Improve package discoverability with clearer descriptions, npm README pages, expanded keywords, promotion assets, and an accurate CLI version banner.

## 0.2.0

### Minor Changes

- 54ef55c: Initial release of Agent Lighthouse:
  - Core gatherer & audit engine with 10 audit categories for agentic readiness
  - Standalone zero-dependency HTML report generator with SVG score gauges
  - Zero-config terminal CLI (`@forkpoint/agent-lighthouse`)
  - Model Context Protocol (MCP) server
