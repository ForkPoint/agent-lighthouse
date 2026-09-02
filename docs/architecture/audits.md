# How an audit is built

The architecture behind every check Agent Lighthouse runs: what an audit is,
what it may claim, and which rule stops it claiming more.

> **Status.** This file is the canonical design record. All sections below are
> **Enforced** in `main`. The six-phase audit architecture migration and
> standing debts are fully implemented, verified across test gates, and shipped.
> Git history keeps the full review dialogue and every superseded draft.

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

## 3. The four-way read _(enforced)_

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

Two rules follow. Both are implemented in `packages/core/src/gatherers/openapi.ts`
and `packages/core/src/gatherers/sitemap.ts` and enforced in `main`:

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

## 4. The declaration is a guard, not a field _(enforced)_

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

`packages/core/src/tests/absent-artifact-contract.test.ts` enforces this in `main`,
keying audit membership on the _import_ rather than on a list:

> The shared precondition constant is the closest thing to a declaration, so a
> family pins its own instance by exporting one and importing it.

---

## 5. Consent _(enforced)_

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

On `/shop/sourdough` the product branch runs first and no product rule matches —
the URL pattern wants `shop/{a}/{b}/{c}` and this path has one segment — so the
category regex claims it. Product detection by markup is a CSS class-name match.
And `content` means _"we could not classify this"_ — a label fourteen audits once
gated on, so a contact page and a privacy policy were judged for missing bylines.

Under consent, result mode is one pure function:

Provenance travels with each page, not with the scan: every `PageContext` keeps
its `pageType` and gains a `pageTypeSource` of `declared` or `detected`. The
scan target is `declared` from `--page-type`, each URL named in
`ScanOptions.pages` is `declared` from its override, and everything the crawl
found is `detected`.

One pure function then decides an audit's whole participation — the pages it may
read **and** the mode its result is reported in — because deciding those apart is
what would let a guess reach a score:

```ts
// meta — the page types under which this audit is scored
const meta = { pageTypes: ["product"] satisfies PageType[] };

interface AuditScope {
  pages: readonly PageContext[]; // immutable, per audit
  mode: ScoreDisplayMode;
}

function scopeForAudit(meta: AuditMeta, ctx: CheckContext): AuditScope {
  if (!meta.pageTypes?.length) {
    return { pages: ctx.pages, mode: meta.scoreDisplayMode };
  }

  const declared = ctx.pages.filter(
    (p) =>
      p.pageTypeSource === "declared" && meta.pageTypes.includes(p.pageType),
  );
  if (declared.length > 0) {
    return { pages: declared, mode: meta.scoreDisplayMode };
  }

  const detected = ctx.pages.filter((p) => meta.pageTypes.includes(p.pageType));
  return { pages: detected, mode: "informative" };
}
```

A page selected because of a detected page type never enters a scored page set.
An audit that declares no `pageTypes` is universal and gets every page.

The runner applies both halves when it creates `CheckResult`. `AuditPlan` stays
`{ reg, categoryId }`, and static audit meta is never changed. Two concurrent
scans therefore cannot leak consent state into each other.

Audits do not read `pageType` themselves. A typed audit that needs a narrower
cut of the pages it was handed goes through `gatherers/pages.ts`, which already
owns that boundary. The per-audit view also keeps `allPages` as a read-only,
gatherer-only view of the full sample. A source gate rejects direct audit reads
of `allPages`. This lets a gatherer add a page because it carries objective
artifact evidence, such as Article markup, without letting the page's detected
type authorize that addition.

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

### Stable audit mass, conditional participation

An audit keeps one intrinsic weight from its grade and tier. That weight never
changes when the audit scores. An `informative` or `na` result does not
participate in the score, so its effective mass for that scan is zero.

The scorer therefore keeps two values instead of using one value for two jobs:

```ts
registryMass = sum(registeredAudits.map((audit) => audit.meta.weight));

assessedChecks = category.checks.filter(
  (check) => check.status !== "na" && !isInformative(check),
);
assessedMass = sum(assessedChecks.map((check) => check.weight));
```

- `registryMass` measures coverage. It never weights the overall score.
- `assessedMass` weights the category in the overall score.
- `gatedMass` stays separate and still decides when missing evidence makes the
  honest result `overallScore: null`.

The overall formula is:

```ts
overallScore =
  sum(categories.map((category) => category.score * category.assessedMass)) /
  sum(categories.map((category) => category.assessedMass));
```

If the total assessed mass is zero, the report returns no overall score.

This correction is required for consent. Structured Data has 9.6 registered
mass, of which 7.6 is page-typed. On a scan with only 2.0 assessed mass, applying
the static 9.6 category mass makes those remaining audits act 4.8 times heavier.
Using `assessedMass` preserves each audit's declared weight.

`isInformative` remains the single predicate for _"shown to the user, never
influences a score"_. Consent does not count as missing evidence and therefore
does not increase `gatedMass`.

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

The application keeps its pre-request DNS check and repeats the check on every
redirect. It does not pin the checked IP inside the HTTP client. A hosted or
multi-tenant deployment must also deny outbound connections to localhost,
private networks and metadata endpoints at the network boundary. The local CLI
may allow the operator-selected local origin so development scans keep working.

---

## 6. Scope _(enforced)_

An audit's subject is either one document or one origin.

```
   ┌─────────────────────────────┐     ┌─────────────────────────────┐
   │        PAGE SCOPE           │     │       ORIGIN SCOPE          │
   ├─────────────────────────────┤     ├─────────────────────────────┤
   │ the document at the URL     │     │ robots.txt   sitemap.xml    │
   │ the operator gave           │     │ llms.txt     openapi.json   │
   │                             │     │ /.well-known/*   MCP        │
   │ cache key:  URL             │     │ cache key: origin + version │
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

Shared origin caching applies only to the canonical anonymous request profile.
An origin scan with URL credentials, an authorization header or explicit
prefetched evidence bypasses the shared cache. Raw credentials never enter a
cache key. The anonymous key includes `ORIGIN_EVIDENCE_VERSION`; every record
stores `readAt` and expires by the phase's stated TTL.

The unread-scan guard is unconditional. It runs before every audit and has no
production opt-out. The narrower `requires` gate defaults on.
`ScanOptions.enforceEvidenceGate: false` remains a documented diagnostic
opt-out for comparing gated and ungated evidence. It never bypasses the
unread-scan guard. A full-registry bypass exists only in a test helper that the
package does not export.

### 6.1 The scan evidence gate _(enforced)_

An audit cannot tell "this page has no `<main>` element" from "the scanner never obtained this page's HTML". Without gating, missing evidence produces either false failures or vacuous passes (e.g. a site behind a Cloudflare captcha wall passing `no-blocking-captcha`).

Before audits run, `buildScanEvidence()` in `packages/core/src/scan-evidence.ts` constructs a pure evidence record evaluating four orthogonal requirements:

| Requirement         | What it proves                                                                                                                   | Failure condition                                                                                                      |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| `origin-reachable`  | The response belongs to the site requested (matching host, registrable domain, sibling ccTLD storefront, or permanent redirect). | Temporary redirect away to an unrelated broker/parking page, non-HTML response, or connection failure.                 |
| `unblocked-fetches` | The site did not refuse or throttle the scan.                                                                                    | Cloudflare/Akamai managed challenge interstitial (even at HTTP 200), captcha wall, 403 bot refusal, or 429 rate limit. |
| `rendered-body`     | At least one fetched page served text a non-JS consumer can read (>50 words or >200 characters).                                 | Empty client-side rendered JavaScript SPA shell (empty root container).                                                |
| `sample-adequate`   | At least one page of an applicable page type served readable text.                                                               | Pages fetched, but none usable for the required page types.                                                            |

**Attribution (`judgeable`).** A scan is judgeable only when both `origin-reachable` and `unblocked-fetches` hold. If either fails, the scan obtained nothing attributable to the site; `planAudits()` marks all page-fed audits `notApplicable` with a human-readable `Not assessed: <reason>` explanation.

**Handling JavaScript shells.** An empty JS shell is not an empty scan: the response arrived and the headers and root files exist. What is missing is the rendered body document. An audit whose population lives in the body (`token-ratio`, `content-depth`, `figure-figcaption`, etc.) declares `rendered-body` and is cleanly skipped.

**Deliberate exemptions (`GATE_EXEMPTIONS`).** Audits whose subject _is_ the missing evidence declare exemptions in `scripts/lib/requires-analysis.ts`:

- `content-extraction/server-rendered` drops `rendered-body` because reporting an unrendered shell is its explicit purpose.
- `operability-safety/no-blocking-captcha` and `access-crawl-control/no-bot-detection` drop `rendered-body` and `unblocked-fetches` so they can report the presence of defense interstitials.
- `content-extraction/server-responsiveness` measures TTFB from the response envelope and does not need rendered text.

**Ratchet enforcement.** `pnpm check:requires` uses static AST parsing to prove that every audit source's `requires` matches what it actually reads, refusing drift at build time.

---

## 7. The score states its conditions _(enforced)_

Two scan units, **one score**. Origin files genuinely affect every page — a
`robots.txt` blocking GPTBot degrades every URL on the host — so folding that
mass into each page's score is accurate, not a distortion.

The repository already scores conditionally: past
`GATED_MASS_UNSCORED_THRESHOLD = 0.35`, the honest output is
`overallScore: null`.

> **A score states the conditions under which it holds. Where the conditions
> cannot be stated, there is no score.**

The score uses `assessedMass`. Coverage compares `assessedMass` with
`registryMass`, while `gatedMass` states what the scan could not read. Category
names group findings; they never inflate an audit's intrinsic weight.

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

## 8. Audits do not reach the network _(enforced)_

Gatherers do. One layer issues requests, so it is the only layer that needs the
origin gate and the only layer that can be counted.

```
   BEFORE                                AFTER
   ────────────────────────────          ────────────────────────────
   audit ──┐                             audit ──┐
   audit ──┼──► ctx.fetch ──► net        audit ──┼──► gatherer ──► net
   audit ──┘                             audit ──┘         ▲
    …36 audits reach net                    …one layer     │
      6 fetch a content URL                             gated once
        with no isSafeUrl                              counted once
     14 verified named limits                           cached once
      other limits vary
      no shared budget
```

A gatherer with exactly one consumer is still correct. The fetch becomes
**visible** to the scan instead of hidden in a private constant, **countable**
so a budget can be enforced rather than declared, and **cacheable** the moment a
second consumer appears — which is precisely how the OpenAPI family reached
seven byte-identical copies of `getOpenApiSpec`.

It also removes the possibility of the duplication it was cloned from: with no
audit able to reach the network, a private reader has nowhere to live.

**How the 36 is counted.** A _network-reaching audit_ is a registered audit that
can issue a request, directly or through a helper. 31 call `ctx.fetch` in their
own file. The other 5 — `mcp-version-downgrade`, `mcp-tool-description-coverage`,
`mcp-tool-contract-validity`, `mcp-tools-list-determinism`,
`mcp-modern-era-reachability` — name no fetch at all and reach the network
through `agent-interfaces/_mcp-client.ts`, a shared helper that lives inside the
audit tree and is registered as no audit. Counting files that call `ctx.fetch`
gives 32 and counts that helper as an audit; counting registered audits that can
reach the network gives 36. The second is the number this document uses.

The enforcing source gate parses every production TypeScript file under the audit
tree — audit sources **and** the private helpers beside them, `_mcp-client.ts`
included — and rejects `ctx.fetch`, destructured or global `fetch`, imports from
the fetcher, and imports from direct HTTP clients. Scanning the whole tree is
what makes the gate complete without an import graph, so the rule that keeps it
complete is: an audit's network helper stays inside the audit tree until Phase 4b
moves it into a gatherer, and never lands in some third directory the gate does
not read. The project does not add a second fetch-free audit context type; the
source gate remains necessary even with such a type and is the smaller complete
boundary. The gate runs in CI as `pnpm check:audit-boundaries`.

---

## 9. The warrant expires _(enforced)_

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

## 11. Standing debts _(all resolved in main)_

Measured 2026-08-30 across 215 registered audits. **All resolved in main** across
the six architecture migration phases:

| debt                                                                           | resolution in `main`                                                                                                                                                                   |
| :----------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An audit's own code does not stop it verdicting on a scan that reached nothing | **Resolved (Phase 1):** Universal unread-scan precondition in `planAudits`; enforced whole-registry by `unreachable-contract.test.ts` with no exemptions.                              |
| The empty-scan fixture contradicts itself                                      | **Resolved (Phase 1):** Truthful fixtures (`fixtureA` & `fixtureB`) in `packages/core/src/tests/fixtures.ts`.                                                                          |
| An artifact-contents audit fails on absence                                    | **Resolved (Phase 2):** Four-way read (`absent`, `empty`, `malformed`, `readable`) in `gatherers/openapi.ts` and `gatherers/sitemap.ts`; pinned by `absent-artifact-contract.test.ts`. |
| The page-type gate is doing the absence rule's job                             | **Resolved (Phase 3):** User consent via `--page-type`; detected page types run informative (weight 0).                                                                                |
| Private readers duplicate a gatherer                                           | **Resolved (Phases 2 & 4b):** All private readers centralized in `gatherers/`; zero duplication.                                                                                       |
| Content-harvested URLs reach the network ungated                               | **Resolved (Phase 4a):** `isSafeUrl()` enforced inside `ctx.fetch` keyed on scan origin.                                                                                               |
| Fetching is unbounded in aggregate                                             | **Resolved (Phase 4b):** All 36 network-reaching audits moved to gatherers; `pnpm check:audit-boundaries` AST gate enforces zero network calls in production audits.                   |
| The warrant has no expiry                                                      | **Resolved (Phase 6):** Automated 6-month review sweep in `.github/workflows/audit-review-sweep.yml`.                                                                                  |

---

## 12. Writing an audit today

These hold in `main` today:

- **Absence is `notApplicable`, not `fail`.** Only a present-and-defective
  artifact may fail. Handled via the four-way read in gatherers and enforced
  by `tests/absent-artifact-contract.test.ts`.
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
