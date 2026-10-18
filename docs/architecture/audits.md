# How an audit is built

What an audit is, what it may claim, and which rule stops it claiming more. Every section describes code in `main` and names the gate that enforces it.

## The one rule above the rest

> **An audit may only claim what a source documents.** If no vendor documents a
> consumer, the check does not affect a site's score. Ever.

Everything below applies that rule to one surface: absence, page classification, network addresses, the score.

---

## 1. What an audit is

One claim about a site, backed by one source, in six parts.

```
                          ┌──────────────────────────────┐
                          │          AN AUDIT            │
                          └──────────────┬───────────────┘
            ┌──────────────┬─────────────┼─────────────┬──────────────┐
            ▼              ▼             ▼             ▼              ▼
      ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
      │ IDENTITY │  │  WARRANT  │  │ EVIDENCE │  │ READING  │  │ CONDUCT  │
      ├──────────┤  ├───────────┤  ├──────────┤  ├──────────┤  ├──────────┤
      │ which    │  │ which     │  │ what the │  │ which    │  │ how it   │
      │ audit,   │  │ source    │  │ scan must│  │ bytes,   │  │ reaches  │
      │ which    │  │ licenses  │  │ have     │  │ and what │  │ the      │
      │ dossier  │  │ it, and   │  │ obtained │  │ absence  │  │ network  │
      │          │  │ what it   │  │          │  │ means    │  │          │
      │          │  │ costs     │  │          │  │          │  │          │
      └──────────┘  └───────────┘  └──────────┘  └──────────┘  └──────────┘
                          ▲
                    ┌─────┴──────┐
                    │ POPULATION │   which pages the claim covers,
                    │            │   and whether anyone consented
                    └────────────┘
```

Warrant and cost are one part, because the weight is derived:

```
       evidence grade          tier              weight
       ──────────────          ────              ──────
            A          ×     scored      =        1.0
            B          ×     scored      =        0.6
            C or D     ×     scored      =        0     (unregistrable)
            any        ×     not scored  =        0

                  weight = weightForGrade(grade, tier)
```

The not-scored tiers are `informative`, `experimental` and `obsolete`. An obsolete audit carries grade D and a notice of kind `obsolete`. It returns `warn` when the site still publishes what a consumer retired or ignores, `notApplicable` otherwise, and never `fail`; `Audit.toCheckResult` lowers a stray `fail` to `warn`. See the [evidence policy](../evidence/policy.md#informative-or-obsolete).

The grade is the one knob. Never hand-set a weight. [Scoring](../scoring.md) shows how weights become a score.

---

## 2. Three sentences

Every law here is one of these.

```
  ┌───────────────────────────────────────────────────────────────────┐
  │  1.  PUT THE GUARD WHERE IT RUNS                                  │
  │      A precondition, an origin check, a fetch, a shared read.     │
  │      None may be an author's job to remember.                     │
  ├───────────────────────────────────────────────────────────────────┤
  │  2.  A CLAIM STATES THE CONDITIONS UNDER WHICH IT HOLDS           │
  │      What absence means. What was consented to. How old the       │
  │      evidence is. Including the score's own conditions.           │
  ├───────────────────────────────────────────────────────────────────┤
  │  3.  A LAW NAMES ITS GATE, OR IT IS A WISH                        │
  │      An unenforced rule is written down as a debt, not a rule.    │
  └───────────────────────────────────────────────────────────────────┘
```

---

## 3. The four-way read

The gatherer that reads an artifact classifies it; the audit only judges.

```
                    ┌───────────────────────┐
                    │  the gatherer reads   │
                    └───────────┬───────────┘
                                │
        ┌───────────────┬───────┴───────┬────────────────┐
        ▼               ▼               ▼                ▼
   ┌─────────┐    ┌──────────┐   ┌────────────┐   ┌────────────┐
   │ ABSENT  │    │  EMPTY   │   │ MALFORMED  │   │  READABLE  │
   ├─────────┤    ├──────────┤   ├────────────┤   ├────────────┤
   │ nothing │    │ readable,│   │ nothing    │   │ something  │
   │ readable│    │ declares │   │ readable,  │   │ survives;  │
   │ arrived │    │ nothing  │   │ the author │   │ defects    │
   │         │    │          │   │ wrote the  │   │ may sit    │
   │         │    │          │   │ breakage   │   │ beside it  │
   └────┬────┘    └────┬─────┘   └─────┬──────┘   └─────┬──────┘
        │              │               │                │
        ▼              ▼               ▼                ▼
   notApplicable  notApplicable      fail,         grade what
                                   naming it       survived and
                                                   name the rest
```

```jsonc
// ABSENT     /openapi.json 404s, serves HTML, or was never fetched
// EMPTY      { "openapi": "3.1.0", "paths": {} }         legal, announces nothing
// MALFORMED  { "openapi": "3.1.0", "paths": "soon" }     the author wrote the breakage
// READABLE   { "paths": { "/a": { "get": {…} },
//                         "/b": { "get": "yes" } } }     one good, one broken
```

`packages/core/src/gatherers/openapi.ts` and `gatherers/sitemap.ts` implement it. Two rules follow:

- **Broken is judged over what survives the read.** One malformed entry beside twenty good ones does not erase the twenty.
- **The decline states what the read observed.** _"No readable OpenAPI document at `/openapi.json`"_, not _"the site publishes no OpenAPI document"_.

Four `openapi-*` audits once failed every site with no OpenAPI document: 2.4 combined weight telling a bakery to add a `servers` array to a spec it never wrote.

---

## 4. The declaration is a guard, not a field

A field that _describes_ can be true while the code contradicts it. A guard runs before the judgement, so the author never writes the absent case.

```
   ┌─── A FIELD ─────────────────────────────────────────────────┐
   │   meta: { subject: 'artifact-contents', artifact: 'sitemap' }│
   │   audit(ctx) {                                              │
   │     if (!getSitemapResult(ctx))                             │
   │       return this.fail('No sitemap found');   ✓ typechecks  │
   │   }                                            ✗ WRONG      │
   └─────────────────────────────────────────────────────────────┘

   ┌─── A GUARD ─────────────────────────────────────────────────┐
   │   static reads = openApiContents;   ← runs before judge()   │
   │   judge(spec, ctx) {                                        │
   │     const servers = spec['servers'];   ← guaranteed readable│
   │   }                                                         │
   └─────────────────────────────────────────────────────────────┘
```

`packages/core/src/tests/absent-artifact-contract.test.ts` enforces it. Membership is keyed on the import of the shared precondition constant, not on a list.

---

## 5. Consent

The tool may guess. **A guess may never move a score.**

```
                    where did this fact come from?
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
      ┌───────────────────┐             ┌───────────────────┐
      │  INFERRED by the  │             │  DECLARED by the  │
      │       tool        │             │     operator      │
      ├───────────────────┤             ├───────────────────┤
      │ shown, marked as  │             │ shown, marked as  │
      │ a guess           │             │ declared          │
      │ NEVER moves       │             │ MAY move          │
      │ a score           │             │ a score           │
      └───────────────────┘             └───────────────────┘
```

### 5.1 Page type

The five page types are `homepage`, `category`, `product`, `article` and `general`. `article` is an editorial page (post, news story, guide) with author and date obligations. `general` is every other page. The word "content" also names the `content` readiness vital and the `content-extraction` category; write "article page" or "general page", never "content page".

The classifier returns `{ type, source, confidence, signals }`:

- The fallback is `general`, with confidence `unknown` when nothing matched.
- A root or mounted homepage keeps its identity regardless of crawl order.
- Open Graph article metadata or article prose can establish `article` without the author, dates or schema an audit will inspect.
- URL-only and schema-only matches are hints. Conflicting strong product and article signals give `general`.
- Signal strength never grants scoring authority.

The public `detectPageType` still returns a type and ignores its historical last argument. Input names `unknown` and `content` are refused. Stored reports that carry them read as `general` (`LEGACY_PAGE_TYPES`, `StoredPageTypeSchema`), and no missing evidence is inferred.

The runner canonicalizes `applicablePageTypes` on a copy of the metadata. It accepts the legacy `pageTypes` alias; if both are set, they must match, or planning throws. An absent or empty set means every page type.

### 5.1.1 Default scope and page-type restrictions

**An audit applies to every page type unless its documented obligation requires one specific population.** Most checks omit `applicablePageTypes`. No type gate does not remove evidence requirements, artifact preconditions, readable-body guards or the audit's own page selection.

- Use a short inclusion list for a purpose-specific obligation, such as article authors or product offers. The dossier must say why the obligation belongs to that population. Even a one-type list needs evidence.
- Never list most or all page types to mean "everywhere", and never build a list as the complement of one excluded type. Such lists silently exclude future types. An absent field includes them. Empty lists mean the same at runtime, but new audits omit the field.
- A feature check selects pages by the feature it measures. Code blocks, dates, definitions, supplementary content, service intent and site hierarchy occur on many page types. Keep that precondition beside the read, in the audit or its gatherer. Count only relevant pages in the numerator and denominator. Return `notApplicable` when the feature or obligation is absent.
- A check about missing required markup must establish intent without that markup, or the missing markup hides its own check.
- A genuine exception needs a documented reason and a local evidence condition. There is no `excludedPageTypes` field; adding one is a contract change, never a way to replace a broad list.

Moving from typed to common scope is a behaviour change, not a cleanup. Typed scope splits declared and detected populations and keeps detected results informative; common scope uses the audit's normal display mode. Removing a list can admit new inputs and change scores with no change to the audit body. Review the dossier, population selection, absence verdict and aggregation first, and follow the changeset rules. Test these cases:

- The feature occurs on each current page type, including `general`.
- No feature occurs; the audit returns `notApplicable`.
- Required markup is missing despite independently established intent.
- A mixed sample of relevant, irrelevant and unread pages; only relevant readable inputs decide the verdict and its denominator.
- Declared and detected inputs produce the intended result mode and score.

### 5.1.2 Inspection of current inclusion lists

Counted 2026-10-17 from the built registry. Of 215 audits, 179 have no page-type gate and 36 have an inclusion list: 12 article-only, 8 product-only, 3 homepage-only, 1 category-only, 2 homepage/product, and 10 broad lists kept from the old general-content population. This is an inventory, not approval of every restriction.

The 10 broad lists are review targets, not a pattern for new audits. Their dossiers record them as deviations.

| Audit                                 | Current inclusion list              | Evidence condition to review before changing scope                                                                                 |
| ------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `answer-readiness/comparison-tables`  | category, product, general, article | Establish comparison intent independently of table markup. The current body counts tables without an intent guard.                 |
| `structured-data/breadcrumb-schema`   | category, product, general, article | Review the existing URL-depth selection against the documented hierarchy obligation. Do not use the list only to exclude homepage. |
| `answer-readiness/direct-definitions` | general, article                    | The body already selects definitional intent. Confirm its source-backed population and aggregation across other types.             |
| `answer-readiness/external-citations` | general, article                    | Establish the claims or content for which citations are justified. The current body counts external links without an intent guard. |
| `answer-readiness/unique-data`        | general, article                    | Establish when original data is an applicable obligation. Do not require numbers on every page.                                    |
| `content-extraction/aside-element`    | general, article                    | The body already selects supplementary blocks. Confirm that selection and its denominator across other types.                      |
| `content-extraction/code-language`    | general, article                    | Select present code blocks. Review the current warning on absent blocks against the absence rule.                                  |
| `content-extraction/time-element`     | general, article                    | Detect date-bearing content independently of `<time>` markup. The current body fails when no `<time>` exists.                      |
| `structured-data/howto-schema`        | general, article                    | Review the existing sequential-heading intent test and its absent-feature warning.                                                 |
| `structured-data/service-schema`      | homepage, general, article          | The body already tests service intent. Confirm selection and aggregation across other types before removing the list.              |

### 5.1.3 Populations

Every `PageContext` carries its `pageType` and a `pageTypeSource` of `declared` or `detected`. The target is declared by `--page-type`, each `ScanOptions.pages` URL by its entry, and everything the crawl found is detected. CLI config, SDK and MCP share these declarations, validated by `PageScopeOptionsSchema` before any fetch.

- A universal audit uses all matching readable input. A typed audit's primary result uses declared matches. Detected matches run as informative, even beside declared ones. A detected-only scan has one informative primary result.
- Each input set puts the scan target first and sorts the rest by URL, so `pages[0]` is the target whenever it is in the set.
- Each population gets a fresh audit instance, its own pages, and evidence limited to them. Readable text on an excluded page cannot satisfy `rendered-body` or `sample-adequate`. Header-only and origin checks keep their exemptions.
- There is one top-level `CheckResult` per audit. A mixed scan keeps the detected population in `advisoryResults`, always informative. Counts and mass use the primary result once. A readable advisory population never promotes a failed or unread primary one.
- Each population has `coverage`: `provenance` (`all`, `declared`, `detected`), `selectedUrls` (including failed attempts), `inputUrls` (handed to the audit; empty when gated or not started), and `unreadUrls` (no readable text, or failed).
- `ScanReport.pageAttempts` records each requested page's URL, provenance, HTTP status and whether it parsed. A failed undeclared page is `general` with unknown confidence.
- Every audit emits one progress event and one trace, including skipped audits.
- Report views keep `pageScope` apart from score and counts. Older reports without these fields still load; nothing is invented for them.

### Stable audit mass, conditional participation

An audit keeps one weight from its grade and tier. A `na` or informative result does not participate, so its effective mass for that scan is zero.

```ts
registryMass = sum(registeredAudits.map((audit) => audit.meta.weight));
assessedMass = sum(
  category.checks
    .filter((check) => check.status !== "na" && !isInformative(check))
    .map((check) => check.weight),
);
overallScore =
  sum(categories.map((c) => c.score * c.assessedMass)) /
  sum(categories.map((c) => c.assessedMass));
```

- `registryMass` measures coverage and never weights the score.
- `assessedMass` weights each category in the overall score.
- `gatedMass` decides when missing evidence makes the result `overallScore: null`. Consent is not missing evidence and does not add to it.

Weighting by registry mass would inflate a category whose page-typed audits did not run: Structured Data has 9.6 registry mass, 7.6 of it page-typed, so a scan assessing 2.0 would make the rest count 4.8 times. `isInformative` stays the one predicate for "shown, never scored".

### 5.2 Network address

**The operator's URL is trusted; a URL taken from scanned content is not.** Scanning `http://localhost:3000` before a deploy is a first-class use, so the rule keys on origin, not address class.

```
   scan target: http://localhost:3000
   ───────────────────────────────────────────────────────────────
   fetch  http://localhost:3000/robots.txt   ► ALLOWED  same origin
   fetch  http://127.0.0.1:9200/             ► REFUSED  other origin, private

   scan target: https://shop.example
   ───────────────────────────────────────────────────────────────
   fetch  https://shop.example/api           ► ALLOWED  same origin
   fetch  http://169.254.169.254/            ► REFUSED  metadata endpoint,
                                                        harvested from a page
```

The fetcher checks DNS before each request and again on every redirect hop. The redirect gate is armed only when the starting URL is public. It does not pin the checked IP inside the HTTP client, so a hosted or multi-tenant deployment must also deny outbound traffic to localhost, private networks and metadata endpoints at the network boundary.

---

## 6. Scope

An audit's subject is one document or one origin.

```
   ┌─────────────────────────────┐     ┌─────────────────────────────┐
   │        PAGE SCOPE           │     │       ORIGIN SCOPE          │
   ├─────────────────────────────┤     ├─────────────────────────────┤
   │ the document at the URL     │     │ robots.txt   sitemap.xml    │
   │ the operator gave           │     │ llms.txt     openapi.json   │
   │                             │     │ /.well-known/*   MCP        │
   │ cache key:  URL             │     │ cache key: origin + version │
   │ 149 audits · 91.6 mass      │     │  66 audits · 42.4 mass      │
   └─────────────────────────────┘     └─────────────────────────────┘
```

The split counts an audit as page-scoped when it requires `rendered-body` or `sample-adequate` or has a page-type list, as the report's `conditions.coverage` does.

Some origin audits also read a discovery link from a page: `openapi-exists` reads `/openapi.json` and `<link rel="service-desc">`. They are origin audits, so they read the origin's homepage, never the scanned page. Otherwise one origin would get different verdicts depending on which URL the operator typed.

> **An origin fact must be idempotent per origin.**

- The shared origin cache serves only the anonymous request profile. URL credentials, an authorization header or prefetched evidence bypass it. Credentials never enter a cache key.
- The cache key includes `ORIGIN_EVIDENCE_VERSION`. Every record stores `readAt` and expires by its TTL.
- The unread-scan guard runs before every audit and has no opt-out. The narrower `requires` gate can be turned off with `ScanOptions.enforceEvidenceGate: false`, for diagnosis only.

### 6.1 The scan evidence gate

An audit cannot tell "this page has no `<main>`" from "the scanner never got this page's HTML". Without a gate, missing evidence gives false failures or vacuous passes, such as a captcha wall passing `no-blocking-captcha`.

`buildScanEvidence()` in `packages/core/src/scan-evidence.ts` evaluates four requirements before audits run:

| Requirement         | What it proves                                                                                                                   | Failure condition                                                                                                      |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| `origin-reachable`  | The response belongs to the site requested (matching host, registrable domain, sibling ccTLD storefront, or permanent redirect). | Temporary redirect away to an unrelated broker/parking page, non-HTML response, or connection failure.                 |
| `unblocked-fetches` | The site did not refuse or throttle the scan.                                                                                    | Cloudflare/Akamai managed challenge interstitial (even at HTTP 200), captcha wall, 403 bot refusal, or 429 rate limit. |
| `rendered-body`     | At least one fetched page served text a non-JS consumer can read (>50 words or >200 characters).                                 | Empty client-side rendered JavaScript SPA shell (empty root container).                                                |
| `sample-adequate`   | At least one page of an applicable page type served readable text.                                                               | Pages fetched, but none usable for the required page types.                                                            |

- **Judgeable** means `origin-reachable` and `unblocked-fetches` both hold. Otherwise `planAudits()` marks every page-fed audit `notApplicable` with `Not assessed: <reason>`, and the scan is unscored.
- **A JavaScript shell** is not an empty scan: headers and root files arrived. Audits that read the body declare `rendered-body` and are skipped.
- **Exemptions** (`GATE_EXEMPTIONS` in `scripts/lib/requires-analysis.ts`) cover audits whose subject is the missing evidence: `content-extraction/server-rendered` drops `rendered-body`; `operability-safety/no-blocking-captcha` and `access-crawl-control/no-bot-detection` drop `rendered-body` and `unblocked-fetches`; `content-extraction/server-responsiveness` needs no rendered text.
- **`pnpm check:requires`** parses every audit source and fails when its `requires` disagrees with what it reads.

---

## 7. The score states its conditions

Two scan units, **one score**. Origin files affect every page — a `robots.txt` blocking GPTBot degrades every URL on the host — so folding origin mass into a page's score is accurate.

> **A score states the conditions under which it holds. Where the conditions
> cannot be stated, there is no score.**

Past `GATED_MASS_UNSCORED_THRESHOLD = 0.35` the output is `overallScore: null`. Coverage compares `assessedMass` with `registryMass`; `gatedMass` states what the scan could not read. The report's `conditions` carry them:

```
   ┌──────────────────────────────────────────────────────────┐
   │  score: 68                                               │
   ├──────────────────────────────────────────────────────────┤
   │  url       https://shop.example/p/sourdough              │
   │            └─ the score is about ONE document            │
   │  pageType  product  (declared)                           │
   │            └─ decides what counted at all                │
   │  origin    read 2026-08-30T14:02:11Z, cached             │
   │            └─ a cached fact is a fact from EARLIER       │
   │  coverage  assessed / registry mass, gated mass          │
   │  unscored  12 audits informative: page type not declared │
   └──────────────────────────────────────────────────────────┘
```

---

## 8. Audits do not reach the network

Gatherers do. One layer issues requests, so it is the only layer that needs the origin gate and the only one that can be counted, budgeted and cached.

```
   audit ──┐
   audit ──┼──► gatherer ──► net
   audit ──┘         ▲
                gated once, counted once, cached once
```

A gatherer with one consumer is still right: the fetch is visible to the scan and cacheable the moment a second consumer appears. That is how the OpenAPI family once reached seven identical copies of `getOpenApiSpec`.

`pnpm check:audit-boundaries` parses every production `.ts` file under `packages/core/src/audits/`, helpers included, and rejects `ctx.fetch`, destructured or global `fetch`, fetcher imports and direct HTTP client imports. Scanning the whole tree keeps the gate complete without an import graph, so a network helper must live in `gatherers/`, never in a directory the gate does not read. CI runs it on every push.

---

## 9. The warrant expires

A grade is a claim with a date. Every dossier carries a `reviewed:` date, and every audit is due for review on a window set by its grade: **A every 12 months, B every 6, C and D every 3**. The weaker the evidence, the sooner it can move.

```
   monthly workflow (.github/workflows/audit-review-sweep.yml)
          │
          ▼
   sweep `reviewed:` across docs/evidence/audits/
          │
          ▼
   open or update one rolling issue
     · audits past their window, oldest first, with grade and category
     · never fails a build
     · never moves a score
```

A second job watches the evidence itself rather than the date on it.

```
   weekly workflow (.github/workflows/source-watch.yml)
          │
          ▼
   re-check every docs/evidence/sources.json URL and every
   docs/evidence/watchlist.json item: status, redirect, TLS,
   text hash; IETF draft revision and state; GitHub archived,
   release and push; IANA well-known registry diff
          │
          ▼
   compare with the last run's state (a workflow artifact, not a commit)
          │
          ▼
   open or update one rolling issue, label `source-watch`
     · each changed source, with the audits whose dossiers cite it
     · broken, moved, revised or archived first; text edits after
     · the watchlist: not-built well-known paths and their registry status
```

A change found by the watch is a reason to review the citing dossiers early, whatever their `reviewed:` date.

This is the weakest enforcement here on purpose. A stale grade is not a broken build, and a score must not move because nobody did paperwork. The sweep only makes the debt impossible to forget.

---

## 10. Designs that were rejected

Recorded so they are not proposed again.

| proposal                                                        | why it failed                                                                                                                                                                                                                                                          |
| :-------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Five audit kinds**, the kind fixing the absence verdict       | Audits fit no kind (cross-artifact coherence, third-party artifacts, differential audits, per-URL artifacts) or fit two (`search-endpoint`, `contact-form`); and a `page-content` rule would force 23 accessibility audits to fail a page for lacking a dialog element |
| **`meta.subject`** as a required discriminated union            | A field can be green while `audit()` returns the wrong value — see §4                                                                                                                                                                                                  |
| **A central `artifacts.ts` registry**                           | `gatherers/` already is one. The real defect was one missing export from `gatherers/sitemap.ts`                                                                                                                                                                        |
| **An absence law with a source-id override**                    | Would silence 16 scored weight-1.0 bot audits to repair a measured defect of 1.6 weight, and its gate was a spelling check over 715 ids that already hold three spellings of RFC 9309                                                                                  |
| **Dropping type-specific audits when no page type is declared** | An empty check list passes `hasAssessableCheck`'s early return and scores 0 at full mass. Dropping punishes; informative protects                                                                                                                                      |
| **A blanket private-address refusal**                           | Breaks scanning a local development site. Consent attaches to the origin — see §5.2                                                                                                                                                                                    |
| **Two scores, one per scan unit**                               | The scan unit and the score unit need not follow each other                                                                                                                                                                                                            |
| **`consentTypes` as a field name**                              | Jargon. `pageType` is universal                                                                                                                                                                                                                                        |

---

## 11. Writing an audit today

- **Absence is `notApplicable`, not `fail`.** Only a present-and-defective artifact may fail (§3).
- **Put the precondition beside the read**, in the gatherer, with the reasoning written down. **Not in the runner**: `planAudits` knows page types and `EvidenceKey`s, both scan-level and domain-neutral. **Never as an `EvidenceKey`**: `gatedMassShare` counts skipped-for-no-evidence mass toward the 0.35 threshold, so an `openapi-spec-present` key would push weight into it on every site without an API.
- **`details` values are scalars or arrays of strings.** The schema accepts `string | number | boolean | string[]`. Anything else throws in `validate()`; the runner logs `Audit error` (component `audit`) and emits an errored `na` stub. Unit tests that call `audit.audit(ctx)` never reach `toCheckResult`, so parse through `AuditResultSchema` in the test whenever `details` is structured.
- **Reuse the gatherers.** A private read costs every scan and drifts.
- **Gate every URL taken from scanned content with `isSafeUrl()`.** Tests `vi.mock` the fetcher; no test performs real DNS.

## Browser snapshot evidence

The optional snapshot path reuses this engine and keeps crawler and browser DOM evidence apart. Snapshot findings never enter crawler scoring. See [Browser-rendered snapshot assessment](browser-snapshots.md).
