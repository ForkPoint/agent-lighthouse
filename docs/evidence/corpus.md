# Brand website corpus

A user-supplied brand list of 684 unique domains is the live-site corpus. It replaced the earlier ranked list and every earlier stored page fixture. Regional domains stay separate entries; a shared company name does not prove two domains serve the same shop.

## Source inventory

`packages/core/test-data/sites/brands.json` holds one row per domain. `aliases` keeps the source names and `inputRows` the source row count, which includes repeated blocks in the pasted input. Neither is a traffic rank. The first name is the display name; alias conflicts stay for review.

`pnpm build:sites` regenerates `sites.json`, `seeds.json` and `candidates.json` from the inventory without a network request. Every entry has `source: seed` and category `brand`. Two reviewed brands form the scheduled smoke sample. `status.json` started empty for this corpus.

## Shop directory

`packages/core/test-data/sites/shop-directory.json` covers all 684 domains. 681 have shop or commerce links. Three are kept as exceptions: one shop that announced a reopening, one that announced its online closure, and one domain that sells enterprise software through sales.

- Each shop has a source URL, an evidence status and the last direct fetch result. Statuses separate reviewed primary pages, captured commerce pages, documented services and indexed-only leads.
- Of 687 mapped links, 480 returned readable pages; 207 hit access limits, walls, shells or fetch failures. These count links, not brands. A readable page may still have no purchase controls, and no purchase or account action was tested.
- A related store needs a primary link or ownership statement, such as a parent company linking its brand's shop or a closed retailer redirecting to its successor. Unrelated customer subdomains do not establish a relationship.
- Travel booking, vehicle catalogues, digital services and accessory order forms carry their own `commerceKind`; they are not retail checkouts.
- Indexed-only leads keep their weaker status even after a failed fetch.
- Raw search records and response bytes stay under `reports/brand-corpus/`. The directory does not list every regional store, marketplace seller or dealer.

```bash
node --import tsx scripts/verify-brand-shops.mjs
node --import tsx scripts/export-brand-corpus.mjs
```

Verification resumes by domain and target URL, uses the scanner's safe fetcher, and respects robots rules. The exporter derives `shop-links.json` and `benchmark-stores.json`. Closed shops and non-retail services stay out of the retail benchmark. Crawler-inferred links stay separate in `machineShopCandidates` and never replace researched evidence.

## Page discovery

```bash
node --import tsx scripts/discover-brand-pages.mjs
node --import tsx scripts/enrich-brand-pages.mjs
node --import tsx scripts/export-brand-corpus.mjs
```

The crawler uses the scanner's fetcher, URL safety checks, redirect checks and user agent. It reads robots.txt before visiting an origin. It follows public links to likely catalogue, product, editorial and shop pages, and may follow an explicitly linked shop to another origin. The crawl is bounded per brand. A second pass reads `sitemap.xml` and up to three child sitemaps, probing up to two URLs per missing role. No account, cart, purchase or form is submitted.

- `reports/brand-corpus/domains/` holds resumable discovery records.
- `reports/brand-corpus/captures/` holds gzipped responses with provenance: requested and final URLs, capture time, status, headers, timings, redirect chain and body SHA-256.
- Transport failures store no fixture. Refusals stay refusals.

The four roles are Homepage, PLP (product listing), PDP (product detail) and Article. Machine observations are candidates, not classifier ground truth. A product card in a header does not prove a PDP; Open Graph article metadata alone does not prove an article; editorial indexes are not product listings. "Unresolved" means the bounded crawl found no page, not that the site lacks one.

## Three examples per shop and page role

```bash
node --import tsx scripts/discover-shop-page-links.mjs
node scripts/check-shop-page-links.mjs
```

`shop-page-links.json` stores up to three PLP, PDP and Article examples per mapped shop URL, each linked to its captured bytes, provenance, discovery source and content signals. A complete entry has nine; a partial one records what is missing per role. The three directory exceptions never become shops.

- The pass reuses captures, follows page links and reads sitemaps. Official indexed URLs add leads.
- A URL pattern or search title never sets a role. The pass reads the content first. It excludes walls, account routes, test hosts, policy pages, and regional or tracking duplicates.
- Editorial pages need article signals, or an editorial route with a primary heading and substantial prose. Recipe indexes and archives supply no Article examples. An empty category does not become an Article because its template declares Article markup.
- Article inspection accepts common containers such as `maincontent`, `main`, `role=main` and `.blog-post`. A listing can qualify as a PLP through at least three distinct priced cards in a named product grid.
- Reviewed exclusions are recorded as `Other` in `page-link-reviews.json` and fill no role. Regional versions of an excluded template stay excluded.
- Functional query values such as `cgid` and `pid` stay in URLs and must match the capture; only known tracking values are removed.
- An explicitly linked editorial host, or the brand's own domain when the shop is elsewhere (`mappedBrandEditorialDomain`), may supply Article examples only, never PLP or PDP.

| Setting               | Effect                                                                                                                                                      |
| :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SHOP_PAGE_BUDGET`    | Further probes per shop. Default 36.                                                                                                                        |
| `SHOP_PAGE_OFFLINE=1` | Saved captures only, with a zero probe budget. Content is still read before a role is set. A later live pass does not treat the offline record as finished. |

Resumable records under `reports/brand-corpus/shop-page-links/` keep attempts and sitemap sources; leads under `shop-page-searches/` keep their weaker status until inspected. The exported directory keeps an `inspectionRecord` link and an observation summary per shop. The validator checks complete coverage, unique role URLs, consistent counts, the SHA-256 of every exported capture, and that attached reviews match capture, hash and role.

Crawl delays pace requests to an origin; they never turn an allowed path into a refusal. Check pacing offline with `node --import tsx scripts/check-corpus-crawl-pacing.mjs`.

`scripts/render-shop-page-gaps.mjs` renders candidates for missing roles in a separate browser session, with its own `captureMode`. It checks robots rules before navigating and stops a domain after an access wall or browser error; a 404 or 410 stops only that URL. It accepts a cross-domain redirect only when the shop verification capture documents that host pair. It does not bypass rate limits or access controls.

`packages/core/test-data/sites/brand-pages.json` is the compact URL index. Raw captures stay in the ignored `reports/` directory. Re-run discovery on another machine to create them; missing local files are not captures.

## Offline regression sample

`packages/core/test-data/corpus/real/` holds a small sample from this corpus, each response with a provenance record. `fixture-io.ts` verifies body hashes and replays the response-kind decision. The audit snapshot suite runs the registered audits on those frozen bytes, with no live root files, secondary pages or browser accessibility results. Its clock is pinned to 2026-10-09 for dated offers.

`corpus/page-types.json` holds labels reviewed from the captured content, not from the classifier under test. A `knownMismatch` label runs as an expected failure; when the classifier is corrected, that case fails and the record must be updated. One such case is a blog index the classifier reports as a product category.

The earlier synthetic conformance suite and fixture-specific accessibility suite were removed with their inputs. This corpus does not claim their public-sector, bank, forum or documentation coverage. Focused audit unit tests remain.
