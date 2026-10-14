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
prove a working checkout. The 687 mapped links returned 483 readable pages;
204 had access limits, response walls, shells, or fetch failures. A readable
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
