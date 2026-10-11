# 7.0.0 audit applicability ledger

Status: P2 local applicability review complete; implementation gaps remain open.
Reviewed against local source and dossiers on 2026-10-07.
Base: `73fd3ef`, plus the local common-page corrections recorded below.
Parent: [execution plan](v7-unified-audit-applicability-plan.md).

P3 status (2026-10-07): the population descriptions below record the P2 baseline.
The P3 section in `v7-unified-audit-applicability-plan.md` lists the 12 article-only
scope migrations and the 10 preserved general-page scopes. Remaining dispositions
and body-level follow-ups stay open; metadata migration does not close them.

## Coverage and reading rules

This review covers **all 215 registrations**, including all 36 registrations
with `applicablePageTypes` and every category. Every row records source and
dossier behavior, scope, disposition and acceptance work. No metadata-only row
counts as reviewed. Completion of this ledger does not mean that every recorded
implementation gap is fixed or that each external source has been reverified.

Each heading below is an exact registered ID. Its review inputs are:

- Source: `packages/core/src/audits/<ID>.ts`.
- Dossier: `docs/evidence/audits/<ID>.md`.
- Existing test location: `packages/core/src/audits/<ID>.test.ts`.

Paths are relative to the repository root. “Tests” below specifies acceptance
work; it does not claim those cases already exist or pass. Only the execution
record identifies tests run during this slice. This is a review of the current
implementation against its existing evidence record, not a fresh verification
of every external consumer. Grades, tiers and weights remain unchanged.

The initial 39 audits read page evidence. The second pass adds page checks,
cross-page measurements and shared site/origin artifacts. Scope below identifies
the read, independently of purpose or feature applicability. Site identity and
policy checks may aggregate page evidence for a site-level claim; that does not
make an arbitrary first page authoritative.

At the P2 baseline, the runner applied the metadata gate before the body ran. Matching
declared pages exclude matching detected pages; detected-only matches run as
informative. “All pages” below means the selected `ctx.pages`, not every URL on
the site. Successful reads omit failed page fetches. That coverage gap remains
P4 work at that baseline. P4 now retains advisory populations, exact input evidence,
and failed-fetch coverage; see the execution plan. These shared runner changes do
not close the body-level dispositions below. No proposed feature gate belongs in
the runner or in an `EvidenceKey`.

For every row, test empty input, page permutations, affected URLs and result
schema validity when the implementation changes. A purpose must have independent
evidence: the absence of the schema under test cannot remove the page from scope.
Keep unsupported or uncertain populations unscored. Do not infer an article
from the current catch-all `content` label.

## Common page audits

### content-extraction/main-element

- **Population / read:** common readable pages; literal `<main>` count. Grade A.
- **Current aggregation / absence:** all pages pass, partial coverage warns,
  none fail, empty sample NA. Sorted missing URLs; bounded evidence text.
- **Disposition:** retain common scope. Existing dossier supports ARIA main
  landmarks, a warning for multiple main landmarks, and exclusion of hidden
  markup. The literal selector still misses these cases. This is a predicate
  correction, not a reason to gate the audit by page purpose.
- **Tests:** explicit `role="main"`, hidden ancestors, templates, multiple
  visible mains and combinations across pages. Keep browser-only visibility
  outside claims based on fetched HTML. P1 scope tests already pass.

### content-extraction/single-h1

- **Population / read:** common readable pages; raw `<h1>` count. Grade B.
- **Current aggregation / absence:** all pages must have exactly one; otherwise
  fail. Empty sample NA. All affected URLs and counts contribute.
- **Disposition:** retain common scope. Existing dossier requires zero headings
  to fail, multiple headings to warn, and hidden/template headings to be excluded.
  Implement visibility and severity together with result-mode tests. The current
  binary mode cannot represent the intended partial verdict faithfully.
- **Tests:** zero/one/multiple visible headings, responsive duplicates, hidden
  ancestors, templates, mixed missing/duplicate pages and severity precedence.
  P1 proves scope only. Metadata and public mode remain unchanged in this slice.

### content-extraction/header-footer

- **Population / read:** common readable pages; literal `<header>` and `<footer>`
  presence. Grade A. The original first-page branch changed warn to fail on reorder.
- **Current aggregation / absence after this slice:** all pages with both pass;
  some pages with both warn; no page with both fails. Empty sample NA. Each missing
  landmark has a URL. A header and footer on different pages cannot form a pass.
- **Disposition:** retain common scope. Dossier already requires document-level
  landmarks, ARIA equivalents and empty-sample handling. Section-scoped elements,
  hidden markup and pages with no relevant chrome still need semantic review.
- **Tests:** order, empty input, per-landmark evidence, separate-page landmarks,
  all four types with both provenance values, and large-sample schema bounds run
  in this slice. Add section-scoped/ARIA/visibility cases with the later predicate fix.

## Typed content-extraction audits

### content-extraction/article-element

- **Population / read:** current `content`; literal `<article>` on each page.
  Grade A supports article extraction, not treating every general page as an article.
- **Current aggregation / absence:** all pass; majority coverage or a passing
  first page warns; otherwise fail. Empty input passes vacuously.
- **Disposition:** require positive article purpose. Use coverage without a
  first-page exception; decline no eligible articles. Keep missing markup eligible.
- **Tests:** privacy/contact negatives, article without Article schema, empty
  sample, identical sets with the sole passing article in different positions.

### content-extraction/aside-element

- **Population / read:** current `content`; supplementary-content candidates
  and `<aside>`/complementary markers. Grade B. Pages without the feature do not count.
- **Current aggregation / absence:** all marked passes, partial warns, none marked
  fails; no candidates NA. Unmarked examples cap at five per page.
- **Disposition:** feature-gate supplementary content in the supported population.
  Review dossier population before extending beyond current types. Distinguish
  sampled examples from total counts; stabilize the representative URL.
- **Tests:** no sidebar, marked/unmarked sidebars, nested candidates, non-article
  feature cases, more than five candidates and page permutations.

### content-extraction/code-language

- **Population / read:** current `content`; `pre code` and language classes.
  Grade C, informative. Reads all selected code blocks.
- **Current aggregation / absence:** all annotated passes, majority warns,
  otherwise fails; zero code blocks warns.
- **Disposition:** use a code-block feature guard; absence NA. Retain informative
  status. A page label must not exclude a real code example or require one.
- **Tests:** no code, code on a general page, partial annotation, blank
  `language-` suffix, multiple pages and stable affected-block evidence.

### content-extraction/time-element

- **Population / read:** current `content`; presence of `time[datetime]`.
  Grade C, informative.
- **Current aggregation / absence:** any page with the element passes the sample;
  none fails, including empty input. Does not first establish a date to mark up.
- **Disposition:** gate on temporal content with an explicit detection limit;
  no applicable date NA. Keep advisory status and measure per-page coverage.
- **Tests:** undated contact page, visible date without markup, valid/invalid
  datetime and one compliant page beside an affected dated page.

## Typed structured-data audits

### structured-data/organization-schema

- **Population / read:** current `homepage`; organization nodes across selected
  pages, then the first node's name, URL and logo. Grade A.
- **Current aggregation / absence:** no organization fails; first complete node
  passes, incomplete warns. Other nodes do not repair first-node selection.
- **Disposition:** keep a site-identity claim with explicit entity ownership.
  Review about/contact evidence as possible inputs; do not require an organization
  on every page or conflate unrelated publishers. Check required versus recommended fields.
- **Tests:** primary versus related organization, alternate identity page,
  multiple nodes, absent logo, no eligible identity page and node permutations.

### structured-data/breadcrumb-schema

- **Population / read:** current category/product/content; URL path depth over
  one segment selects pages, then BreadcrumbList presence. Grade A.
- **Current aggregation / absence:** all covered passes, some warns, none fails;
  no deep URL warns. URL depth supplies the hierarchy assumption.
- **Disposition:** establish navigational hierarchy independently. Locale or
  deployment path depth alone cannot require breadcrumbs. No eligible hierarchy NA.
- **Tests:** locale prefixes, mounted apps, shallow hierarchical pages, deep
  standalone pages, missing breadcrumb schema and partial coverage.

### structured-data/article-schema

- **Population / read:** current `content`; `isArticlePage` returns true for
  every selected page. First Article/NewsArticle/BlogPosting per page. Grade A.
- **Current aggregation / absence:** all complete passes, any present warns,
  none fails; empty sample NA. Required fields include `dateModified`.
- **Disposition:** positive article purpose with independent evidence. Validate
  the primary article and recheck required versus recommended fields against the
  dossier before making an unchanged article invent an update date.
- **Tests:** privacy/contact pages, article missing schema, related article cards,
  multiple article nodes, unchanged article, partial and malformed markup.

### structured-data/service-schema

- **Population / read:** current homepage/content; Service/ProfessionalService,
  service-like paths or services links imply intent. Grade A.
- **Current aggregation / absence:** no intent NA; intent with no nodes fails;
  any complete name/provider node passes; otherwise warns across the selected sample.
- **Disposition:** service-offering purpose or present service feature. A shared
  navigation link, especially an external link, must not make every page a service.
  Define whether the claim concerns site coverage or each offering before aggregation changes.
- **Tests:** shared services navigation, external link, real offering without
  schema, unrelated complete node and two offerings with unequal coverage.

### structured-data/speakable-schema

- **Population / read:** current `content`; article helper accepts every page.
  Reads nonempty cssSelector/xpath on Article/Page/Posting hosts. Grade B.
- **Current aggregation / absence:** all covered passes, some warns, none fails;
  empty sample NA. Does not establish the narrower consumer population.
- **Disposition:** dossier documents a limited English-news consumer, not all
  articles. Require that supported population or a present adopted feature.
  Preserve uncertainty and refresh the dossier's consumer-retirement trigger
  before enabling broader scoring. Do not infer live support from this review.
- **Tests:** general content, non-news article, non-English news, uncertain
  publisher eligibility, valid selector forms, missing targets and partial coverage.

### structured-data/howto-schema

- **Population / read:** current `content`; numbered sequential headings imply
  instructions; checks HowTo step arrays. Grade C, informative.
- **Current aggregation / absence:** no candidate warns; all marked passes,
  partial warns, none fails.
- **Disposition:** instructional feature; no candidate NA. Keep grade C and
  avoid implying documented adoption. Separate an ordered list from actual instructions.
- **Tests:** numbered legal clauses, recipe/tutorial intent, non-content page
  with steps, absent versus malformed HowTo and partial coverage.

### structured-data/local-business-schema

- **Population / read:** current `homepage`; PostalAddress plus a locator link
  implies physical presence, then scans all selected nodes. Grade A.
- **Current aggregation / absence:** no physical signals NA; any matching
  LocalBusiness/ProfessionalService passes; otherwise fails.
- **Disposition:** explicit physical-business site context; postal contact alone
  is insufficient. Review subtype handling and primary-business identity.
  Avoid a guard that requires the schema being tested to establish eligibility.
- **Tests:** online-only business with mailing address, real store without
  schema, business subtypes, locator elsewhere and unrelated business nodes.

### structured-data/review-schema

- **Population / read:** current homepage/product; review components, widgets,
  or review markup; reads structured data formats. Grade A.
- **Current aggregation / absence:** no review content NA. Aggregates usable
  reviews/ratings; URL patterns and Product attachment decide product coverage.
  Dossier deliberately accepts at least one rated product in the sample.
- **Disposition:** review feature plus supported review target. Replace hidden
  URL-based product guessing with shared purpose evidence. Retain the explicit
  sample claim until a dossier revision supports per-page requirements.
- **Tests:** no reviews, visible reviews without schema, product versus
  organization ratings, custom product URLs and mixed review-target samples.

### structured-data/author-schema

- **Population / read:** current `content`; Person nodes and article author
  objects across the sample. Grade C, informative.
- **Current aggregation / absence:** none fails; any person with name, jobTitle,
  sameAs and affiliation passes; otherwise warns.
- **Disposition:** authorship feature or supported article purpose. Bind a
  person to the assessed article. Optional enrichment absence must not become
  a requirement for every page; retain unscored advice.
- **Tests:** unrelated employee Person, organizational author, linked author
  references, absent authorship, incomplete optional fields and mixed articles.

### structured-data/advanced-product-details

- **Population / read:** current `product`; flattened product nodes, first
  product and its offers. Grade A.
- **Current aggregation / absence:** no product node fails; first node's name,
  brand/manufacturer, category and availability decide pass/warn/fail.
- **Disposition:** confirmed product purpose for presence; present primary
  product for content validation. Do not allow a related product to satisfy the
  page or report only the first product in a multi-page sample.
- **Tests:** product without schema, related-product cards, absent versus broken
  product data, two unequal PDPs and node/page permutations.

## Typed answer-readiness audits

### answer-readiness/meta-author

- **Population / read:** current `content`; first page's meta author. Grade C,
  informative.
- **Current aggregation / absence:** nonempty first value passes; otherwise
  fails, including empty input. Ignores other selected pages.
- **Disposition:** authorship feature or supported article purpose, per-page
  evidence and no applicable page NA. Retain grade C; do not imply a required crawler signal.
- **Tests:** general/privacy pages, article without meta author but another valid
  author representation, mixed bylines, empty input and page permutations.

### answer-readiness/first-paragraph-answers

- **Population / read:** current `content`; first page accepted by the imported
  article helper, which only excludes XML. Reads a substantive paragraph. Grade C.
- **Current aggregation / absence:** no accepted page NA; first paragraph length,
  English sentence pattern and weak-opener patterns decide the sample verdict.
- **Disposition:** positive article/answer purpose; per-page assessment. English
  patterns need an explicit language limit. Keep advisory status.
- **Tests:** contact/privacy HTML, XML, non-English article, no paragraph,
  good and weak openings in reversed samples, non-article answer features.

### answer-readiness/direct-definitions

- **Population / read:** current `content`; helper selects definition intent
  from structural markup or lexical patterns, then assesses markup/prose.
  Unknown languages fall back to English patterns. Grade C, informative.
- **Current aggregation / absence:** no candidate NA; all marked passes,
  otherwise warns. Ordinary prose definitions do not fail.
- **Disposition:** definition feature, not every article. Preserve the existing
  absence and advisory rules; review widening beyond `content` against the dossier.
- **Tests:** no definition intent, valid prose, definition list/markup,
  definition on a general page, unsupported languages and stable representative URLs.

### answer-readiness/comparison-tables

- **Population / read:** current category/product/content; any `<table>` in
  any selected page. Grade C, informative.
- **Current aggregation / absence:** any table passes; none fails, including
  empty input. Does not establish comparison intent or distinguish layout tables.
- **Disposition:** comparison feature; no comparison NA. Keep unscored. A homepage
  comparison is a candidate for scope expansion, not automatic scoring permission.
- **Tests:** no comparison, layout table, real comparison with/without a table,
  homepage feature, multiple pages and accessible alternative representations.

### answer-readiness/dates-on-content

- **Population / read:** current `content`; helper excludes XML only. Reads
  modified/published signals in markup and visible text. Grade A.
- **Current aggregation / absence:** any modified signal passes; otherwise any
  publication date warns; none fails. No candidates NA. Dossier states this best-signal rule.
- **Disposition:** positive article purpose. Change the dossier's aggregation
  contract before replacing the best-signal rule with page coverage. Review
  overlap with publication-date/last-modified-schema and unchanged articles.
- **Tests:** privacy/contact, article without schema, publication-only article,
  unrelated footer dates, mixed date coverage and stable provenance.

### answer-readiness/named-author

- **Population / read:** current `content`; author objects, meta author or
  visible author/byline markers across pages. Grade C, informative.
- **Current aggregation / absence:** first qualifying name passes; none fails,
  including empty input. Generic-name exclusions can reject real collective authors.
- **Disposition:** bind authorship to each eligible article; do not require a
  byline on generic content or invent a penalty for organizational authors.
- **Tests:** real person/organization authors, staff byline, unrelated footer
  name, no article, missing byline and mixed article coverage.

### answer-readiness/author-same-as

- **Population / read:** current `content`; Person/article-author sameAs values
  beginning with HTTP across all selected pages. Grade C, informative.
- **Current aggregation / absence:** first matching value passes; none fails,
  including empty input. Does not prove an external author profile.
- **Disposition:** optional linked-author feature with entity ownership;
  distinguish absent enrichment from a defective supplied link. Keep unscored.
- **Tests:** unrelated Person, same-site URL, malformed link, author reference,
  no authorship and different author-link coverage across articles.

### answer-readiness/author-page

- **Population / read:** current `content`; JSON-LD author URLs and author links;
  safe probe via the author gatherer. Grade C, informative.
- **Current aggregation / absence:** no pages/links fails; probes only the first
  collected URL. Non-200 and failed reads collapse into failure.
- **Disposition:** present author-link feature, distinct missing/unread/broken
  states and explicit bounded link coverage. Retain URL safety and shared fetches.
- **Tests:** no link, two authors with different outcomes, URL order, unsafe URL,
  refused redirect, timeout, real 404 and successful shared author link.

### answer-readiness/external-citations

- **Population / read:** current `content`; all external anchors across pages,
  including site chrome. Grade B derives from measured citation-bearing content.
- **Current aggregation / absence:** any page with two links passes; any link
  warns; otherwise fails, including empty input. Representative URL can be unrelated.
- **Disposition:** supported editorial content, with citations in its body.
  Dossier already asks for chrome/paid-link exclusions, deduplication and page
  coverage. A two-link threshold is an implementation heuristic, not proof of authority.
- **Tests:** footer social links, repeated URLs, paid links, own asset hosts,
  true citations, unsupported page purposes and mixed article coverage.

### answer-readiness/trust-signals

- **Population / read:** homepage only; first selected page and English-language
  patterns for two measured factors. Grade B. Review markup defers social proof.
- **Current aggregation / absence:** no page or explicit non-English language NA;
  all remaining factors pass, one/deferred warns, none fails.
- **Disposition:** retain the dossier's homepage and language boundaries.
  Do not widen to every page. Preserve review deferral in both numerator and
  denominator. Define multiple-homepage and unknown-language handling explicitly.
- **Tests:** review-markup monotonicity, unknown/non-English language, duplicate
  homepages, navigation-only evidence and unsupported general pages.

### answer-readiness/review-signals

- **Population / read:** current homepage/product; attributed quotations,
  review markup and widgets across selected pages. Grade B.
- **Current aggregation / absence:** empty NA; any strong signal passes, weak
  signal warns, none fails. One outer gate covers two different populations.
- **Disposition:** dossier permits attributed quotation on any scanned page,
  but review vocabulary only on homepage/product. Use branch-specific
  applicability with one audit weight; do not expose both to all page purposes.
- **Tests:** attributed article quotation, unsupported review widget context,
  mixed page purposes, review-schema overlap and independent branch absence.

### answer-readiness/publication-date

- **Population / read:** current `content`; its own XML-exclusion helper accepts
  other HTML as articles. Reads structured or visible dates. Grade B.
- **Current aggregation / absence:** any qualifying date passes the sample;
  none fails; no candidates NA.
- **Disposition:** shared positive article evidence and per-article provenance.
  Review overlap with dates-on-content before changing denominator/aggregation.
- **Tests:** privacy/contact, XML, publication versus footer/update dates,
  missing schema, mixed coverage and stable affected URLs.

### answer-readiness/last-modified-schema

- **Population / read:** current `content`; Article-family/WebPage dateModified
  and datePublished fields. Grade B.
- **Current aggregation / absence:** first modified date differing from published
  passes; equal warns immediately; no date fails, including empty input.
- **Disposition:** article revision or supplied metadata feature with explicit
  absence rules. No fabricated update dates. Distinguish malformed dates from
  unchanged content and remove first-node/page severity dependence.
- **Tests:** equal/different dates in reversed nodes/pages, invalid date strings,
  no revision, general WebPage and partial article coverage.

### answer-readiness/unique-data

- **Population / read:** current `content`; numeric regex matches from page body,
  at most ten per page. Grade B supports measured quantitative content, not originality.
- **Current aggregation / absence:** total at least three passes, some warns,
  none fails, including empty input. More pages can increase the sample verdict.
- **Disposition:** constrain to the supported content population and measured
  claim. Dossier rejects prices/number density as proof of original research.
  Rename or reframe only with the corresponding contract change; preserve no false claim.
- **Tests:** prices, dates, copied statistics, real quantitative statements,
  irrelevant body numbers, sample-size effects and correct evidence URLs.

## Typed agentic-commerce audits

### agentic-commerce/offer-schema

- **Population / read:** current `product`; Offer/AggregateOffer or offers
  properties and price/currency on each selected page. Grade A.
- **Current aggregation / absence:** empty NA; all pages covered pass,
  some warn, none fail.
- **Disposition:** confirmed buyable-product purpose, independent of schema.
  Bind offers to the primary product; distinguish presence from content
  validation and support the documented aggregate-offer shape.
- **Tests:** product without schema, non-buyable product, related offer,
  AggregateOffer, malformed present offer and mixed product coverage.

### agentic-commerce/product-identifiers

- **Population / read:** current `product`; flattened products and identifiers
  from the first product/offers. Grade A.
- **Current aggregation / absence:** no product fails; any accepted identifier
  on the first product passes; otherwise fails.
- **Disposition:** primary-product identity with per-product coverage. Review
  identifier alternatives and legitimate unassigned identifiers; do not require
  a fabricated GTIN or let a related product satisfy the page.
- **Tests:** missing Product, SKU/MPN/GTIN alternatives, no assigned GTIN,
  related cards, multiple product entities and mixed PDPs.

### agentic-commerce/product-transaction-certainty

- **Population / read:** current `product`; existing products/offers with
  availability, validity date, price pair and returns policy. Grade A.
- **Current aggregation / absence:** no products NA; no offers fails; best
  product passes at four factors, warns at two, else fails. Fields can come from different offers.
- **Disposition:** present transaction feature. Judge coherent offers instead
  of combining facts from different transactions. Review validity-date and
  other optional-field requirements against the consumer's supported path.
- **Tests:** no artifact, broken offer, split facts across conflicting offers,
  unexpired/no-expiry price, variant offers and mixed products.

### agentic-commerce/landed-cost-and-returns

- **Population / read:** current `product`; first Offer or offers object,
  shipping fields and return policy from the offer or elsewhere in the sample. Grade A.
- **Current aggregation / absence:** no offer NA; problems fail, link-only warns,
  valid passes. Later offers are not assessed; arbitrary policy fallback lacks ownership.
- **Disposition:** present offer, per-offer coverage, correctly inherited
  merchant policy. Do not import another product's or merchant's policy.
- **Tests:** absent versus defective offer, two offers with different shipping,
  linked policy, correct Organization inheritance, unrelated policy and page order.

### agentic-commerce/checkout-offer-field-mapping

- **Population / read:** current `product`; first product plus field-verification
  evidence from the selected sample. Grade A for the documented feed path.
- **Current aggregation / absence:** no product NA; mapping problems fail,
  ambiguity warns, valid passes. Dossier says every PDP; implementation picks one.
- **Disposition:** explicitly supported commerce/feed population with per-product
  mapping. Existing schema alone must not imply enrollment in an optional feed.
  Review whether the scored claim is applicable or a mapping preview before widening it.
- **Tests:** unenrolled store, valid/invalid mappings, ambiguous field ownership,
  two unequal PDPs, shared field-verification evidence and deterministic sample order.

### agentic-commerce/buyable-variant-resolution

- **Population / read:** current `product`; variant controls/groups and product
  fields on the first three pages. Grade B.
- **Current aggregation / absence:** no variant feature NA; any failure fails,
  else warnings warn, otherwise passes. The sample cap depends on input order.
- **Disposition:** variant feature in supported commerce pages; deterministic
  bounded selection and explicit omitted coverage. Keep group and buyable-variant
  identity distinct. A passing sampled set cannot claim full input coverage.
- **Tests:** no variants, real selector versus decorative options, unresolved
  variant identity, group/per-variant data, four-plus pages and permutations.

### agentic-commerce/offer-truth-consistency

- **Population / read:** current `product`; offers and visible product-region
  price, currency and availability on the first three pages. Grade B.
- **Current aggregation / absence:** contradictions fail, warnings warn, otherwise
  passes; no checked data warns. Missing rendered prices can produce a claim about client rendering.
- **Disposition:** present offer/visible-price feature with deterministic
  bounded coverage. A missing fetched price does not prove JavaScript-only
  rendering or what every crawler sees. Report the observation and unread state.
- **Tests:** matching/conflicting price, unrelated cards, localization, missing
  visible price, no offer, multiple offers and four-plus page permutations.

## Typed operability audit

### operability-safety/url-addressable-state-and-pagination-fallback

- **Population / read:** current `category`, plus internal `pagesOfType`;
  local `surveyListing` reads pagination links and probes at most two facet
  URLs per page through `fetchSampledPage`. Grade B.
- **Current aggregation / absence:** no category NA; truncated listing/sentinel
  failure takes precedence; button/client-facet limits warn; otherwise passes.
- **Disposition:** listing/filter/pagination feature in the documented
  population. A non-commerce listing can need the same navigation, but do not
  claim every tab/state is covered. The current deepest index multiplies item
  count by a URL number; it does not walk pagination. Equal item counts after a
  filter do not prove client-only filtering. Report observed versus inferred
  reachability and unread probes; expose facet sampling limits.
- **Tests:** non-commerce listing, no pagination, real next link, client-only
  control, offset versus page number, same-count different filtered items,
  fetch failure, more than two facets and stable worst-page evidence.

## Remaining content-extraction audits

### content-extraction/server-responsiveness

- **Scope / read:** common page-fetch sample; median TTFB. Grade B. WAF block
  or no completed fetch NA; errored fetches excluded and counted separately.
- **Aggregation:** median at most 800 ms passes, through 2,500 ms warns, higher
  fails. Dossier explicitly defines this cross-page measurement.
- **Disposition / tests:** retain median, not worst-page scoring. Stabilize tied
  slowest URLs; test errored attempts, even samples, ties and selected-page
  coverage. Do not describe scanner-location latency as server-only time.

### content-extraction/language-attribute

- **Scope / read:** common page HTML attribute, including pages without body
  text. Grade A covers accessibility/i18n consumers, not model/tokenizer selection.
- **Aggregation:** previously first page only, empty input failed. This slice
  checks all selected pages; any missing/blank declaration fails, empty NA.
  Different languages on different pages are valid for this presence check.
- **Disposition / tests:** retain binary presence contract and body-gate exemption.
  Correct unsupported impact text. BCP 47 validity and content-language agreement
  remain open; the later evidence rejects the old review's meta Content-Language
  fallback. Test locales, shell pages, mixed missing declarations and order.

### content-extraction/markdown-alternate

- **Scope / read:** one selected page, preferring an advertised alternate,
  then a non-root URL. Probes declared link, .md and Accept negotiation. Grade A.
  No readable alternate NA; best available route determines fail/warn/pass.
- **Disposition:** adopted alternate feature in the documented coding-agent
  population. Keep absence neutral. Expose the selected page and routes; one
  faithful route must not imply every advertised alternate works. Select pages
  deterministically and separate confirmed broken declarations from unread probes.
- **Tests:** later-page declaration, two alternate pages reordered, safe-refused
  link, HTML fallback, declared broken link plus good negotiation, drift and MDX.

### content-extraction/sequential-headings

- **Scope / read:** headings across common pages. Grade B/scored today.
  No page with two headings warns; no skips passes, at most half affected warns,
  otherwise fails. Pages without enough headings remain in the denominator.
- **Disposition:** dossier explicitly says the grade supports real headings,
  not a penalty for skipped levels. Resolve this score/evidence conflict at the
  major boundary; do not extend unsupported scoring through new purpose detection.
- **Tests:** empty/no-heading pages, skipped levels, hidden headings and adding
  ineligible pages without diluting findings. Re-grade requires dossier/meta agreement.

### content-extraction/section-headings

- **Scope / read:** present nonempty sections, all pages; heading/ARIA labels.
  Grade B. No eligible section NA; all labeled pass, majority warn, else fail.
- **Disposition:** retain feature gate. Descendant headings can label an outer
  section accidentally; nonempty aria-labelledby does not prove a resolved name.
  Add affected URLs without turning layout-only slots into requirements.
- **Tests:** empty slots, nested sections, missing label targets, whitespace
  labels, hidden headings and mixed-page section counts.

### content-extraction/semantic-lists

- **Scope / read:** visible content-list features across pages. Grade B.
  Excludes navigation/chrome; counts semantic and pseudo lists. None NA;
  all semantic pass, at least half semantic warn, otherwise fail.
- **Disposition:** keep the dossier's block-based denominator, not one vote per
  page. Preserve hidden-content and chrome guards. Sort offender evidence.
- **Tests:** no lists, navigation-only lists, broken definitions, numbered prose,
  nested lists, hidden ancestors and tied offenders in reversed pages.

### content-extraction/data-tables

- **Scope / read:** every table across pages, using th/thead/tbody structure.
  Grade B. No table passes on readable input and is NA on unread input.
  All proper pass, majority warn, otherwise fail.
- **Disposition:** data-table feature; no table NA. Separate layout tables and
  valid header arrangements from one prescribed element pattern. Body evidence
  must refer to the selected pages, not a readable excluded page.
- **Tests:** no table, layout table, row/column headers without thead, nested
  tables, mixed coverage and per-table affected URLs.

### content-extraction/image-alt-text

- **Scope / read:** nondecorative image accessible names across all pages.
  Grade A. No relevant images NA; full coverage passes, threshold bands warn/fail.
- **Disposition:** retain image-feature scope and alternate naming methods.
  Worst-page ties currently depend on input order. Audit direct versus ancestor
  hiding before claiming accessibility-tree coverage.
- **Tests:** decorative images, ARIA names, broken label references, hidden
  ancestors, multiple page coverage and stable worst-page ties.

### content-extraction/figure-figcaption

- **Scope / read:** figure/caption features across pages. Grade C/informative.
  No figure plus images warns; no images passes on readable input; figures
  use all/majority/fewer-caption coverage.
- **Disposition:** optional figure/caption feature, absence NA. Do not demand
  figure markup for every image or accept an unrelated nested caption.
- **Tests:** no media, decorative images, uncaptioned figure with meaningful
  alternative text, nested figures and mixed-page coverage.

### content-extraction/content-depth

- **Scope / read:** word count for every page. Grade B. All over 300 words
  pass; majority or first-page success warns; otherwise fails. Empty passes.
- **Disposition:** remove order dependence and vacuous success, but first
  resolve population and threshold evidence. Dossier's token/extraction evidence
  does not establish a universal 300-word requirement for contact, utility or product pages.
- **Tests:** concise useful pages, CJK text, chrome-heavy shells, empty input,
  mixed-purpose samples and the same low-coverage set in different orders.

### content-extraction/svg-bloat

- **Scope / read:** inline SVG/base64 features across pages. Grade B. No assets
  NA; aggregate bytes/tokens and largest SVG determine threshold bands.
- **Disposition:** retain feature scope. Per-page limits must not become a
  crawl-size penalty through summed bytes. Separate raw-HTML cost from
  accessibility-tree hiding; hiding an SVG does not remove its response bytes.
- **Tests:** many individually small pages, one large asset, decorative SVG,
  hidden ancestor, Unicode size accounting and stable largest-asset evidence.

### content-extraction/token-ratio

- **Scope / read:** first selected page; extracted content versus raw HTML
  tokens. Grade B. No body NA; ratio bands decide verdict.
- **Disposition:** dossier explicitly chooses the homepage/entry page. Keep
  that sample contract until revised, but identify the entry independently of
  array order and do not label a deep-link scan “homepage.”
- **Tests:** deep-link entry, reordered extra pages, no body, extractor fallback
  and actual versus estimated tokens. Report one measured page, not site coverage.

### content-extraction/fake-headings

- **Scope / read:** heading-like generic elements across pages, with visibility
  and duplicate guards. Grade B. No findings passes with readable evidence;
  fewer than five warns; five or more fails.
- **Disposition:** feature-based heuristic; retain uncertainty in claims.
  Absolute sample-wide count can worsen with added pages; review denominator
  before adopting common per-page aggregation. Stabilize five displayed examples.
- **Tests:** real/ARIA headings, prominent non-heading copy, hidden duplicates,
  five findings spread across pages and different sample order/size.

### content-extraction/server-rendered

- **Scope / read:** every fetched page's body-readability evidence. Grade B.
  Empty NA; all readable pass, some warn, none fail. Dossier supports these ratios.
- **Disposition:** common fetched-page scope, even without rendered-body evidence.
  Preserve failed-attempt coverage separately. Sort empty URLs and tie evidence.
  A low-text page alone does not prove client rendering or inability of all agents to read it.
- **Tests:** real shell, concise static utility page, CJK body, mixed readability,
  unavailable attempts and reversed page order.

### content-extraction/css-hidden-ghost-content

- **Scope / read:** all page bodies plus shared CSS collection. Grade A.
  No body NA; no detected blocks passes; duplicates/size/share thresholds fail,
  smaller findings warn. Skips cross-origin stylesheets.
- **Disposition:** CSS-hidden content feature with partial-read coverage.
  Do not claim no hidden text when relevant stylesheets were unread. Global
  size/share can hide one page or penalize many small pages.
- **Tests:** unavailable stylesheets, media rules, assistive text, nested hidden
  blocks, cross-page dilution, duplicates and stable largest-block ties.

### content-extraction/hydration-payload-share

- **Scope / read:** framework state across all pages. Grade A. No payload NA;
  size/share/duplication thresholds fail, intermediate share warns, else pass.
- **Disposition:** per-page payload feature. This slice fixes the shared map
  that merged same-named state from different pages into one “single” payload.
  Maps now belong to a page; same-page flight frames still combine. Size ties
  use stable URL/name order. Total share and duplication still merge globally;
  their per-page semantics remain open.
- **Tests:** two sub-limit NEXT_DATA payloads on different pages, same-page
  frames, Unicode byte counts, 512 KiB scan cap and cross-page duplicate text.

### content-extraction/preamble-tax

- **Scope / read:** first selected page; token offset before locatable extracted
  content. Grade B. No/short/unlocatable content NA; token bands decide verdict.
- **Disposition:** dossier explicitly defers per-page sampling. Preserve its
  bounded entry-page measurement until revised; make entry identity explicit.
  Unlocatable content must stay unmeasured, not a zero-token pass.
- **Tests:** entry reorder, deep entry, extraction misses, short pages, boundary
  offsets and Unicode. Do not claim to measure mid-document interruptions.

### content-extraction/boilerplate-tax

- **Scope / read:** cross-page sample, at most five per URL-depth bucket.
  Grade B. Fewer than three extractable pages NA; distinct-token share and median
  determine bands. This is deliberately a site-sample comparison.
- **Disposition:** retain cross-page aggregation. Depth is a proxy, not a proven
  template identity; first-five selection is order-dependent. Expose omitted
  pages and never treat repeated substantive terms as proven chrome.
- **Tests:** six-plus same-depth pages, multiple templates at one depth, thin
  samples, repeated real content, stable sample selection and evidence ordering.

### content-extraction/extraction-determinism

- **Scope / read:** first selected page through three extractors. Grade B.
  No/short visible text NA; Readability decline or short result fails; agreement bands follow.
- **Disposition:** dossier explicitly limits cost to entry-page comparison.
  Keep sampled coverage explicit. Reader-mode suitability is not universal page
  suitability; review non-article populations before wider scoring.
- **Tests:** deep entry, privacy/utility/product layouts, declined versus
  disagreeing extraction, empty input and reorder with fixed entry identity.

### content-extraction/json-ld-duplication-mass

- **Scope / read:** first selected page with JSON-LD. Grade C/informative.
  No page/blocks NA; duplicate nodes or body text warn; otherwise passes.
- **Disposition:** optional structured-data feature. First page without markup
  currently hides later adopted features. Select features explicitly and preserve
  legitimate structured-data duplication; no advice to remove useful schema.
- **Tests:** absent entry plus later JSON-LD, repeated entity versus @id reference,
  script text in the DOM comparison, large blocks and multiple page coverage.

## Machine-discovery audits

These checks mix origin artifacts, mounted-site indexes, page links and feeds.
Page purpose must not change a root artifact's verdict. Keep shared fetches,
but key derived site-scope data by the context that selected it. Distinguish
attempted, safely refused, absent, malformed, unread and budget-limited artifacts.

### machine-discovery/llms-txt-exists

- **Scope / read:** root llms.txt plus first-page discovery link. Grade C/informative.
  Absent without link NA; absent with link warns; heading-less body warns; otherwise pass.
- **Disposition:** origin artifact plus page-link feature; inspect advertised
  links across selected pages. Later dossier corrections override its stale
  opening table that still says absence fails.
- **Tests:** optional absence, link only on a later page, subpath declaration,
  HTML catch-all, empty body and unread versus confirmed missing file.

### machine-discovery/llms-txt-structure

- **Scope / read:** existing root llms.txt; H1, summary window and H2 sections,
  excluding code fences. Grade C/informative. Absent/non-markdown NA; both
  elements pass, one missing warns, both missing fail.
- **Disposition / tests:** retain origin-feature guard and advisory grade.
  Dossier calls summary optional; severity must not imply an agent requirement.
  Test missing/malformed files, fences, summary-window edges and page-label invariance.

### machine-discovery/llms-txt-link-descriptions

- **Scope / read:** root llms.txt links/descriptions. Grade C/informative.
  Missing file fails; no links warns; description-coverage bands decide the result.
- **Disposition:** optional existing-file content check; absence NA. Dossier
  rejects the unsupported 50% requirement and requires parser improvements.
- **Tests:** missing file, malformed body, relative/angle/title links, alternate
  note separators, no optional descriptions and unchanged verdict across page types.

### machine-discovery/llms-txt-links-valid

- **Scope / read:** existing root-file links through safe shared probes.
  Grade C/informative. Missing file NA; no links warns; any broken result warns,
  otherwise all links are reported as HTTP 200.
- **Disposition:** retain artifact feature. Filtering failed results before
  mapping indexes attaches the wrong URL; unsafe/unresolved links disappear
  yet remain in the “all links” claim. Keep each outcome paired with its URL.
- **Tests:** good then broken link, all refused, relative URLs, timeout versus
  404, redirect, duplicate links and bounded deterministic probes.

### machine-discovery/llms-full-txt

- **Scope / read:** root llms-full.txt status. Grade C/informative. Missing fails;
  any successful response passes without content validation.
- **Disposition:** optional documentation artifact, absence NA. Dossier says
  generic/commercial sites need not adopt it. Validate a present document before
  claiming full content; retain no score impact.
- **Tests:** absence, HTML catch-all, empty/invalid body, actual document and
  scope independence from the scanned page's label.

### machine-discovery/sitemap-exists

- **Scope / read:** site-scoped sitemap discovery through the shared gatherer,
  including mounted homepage directories. Grade A. Confirmed absence/malformed
  fails; incomplete absence NA; readable structure passes.
- **Disposition:** preserve existing site-scope and incomplete-read contract.
  Do not infer a mount from an arbitrary content URL. Consumer claims cover
  supported search-index paths, not every AI crawler.
- **Tests:** declared/detected mount, origin index, unrelated sibling sitemap,
  child/entry limits, unread children and page order with fixed site scope.

### machine-discovery/discovery-index-coverage

- **Scope / read:** selected page URLs/canonicals versus site sitemap plus
  llms links. Grade B. No pages NA; no indexes warns; missing with incomplete
  index NA; all covered pass; missing fraction sets warn/fail.
- **Disposition:** cross-page index coverage with eligible indexable population.
  Recheck whether optional grade-C llms links can satisfy the scored consumer
  path. Current normalization collapses query, case and scheme distinctions.
- **Tests:** noindex/private pages, query-distinct pages, case-sensitive paths,
  off-site canonicals, partial indexes and stable uncovered URLs.

### machine-discovery/sitemap-absolute-urls

- **Scope / read:** loc values from shared sitemap tree. Grade B.
  Absent/empty NA; malformed fails; non-HTTP-prefix loc fails; otherwise passes.
- **Disposition / tests:** existing-artifact validation independent of page type.
  Preserve partial-read limits and retained defects. Test malformed absolute
  strings, relative entries, valid HTTP/HTTPS, empty trees and partially readable children.

### machine-discovery/sitemap-lastmod

- **Scope / read:** existing sitemap entries and nonempty lastmod fields.
  Grade A. Absent/empty NA; malformed fails; at least 80% populated passes, else fails.
- **Disposition:** retain artifact scope; separate date presence from validity
  and consumer-supported need. Dossier records the integrity gap; the sibling
  verifiability check already owns detailed date comparison.
- **Tests:** absent/empty trees, invalid/future values, genuine unchanged pages,
  partial sitemap coverage and overlap without duplicated penalties.

### machine-discovery/rss-feed

- **Scope / read:** feeds advertised by every selected page plus common paths;
  shared feed gatherer. Grade B. No published/advertised feed NA; advertised
  but none read fails; first valid feed passes the site claim.
- **Disposition:** optional adopted feed feature. One valid feed does not prove
  every advertised feed works. Preserve that distinction and unread probe states.
- **Tests:** no feed, later-page advertisement, one good/one broken feed,
  malformed versus unreachable feed, mounted URL and discovery budget.

### machine-discovery/rss-feed-content

- **Scope / read:** first parsed feed; item content length. Grade C/informative.
  No feed fails; empty feed warns; over-500-character coverage sets bands.
- **Disposition:** present feed-content feature; missing feed NA. Length is not
  proof of complete content. Define which feeds are sampled and avoid rewarding padding.
- **Tests:** multiple feeds, absent/malformed/empty feed, short complete entry,
  long excerpt, Atom content and stable selected-feed identity.

### machine-discovery/in-content-links

- **Scope / read:** distinct internal destinations in every page's content.
  Grade A. Empty NA; all at least two pass; some below warn; all linkless fail.
- **Disposition:** common navigation measurement with an explicit supported
  population and heuristic threshold. Preserve chrome/self-link exclusions;
  review one-page sites and pages that legitimately terminate a task.
- **Tests:** utility pages, same-page anchors, query-distinct destinations,
  shared chrome, zero/one/two links and stable affected URLs.

### machine-discovery/no-broken-links

- **Scope / read:** first 20 distinct internal links from all pages, shared probes.
  Grade A. Empty input fails; no links warns; errors/400+ count as broken;
  majority broken fails, some warn, none pass.
- **Disposition:** present link feature, no candidate NA. Sort before sampling,
  expose omissions, separate unread from confirmed breakage, and describe the
  statuses actually accepted rather than claiming all successes are HTTP 200.
- **Tests:** 21-plus links reordered, refused URL, timeout, 404/redirect/204,
  no links and stable source/target attribution.

### machine-discovery/cors-ai-files

- **Scope / read:** root llms/catalog OPTIONS responses; first page only supplies
  attribution. Grade C/informative. Absent files warn; ACAO coverage sets bands.
- **Disposition:** adopted file plus browser cross-origin consumer context.
  Server-side clients do not need browser CORS. Empty rootFiles currently causes
  probes of both optional paths; origin values need more than a nonempty string.
- **Tests:** no files NA, restrictive/wildcard origins, OPTIONS versus GET,
  failed probe, partial artifacts and correct artifact URL attribution.

### machine-discovery/ai-file-delivery

- **Scope / read:** already-fetched root files' MIME/cache headers. Grade B,
  informative. No actual file NA; wrong MIME fails; uncached warns; otherwise pass.
- **Disposition:** retain artifact-content guard and HTML-shell exclusion.
  Attribute to artifact URLs, not the first page. Mounted/discovered alternate
  artifact paths require an explicit expansion of the current fixed-path sample.
- **Tests:** no artifacts, shell response, MIME parameters, validators/no-store,
  subpath sitemap and scanned-page order independence.

### machine-discovery/no-broken-ai-endpoints

- **Scope / read:** catalog/llms/navigation URLs, first 20 then safe probes.
  Grade A. None warns; all refused warns; all requested broken fails, some warn,
  otherwise passes. First page provides unrelated result attribution.
- **Disposition:** adopted endpoint feature; no endpoints NA. Do not infer
  documented consumption of every optional manifest. Normalize relative links
  against their source; expose refused/omitted/unread targets alongside requested ones.
- **Tests:** malformed manifests, relative links, mixed safe/refused targets,
  21-plus links, status zero, redirects and source-artifact evidence.

### machine-discovery/ai-crawler-surface-reachability

- **Scope / read:** origin robots rules versus advertised sitemaps/feeds and
  50 sitemap entries. Grade A. No surfaces NA; contradictions fail; explicit
  opt-outs warn even without a contradiction; otherwise pass.
- **Disposition:** retain path-specific rules and deliberate-opt-out distinction.
  Robots permission does not prove actual fetch reachability. Recheck score loss
  from the opt-out-only warning and retain partial-index coverage.
- **Tests:** intentional block, wildcard/named rules, foreign feed origin,
  no robots versus unread robots, incomplete sitemap and scope-preserving page reorder.

### machine-discovery/sitemap-lastmod-verifiability

- **Scope / read:** sitemap dates, six sampled URLs and page/header date signals.
  Grade A. No lastmod NA; future/contradictory dates fail; malformed/unverifiable
  dates warn; otherwise pass.
- **Disposition:** present date feature with sampled corroboration. Preserve
  unverified counts and distinguish fetch failure from a page with no date.
  Missing dateModified does not imply a required new field on every page type.
- **Tests:** unread samples, identical legitimate updates, future clock skew,
  unrelated page dates, malformed values and stable sample selection.

### machine-discovery/agent-commerce-feed-parity

- **Scope / read:** six sampled sitemap URLs, retaining Product or og:type=product
  candidates; two image HEAD checks. Grade A. No candidates NA; any mapping
  defect fails, risks warn, otherwise passes.
- **Disposition:** supported feed population, not every store. Existing declared
  products absent from the sitemap are ignored. Uses a first product node and
  merges requirements from two consumers; keep each consumer's contract explicit.
- **Tests:** product without sitemap, unenrolled store, related Product node,
  missing schema with independent purpose, failed samples and differing feed requirements.

### machine-discovery/conditional-request-support

- **Scope / read:** robots, at most four sitemap URLs and two feeds through
  shared revalidation. Grade B. No answered surface NA; missing/unstable/broken
  validators fail; cache/size issues warn; otherwise pass.
- **Disposition:** present discovery artifacts, independent of page purpose.
  Expose unread conditional attempts and unmeasured surfaces; do not claim every
  surface returned 304 from missing outcomes. Preserve the documented analogy limit.
- **Tests:** changing content, missing second/conditional response, ETag/Last-Modified
  combinations, mounted sitemap, absent files and deterministic capped selection.

### machine-discovery/feed-entry-identity-and-canonical-integrity

- **Scope / read:** two parsed feeds, first 20 entries each, five newest canonical
  probes. Grade B. No feeds NA; any identity/canonical defect fails, otherwise pass.
  Generic XML warnings live in details even on a pass.
- **Disposition:** feed-entry feature. Keep format-specific mandatory fields
  separate from policy preferences. Expose unparsed feeds and unread probes;
  do not mistake a probe failure for a proven bad canonical.
- **Tests:** RSS versus Atom requirements, equal-date sampling ties, redirect,
  tracking/canonical mismatch, valid media types, unread target and omitted entries.

### machine-discovery/root-text-file-resolution-integrity

- **Scope / read:** origin, two random missing-text probes and robots positive
  control. Grade B. No/safe-refused origin NA; catch-all/wrong control type fails;
  absent control warns; otherwise passes.
- **Disposition:** origin-resolution measurement, not page purpose. Missing
  random-probe results drop out, allowing zero probes to meet `absent.length ===
probes.length`. Require two observed negative controls before claiming reliability.
- **Tests:** zero/one/two failed probes, real absence, catch-all, redirected
  probe, missing robots, mixed origin/subpath and no network side effects beyond reads.

### machine-discovery/three-way-freshness-lag

- **Scope / read:** newest selected-page date, sitemap date and two feeds;
  five sitemap status probes. Grade B. Fewer than two date surfaces NA;
  lag/build mismatch fails, order/dead-URL issues warn, otherwise passes.
- **Disposition:** compare equivalent content populations before inferring lag.
  A newer product page need not appear in a blog feed. Report only the surfaces
  present; feed+sitemap alone currently permits a claim about page freshness.
- **Tests:** unrelated product/blog dates, missing page dates, unread feeds,
  identical population lag, malformed/future dates and partial indexes.

### machine-discovery/websub-hub-advertisement

- **Scope / read:** two feeds, each with up to two hub probes and self-link
  validation. Grade C/informative. No feeds NA; observations warn; otherwise pass.
- **Disposition:** optional WebSub adoption. A polling-only feed is not broken.
  Gate required self/hub coherence to adoption and retain unscored discovery advice.
- **Tests:** no feed/hub, adopted malformed self link, safe-refused/unread hub,
  valid method-specific statuses, multiple hubs and explicit sampled coverage.

## Access policy and interface review

This pass adds all 37 access-crawl-control and all 24 agent-interfaces audits.
The bot-policy rows share `_crawler-bot-audit.ts`; Anthropic and Meta add their
own policy details. Root-policy verdicts are not page-access measurements.
Interface checks use artifact or endpoint evidence regardless of HTML page type.
The MCP rows also read `gatherers/mcp.ts`; its first-endpoint discovery and partial
listing behavior affect all consumers. A defect noted below is pending unless the
execution record explicitly identifies a completed correction.

### access-crawl-control/gptbot

- **Scope / read:** Origin robots policy evaluated at `/` for GPTBot training crawler. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/google-extended

- **Scope / read:** Origin robots policy evaluated at `/` for Google-Extended usage-control token. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/anthropic-ai

- **Scope / read:** Origin robots policy evaluated at `/` for ClaudeBot training crawler; legacy anthropic-ai and Claude-Web names remain diagnostic only. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/perplexitybot

- **Scope / read:** Origin robots policy evaluated at `/` for PerplexityBot; review the training/search grouping separately from path access. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/applebot-extended

- **Scope / read:** Origin robots policy evaluated at `/` for Applebot-Extended usage-control token. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/ccbot

- **Scope / read:** Origin robots policy evaluated at `/` for CCBot. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/meta-external-agent

- **Scope / read:** Origin robots policy evaluated at `/` for Meta-ExternalAgent; its override adds named-policy details. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/amazonbot

- **Scope / read:** Origin robots policy evaluated at `/` for Amazonbot. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/chatgpt-user

- **Scope / read:** Origin robots policy evaluated at `/` for ChatGPT-User; keep the dossier's no-proven-consumer limitation unscored. Grade C; informative tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/claude-user

- **Scope / read:** Origin robots policy evaluated at `/` for Claude-User. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/oai-searchbot

- **Scope / read:** Origin robots policy evaluated at `/` for OAI-SearchBot. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/meta-external-fetcher

- **Scope / read:** Origin robots policy evaluated at `/` for Meta-ExternalFetcher. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/bravebot

- **Scope / read:** Origin robots policy evaluated at `/` for Bravebot; keep the current informative limit. Grade C; informative tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/duckassistbot

- **Scope / read:** Origin robots policy evaluated at `/` for DuckAssistBot. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/mistralai-user

- **Scope / read:** Origin robots policy evaluated at `/` for MistralAI-User. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/claude-searchbot

- **Scope / read:** Origin robots policy evaluated at `/` for Claude-SearchBot. Grade A; scored tier.
- **Current aggregation / absence:** Absent/non-200/empty or unparseable robots data returns NA. Effective root allowance passes; a root block fails. Named groups and wildcard inheritance use the shared robots parser.
- **Disposition:** Retain origin policy scope independent of page purpose. Label the tested path. Root allowance cannot establish access to each sampled URL. Usage-control tokens must not become network impersonation probes. A publisher may intend a restriction.
- **Tests:** Named/wildcard precedence, absent policy, root allowed with deep URL blocked and the reverse; unchanged outcome across page labels. Add token-specific legacy/control cases where relevant.

### access-crawl-control/no-nofollow

- **Scope / read:** Robots metadata and X-Robots-Tag on every selected page, including empty-body pages. Grade A; scored tier.
- **Current aggregation / absence:** After this slice: no directives pass, some warn, all fail; empty sample NA. Sorted affected URLs and bounded text identify the sample.
- **Disposition:** Keep page scope. This slice fixes scope reporting and removes site-wide/individual-link claims. Token parsing, `none`, named-bot directives and legitimate utility-page exclusions remain open.
- **Tests:** Empty input, permutations, long URLs and actual runner output across four types and both provenance values now pass. Add token/utility cases with their predicate correction.

### access-crawl-control/no-redirect-chains

- **Scope / read:** Requested and final URLs of selected page fetches. Grade A; scored tier.
- **Current aggregation / absence:** Empty input fails. More than half the pages redirected fails; fewer warns; no observed redirect passes. It counts redirected pages, not redirect hops.
- **Disposition:** Use per-fetch evidence for a common access check. Measure hop count before claiming a chain; the dossier allows a single redirect. Preserve failed/refused fetch coverage and distinguish normal canonical upgrades.
- **Tests:** HTTP-to-HTTPS single hop, two-plus hops, redirect refusal, empty input, mixed outcomes and stable URL attribution.

### access-crawl-control/canonical

- **Scope / read:** Canonical markup across selected pages, including cross-page root/target collapse. Grade A; scored tier.
- **Current aggregation / absence:** Empty input NA. Invalid/root-collapse findings fail; missing/conflicting/off-site/shared targets warn. A lone same-site non-self target can pass with a self-reference claim.
- **Disposition:** Keep page canonical declarations and cross-page equivalence separate. Valid duplicate aliases need not self-canonicalize. Review normalization that drops query/case distinctions before judging collapse.
- **Tests:** Single non-self canonical, legitimate duplicates, URL case/query variants, partial declarations, conflicting nodes and page permutations.

### access-crawl-control/ai-bot-directives

- **Scope / read:** Root robots rules for five long-tail tokens. Grade B; scored tier.
- **Current aggregation / absence:** Absent/unparseable policy NA. YouBot and AI2Bot root blocks decide failure; Bytespider, cohere-ai and Diffbot remain advisory. Named or inherited allowance passes.
- **Disposition:** Keep supported consumers separate from the advisory population. Root policy is independent of page purpose and does not prove deep-path access.
- **Tests:** Each scored/advisory token alone, wildcard inheritance, named exceptions and root/deep-path disagreement.

### access-crawl-control/no-blanket-block

- **Scope / read:** Wildcard robots policy at `/`. Grade B; scored tier.
- **Current aggregation / absence:** Missing robots warns; wildcard root block fails; otherwise passes. The result can claim all crawlers are blocked despite named allow groups.
- **Disposition:** Absent optional robots policy should not be a defect. Resolve named exceptions before a site-wide statement. Keep policy intent separate from actual sampled-page access.
- **Tests:** Missing file, wildcard block plus named allow, root-only versus deep blocks and malformed policy.

### access-crawl-control/sensitive-paths

- **Scope / read:** Observed utility routes from scanned URLs, same-host links and shared sitemap entries. Grade A; scored tier.
- **Current aggregation / absence:** No candidates NA. All AI tokens blocked at root also returns NA. All observed families blocked pass; partial coverage warns; none fails.
- **Disposition:** Retain observed-feature scope, not hypothetical admin paths. Root block can have deeper Allow exceptions. The dossier opening still implies security protection; robots rules are not authorization. Preserve locale/mount prefixes.
- **Tests:** No utility routes, nested/localized routes, duplicate family prefixes, root block with deep Allow, legitimate publicly useful pages and sitemap-only candidates.

### access-crawl-control/crawl-delay

- **Scope / read:** Crawl-delay values across robots groups. Grade C; informative tier.
- **Current aggregation / absence:** Missing robots warns; no delay passes; any delay above 10 seconds fails.
- **Disposition:** Optional adopted directive; absence NA. Keep the consumer limit unscored and associate delay with its bot group. An unrelated crawler setting cannot establish an AI access defect.
- **Tests:** Absent file/directive, unrelated bot delay, supported consumer values, malformed numbers and group inheritance.

### access-crawl-control/robots-directives

- **Scope / read:** Parsed page metadata and headers; utility-route heuristic changes noindex handling. Grade A; scored tier.
- **Current aggregation / absence:** Empty pages NA. Non-utility noindex/none fails; snippet/archive restrictions warn; permitted directives pass.
- **Disposition:** Retain per-page policy scope with independent utility-purpose evidence. Do not attribute a named-bot directive to all consumers. Stable representative URLs must replace page-order choice.
- **Tests:** Localized/custom utility routes, general pages, named directives, empty-body metadata, conflicting channels and reordered samples.

### access-crawl-control/no-bot-detection

- **Scope / read:** Global WAF/rate observations plus challenge patterns and readable text on selected pages. Grade A; scored tier.
- **Current aggregation / absence:** 429 NA; global blocked WAF fails; empty pages warn. Challenge patterns on unreadable pages warn; readable pages can pass despite embedded challenge scripts.
- **Disposition:** Distinguish baseline response access from access by specific bots. Readable text does not prove a widget guards only forms, and one global flag must not erase mixed page evidence.
- **Tests:** Readable page plus blocked page, empty read, rate limit, form-only challenge, hidden challenge text and page order.

### access-crawl-control/https-enabled

- **Scope / read:** Input base URL scheme and first selected page status. Grade A; scored tier.
- **Current aggregation / absence:** HTTP input fails. HTTPS plus first status 200 passes; other or absent first response warns using homepage wording.
- **Disposition:** Check observed fetch/TLS evidence at the relevant URL. A deep entry is not a homepage; an input HTTP URL may redirect to HTTPS. No fetched response cannot prove a transport defect.
- **Tests:** Deep entry, HTTP upgrade, HTTPS error, no pages, mixed final schemes and requested/final URL distinction.

### access-crawl-control/tdm-rep

- **Scope / read:** First page carrying a reservation header, otherwise root policy file, otherwise all page meta values. Grade C; experimental tier.
- **Current aggregation / absence:** No declaration NA. Valid 0 and 1 declarations pass as reported policy; invalid values warn. Different file/meta values warn without preserving their resource scopes.
- **Disposition:** Retain optional unscored policy reporting. Keep page URL and file location attached to each value. Different permissions on different pages are not automatically contradictory; header-first selection currently hides other pages.
- **Tests:** Two pages with different valid reservations, mixed valid/invalid headers, disjoint file locations, channel precedence on one URL and absent adoption.

### access-crawl-control/agent-governance

- **Scope / read:** Named training/realtime robots groups and root allowance. Grade A; scored tier.
- **Current aggregation / absence:** Absent policy and unnamed permissive catch-all NA. Named coverage across categories or differing category allowance can pass; other named cases warn; unnamed blanket block fails.
- **Disposition:** Describe policy control, not a mandatory number of bot groups. Equivalent effective policies should not change quality merely because one spells out extra names. Keep intentional restrictions explicit.
- **Tests:** Equivalent wildcard/named policies, intentional broad deny, category-specific rules, duplicate groups and deep Allow exceptions.

### access-crawl-control/ai-content-declaration

- **Scope / read:** Origin Content-Usage and page headers/meta conventions. Grade D; experimental tier.
- **Current aggregation / absence:** Any AIPREF declaration passes ahead of opt-out-convention warnings; no declaration NA.
- **Disposition:** Optional declaration presence only. Preserve each channel/resource and avoid implying syntax validity or consumer enforcement. Keep grade D experimental status; validity belongs to its separate audit.
- **Tests:** Absent convention, malformed adopted declaration, different pages/channels, opt-out beside a preference and stable provenance.

### access-crawl-control/robots-ai-group-shadowing

- **Scope / read:** Named robots groups compared with wildcard over rule literals, root and selected page paths, capped at 200. Grade A; scored tier.
- **Current aggregation / absence:** Absent robots NA. Empty named groups/shadowed protections fail; a named root block can warn; no divergence passes.
- **Disposition:** Origin policy comparison with path evidence. The implementation does not sample sitemap paths despite dossier wording. Different groups can encode intent; do not label every difference unintended. Stabilize capped samples.
- **Tests:** Intentional named overrides, empty named groups, wildcard rules, glob-derived probes, 200-plus paths and page order.

### access-crawl-control/ai-crawler-edge-parity

- **Scope / read:** Shared UA probes of root, bounded sitemap URLs and llms.txt when served. Grade A; scored tier.
- **Current aggregation / absence:** No probes or no successful baseline NA. Robots-consistent blocks become notes; hard deltas fail; ambiguous deltas warn; otherwise pass.
- **Disposition:** Per-URL probe comparisons independent of page type. Exclude unusable baselines per pair, not only when all baselines fail. Impersonated UA results do not establish verified crawler behavior. Expose sample and unknown policy.
- **Tests:** One failed baseline among good pairs, deliberate path block, unknown robots, mounted URL, missing probes and limited sitemap coverage.

### access-crawl-control/bot-content-delta-declared

- **Scope / read:** Bounded sitemap UA comparisons and paywall schema with resolving selectors. Grade A; scored tier.
- **Current aggregation / absence:** No sitemap sample or comparable responses NA. Undeclared qualifying deltas fail; accepted declaration or no measured delta passes.
- **Disposition:** Gate comparisons to the same URL and readable variants. Keep the paywall consumer population explicit; text-ratio change alone does not establish harmful cloaking. Report sampled coverage.
- **Tests:** Localized/personalized responses, paywall/non-paywall variants, broken selectors, unread probe and pages absent from sitemap.

### access-crawl-control/ai-usage-signal-coherence-across-channels

- **Scope / read:** Robots, page Content-Usage/Content-Signal/TDM/meta and RSL declarations normalized into category/agent/scope. Grade B; scored tier.
- **Current aggregation / absence:** No declarations NA; cross-channel opposite values over overlapping scopes fail. Page declarations can default to `/`; same-channel pairs are skipped.
- **Disposition:** Preserve resource scope before comparison. Different page policies must not become origin-wide contradictions. Fetch permission and usage permission need distinct meanings. Line order alone cannot identify CDN ownership.
- **Tests:** Opposite policies on disjoint pages, same-page conflict, agent-specific rules, path boundaries, same-channel contradictions and partial reads.

### access-crawl-control/aipref-content-usage-declaration-validity

- **Scope / read:** Robots and page header preference dictionaries plus robots crawlability. Grade B; scored tier.
- **Current aggregation / absence:** No adopted declarations NA. Syntax/conflict/all-inert findings fail; legacy or partly inert values warn. Header scope defaults to root; cross-channel conflict comparison omits agent overlap.
- **Disposition:** Share scoped declaration reading with coherence checks. A page header must retain its URL. Distinguish malformed adoption, inaccessible preference and deliberate blocking; advice must not prescribe opening protected paths.
- **Tests:** Disjoint page preferences, named-bot versus global scope, valid/invalid mixtures, same-path contradictions and missing policy.

### access-crawl-control/rsl-licensing-terms-conformance

- **Scope / read:** Advertised/fallback RSL documents, page inline licenses and all selected URL paths. Grade B; scored tier.
- **Current aggregation / absence:** No candidates NA, including some invalid-advertisement-only cases. Each license is compared with every selected page. Conformance/fetch findings fail; clean documents pass.
- **Disposition:** Optional license feature. Bind a page-advertised license to its advertised population. Retain host and resource scope; a license for one page need not cover every page. Unread licenses are not proven malformed.
- **Tests:** Independent page licenses, foreign-host content prefixes, malformed advertised URI, one unread license, fallback absence and capped/deduplicated candidates.

### access-crawl-control/machine-actionable-402-paid-access

- **Scope / read:** Shared root/sitemap/llms UA responses with 402 and advertised/inline payment mechanisms. Grade B; scored tier.
- **Current aggregation / absence:** No observed 402 NA. Missing machine payment fails; payable responses with issues warn; all observed payable responses pass.
- **Disposition:** Response-level paid-access feature. Do not claim a whole site never charges from a bounded sample. Resolve advertised license coverage before treating an unread license as absent payment. A browser baseline is scanner evidence, not proof of all human traffic.
- **Tests:** Free pages plus paid page, page-scoped RSL, unread external license, malformed price/challenge, duplicate baseline observations and cache directives.

### access-crawl-control/web-bot-auth-request-tolerance

- **Scope / read:** Unsigned and signed probes at the origin root. Grade B; scored tier.
- **Current aggregation / absence:** Unsafe/unusable baseline NA. Signed fetch failure, selected rejection statuses or body collapse fail; negotiated auth passes; otherwise warns on differing uncached variants or passes.
- **Disposition:** Common root transport tolerance, independent of page purpose. A length/status match is not exact body equality. Failure to fetch is not proof that signature headers caused refusal. Preserve path and sample limits.
- **Tests:** Missing signed response, auth negotiation, same-size different body, transient status changes, deep-only rules and valid Vary token handling.

### agent-interfaces/openapi-exists

- **Scope / read:** Root API catalog/spec files or the first advertised spec link on selected pages. Grade B; informative tier.
- **Current aggregation / absence:** Any recognized catalog/spec passes; malformed JSON spec or unverifiable link warns; no API surface NA. YAML and JSON absence/defect handling differ.
- **Disposition:** Optional API discovery feature, not a page-purpose requirement. Use the same discovered artifact set as content audits; current content readers do not follow every discovery route. Resolve page-relative links against their page.
- **Tests:** No API, catalog-only, linked/YAML specs, malformed artifacts, multiple advertisements, page-relative URL and unread advertised target.

### agent-interfaces/openapi-endpoints

- **Scope / read:** Shared OpenAPI reader and surviving path operations. Grade B; scored tier.
- **Current aggregation / absence:** Absent spec NA; malformed paths or no operations fail; surviving operations pass with defect notes.
- **Disposition:** Retain adopted-spec scope and partial-read semantics. Align with discovery routes and retain operation/path attribution. HTML page type must not decide applicability.
- **Tests:** Absent/malformed/empty paths, valid operations beside bad entries, linked spec discovery and identical artifact across page labels.

### agent-interfaces/openapi-operation-ids

- **Scope / read:** Operation IDs in the shared spec reader. Grade B; scored tier.
- **Current aggregation / absence:** Absent spec or empty operation set NA; malformed paths/illegal names fail; missing/duplicate IDs warn; valid IDs pass.
- **Disposition:** Feature scope is declared operations. Tool-name restrictions need the documented converter population; an OpenAPI ID need not be a universal vendor tool name. Keep unread entries separate.
- **Tests:** Missing/duplicate/illegal IDs, multiple converters, malformed paths with valid survivors and no operations.

### agent-interfaces/openapi-servers

- **Scope / read:** First nonempty URL in the spec servers array and a shared GET probe. Grade B; scored tier.
- **Current aggregation / absence:** No spec NA. Missing servers/URL fails; reachable first server passes; unreachable or other status warns.
- **Disposition:** Optional API feature. Review spec defaults, relative URLs, variables and version-specific server models before requiring an absolute top-level server. One sampled server cannot certify every declared server.
- **Tests:** Relative/default servers, variables, Swagger versus OpenAPI, multiple servers, unsafe URL and unavailable probe.

### agent-interfaces/openapi-schemas

- **Scope / read:** Request/response schema presence across surviving operations. Grade B; scored tier.
- **Current aggregation / absence:** Absent spec/empty operations NA; malformed paths fail. Full coverage passes, at least half warns, lower coverage fails.
- **Disposition:** Operation feature; distinguish methods needing bodies and responses carrying content. References and legitimate no-content responses must not become missing schemas. The first content-bearing response currently ends the search.
- **Tests:** 204 responses, bodyless writes, references, multiple response orderings and malformed entries beside valid operations.

### agent-interfaces/openapi-description-quality

- **Scope / read:** Descriptions on operations and parameters gathered from a parsed spec. Grade A; scored tier.
- **Current aggregation / absence:** No spec/checkable items NA; 90% coverage passes, 50% warns, lower fails. Length above 15 characters defines described.
- **Disposition:** Tool-conversion consumer population. Presence/length is a heuristic, not proof of quality. Report actual coverage; review reference resolution and shared path parameters.
- **Tests:** Referenced/inherited parameters, short informative text, long boilerplate, malformed paths, multilingual descriptions and stable missing labels.

### agent-interfaces/ai-catalog-exists

- **Scope / read:** Shared ARD reader at the well-known path plus page link/header advertisements. Grade C; informative tier.
- **Current aggregation / absence:** Absent/HTML without advertisement fails; advertised absence warns. Malformed JSON/shape fails; empty entries warn; nonempty manifest passes.
- **Disposition:** Optional catalog feature; absence should be neutral. Preserve advertised-but-broken findings. Dossier history claims grade A while current frontmatter/code are C informative; reconcile authority before any grade move.
- **Tests:** Unadopted site, advertised missing file, catch-all HTML, malformed manifest, empty entries and multiple page advertisements.

### agent-interfaces/ai-catalog-metadata

- **Scope / read:** Host and entry metadata in the shared ARD manifest. Grade B; scored tier.
- **Current aggregation / absence:** No readable manifest or entries NA. No indexed annotations fails; missing host display name/thin entries warn; otherwise pass.
- **Disposition:** Retain adopted-catalog population. Readable entries need not disappear with unrelated malformed data. Distinguish spec-required fields from optional metadata useful to the documented indexer.
- **Tests:** No catalog, partial malformed entries, host-only defect, inline/linked entries, optional metadata and stable labels.

### agent-interfaces/ai-catalog-urls

- **Scope / read:** Safely resolved linked ARD entry URLs via pooled shared probes. Grade B; scored tier.
- **Current aggregation / absence:** No manifest or no linked entries NA. All reachable pass, some warn, none fail; inline entries are skipped.
- **Disposition:** Linked-entry feature. Resolve references against the artifact location and distinguish protected, refused and unread targets from broken links. Document status handling instead of the dossier opening's blanket HTTP 200 rule.
- **Tests:** Inline-only entries, relative references, auth-protected services, malformed/private URL, mixed probe failures and duplicate URLs.

### agent-interfaces/agents-json

- **Scope / read:** Optional root agents.json document. Grade C; informative tier.
- **Current aggregation / absence:** No file/empty/non-200 NA; published HTML, malformed JSON/shape or HTML media type warns; recognized document passes.
- **Disposition:** Keep optional artifact validation unscored. Do not infer need from app/page type. Current shape validation is shallow and not an end-to-end service reachability proof.
- **Tests:** Unadopted site, empty arrays, malformed source/flow entries, catch-all HTML and blocked artifact fetch.

### agent-interfaces/mcp-discovery

- **Scope / read:** Root servers.json, otherwise UCP profile. Grade C; informative tier.
- **Current aggregation / absence:** No document NA; malformed/empty declarations fail; nonempty server/service/capability lists pass.
- **Disposition:** Optional published discovery feature, unscored. UCP capabilities alone are not proof of an MCP server. First-document precedence can hide a valid alternative or an additional defective declaration.
- **Tests:** Multiple discovery routes, commerce-only UCP, malformed server entries, catch-all HTML and unread artifacts.

### agent-interfaces/mcp-endpoint

- **Scope / read:** First endpoint from shared MCP discovery, legacy initialize and optional tools/list. Grade C; informative tier.
- **Current aggregation / absence:** No endpoint or malformed declaration fails. Auth challenge passes; invalid reply/no capability or missing annotations warns; successful handshake passes, even if tools/list cannot be read.
- **Disposition:** Optional MCP feature; absent declaration should be NA. Consolidate reachability with the modern check without letting legacy probes penalize supported modern servers. Discovery currently treats a server-card URL as an endpoint and stops at a malformed earlier source.
- **Tests:** No adoption, alternate valid declaration, card versus endpoint, protected server, modern-only endpoint and incomplete tools/list.

### agent-interfaces/search-endpoint

- **Scope / read:** SearchAction from selected pages or a GET search operation in OpenAPI. Grade C; informative tier.
- **Current aggregation / absence:** Verified result-bearing SearchAction or matching operation passes; defective/gated/no-action WebSite warns; no declaration fails.
- **Disposition:** Optional search feature. A WebSite node alone does not imply site search. A valid empty result set for the arbitrary query `test` is not proof of a defective endpoint. Keep declaration and runtime proof distinct.
- **Tests:** No search, legitimate zero results, advertised malformed template, relative URL, multiple actions and OpenAPI-only declaration.

### agent-interfaces/webmcp-registered-tools

- **Scope / read:** Inline script patterns and declarative form markers across pages. Grade B; experimental tier.
- **Current aggregation / absence:** Observed tool names pass; API reference without names warns; declarative-only or no static signal NA.
- **Disposition:** Retain experimental static-observation scope. Source text does not prove runtime registration. Keep page/name associations; external bundles and runtime conditions remain unobserved.
- **Tests:** Unexecuted source, external script, per-page duplicate names, declarative-only forms, multiple pages and absent feature.

### agent-interfaces/webmcp-declarative-forms

- **Scope / read:** All forms across selected pages plus declarative WebMCP attributes. Grade B; scored tier.
- **Current aggregation / absence:** No forms/no annotation NA. Any adoption makes all forms the denominator; none named fails, partial names/descriptions warn, all complete pass.
- **Disposition:** Gate at the adopted form, not the whole site. A search form exposing a tool must not force a newsletter or payment form on another page to adopt. Grade B remains unchanged.
- **Tests:** One complete adopted form beside an ordinary form, malformed adopted form, duplicate names per page, description gaps and no adoption.

### agent-interfaces/cors-api-routes

- **Scope / read:** Endpoints resolved by a separate /openapi.json reader and probed for CORS. Grade C; informative tier.
- **Current aggregation / absence:** No spec/resolvable endpoints NA. Any wildcard endpoint passes; named/no headers or unread probes warn.
- **Disposition:** Browser-origin consumer only; retain informative status. One wildcard endpoint does not establish access to every API route or credentialed operation. Share artifact resolution and report per-route methods/coverage.
- **Tests:** Mixed CORS routes, protected endpoints, exact named origins, methods/headers, unsafe targets and other spec discovery routes.

### agent-interfaces/mcp-modern-era-reachability

- **Scope / read:** First declared endpoint; discover, GET, DELETE and legacy fallback probes. Grade A; scored tier.
- **Current aggregation / absence:** No endpoint NA; selected protocol failures fail; auth/older revision/residue warns; accepted configured revision passes.
- **Disposition:** Endpoint feature, independent of page purpose. Align source revision, negotiated protocol and consumer support before score changes. Discovery-channel limits and missing negative probes must remain visible; do not certify unobserved methods.
- **Tests:** No declaration, protected endpoint, mixed supported revisions, missing GET/DELETE, malformed discovery and modern-only server.

### agent-interfaces/mcp-oauth-discovery-chain

- **Scope / read:** Declared endpoint challenge, resource metadata and bounded authorization-server metadata reads. Grade A; scored tier.
- **Current aggregation / absence:** No endpoint/unreachable NA; public endpoint without PRM NA. Broken mandatory chain fails; recommended fields warn; otherwise passes.
- **Disposition:** Authorization feature, not a requirement for every MCP server. Preserve challenge status, metadata validity and sample limits; malformed advertised metadata cannot silently become legitimate public absence.
- **Tests:** Public/no-auth, challenged missing metadata, advertised malformed metadata, alternate issuers, bounded issuer list and unsafe URL.

### agent-interfaces/mcp-tool-contract-validity

- **Scope / read:** Shared paginated tools/list and object tool definitions. Grade A; scored tier.
- **Current aggregation / absence:** No endpoint/no retained tools NA. Structural mandatory failures fail, naming issues warn, otherwise passes. The gatherer drops non-object entries and returns partial lists on read failure.
- **Disposition:** Tool-definition feature. Distinguish absent capability, auth/unread listing and malformed returned entries. Report partial coverage. Recheck schema constraints before asserting every required key absent from properties invalidates all calls.
- **Tests:** Resource-only server, malformed entries beside valid tools, failed next page, schema references/pattern properties, duplicate names and invalid header annotations.

### agent-interfaces/mcp-tools-list-determinism

- **Scope / read:** Repeated paginated tools/list calls with cache metadata and definition hashes. Grade A; scored tier.
- **Current aggregation / absence:** No initial tools NA. Cache findings fail, differences warn, otherwise passes. Later failed calls stop the loop, yet pass wording still claims all configured calls answered.
- **Disposition:** Observed tool-list feature. Require enough completed comparable calls for stability claims. Zero TTL validity and caching cost need separate treatment; expose missing/partial reads without inventing determinism.
- **Tests:** One of three calls answered, failed later page, changing tools/order/serialization, zero TTL, private cache scope and legitimate timed updates.

### agent-interfaces/mcp-version-downgrade

- **Scope / read:** Three version probes against the first declared endpoint plus advertised revisions. Grade A; scored tier.
- **Current aggregation / absence:** No endpoint/first unanswered probe NA. Unsupported/mismatch defects fail or warn. Missing later responses do not prevent a pass claiming mismatch rejection.
- **Disposition:** Endpoint protocol feature. Grade only responses read; authentication and unsupported-era responses need applicability before conformance claims. Separate incomplete probes from server violations.
- **Tests:** Only first probe answered, auth challenge, protocol error inside HTTP 200, missing advertised revisions and header/body mismatch.

### agent-interfaces/mcp-origin-validation-cors

- **Scope / read:** Baseline discover, arbitrary Origin and OPTIONS at a declared endpoint. Grade B; scored tier.
- **Current aggregation / absence:** No endpoint/baseline NA. Reflected credentialed or wildcard authenticated surfaces fail; no differentiation may warn; otherwise passes.
- **Disposition:** Endpoint/browser-origin feature. Missing Origin/preflight reads cannot prove a policy. Header tokens, bearer versus ambient credentials and legitimate same-status rejections need source-bound semantics.
- **Tests:** Missing probes, same status with different body, explicit Authorization policy, exact allowed origin, malformed token substrings and protected baseline.

### agent-interfaces/mcp-registry-listing-ownership

- **Scope / read:** Domain/brand registry searches, matching remote domains and apex ownership proof. Grade B; scored tier.
- **Current aggregation / absence:** No endpoint/domain NA. No listings, missing proof or third-party-only ownership can fail; other listing issues warn; otherwise passes. Failed registry fetches look like no listing.
- **Disposition:** Separate optional registry adoption from MCP endpoint existence. The dossier admits its Evidence block belongs to unrelated audits; observable registry data alone does not establish a consumer penalty. Resolve this before 7.0.0 scoring. No grade changed in this slice.
- **Tests:** Unlisted working server, registry outage, subdomain/hosted service ownership, malformed versus absent proof, GitHub namespace and stale listing.

### agent-interfaces/mcp-tool-description-coverage

- **Scope / read:** Shared tool definitions and recursive parameter descriptions, plus discover instructions. Grade B; scored tier.
- **Current aggregation / absence:** No endpoint/tools NA. Coverage thresholds fail; stub text or absent instructions warns; otherwise passes. Truncation is reported, but unread tool entries disappear in the gatherer.
- **Disposition:** Observed tool feature. Distinguish optional instructions, required descriptions and heuristic length. Keep thresholds/claims consistent: a threshold pass cannot claim every tool is described unless coverage is 100%.
- **Tests:** Partial/unread listing, references and nested required parameters, concise descriptions, absent optional instructions and coverage at each threshold.

## Remaining page, commerce and operability review

This pass covers the remaining four structured-data, 19 answer-readiness,
three agentic-commerce and 45 operability-safety registrations. Accessibility
wrappers were traced through `_shared.ts`, `runner.ts` and `engine/rules.ts`:
their per-element match rules and shared page aggregation supply applicability,
not the wrapper metadata alone. These are static HTML observations; they do
not establish runtime browser conformance or a full security certification.

### structured-data/json-ld-present

- **Scope / read:** Parsed JSON-LD blocks pooled across selected pages. Grade A; scored tier.
- **Current aggregation / absence:** Any block passes; no blocks or no pages fail.
- **Disposition:** Distinguish site-level detection from page-level obligations. Valid alternative encodings and pages without a supported structured-data use case must not inherit a JSON-LD requirement. Keep malformed-present separate from absent.
- **Tests:** Empty sample, Microdata/RDFa-only page, unrelated schema on another page and eligible entity missing all markup.

### structured-data/schema-validation

- **Scope / read:** Flattened structured-data nodes, excluding graph wrappers and reference-only nodes. Grade A; scored tier.
- **Current aggregation / absence:** No nodes fail; any retained node without context/type fails; otherwise passes.
- **Disposition:** Adopted structured-data feature; absence NA. Validate inherited context and node/reference semantics before requiring fields on each flattened object. Current pass is not full schema validation.
- **Tests:** Absent markup, inherited graph context, reference-only objects, invalid JSON beside valid nodes and page permutations.

### structured-data/faqpage-schema

- **Scope / read:** Pages selected by question-shaped headings; FAQPage presence. Grade C; informative tier.
- **Current aggregation / absence:** No matching pages warns; all FAQ-covered pass, some warn, none fail.
- **Disposition:** Keep informative. Question headings do not establish the specialist FAQ rich-result population. No eligible FAQ feature should be NA; avoid unsupported answer-priority claims.
- **Tests:** Non-FAQ question heading, genuine FAQ without markup, no questions, malformed FAQ markup and mixed pages.

### structured-data/claimreview-advisory

- **Scope / read:** ClaimReview nodes and counts per selected page. Grade A; informative tier.
- **Current aggregation / absence:** No adopted markup NA. Missing fields, rating labels or multiple nodes warn; otherwise passes.
- **Disposition:** Retain advisory artifact scope. Separate currently supported consumer shape from historical Search eligibility. Stabilize node/URL examples and associate defects with their own page.
- **Tests:** No adoption, valid and defective nodes on different pages, multiple reviews, rating formats and stable affected URL.

### answer-readiness/meta-description

- **Scope / read:** Description, title and H1 of the first selected page. Grade B; scored tier.
- **Current aggregation / absence:** Absent description fails, length/prose/topic heuristics warn, otherwise passes; empty pages fail.
- **Disposition:** Common page metadata, with current first-page limit explicit in the dossier. Revise that scope deliberately or bind an explicit entry identity; never silently let reorder choose it. Length and token overlap are heuristics.
- **Tests:** Mixed descriptions and permutations, empty sample, non-English prose, synonyms with no shared term and utility-page population.

### answer-readiness/unique-meta

- **Scope / read:** Title/description pairs after first-page-per-canonical deduplication. Grade C; informative tier.
- **Current aggregation / absence:** Fewer than two canonical pages NA; duplicate pairs fail; unique pairs pass.
- **Disposition:** Cross-page comparison of genuinely distinct resources. Dropping every query can merge distinct products; first representative selection is order-sensitive. Keep unscored and distinguish empty metadata from duplicate content.
- **Tests:** Canonical aliases, query-selected resources, missing values, multilingual equivalents and reordered duplicate groups.

### answer-readiness/core-open-graph

- **Scope / read:** Core OG metadata and optional site name on the first page; Twitter tags reported only. Grade A; scored tier.
- **Current aggregation / absence:** All core tags plus site name pass; partial core/missing site name warn; no core tags or pages fail.
- **Disposition:** Common share-preview population with an explicit current entry-page dossier limit. Keep optional site name separate from core fields. Review wider page aggregation before changing it.
- **Tests:** Empty sample, later-page defect, placeholders, multiple OG images, optional site name and stable entry identity.

### answer-readiness/og-type

- **Scope / read:** First-page og:type plus URL substring article heuristic. Grade B; scored tier.
- **Current aggregation / absence:** Missing/empty sample fails; blog-like path with non-article type warns; any other nonempty value passes.
- **Disposition:** Use independent purpose evidence instead of `/blog`, `/post` or `/article` substrings. A blog index is not necessarily an article. Limit claims to the documented preview consumer.
- **Tests:** Blog index, posting form, article outside blog paths, invalid type, missing tag and reordered page sample.

### answer-readiness/og-image-alt

- **Scope / read:** First-page og:image and og:image:alt. Grade C; informative tier.
- **Current aggregation / absence:** No image warns despite not-applicable wording; image with alt passes, image without alt fails.
- **Disposition:** Optional adopted image metadata; no image NA. Keep informative. Match alt with the corresponding image rather than flattening multi-image properties.
- **Tests:** No image/pages, multiple images with partial alt, blank alt, later-page image and bounded text.

### answer-readiness/faq-sections

- **Scope / read:** FAQ schema, heading/summary text and FAQ-like class/id markers across pages. Grade C; informative tier.
- **Current aggregation / absence:** Any matching page passes immediately; no match or no pages fails.
- **Disposition:** Optional FAQ presence advisory. Do not require FAQs on every site or equate a class token with readable answers. Stable sample evidence must name what was observed.
- **Tests:** No FAQ purpose, FAQ label without answers, translated labels, class false positives and multiple matching pages.

### answer-readiness/question-headings

- **Scope / read:** H2/H3 headings ending with a question mark across the sample. Grade C; informative tier.
- **Current aggregation / absence:** Two or more pass, one warns, zero/empty fails; URL is the first page.
- **Disposition:** Optional writing-style advisory, not a general page obligation. Do not let unrelated pages pool counts into a page-quality claim. Keep grade C and name the actual heading population.
- **Tests:** No heading/question feature, one question on each of two pages, translated punctuation, rhetorical heading and source URL.

### answer-readiness/specific-numbers

- **Scope / read:** Numeric patterns in main text across selected pages. Grade B; scored tier.
- **Current aggregation / absence:** Any matching page passes; no numeric match/empty sample fails, attributed to the first page.
- **Disposition:** Restrict the empirical claim to content where quantitative facts are relevant. A privacy/contact or qualitative explanation must not invent statistics. Preserve unsupported populations unscored pending evidence.
- **Tests:** Qualitative versus quantitative pages, product price versus unrelated date, locale number formats, boilerplate numbers and matching-page attribution.

### answer-readiness/content-without-clickthrough

- **Scope / read:** Teaser phrases across pages; otherwise word count of the first non-root/non-XML page. Grade B; scored tier.
- **Current aggregation / absence:** Two phrase patterns on a page fail; short chosen page warns; unread text NA; otherwise pass. Empty sample fails.
- **Disposition:** Feature/purpose eligibility must distinguish listing teasers from withheld article answers. Readability belongs to the judged page, not unrelated scan evidence. Stable sampling replaces first eligible choice.
- **Tests:** Product/category cards, full article with legitimate download link, short utility page, mixed readable/unread pages and reorder.

### answer-readiness/about-credentials

- **Scope / read:** First about-like cached page or root-path probe; English credential words in raw HTML. Grade C; informative tier.
- **Current aggregation / absence:** No candidate fails; two keywords pass, one or none warn.
- **Disposition:** Site-identity advisory with language and probe limits. Missing conventional paths do not establish no about page; words in scripts do not establish credentials. Keep informational status.
- **Tests:** Localized linked about page, catch-all shell, unavailable probe, keyword in script and equivalent identity content under another route.

### answer-readiness/brand-name

- **Scope / read:** Names from JSON-LD plus first-page site name; body text on any page. Grade C; informative tier.
- **Current aggregation / absence:** Empty pages fail; no name warns; any candidate-name mention passes; none fail.
- **Disposition:** Entity-specific identity advisory. Article/WebPage names are not necessarily brands. Bind claimed publisher to matching text and avoid requiring every page to repeat it.
- **Tests:** Article title as name, third-party organization, multilingual boundary matching, missing identity data and stable representative URL.

### answer-readiness/descriptive-urls

- **Scope / read:** Bad-slug patterns against each full page URL. Grade C; informative tier.
- **Current aggregation / absence:** No pages fail; none bad pass, some bad warn, all bad fail.
- **Disposition:** Keep unscored URL advice. Do not infer page purpose or defect from an identifier alone. Match path segments deliberately and stabilize affected URLs.
- **Tests:** Valid ID-based resource, query-only differences, non-Latin slugs, encoded paths, empty sample and order.

### answer-readiness/snippet-gate-coverage

- **Scope / read:** First-page directives, main text and candidate answer spans. Grade A; scored tier.
- **Current aggregation / absence:** No page/main text NA; blocked snippets/suppressed spans/budget findings fail; minor subtree suppression warns; otherwise passes.
- **Disposition:** Per-page snippet permission and answer-feature measurement. An intentional snippet restriction is policy, not necessarily misconfiguration. The dossier calls it site-wide while only one page contributes.
- **Tests:** Different page permissions, bot-specific rules, protected content, no answer spans, partial data-nosnippet and stable entry identity.

### answer-readiness/text-fragment-addressability

- **Scope / read:** First-page document policy and heading/definition/FAQ answer spans. Grade A; scored tier.
- **Current aggregation / absence:** No page/spans NA, except force-load-at-top fails before candidate detection. Broken simulated match fails; normalization hazards warn; otherwise passes.
- **Disposition:** Answer-span feature with explicit browser simulation limits. Scope the opt-out to the relevant resource; no candidate should not become a manufactured citation requirement. Do not claim browser execution from static matching.
- **Tests:** No spans with opt-out, multi-block ranges, repeated text, hidden candidates, normalization and later-page defects.

### answer-readiness/chunk-boundary-referent-integrity

- **Scope / read:** First-page H2/H3 chunks and entity/anaphora/positional-reference heuristics. Grade B; scored tier.
- **Current aggregation / absence:** No page/chunks NA. Coverage thresholds choose fail/warn/pass; pass text can say every chunk despite a threshold below 100%.
- **Disposition:** Heading-led retrieval feature in the documented language/population. A configurable retrieval strategy is not universal. Bind the entry explicitly or adopt reviewed per-page aggregation; expose measured fractions.
- **Tests:** Non-English text, short standalone sections, no entity metadata, one failing chunk above pass threshold and page order.

### answer-readiness/extractor-survival-recall

- **Scope / read:** First-page key spans against Readability and an aggressive local extractor. Grade B; scored tier.
- **Current aggregation / absence:** No page/spans NA; minimum recall chooses fail/warn/pass. Pass can claim all spans despite partial recall.
- **Disposition:** Explicit extraction experiment on one page, not proof about every agent. Preserve extractor identity, supported content population and actual retained counts; apply common scope only after dossier/sample revision.
- **Tests:** Application/utility page, partial recall at pass threshold, hidden spans, missing extractor output and reordered pages.

### answer-readiness/section-split-risk-profile

- **Scope / read:** First main/article of first page; H2/H3 sections against a fixed token window. Grade B; scored tier.
- **Current aggregation / absence:** No page/short text NA; fewer than two H2s forces blob score zero; thresholds and atomic splits choose fail/warn/pass.
- **Disposition:** Long-section feature under a named retrieval strategy. One valid section or many H3s must not become a claim that there are no headings. Keep token denominator and nested-section accounting explicit.
- **Tests:** One H2, H3-only structure, unheaded intro, nested wrappers, atomic tables/lists, multilingual token counts and short pages.

### answer-readiness/site-wide-passage-uniqueness-ratio

- **Scope / read:** Extractable sentences and shingle overlap across selected pages, with canonical clusters. Grade B; scored tier.
- **Current aggregation / absence:** Insufficient readable pages NA; unresolved duplicates or low median fail; low outliers warn; otherwise passes.
- **Disposition:** Cross-page sample metric, not a census. Canonical equivalence, legal repeated text and sample composition matter. The dossier mentions alternate-content divergence absent from the body; keep that claim deferred.
- **Tests:** Query/canonical aliases, necessary repeated policy text, unrelated page purposes, unread members, clustering order and even-sized median.

### answer-readiness/table-markdown-round-trip-loss

- **Scope / read:** Eligible top-level main-content tables on the first page; local grid/Markdown conversion. Grade B; scored tier.
- **Current aggregation / absence:** No page/data table NA; corrupting number/unit findings or low survival fail; other loss/shape findings warn; otherwise passes.
- **Disposition:** Data-table feature regardless of page label. Name the simulated serializer and its limits. Captions can carry valid units; layout tables and nested structures need supported selection rules.
- **Tests:** Table on later page, layout table, spanning cells, caption units, escaping pipes/newlines and comparison with actual documented converter behavior.

### agentic-commerce/acp-policy-link-surface

- **Scope / read:** Links across selected pages plus policy URL validation. Grade A; scored tier.
- **Current aggregation / absence:** No pages/anchors NA. Otherwise checks eight ACP link types; missing hard gates fail, partial set warns, all pass.
- **Disposition:** Require independent ACP/merchant evidence. Any ordinary anchor currently activates checkout obligations on non-commerce sites. Bind each claim to the protocol/version and observed checkout surface.
- **Tests:** Informational site with links, merchant without ACP adoption, actual ACP surface, external/PDF policies and unread target.

### agentic-commerce/agent-ua-commerce-parity

- **Scope / read:** Root, first selected URLs labeled PDPs, guessed cart and discovered policy links. Grade A; scored tier.
- **Current aggregation / absence:** No pages/unreachable cart or no comparable baselines NA; any access delta/path disallow fails; otherwise passes.
- **Disposition:** Select proven commerce URLs; arbitrary pages are not PDPs. Preserve same-URL baseline comparison, intentional crawler policy and incomplete probe coverage. Do not claim both agents matched every target from partial pairs.
- **Tests:** Non-commerce site, real product outside default paths, partial probes, intentional training block and custom cart URL.

### agentic-commerce/cart-handoff-reachability

- **Scope / read:** Platform fingerprint and guessed cart/checkout paths with browser/agent probes. Grade B; scored tier.
- **Current aggregation / absence:** No platform/no answers NA; known platform/no answers fails. Blocks/account walls fail, JS-only warns, otherwise passes.
- **Disposition:** Observed cart/handoff feature. A guessed path is not a published continue_url; a catalog-only storefront may have no cart. Missing paired response and server errors must not count as successful handoff.
- **Tests:** Catalog-only platform, custom/advertised cart, 500 or partial probe, legitimate account-required flow, catch-all HTML and absence.

### operability-safety/contact-form

- **Scope / read:** Contact-like HTML forms or POST operations; links to unscanned contact pages. Grade C; informative tier.
- **Current aggregation / absence:** Any matching form/API passes; unscanned contact link with no observed form NA; otherwise fails.
- **Disposition:** Optional contact capability advisory. Email/phone or no contact workflow can be valid. Do not claim reachability or successful submission from declaration patterns.
- **Tests:** Non-contact page, mailto alternative, form on unscanned route, false keyword match, broken declared API and empty sample.

### operability-safety/no-blocking-captcha

- **Scope / read:** Global WAF observation and CAPTCHA selectors across selected pages. Grade A; scored tier.
- **Current aggregation / absence:** Blocking WAF fails; no pages/unread clean sample NA; selectors warn; no selectors pass.
- **Disposition:** Common access plus adopted form feature, with per-page attribution. A widget/script is not proof it blocks a task, and scanner blocking is not proof about every agent.
- **Tests:** Mixed wall/readable pages, nonblocking widget, missing readable evidence, rate limits and stable URL.

### operability-safety/forms-no-js

- **Scope / read:** Extracted forms and action/method strings across pages. Grade C; informative tier.
- **Current aggregation / absence:** No forms NA; all attributes pass, some action coverage warns, no actions fail.
- **Disposition:** HTML-form feature for non-JS consumers. Empty/default action and method can be valid HTML; attributes alone do not prove successful submission. Keep informative.
- **Tests:** Default self-target/GET, submitter overrides, JS-enhanced native form, invalid action, no forms and per-form evidence.

### operability-safety/form-actionability

- **Scope / read:** Native and simulated fields inside forms; names, label markers and expected autofill. Grade A; scored tier.
- **Current aggregation / absence:** No fillable fields NA; at least 90% pass, at least half warn, lower fail.
- **Disposition:** Field feature, not page type. Label references must resolve and contain text; disabled/hidden/external form-owned fields need proper population. Pooling many good forms can hide one unusable form.
- **Tests:** Broken/empty label reference, disabled field, form attribute ownership, mixed forms/pages and exact coverage messages.

### operability-safety/aria-landmarks

- **Scope / read:** Landmark predicates on first selected page. Grade A; scored tier.
- **Current aggregation / absence:** No pages warns; all required landmarks pass, one missing warns, more fail.
- **Disposition:** Common relevant page regions. Do not require navigation/footer where no such region exists. Align with main/header/footer audits and real document landmarks; change first-page scope deliberately.
- **Tests:** Standalone page, section-scoped header, ARIA equivalents, empty sample, hidden regions and later-page defect.

### operability-safety/form-error-messages

- **Scope / read:** Resolvable message references on invalid fields, otherwise required fields, across pages. Grade A; scored tier.
- **Current aggregation / absence:** No relevant fields NA; all linked pass, some warn, none fail.
- **Disposition:** Validation feature. One invalid field currently changes the population for every other page; choose state/population per form/page. A GET cannot prove runtime validation messages. Native validation is not inherently broken.
- **Tests:** Invalid field on one page plus required fields elsewhere, native constraint messages, stale/hidden references and mixed order.

### operability-safety/landmark-unique

- **Scope / read:** Per-page cached static accessibility results for same-role landmark names; rules `landmark-unique`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Lone landmark, distinct same-role names, unnamed duplicates and hidden regions. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/label

- **Scope / read:** Per-page cached static accessibility results for native input/select names; rules `label, select-name`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Hidden/button exclusions, external labels, wrapping labels and unresolved references. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/accessible-names

- **Scope / read:** Per-page cached static accessibility results for native button and anchor names; rules `button-name, link-name`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Icon-only native controls, ARIA role controls outside selectors, whitespace names and hidden nodes. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/dialog-name

- **Scope / read:** Per-page cached static accessibility results for dialog and alertdialog names; rules `aria-dialog-name`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Named/unnamed dialogs, absent dialog, hidden dialog and referenced title. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/aria-hidden-body

- **Scope / read:** Per-page cached static accessibility results for document body exclusion from the accessibility tree; rules `aria-hidden-body`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Body true/false/absent, empty-body evidence and no rendered-content gate masking the defect. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/aria-roles

- **Scope / read:** Per-page cached static accessibility results for declared roles; rules `aria-roles, aria-deprecated-role, aria-allowed-role`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Fallback role lists, deprecated/abstract roles, native restrictions and hidden-state rules. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/aria-attributes

- **Scope / read:** Per-page cached static accessibility results for ARIA attributes and values; rules `aria-valid-attr, aria-valid-attr-value, aria-allowed-attr, aria-prohibited-attr`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Invalid values, role-dependent attributes, native implicit roles and unresolved references. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/aria-relationships

- **Scope / read:** Per-page cached static accessibility results for composite widget requirements; rules `aria-required-attr, aria-required-children, aria-required-parent`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Owned versus DOM children, required context, incomplete dynamic widget and valid native equivalent. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/duplicate-id

- **Scope / read:** Per-page cached static accessibility results for IDs referenced by accessibility relationships; rules `duplicate-id-aria`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Duplicate referenced ID, duplicate unreferenced ID, ambiguity alongside a passing page and stable review status. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/autocomplete

- **Scope / read:** Per-page cached static accessibility results for nonempty adopted autocomplete on eligible enabled controls; rules `autocomplete-valid`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Absent token, valid token sequence, readonly/disabled exclusions and false identity inference. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/nested-interactive

- **Scope / read:** Per-page cached static accessibility results for presentational-child roles with focusable descendants; rules `nested-interactive`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Nested focusable child, nonfocusable child, native/ARIA role and hidden descendant. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/table-headers

- **Scope / read:** Per-page cached static accessibility results for data tables and header associations; rules `td-has-header, th-has-data-cells, td-headers-attr, scope-attr-valid`. Grade B; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Small versus large table, layout table, row/column spans, explicit headers and malformed scope. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/document-title

- **Scope / read:** Per-page cached static accessibility results for top-level document title; rules `document-title`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Missing/blank/title-present, no pages, empty-body title and later-page failure. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/frame-title

- **Scope / read:** Per-page cached static accessibility results for visible nonnegative-tabindex frames and repeated frame titles; rules `frame-title, frame-title-unique`. Grade C; informative tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Unique/missing title, hidden frame, negative tabindex and duplicate-title incomplete beside a pass. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/meta-refresh

- **Scope / read:** Per-page cached static accessibility results for adopted refresh meta directives; rules `meta-refresh`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Absent refresh, immediate/delayed refresh, malformed delay and header-delivered refresh coverage limit. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/tabindex

- **Scope / read:** Per-page cached static accessibility results for adopted tabindex values; rules `tabindex`. Grade C; informative tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Absent/zero/negative/positive values, hidden element and natural DOM focus order. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/presentation-conflict

- **Scope / read:** Per-page cached static accessibility results for presentation/none roles and empty-alt images; rules `presentation-role-conflict`. Grade A; scored tier.
- **Current aggregation / absence:** Shared A11yBackedAudit: any failure fails; incomplete without any pass warns; any pass passes; no observed applicable result NA. First failing URL and up to five selectors follow page order.
- **Disposition:** Retain element-feature or common-document scope. Missing engine output is unknown, not proven inapplicability; one pass currently masks another incomplete result. The runner strips stylesheets and does not execute JS. Preserve these coverage limits and stabilize URL/selector evidence.
- **Tests:** Focusable presentation, global ARIA conflict, legitimate decorative image and implicit-role filter. Also test all page labels, mixed pass/incomplete/missing results and permutations through the shared runner.

### operability-safety/security-header-hygiene

- **Scope / read:** Optional security.txt at well-known or legacy root path. Grade C; informative tier.
- **Current aggregation / absence:** Never fetched/absent NA; HTML or malformed/expired fields warn; Contact and future Expires pass.
- **Disposition:** Retain optional artifact advisory. Name the limited field validation instead of complete RFC conformance. Page labels do not change origin-file applicability.
- **Tests:** Absent/unread file, legacy fallback, HTML catch-all, malformed Contact URI, invalid expiry and deterministic clock.

### operability-safety/form-autofill-token-coverage

- **Scope / read:** Autofill candidates, visual required markers and message wiring across forms/pages. Grade A; scored tier.
- **Current aggregation / absence:** No forms/no applicable concepts NA; full coverage passes, zero coverage fails, partial/side issues warn.
- **Disposition:** Per-field feature, with query-form exclusion. Dossier says per-form while source pools counts. Keep constraints and error findings tied to the same field/page; no field should acquire identity obligations from a vague name.
- **Tests:** Search/store-locator forms, custom labels/locales, mismatched token/type, separate failing form and stable URL.

### operability-safety/native-control-substitution

- **Scope / read:** Native/custom choice, date and upload controls across pages. Grade A; scored tier.
- **Current aggregation / absence:** No controls NA; native-only pass; broken custom contract fails; complete custom widgets warn.
- **Disposition:** Control feature. Distinguish a proven broken contract from extra interaction cost. Native equivalence and task-critical status require their own evidence; static markup cannot count actual interaction steps.
- **Tests:** Complete APG custom widget, native wrapper, disabled/hidden widgets, no matching controls and critical versus decorative contexts.

### operability-safety/invisible-instruction-scan

- **Scope / read:** Text and nonrendering channels with local/same-origin CSS analysis. Grade A; scored tier.
- **Current aggregation / absence:** No body text NA; hidden instruction patterns fail; unexplained long hidden text warns; otherwise passes.
- **Disposition:** Common scanned-channel heuristic. Report incomplete CSS and runtime limits; a pattern hit is not proof of malicious intent or successful injection. Check feature detection does not drop comment/attribute-only payloads.
- **Tests:** Instruction quoted as documentation, template/comment-only payload, cross-origin CSS, language limits and affected channel URL.

### operability-safety/aria-layer-injection-scan

- **Scope / read:** Accessible/nonvisual text values and visible-label comparisons. Grade A; scored tier.
- **Current aggregation / absence:** No values NA; instruction/opposing-action matches fail; long/divergent values warn; unread clean text NA; otherwise passes.
- **Disposition:** Nonvisual-value feature. Name pattern observations rather than proving all values benign. Legitimate longer accessible labels and translated abbreviations need negative fixtures.
- **Tests:** Accessible clarification longer than visible text, quoted instructions, hidden-only values, multilingual labels and partial readability.

### operability-safety/ghost-clickable-element-ratio

- **Scope / read:** Static native/semantic and inferred click targets, with CSS input. Grade B; scored tier.
- **Current aggregation / absence:** No targets NA; no ghosts pass; ratio below threshold fails; other ghosts warn.
- **Disposition:** Click-target feature with declared CSS/runtime coverage. Pointer appearance is not proof of an actionable target; lack of a static signal is not proof no runtime target exists. Dossier ghost ratio and output semantic ratio need clear labels.
- **Tests:** CSS pointer decoration, delegated handler, native unnamed target, cross-origin stylesheet, threshold and per-page counts.

### operability-safety/stateful-control-introspectability

- **Scope / read:** State-bearing controls inferred from markup/classes with CSS input. Grade B; scored tier.
- **Current aggregation / absence:** No controls NA; all introspectable pass; low ratio fails; remaining opaque controls warn.
- **Disposition:** State-control feature. Static state presence does not prove updates after interaction. Keep class-name heuristics and missing stylesheet limits explicit; preserve per-page evidence.
- **Tests:** Native state, valid ARIA state, stale state only observable at runtime, false state-class hit, partial CSS and order.

### operability-safety/hover-only-content-and-navigation

- **Scope / read:** Hover CSS, title-only strings and hover-card heuristics across pages. Grade B; scored tier.
- **Current aggregation / absence:** No signal and no omitted stylesheet NA. Missing paths fail/warn; no observed finding otherwise passes, including omitted CSS.
- **Disposition:** Hover feature. Unread CSS must not become a claim that every submenu has an alternative. Static ARIA markers do not prove a working focus/click route. Keep title information separate from blocked navigation.
- **Tests:** Cross-origin-only CSS, focus-within path, inert ARIA trigger, title supplement versus unique text and hidden menu.

### operability-safety/drag-and-slider-dependency

- **Scope / read:** Slider/drag/drop/carousel markup and class patterns across pages. Grade B; scored tier.
- **Current aggregation / absence:** No constructs NA; no findings passes; missing alternative fails.
- **Disposition:** Gesture feature independent of page type. Native keyboard support and programmatic values can be alternatives without a text box. Class names do not establish gesture-only behavior or task criticality.
- **Tests:** Keyboard-native range, typed alternative, real drag-only task, noninteractive carousel class and hidden controls.

### operability-safety/first-contact-consent-gate-operability

- **Scope / read:** Detected consent gates across pages, but only first detected gate judged. Grade C; informative tier.
- **Current aggregation / absence:** No static platform NA with an overly broad no-gate claim; defects warn; otherwise passes. Zero refusal controls can still pass.
- **Disposition:** Optional detected-gate advisory. Runtime gate absence remains unknown. Judge each observed gate; distinguish missing refusal control from zero-cost refusal. Keep cross-origin extraction limits explicit.
- **Tests:** Multiple different gates, no refusal control, runtime-only platform, valid labeled choices and page order.

### operability-safety/unicode-covert-channel-scan

- **Scope / read:** Page text/attributes and selected root files scanned for codepoint patterns. Grade B; scored tier.
- **Current aggregation / absence:** No input/unread clean text NA; tag/bidi/high zero-width matches fail; lower-count matches warn; no hits pass.
- **Disposition:** Common scanned-text heuristic, with channel-specific attribution. Legitimate script shaping, emoji sequences and quotations need exclusions. Aggregate thresholds must not manufacture a per-page density defect.
- **Tests:** Indic joiners, emoji tags, bidirectional language, legal soft hyphens, repeated low-density pages and root-only evidence.

### operability-safety/third-party-dom-write-blast-radius

- **Scope / read:** Pooled third-party script/style domains, integrity flags, page CSP and unsandboxed frames. Grade B; scored tier.
- **Current aggregation / absence:** No pages/unread clean sample NA. Any weak page policy plus any unpinned domain fails; otherwise pass/warn by combined policy/frame state.
- **Disposition:** Third-party feature per resource and page. Current pooling can combine CSP absence on a script-free page with an unpinned script protected elsewhere. Keep CSS, script, frame and runtime capability claims distinct.
- **Tests:** CSP-free page with no third parties beside protected external script, mixed integrity, script-src none, multiple policies and runtime injection limits.

### operability-safety/unsafe-agent-triggerable-affordances

- **Scope / read:** URL/label patterns on links and GET forms; confirmation/nofollow/robots hints. Grade B; scored tier.
- **Current aggregation / absence:** No pages/unread clean sample NA; suspect links fail, forms warn, none passes.
- **Disposition:** Observed possible action feature. A URL pattern cannot prove a server mutation or absence of server-side confirmation. Never trigger destructive endpoints to strengthen this check; retain static uncertainty.
- **Tests:** Delete documentation URL, confirmation route, real action-shaped GET, POST alternative, nofollow limits and stable URL evidence.

### operability-safety/reflected-parameter-injection-canary

- **Scope / read:** First-page readability gate, then origin query/search/path canary GET probes. Grade B; scored tier.
- **Current aggregation / absence:** No readable entry/no probe response NA; high-trust or indexable body reflection fails; noindex body reflection warns; no echo passes.
- **Disposition:** Origin reflection experiment, not arbitrary page-purpose requirement. Escaped search text is not equivalent to executable injection. Preserve per-response escaping/sink association and partial probe coverage.
- **Tests:** Legitimate escaped query, raw versus escaped mixed sinks, unavailable probes, mounted app, error-page reflection and first-page reorder.

### operability-safety/ugc-trust-boundary-markers

- **Scope / read:** Visitor-content region heuristics, markup and instruction patterns across pages. Grade B; scored tier.
- **Current aggregation / absence:** No regions NA; dangerous/payload findings fail; unbounded regions warn; bounded/marked pass.
- **Disposition:** UGC feature with explicit provenance evidence. rel=ugc/data-nosnippet are consumer-specific signals, not sanitizer or prompt-injection guarantees. Do not force useful forum answers out of all snippets.
- **Tests:** Editorial content resembling comments, valid user images, marked link beside unbounded text, sanitizer survivors and instruction quotations.

### operability-safety/agent-ua-content-divergence-diff

- **Scope / read:** Bounded selected URLs with browser/crawler/control UA responses. Grade B; scored tier.
- **Current aggregation / absence:** No URLs/comparable responses NA; selected content/schema deltas fail; otherwise passes. Failed control fetch defaults to similarity 1.
- **Disposition:** Per-URL experiment. Missing control is unknown, not a matching control; intentional localization/personalization can produce benign differences. A skipped bot-management delta is not a matching response.
- **Tests:** Unavailable control, rotating content, dynamic schema fields, true agent-only payload, blocked pairs and stable capped sample.

### operability-safety/c2pa-manifest-survives-delivery

- **Scope / read:** Bounded image candidates plus inferred original/variant pairs through the media gatherer. Grade B; scored tier.
- **Current aggregation / absence:** No readable/adopted manifests NA; observed stripping fails; otherwise passes.
- **Disposition:** Adopted per-asset provenance feature. Unsigned unrelated assets are not defects. Missing original reads cannot prove preservation; manifest markers alone do not prove valid signatures. Expose sample and read cap.
- **Tests:** Signed original/unsigned variant, unread original, mixed adoption, large image, reordered candidate cap and unsupported optimizer URL.

### operability-safety/c2pa-signer-trust-status

- **Scope / read:** Certificates found in sampled manifest bytes and timestamp-label presence. Grade B; scored tier.
- **Current aggregation / absence:** No manifests NA; self-issued/expired/future certificate fails; unread certificate or missing timestamp warns; otherwise passes.
- **Disposition:** Adopted-manifest feature. The dossier opening promises Trust List/identity validation that the source does not perform. Bound claims to certificate observations; valid signing-time evidence and cryptographic validation need proper consumers before trust verdicts.
- **Tests:** Unread/partial manifest, expired-now but timestamped signing, self-issued versus verified self-signed, unknown CA and absent signature validation.

### operability-safety/organization-identifier-registry-resolution

- **Scope / read:** Organization identifier claims and GLEIF resolution for deduplicated LEIs. Grade B; scored tier.
- **Current aggregation / absence:** No claims NA; invalid/mismatching LEIs fail; registry problems/advice warn; otherwise passes, potentially with zero resolved LEIs.
- **Disposition:** Declared identifier feature, not mandatory merchant identification. Deduplicate fetches without discarding distinct entity/name assertions. Malformed registry JSON is unread evidence, not proof of no record.
- **Tests:** Same LEI claimed under two names, DUNS-only data, multiple organizations, malformed registry reply, outage and local identifier formats.

### operability-safety/synthetic-media-disclosure-validity

- **Scope / read:** Sampled image XMP source-type declarations with manifest substring comparison. Grade B; scored tier.
- **Current aggregation / absence:** No adopted declarations NA; malformed/conflicting values fail; otherwise passes. Valid count subtracts findings, allowing multiple findings per asset to overcount.
- **Disposition:** Adopted disclosure feature. Name sampled assets; unread files do not establish site-wide absence. Verify same-asset assertion semantics before calling multiple historical provenance strings a contradiction.
- **Tests:** Multiple findings on one asset, mixed capture/edit history, unread media, valid vocab URI and sample-order stability.

### operability-safety/trust-txt-reciprocity-coherence

- **Scope / read:** Optional origin trust.txt, bounded reciprocal-domain probes and root robots policy. Grade C; informative tier.
- **Current aggregation / absence:** Absent artifact NA; observations warn; no observations passes.
- **Disposition:** Optional unscored declaration feature. Crawl allowance is not permission to train. HTML catch-all/empty parsed entries cannot prove a valid trust file. Retain incomplete association coverage.
- **Tests:** No file, HTML catch-all, empty parse, failed reciprocal fetch, intentional training deny with crawl allow and capped associations.

### operability-safety/wikidata-round-trip-verification

- **Scope / read:** Declared Wikidata entities and bounded official-website lookups. Grade B; scored tier.
- **Current aggregation / absence:** No claims NA; mismatching domain fails; absent/unread/alternate-domain evidence warns; otherwise passes.
- **Disposition:** Declared entity feature. A related person/publisher can have a different official site; distinguish owner identity from referenced entity. Multiple official websites and sample limits must remain visible.
- **Tests:** Related person entity, multi-domain organization, multiple P856 values, registry outage, no claim and stable capped entity order.

## Decisions and remaining work

1. Keep common, purpose and feature applicability distinct. The reviewed audits
   need all three. A single expanded page-type enum would not fix first-node
   selection, optional-artifact handling or unsupported consumer populations.
2. Share article-purpose evidence in P3. Remove the “all non-XML HTML is an
   article” assumption from dates/publication/first-paragraph checks. Keep the
   current informative guard until independent positive/negative fixtures pass.
3. Preserve explicit dossier aggregation until a reviewed revision replaces it.
   Review-schema and dates-on-content currently document sample-level success.
   Do not silently redefine their claims as per-page obligations.
4. Review source populations before broadening service, commerce-feed, news or
   English-only checks. This ledger identifies limits; it does not supply new evidence.
5. The P1 semantic deferrals now have explicit decisions above. Their code fixes
   remain open. Treat visibility and duplicate-heading severity as a separate
   tested slice; do not bury them inside classification or runner changes.
6. P2 has a reviewed row for all 215 registrations. P3 must define independent
   purpose evidence and canonical metadata from these dispositions. P4–P6 remain
   open. Planned predicate, evidence and sampling fixes need their own proof.

## Execution proof for this slice

The `header-footer` scope regression initially produced **12 failures and six
passes** across its audit test and `common-page-scope.test.ts`. The reorder
case returned `[warn, fail, fail]` instead of `[warn, warn, warn]`; empty input
returned `pass` instead of `na`. The missing-URL and result-bound tests also failed.

The correction uses the existing `judgePages` helper, stable failure URLs and
bounded result text. It preserves literal element predicates, grade A, scored
tier, ternary mode and derived weight. See the parent plan for final gate results.

A source-registry membership check confirmed 215 registrations, 36 typed
registrations, 39 unique reviewed IDs, 176 pending IDs, no missing typed row,
and no missing source/test/dossier pointer. The first temporary check's regex
excluded digits and omitted `single-h1`; correcting it to accept digits made
the check pass. This check proves ledger coverage, not semantic correctness.

The second review slice adds 44 source/dossier reviews: 20 content-extraction
and 24 machine-discovery registrations. The registry check confirms 83 unique
reviewed IDs, both complete category sets, all 36 typed audits, 132 pending and
valid source/test/dossier pointers. Its first run caught the omitted Markdown
alternate row; that reviewed row is now present.

`language-attribute` regression tests produced 12 failures and seven passes
before correction. A direct hydration probe reproduced two individual passes
becoming a combined failure at the single-payload ceiling. Three new hydration
tests failed before the map moved inside the page loop; 11 existing cases passed.
The parent plan records final validation. Proposed fixes in other rows remain
open; a reviewed row is not a claim that its implementation is correct.

The third and final review passes add 132 rows, completing **215 unique reviewed
registrations**. The source registry check found zero pending IDs and valid
source/test/dossier paths for every row. Accessibility wrappers also read the
shared evaluator and its actual rule-match/aggregation path.

`no-nofollow` produced 12 failing and seven passing regression cases before the
scope correction. All 19 audit cases then passed; the focused audit/common-page/
hostile-state run passed 405 tests. Full tests passed 5,831 cases with 219 skips.
Build, typecheck, lint, dossiers and requirements passed. The audit-map gate
initially rejected the changed title; regenerating its map fixed the mismatch,
and the final map check passed. The parent plan records the exact sequence and
log. No other finding in the final 132 review rows is claimed as implemented.
