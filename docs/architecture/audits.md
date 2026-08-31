# How an audit is built

The architecture behind every check Agent Lighthouse runs: what an audit is,
what it may claim, and which rule stops it claiming more.

> **Status.** Every section carries one. **Enforced** holds in `main` today.
> **PR 23** is written but unmerged. **Decided** was settled on 2026-08-30 and is
> _not built_ — do not assume the code obeys it. The working record, with every
> measurement and every rejected alternative, is in
> `docs/superpowers/specs/2026-08-30-audit-architecture-quiz.md`.

---

## The one rule above the rest

> **An audit may only claim what a source documents.** If no vendor documents a
> consumer, the check does not affect a site's score. Ever.

Everything below is that rule applied to a different surface: to absence, to
page classification, to network addresses, to the score itself.

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

Warrant and cost are one part, not two, because the weight is derived:

```
       evidence grade          tier              weight
       ──────────────          ────              ──────
            A          ×     scored      =        1.0
            B          ×     scored      =        0.6
            C or D     ×     scored      =        0     (unregistrable)
            any        ×     not scored  =        0

                  weight = weightForGrade(grade, tier)
```

There is one knob — the grade — and the weight follows it. Never hand-set one.

---

## 2. Three sentences

Every law is one of these.

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

The third is why this file exists. An architecture proposal was once built on
four wrong facts, because nothing in the repository answered _which rules are
load-bearing?_ Three of its numbers were grep artifacts over fields the schema
already required.

---

## 3. The four-way read _(written for OpenAPI in PR 23, unmerged; decided elsewhere)_

The shared vocabulary for reading any artifact — a file, or a page's structured
data. The gatherer that reads it owns the classification; the audit only judges.

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

Two rules follow. Both are written into `packages/core/src/gatherers/openapi.ts`,
which lives on `fix/absent-artifact-is-not-a-failure` (PR 23) and is **not** in
`main`:

- **Broken is judged over what survives the read, not over the whole artifact.**
  One malformed entry beside twenty good ones does not erase the twenty.
- **The decline states what the read observed, not what the site did.** _"No
  readable OpenAPI document at `/openapi.json`"_ — not _"the site publishes no
  OpenAPI document"_, which the read never established.

### Why this exists

Four `openapi-*` audits used to `fail` on every site with no OpenAPI document —
2.4 combined weight telling a bakery to add a `servers` array to a spec it had
never written.

The same shape sits in `main` today: `machine-discovery/sitemap-lastmod`, grade
A at weight 1.0, returns `fail` at `priority: 'critical'` when a site has no
sitemap.

---

## 4. The declaration is a guard, not a field _(decided)_

A declaration that _describes_ can be true while the code contradicts it.

```
   ┌─── A FIELD ─────────────────────────────────────────────────┐
   │                                                             │
   │   meta: { subject: 'artifact-contents', artifact: 'sitemap' }│
   │            ✓ typechecks                                     │
   │                                                             │
   │   audit(ctx) {                                              │
   │     if (!getSitemapResult(ctx))                             │
   │       return this.fail('No sitemap found');   ✓ typechecks  │
   │   }                                            ✗ WRONG      │
   │                                                             │
   │   The bug is a VALUE bug inside audit().                    │
   │   No type on meta reaches it.                               │
   └─────────────────────────────────────────────────────────────┘

   ┌─── A GUARD ─────────────────────────────────────────────────┐
   │                                                             │
   │   static reads = openApiContents;   ← runs before judge()   │
   │                                                             │
   │   judge(spec, ctx) {                                        │
   │     const servers = spec['servers'];   ← guaranteed readable│
   │     …only the judgement lives here                          │
   │   }                                                         │
   │                                                             │
   │   The author never writes the absent case,                  │
   │   and therefore cannot write it wrong.                      │
   └─────────────────────────────────────────────────────────────┘
```

`packages/core/src/tests/absent-artifact-contract.test.ts` — also PR 23, also
unmerged — reached the same conclusion independently, and keys audit membership
on the _import_ rather than on a list:

> The shared precondition constant is the closest thing to a declaration, so a
> family pins its own instance by exporting one and importing it.

---

## 5. Consent _(decided)_

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
      │                   │             │                   │
      │ NEVER moves       │             │ MAY move          │
      │ a score           │             │ a score           │
      └───────────────────┘             └───────────────────┘
```

This resolves two unrelated-looking problems the same way.

### 5.1 Page type

`detectPageType` is four ordered rules whose last branch has no test:

```
   isFirstPage && path === '/'   ──► homepage     positive claim
   isProductPage(...)            ──► product      positive claim
   isCategoryPage(...)           ──► category     positive claim
   ────────────────────────────────────────────
   (nothing matched)             ──► content      ✗ NOT A CLAIM
                                                    "we could not tell"
```

`/shop/sourdough` matches the **category** regex before the product branch is
reached. Product detection by markup is a CSS class-name match. And `content`
means _"we could not classify this"_ — a label fourteen audits once gated on,
so a contact page and a privacy policy were judged for missing bylines.

Under consent, the whole mechanism is one expression:

```ts
// meta — the page types under which this audit is scored
pageTypes: ['product'],

// runner — the only new logic anywhere
scoreDisplayMode:
  meta.pageTypes?.length && !meta.pageTypes.includes(ctx.declaredPageType)
    ? 'informative'          // reported in full, never scored
    : meta.scoreDisplayMode,
```

`scorer.ts` does not change. `isInformative` is already the documented single
source of truth for _"shown to the user, never influences a score"_, and every
ranking surface filters through it.

```
   al scan URL --page-type product     al scan URL
            │                                │
            ▼                                ▼
      ┌──────────┐                     ┌──────────┐
      │ CONSENT  │                     │ NO       │
      │          │                     │ CONSENT  │
      ├──────────┤                     ├──────────┤
      │ scored   │                     │informative│
      │ shown    │                     │ shown     │
      └──────────┘                     └──────────┘

   Both report every finding. Only the score differs.
```

Three behaviours are inherited rather than designed:

| existing rule                                                                     | effect on an unconsented finding                                                        |
| :-------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| `calculateCategoryScore:29` excludes `na` and informative                         | leaves the category denominator                                                         |
| `gatedMassShare:126` skips informative before counting                            | does **not** count toward the 0.35 unscored threshold — consent is not missing evidence |
| `hasAssessableCheck:80` drops a category whose checks are all `na` or informative | the category leaves the overall score rather than scoring 0                             |

The last one matters, and the scorer already explains why:

> without it a site with no commerce surface paid the whole agentic-commerce
> evidence mass at score 0, which reads as a penalty for not being a shop

**Dropping the audits instead would punish the site.** An empty check list passes
`hasAssessableCheck`'s early return and scores 0 at full mass. Informative
protects; dropping punishes.

### 5.2 Network address

The same distinction, one layer down: **the operator's URL is trusted, a URL
taken from scanned content is not.** Scanning `http://localhost:3000` before a
deploy is a first-class use, so the rule keys on **origin**, not address class.

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

The fetcher already states the principle at `fetcher.ts:292`:

> The gate is armed only when the starting URL is itself public: an operator who
> deliberately points the scanner at a dev host gains nothing from having its
> redirects refused.

---

## 6. Scope _(decided)_

An audit's subject is either one document or one origin.

```
   ┌─────────────────────────────┐     ┌─────────────────────────────┐
   │        PAGE SCOPE           │     │       ORIGIN SCOPE          │
   ├─────────────────────────────┤     ├─────────────────────────────┤
   │ the document at the URL     │     │ robots.txt   sitemap.xml    │
   │ the operator gave           │     │ llms.txt     openapi.json   │
   │                             │     │ /.well-known/*   MCP        │
   │ cache key:  URL             │     │ cache key:  origin          │
   │ 134 audits · 88.4 mass      │     │  76 audits · 42.8 mass      │
   │ 66.0%                       │     │ 32.0%                       │
   └─────────────────────────────┘     └─────────────────────────────┘
```

Twenty-six audits read both. They are **not** dual-subject — they are origin
audits that also scrape a page for a discovery link. `openapi-exists` reads
`/openapi.json` **and** `<link rel="service-desc">`.

Under per-URL scans that breaks origin idempotence:

```
   scan https://shop.example/            ► <link rel="service-desc"> found
   scan https://shop.example/p/bread     ► not found

   Same origin. Same artifact. Different verdict,
   decided by which URL the operator happened to type.
```

> **An origin fact must be idempotent per origin.** Those 26 belong to the origin
> scan and read the origin's homepage, never the scanned page.

---

## 7. The score states its conditions _(decided)_

Two scan units, **one score**. Origin files genuinely affect every page — a
`robots.txt` blocking GPTBot degrades every URL on the host — so folding that
mass into each page's score is accurate, not a distortion.

The repository already scores conditionally: past
`GATED_MASS_UNSCORED_THRESHOLD = 0.35`, the honest output is
`overallScore: null`.

> **A score states the conditions under which it holds. Where the conditions
> cannot be stated, there is no score.**

```
   ┌──────────────────────────────────────────────────────────┐
   │  score: 68                                               │
   ├──────────────────────────────────────────────────────────┤
   │  url       https://shop.example/p/sourdough              │
   │            └─ the score is about ONE document            │
   │                                                          │
   │  pageType  product  (declared)                           │
   │            └─ decides what counted at all                │
   │                                                          │
   │  origin    read 2026-08-30T14:02:11Z, cached             │
   │            └─ a cached fact is a fact from EARLIER       │
   │                                                          │
   │  coverage  page 88.4 · origin 42.8 · gated 0.0           │
   │            └─ already computed, never shown until now    │
   │                                                          │
   │  unscored  12 audits informative: page type not declared │
   └──────────────────────────────────────────────────────────┘
```

---

## 8. Audits do not reach the network _(decided)_

Gatherers do. One layer issues requests, so it is the only layer that needs the
origin gate and the only layer that can be counted.

```
   BEFORE                                AFTER
   ────────────────────────────          ────────────────────────────
   audit ──┐                             audit ──┐
   audit ──┼──► ctx.fetch ──► net        audit ──┼──► gatherer ──► net
   audit ──┘                             audit ──┘         ▲
     …33 call sites                        …one layer      │
      9 ungated                                        gated once
     33 private caps                                  counted once
     nothing sums them                                cached once
```

A gatherer with exactly one consumer is still correct. The fetch becomes
**visible** to the scan instead of hidden in a private constant, **countable**
so a budget can be enforced rather than declared, and **cacheable** the moment a
second consumer appears — which is precisely how the OpenAPI family reached
seven byte-identical copies of `getOpenApiSpec`.

It also removes the possibility of the duplication it was cloned from: with no
audit able to reach the network, a private reader has nowhere to live.

---

## 9. The warrant expires _(decided)_

A grade is a claim with a date. Specs gain adoption; vendors document consumers
they previously did not. Every audit is re-reviewed every **6 months**.

```
   scheduled workflow
          │
          ▼
   sweep `reviewed:` across docs/evidence/audits/
          │
          ▼
   open or UPDATE one rolling issue
   ─────────────────────────────────────────────
     · oldest first, with grade and category
     · one issue, updated in place
     · never fails a build
     · never moves a score
```

Deliberately the weakest enforcement of any law here. A stale grade is not a
broken build, and a score must not move because nobody did paperwork. The gate's
only job is to make the debt impossible to forget.

Today 215 of 216 dossiers carry a `reviewed:` date, and every one falls between
2026-08-20 and 2026-08-24 — a single research sprint. The stamp exists, is fully
populated, and nothing reads it.

---

## 10. Designs that were rejected

Recorded so they are not proposed again.

| proposal                                                        | why it failed                                                                                                                                                                                                                                                      |
| :-------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Five audit kinds**, the kind fixing the absence verdict       | Audits fit no kind (cross-artifact coherence, third-party artifacts, differential audits, per-URL artifacts) or fit two (`search-endpoint`, `contact-form`); and a `page-content` rule would force 23 accessibility audits to fail a page for lacking a `<dialog>` |
| **`meta.subject`** as a required discriminated union            | A field can be green while `audit()` returns the wrong value — see §4                                                                                                                                                                                              |
| **A central `artifacts.ts` registry**                           | `gatherers/` already is one. The real defect was one missing export from `gatherers/sitemap.ts`                                                                                                                                                                    |
| **An absence law with a source-id override**                    | Would silence 16 scored weight-1.0 bot audits to repair a measured defect of 1.6 weight, and its gate was a spelling check over 715 ids that already hold three spellings of RFC 9309                                                                              |
| **Dropping type-specific audits when no page type is declared** | An empty check list passes `hasAssessableCheck`'s early return and scores 0 at full mass. Dropping punishes; informative protects                                                                                                                                  |
| **A blanket private-address refusal**                           | Breaks scanning a local development site. Consent attaches to the origin — see §5.2                                                                                                                                                                                |
| **Two scores, one per scan unit**                               | The scan unit and the score unit need not follow each other                                                                                                                                                                                                        |
| **`consentTypes` as a field name**                              | Jargon. `pageType` is universal                                                                                                                                                                                                                                    |

---

## 11. Standing debts

Measured 2026-08-30 across 215 registered audits. **None is fixed.**

| debt                                               | measurement                                                                                                                                                                           |
| :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Audits verdict on a scan that reached nothing      | **62** do. 15 are robots.txt bot audits warning _"robots.txt not found"_ about a host that never answered                                                                             |
| The empty-scan fixture contradicts itself          | `emptyContext()` sets `judgeable: true` and `usablePageTypes: ALL_PAGE_TYPES` while supplying zero pages. It manufactured 19 phantom violations, including 7 phantom "vacuous passes" |
| An artifact-contents audit fails on absence        | `sitemap-lastmod` (A, 1.0) `fail`s at `priority: 'critical'`; `sitemap-absolute-urls` (B, 0.6) `fail`s. 1.6 weight                                                                    |
| The page-type gate is doing the absence rule's job | `product-identifiers` has **no** `notApplicable` branch — the gate is the only thing keeping `fail: 'No Product schema found'` off a bakery                                           |
| Private readers duplicate a gatherer               | 5 audits carry `getSitemapResult` while `gatherers/sitemap.ts` exists without the four-way split                                                                                      |
| Content-harvested URLs reach the network ungated   | 9 of 33 fetching audits never import `isSafeUrl`. An unguarded first hop is fetched **and** disarms the redirect gate behind it                                                       |
| Fetching is unbounded in aggregate                 | 33 audits, 33 private caps, nothing sums them                                                                                                                                         |
| The warrant has no expiry                          | 215 of 216 `reviewed:` stamps, all one sprint, read by nothing                                                                                                                        |

---

## 12. Writing an audit today

These hold in `main` today, except where marked.

- **Absence is `notApplicable`, not `fail`.** Only a present-and-defective
  artifact may fail. The worked example, `gatherers/openapi.ts`, and the contract
  test that pins it, `tests/absent-artifact-contract.test.ts`, are in PR 23 and
  not yet merged. Until they land, `tests/na-contract.ts` is the only helper
  enforcing this, and §11 lists where it does not.
- **Put the precondition beside the read**, in the gatherer, with the reasoning
  written down. Two places it must not go. **Not the runner** — `planAudits`
  knows page types and `EvidenceKey`s, both scan-level and domain-neutral, and
  teaching it one artifact type invites every other to follow. **Never an
  `EvidenceKey`** — `gatedMassShare` counts skipped-for-no-evidence mass toward
  the 0.35 threshold, so an `openapi-spec-present` key would push that weight
  into the numerator on every site without an API.
- **`details` values are scalars or arrays of strings.** The catchall accepts
  `string | number | boolean | string[]`, and `validate()` calls `.parse`, which
  **throws** — the runner then logs `[scanner] Audit error` and emits an errored
  `na` stub, so one bad value costs the whole result. Unit tests call
  `audit.audit(ctx)` directly and never reach `toCheckResult`, so parse through
  `AuditResultSchema` in the test whenever `details` carries anything structured.
- **Reuse the gatherers.** A per-audit read that duplicates one costs every scan
  and drifts.
- **Gate every URL taken from scanned content with `isSafeUrl()`.** Test suites
  `vi.mock` the fetcher and stub it; no test performs real DNS.
