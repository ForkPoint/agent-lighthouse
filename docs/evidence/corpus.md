# Brand website corpus

The user-supplied brand list replaces the previous ranked live-site corpus and
all previous stored page fixtures. The replacement contains 684 unique domains.
It preserves regional domains as separate entries. A shared company name does
not prove that two domains serve the same shop.

## Source inventory

`packages/core/test-data/sites/brands.json` holds one row per domain. Each row
preserves the source names in `aliases` and the source row count in `inputRows`.
Those counts include the repeated blocks in the pasted input. They are not
traffic ranks or counts of independent companies. The first supplied name is
the display name. Alias conflicts remain available for review.

`pnpm build:sites` regenerates `sites.json`, `seeds.json`, and `candidates.json`
from that inventory. It makes no network request. It does not reintroduce the
previous Tranco or CrUX list. All entries use `source: seed` and category `brand`.
Two reviewed brands, Altra and Amart, supply the scheduled smoke sample.
The status file starts empty. Old observations do not apply to this new corpus.

## Shop directory

`packages/core/test-data/sites/shop-directory.json` covers all 684 input domains.
It records shop or related commerce links for 681 domains. It preserves three
exceptions: Alinéa awaits reopening, Saks OFF 5TH announces its online closure,
and elixir.com belongs to sales-led enterprise software. The directory does not
rename Elixir to an unrelated cosmetics brand.

Each shop has a source URL, an evidence status, and the last direct fetch result.
Evidence statuses distinguish reviewed primary pages, captured commerce pages,
documented services, and indexed-only leads. A successful fetch alone does not
prove a working checkout. The 687 mapped links returned 480 readable pages;
207 had access limits, response walls, shells, or fetch failures. A readable
page can still contain no purchase controls. These are link counts, not brand
counts. No purchase or account action was tested.

Related stores require a primary link or ownership statement. Examples include
VF to Vans, Upbound to Rent-A-Center, Interface to FLOR, and CV Sciences to
PlusCBD. JOANN redirects to its successor Michaels. FUJIFILM documents its new
camera shop. The it.com registry maps to its domain registration service;
unrelated customer subdomains do not establish a brand relationship.

The directory includes travel booking, vehicle catalogues, digital services,
and accessory ordering forms with their own `commerceKind`. They do not become
ordinary retail checkouts. Indexed-only leads retain their weaker evidence
status even after a failed direct fetch. Raw search records and response bytes
stay under `reports/brand-corpus/`. This directory does not enumerate every
regional store, marketplace seller, or dealer.

```bash
node --import tsx scripts/verify-brand-shops.mjs
node --import tsx scripts/export-brand-corpus.mjs
```

The verification pass resumes by domain and target URL. It uses the existing
safe crawler and respects robots rules. The exporter derives `shop-links.json`
and `benchmark-stores.json` from the directory. Closed shops and selected
non-retail services do not enter the retail benchmark. Inferred crawler links
remain separate in `machineShopCandidates`; they cannot replace researched
shop evidence. The four page-role labels remain a separate discovery result.

## Page discovery

```bash
node --import tsx scripts/discover-brand-pages.mjs
node --import tsx scripts/enrich-brand-pages.mjs
node --import tsx scripts/export-brand-corpus.mjs
```

The crawler uses the scanner fetcher, URL safety checks, redirect checks, and
user agent. It checks robots.txt before visiting each origin. It follows public
links to likely catalogue, product, editorial, and shop pages. An explicitly
linked shop may use another origin. Link text and source URLs preserve the
basis for that relationship. Each brand has a bounded crawl, not an exhaustive
URL census. A second pass checks sitemap.xml and up to three sitemap children
for missing roles. It probes up to two URLs per missing role. Requests make no account, cart, purchase, or form submission.

`reports/brand-corpus/domains/` holds resumable discovery records.
`reports/brand-corpus/captures/` holds gzipped responses and their provenance.
The record includes requested and final URLs, capture time, HTTP status,
headers, timings, redirect chain, and body SHA-256. Transport failures have no
stored response fixture. Refusals remain refusals; they do not become pages.

The four target roles are Homepage, PLP (product listing), PDP (product detail),
and Article. Machine observations are candidates, not independent classifier
ground truth. A product card in a header does not prove a PDP. Article Open
Graph metadata alone does not prove an article. Editorial indexes do not count
as product listings. Unresolved means the bounded crawl found no supported
page. It does not prove that the site lacks that page type.

## Three examples per shop and page role

```bash
node --import tsx scripts/discover-shop-page-links.mjs
node scripts/check-shop-page-links.mjs
```

`shop-page-links.json` stores up to three distinct PLP, PDP, and Article examples
for each mapped shop URL. Each example links to captured bytes, provenance,
its discovery source, and the observed content signals. A complete shop entry
has nine examples. A partial entry records the missing count for each role.
The three directory exceptions remain separate; they do not become fake shops.

The pass reuses existing captures, follows page links, and checks sitemap
locations. Official indexed URLs supply further discovery leads. A URL pattern
or search title does not establish a page role. The crawler must inspect readable
content before it adds the URL to a role. It excludes transport walls, account
routes, test hosts, policy pages, and repeated regional or tracking variants.
Editorial pages require article signals or a specific editorial route with a
primary heading and substantial prose. Editorial indexes do not count as PLPs.

The script uses `SHOP_PAGE_BUDGET` to bound further probes per shop. The default
is 36. The resumable records under `reports/brand-corpus/shop-page-links/` retain
attempts and sitemap sources. Indexed leads under `shop-page-searches/` retain
their weaker status until content inspection. Gaps do not prove page absence.
The validator checks complete shop coverage, unique role URLs, consistent
completion counts, and the SHA-256 of every exported capture.
Attached content reviews must match the exported capture, hash, and role.

`SHOP_PAGE_OFFLINE=1` limits inspection to saved captures and forces a zero
network probe budget. The pass still reads page content before it assigns a
role; an older classifier result of `general` does not exclude a saved page.
A later live pass does not reuse an incomplete offline record as a finished
network search. Complete nine-link sets can reuse their captured evidence.
Article inspection accepts common content containers such as `maincontent`,
`main`, `role=main`, and `.blog-post`. Independent reviewed labels bind to a
capture hash. Nike listing pages can establish a PLP through at least three
distinct priced cards in their named product grid. An empty commerce category
does not become an Article because its template declares Article markup.
Recipe indexes and archive pages do not supply individual Article examples.
Reviewed exclusions also reject Diesel's editorial index and Dainese's course
directory. An exclusion uses `Other` in `page-link-reviews.json`; it does not
fill a requested role. Regional versions of these two templates stay excluded.

The exported directory keeps an `inspectionRecord` link and an observation
summary for each shop. Full attempts remain in the resumable records under
`reports/brand-corpus/shop-page-links/`. Crawl delays pace requests to an origin;
they do not turn an allowed path into a refusal. Validate pacing without network
requests with `node --import tsx scripts/check-corpus-crawl-pacing.mjs`.

Functional query values remain in the exported URLs. Category selectors such
as `cgid` and product selectors such as `pid` must match the capture. The pass
removes known tracking values only. An explicit shop link can establish a
related editorial host; that host can supply Article pages only.
When a mapped shop uses another domain, the supplied brand domain can also
supply Article examples. `mappedBrandEditorialDomain` records this source.
Its pages do not supply PLP or PDP examples for the separate shop. The `it.com`
case uses only the exact brand host; arbitrary tenant domains remain excluded.

Browser captures retain their own `captureMode`. A reviewed ASICS listing
records a classifier mismatch in `page-link-reviews.json`. A browser response
wall remains a wall. The pass does not bypass rate limits or access controls.
`scripts/render-shop-page-gaps.mjs` renders readable candidates for missing
roles in a separate browser session. It stops each domain after an access
wall or browser error. A 404 or 410 stops that URL, not the whole domain. A
later successful read of the same URL can resolve a recorded browser error.
The helper checks robots rules before navigation. It accepts a cross-domain
redirect only when the shop verification capture documents that host pair.
Browser discovery also checks cached pages on the brand's owned domains. It
includes editorial, baby-talk, bb-world, and demonerosso article routes.

`packages/core/test-data/sites/brand-pages.json` is the compact reusable URL
index. The JSON index supports review outside the repository. The full raw
captures stay in the ignored `reports/` directory. Re-run discovery on another
machine to create local captures; do not treat missing local files as captures.

## Offline regression sample

`packages/core/test-data/corpus/real/` holds a small replacement sample from the
new input. Each response has a provenance record. `fixture-io.ts` verifies body
hashes and replays the response-kind decision. The audit snapshot suite runs
the registered audits on those frozen bytes. It supplies no live root files,
secondary pages, or browser-rendered accessibility results.

`corpus/page-types.json` holds labels reviewed from the captured page content.
These labels do not come from the classifier under test. A `knownMismatch`
label runs as an expected failure. A later classifier correction will make that
case fail the expected-failure contract, so the reviewer must update the record.
The Amart blog index is one such case: it is an editorial index, while the
classifier reports a product category.

The previous synthetic corpus conformance suite and the old fixture-specific
accessibility suite were removed with their inputs. Their coverage is retired.
The replacement corpus does not claim the previous public-sector, bank, forum,
or documentation coverage. Existing focused audit unit tests remain in place.
The replacement snapshot clock stays pinned to 2026-10-09 for dated offers.
