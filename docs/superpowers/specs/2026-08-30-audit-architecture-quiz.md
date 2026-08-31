# Law quiz — explanations and the user's rulings

**Date:** 2026-08-30
**Branch:** `docs/audit-architecture`
**Format:** Claude explains each law from
[`2026-08-30-audit-architecture-design.md`](./2026-08-30-audit-architecture-design.md);
the user rules on whether the explanation is right. User notes are recorded verbatim.

This file is the record of what was ratified, what was rejected, and what the
quiz turned up that the design did not contain. Where a ruling changes a law,
the change is tracked in the "Consequence" row and applied to the design
document separately.

---

## Law 1 — One audit, one file, one dossier

**Claude's explanation.** This is not about tidiness. `scripts/check-dossiers.mjs`
proves agreement in both directions: every registered audit has a dossier whose
`evidence_grade` and `slug` match its meta, every `sources:` id resolves, and no
dossier survives its audit's removal — removed audits move to
`docs/evidence/sunset/`, merged ones to `docs/evidence/merged/`, neither is
deleted. The bidirectionality is the point: a one-way check would let a dossier
drift into fiction after its audit changed grade, and the dossier is what the
public website publishes.

**Ruling.** No option selected. Note given instead.

> the idea is that one file codewise does not mean we are not reausing some
> pre-conditions of library peaces that will be used in all audits, if you like
> we can make a some kind of annotations or cross cutting concerns so there are
> reusable pieces and the actual code of the audit is focusing on the audit
> itself not some boilerplate code for preconditions

**Consequence.** The explanation was not the point. "One audit, one file" must
not be read as "every audit reimplements its own preconditions." Preconditions
are cross-cutting concerns and belong in reusable pieces — annotations,
decorators or guards — so an audit body holds the judgement and nothing else.

This is stronger than the design's law 5. Importing a _constant_ is passive: an
audit can import `NO_OPENAPI_SPEC` and still branch wrongly around it. Importing
a _guard that runs_ is active, and cannot be satisfied without being obeyed. It
also partly revives the "framework prevents it" option, which the review
rejected on migration cost rather than on soundness.

**Status:** law 1 to be re-drafted. New law needed on precondition reuse.

---

## Law 2 — The grade sets the weight

**Claude's explanation.** Weight is a derived value, never a knob.
`weightForGrade(grade, tier)` gives A → 1.0, B → 0.6, C/D → 0, and
`sunset.test.ts` enforces three consequences: a non-scored tier implies weight 0
and `scoreDisplayMode: 'informative'`; grade C in the scored tier is
unregistrable because `weightForGrade` returns 0 for it; and `tier !== 'scored'`
is equivalent to `weight === 0`. The reason is the top law — weight is how much
a claim moves a score, so it must be a function of how well the claim is
evidenced, never of how important it feels.

**Ruling.** No option selected. Note given instead.

> however this means that grades for audits will drift over time, since some
> adopted specs will become more valuable over time, so a constant research is
> important to be done, we need to stamp when the audit was last validated and
> researched, is the info stale

**Consequence.** The mechanism is not disputed; the missing part is time. A
grade is a claim with a date. Specs gain adoption, vendors document consumers
they previously did not, and a grade earned in one month is not the same claim a
year later.

Measured on this branch: **215 of 216 dossiers carry a `reviewed:` date, and
every one falls in 2026-08-20 to 2026-08-24** — a single research sprint. The
stamp exists, is fully populated, and nothing reads it. No gate, no staleness
threshold, no re-review trigger.

**Status:** law 2 keeps its mechanism and gains a sibling law on warrant
freshness. New debt: the `reviewed:` stamp is unused.

---

## Law 3 — Score only the population the evidence covers

**Claude's explanation.** `applicablePageTypes` is enforced at runtime by
`planAudits`, not in CI, and that is correct rather than a gap. Omitting the
field means "all page types", which is a valid and common declaration — 180 of
215 omit it — so there is nothing a CI check could compare it against without a
second declaration of the same fact. The failure it prevents: a grade earned for
coding agents does not license failing a retail store.

**Ruling.** No option selected. Note given instead.

> i am not ok with this example, the applicable page types were ideal for pages
> of e-commerce improtance like PDP PLP Homepage, but i need to revisit this
> idea in general, maybe generalize the audits for all types of sites
> independent of page type

**Consequence.** Not ratified. The example was wrong, and the concept itself is
under review. `applicablePageTypes` was introduced for e-commerce page classes —
PDP, PLP, homepage — and the open question is whether audits should instead hold
for any site regardless of page type, which would remove the field rather than
gate it.

**Status:** law 3 parked. Open question, not a settled law. Nothing in the
design should assert it until this is decided.

---

## Law 4 — Declare what the scan must have obtained

**Claude's explanation.** `requires` names classes of scan evidence an audit
needs to say anything true — `origin-reachable`, `unblocked-fetches`,
`rendered-body`, `sample-adequate` — and `scripts/check-requires.mjs` compares
that declaration against what the source actually reads. Four audits declare
`requires: []` deliberately and are listed as `GATE_EXEMPTIONS`:
`access-crawl-control/no-redirect-chains`, `no-bot-detection`, `https-enabled`,
and `operability-safety/no-blocking-captcha`. The reason: their subject _is_ the
missing evidence. `no-bot-detection` cannot require `unblocked-fetches`, because
a blocked fetch is exactly what it reports on.

**Ruling.** **Correct.**

**Status:** ratified as written.

---

## Running tally

|  law | ruling              | effect on the design                                                             |
| ---: | :------------------ | :------------------------------------------------------------------------------- |
|    1 | note, not a verdict | re-draft; add a law on precondition reuse                                        |
|    2 | note, not a verdict | keep mechanism, add a freshness law, record the unused `reviewed:` stamp as debt |
|    3 | note, not a verdict | park as an open question; do not assert                                          |
|    4 | correct             | ratified                                                                         |
| 5–10 | pending             | —                                                                                |

---

## Law 5 — Absent artifact, absent verdict

**Claude's explanation.** The gatherer that reads an artifact owns a four-way
split — absent (nothing readable arrived), empty (readable, declares nothing),
malformed (nothing readable and the author wrote the breakage), readable
(something survives, defects may sit beside it). Absent and empty decline;
malformed fails; readable grades what survived and names the rest. Following
law 1's note: the design wrote the declaration as importing a _constant_, but a
constant is passive — an audit can import `NO_OPENAPI_SPEC` and still branch
wrongly around it. A guard that _runs_ cannot be satisfied without being obeyed.

**Ruling.** No option selected.

> i don't get this one, let's discuss it again

**Status:** open. Explanation was unclear and must be re-made from first
principles, not from the vocabulary the design already assumes.

---

## Law 6 — A scan that read nothing yields no verdict

**Claude's explanation.** `emptyContext()` builds its evidence from
`allEvidenceMet()`, which sets `judgeable: true` and `usablePageTypes:
ALL_PAGE_TYPES`, while supplying zero pages. The fixture therefore asserts "the
scan read the site fine" and "there are no pages" simultaneously, a state no
real scan produces. `single-h1` passes its `scanReadTheSite` guard on that
fixture and falls through to `!homepage -> fail`. So some of the 81 audits that
"cannot satisfy the contract" may be fixture artifacts rather than real
violations.

**Ruling.** No option selected.

> have to discussi this in details, can't understand what you are asking

**Status:** open. The question was posed in terms of a fixture the reader has
no reason to hold in mind. Needs re-framing around what a scan actually is.

---

## Law 7 — Gate every URL taken from scanned content with `isSafeUrl()`

**Claude's explanation.** SSRF defence. `isSafeUrl` resolves DNS and refuses
localhost and private addresses. The fetcher re-applies it on redirect hops, but
`gateArmed ??= await isSafeUrl(targetUrl)` arms the gate only when the starting
URL is already public — so an unguarded first hop bypasses the check _and_
disarms the redirect gate behind it. Nine of 33 fetching audits never import it.

**Ruling.** No option selected. A design objection was raised instead.

> don't see why i wouldn't be scanning a local dev website before uploading to
> production

**Consequence.** This is a hit, and it is not about the mechanism. Scanning
`http://localhost:3000` before a deploy is a legitimate, arguably primary use of
the tool. A blanket private-address refusal breaks it. So the rule cannot be
"never touch a private address" — the real distinction is between an address the
_operator_ named and an address the _scanned site_ supplied. The first is
consent; the second is the attack.

**Status:** law 7 to be re-drafted around operator intent, not address class.
The nine unguarded audits remain a finding; the rule that governs them changes.

---

## Law 8 — Bound what you fetch

**Claude's explanation.** 33 audits call `ctx.fetch`, each with a private cap —
`MAX_PROBES = 3`, `DEAD_URL_SAMPLE = 5`, `MAX_ENTITIES = 2`, `.slice(0, 20)`.
Each is locally reasonable; the sum is nobody's. The reason it matters is not
politeness: exceeding what a host tolerates gets the scanner rate-limited
mid-scan, which corrupts the `unblocked-fetches` evidence key that other audits
declare in `requires`, so the scan reports a site as hostile when the scanner
was the cause.

**Ruling.** No option selected. A deeper objection was raised.

> the use of so many fetches is somehow a sign of a ery bad architecture, let's
> discuss what audits do it and can't we fetch and cache and reuse across audits

**Consequence.** The question is not how to bound per-audit fetching but why
per-audit fetching exists at all. The gatherer layer was built to share reads;
33 audits reaching for `ctx.fetch` directly suggests the layer does not cover
what they need. The right move may be to move those reads into gatherers with a
shared cache, after which a budget law has far less to govern.

**Status:** open. Requires an inventory of what the 33 actually fetch, and
whether each is cacheable and shareable.

---

## Running tally

|  law | ruling              | effect on the design                                                             |
| ---: | :------------------ | :------------------------------------------------------------------------------- |
|    1 | note, not a verdict | re-draft; add a law on precondition reuse                                        |
|    2 | note, not a verdict | keep mechanism, add a freshness law, record the unused `reviewed:` stamp as debt |
|    3 | note, not a verdict | park as an open question; do not assert                                          |
|    4 | correct             | ratified                                                                         |
|    5 | discuss             | re-explain from first principles                                                 |
|    6 | discuss             | re-frame around what a scan is                                                   |
|    7 | objection sustained | re-draft around operator intent, not address class                               |
|    8 | deeper objection    | inventory the 33 fetching audits; ask why the gatherer layer does not cover them |
| 9–10 | not yet asked       | —                                                                                |

**One law ratified of eight asked.** The quiz found more than the design did.

---

## Law 5 — resolved

Re-explained from first principles rather than from the design's vocabulary.
Both questions answered.

**Question 1 — is the four-case split right, and does an empty artifact
decline?** Ruled: **yes.**

| case      | example                                                         | verdict                         |
| :-------- | :-------------------------------------------------------------- | :------------------------------ |
| absent    | `/openapi.json` 404s, returns HTML, or was never fetched        | `notApplicable`                 |
| empty     | `{ "openapi": "3.1.0", "paths": {} }` — legal, declares nothing | `notApplicable`                 |
| malformed | `{ "paths": "coming soon" }` — the author wrote the breakage    | `fail`, naming it               |
| readable  | one good operation beside one broken entry                      | grade the good, name the broken |

**Question 2 — where does the precondition live?** Ruled: **version 3, the
guard.**

Three versions were put side by side:

- **Version 1**, on `main` today: each audit carries a private copy of the read
  and writes `return this.fail(...)` on absence. The bug.
- **Version 2**, what PR 23 ships: a shared read, and each audit writes
  `if (!spec) return this.notApplicable(NO_OPENAPI_SPEC.message, ...)` by hand.
  Correct, but the block is copied into five files and a sixth audit can still
  copy version 1. The rule lives in a comment, and a comment stops nobody.
- **Version 3**, chosen: the precondition is a piece that runs. The audit
  declares what it reads and implements only the judgement.

```ts
export class OpenApiServersAudit extends Audit {
  static reads = openApiContents; // runs first: sorts the four cases

  judge(spec: OpenApiSpec, ctx: CheckContext): AuditResult {
    const servers = spec["servers"]; // guaranteed readable
    // ...only the judgement
  }
}
```

The audit author never writes the absent case and therefore cannot write it
wrong. Cost: the entry point of roughly 24 artifact audits is rewritten. That
cost is what the review priced as expensive and what law 1's note argues is
worth paying — "the actual code of the audit is focusing on the audit itself
not some boilerplate code for preconditions".

**Status:** ratified. Law 5 is re-drafted around a running guard, not an
imported constant. Supersedes the design document's §5.

---

## Running tally

|  law | ruling                  | effect on the design                                                             |
| ---: | :---------------------- | :------------------------------------------------------------------------------- |
|    1 | note, not a verdict     | re-draft; the precondition-reuse law is law 5's guard                            |
|    2 | note, not a verdict     | keep mechanism, add a freshness law, record the unused `reviewed:` stamp as debt |
|    3 | note, not a verdict     | park as an open question; do not assert                                          |
|    4 | correct                 | ratified                                                                         |
|    5 | **ratified, version 3** | four-case split confirmed; declaration becomes a running guard                   |
|    6 | discuss                 | re-frame around what a scan is                                                   |
|    7 | objection sustained     | re-draft around operator intent, not address class                               |
|    8 | deeper objection        | inventory the 33 fetching audits; ask why the gatherer layer does not cover them |
| 9–10 | not yet asked           | —                                                                                |

---

## Law 6 — resolved, and a published claim retracted

Re-explained around the fixture rather than around the rule. Both questions
answered.

**Question 1 — should the fixture describe a real scan?** Ruled: **yes, fix it.**

**Question 2 — is the empty-scan rule testing two different things?** Ruled:
**maybe we need two separate.** Taken as: build two fixtures.

### What was wrong

`emptyContext()` builds its evidence from `allEvidenceMet()`, which sets
`judgeable: true` and `usablePageTypes: ALL_PAGE_TYPES`, while supplying zero
pages. The fixture asserts _nothing was read_ and _everything was read_ at the
same time. `buildScanEvidence` never produces that state: `judgeable` is
`met['origin-reachable'] && met['unblocked-fetches']`, both false when the
origin never answered.

Audits open with `if (!scanReadTheSite(ctx.evidence))`, which reads
`evidence.judgeable`. On the old fixture that guard returns `true`, so audits
walk past their own correct decline branch and start reading pages that are not
there.

### The measurement, re-run against a truthful fixture

|          | old fixture | truthful fixture |
| :------- | ----------: | ---------------: |
| `na`     |         134 |          **153** |
| `fail`   |          46 |               38 |
| `warn`   |          28 |               24 |
| `pass`   |           7 |            **0** |
| non-`na` |          81 |           **62** |

### Retraction

**The seven vacuous passes do not exist.** `content-extraction/main-element`,
`article-element`, `header-footer`, `data-tables`, `content-depth`,
`figure-figcaption` and `fake-headings` all return `notApplicable` correctly
once the fixture stops claiming the site was read. Their `scanReadTheSite`
guard was always right.

They were reported as bugs in three places, all of which are now wrong:

- `2026-08-30-audit-architecture-review.md` §5.1 and §9
- `2026-08-30-audit-architecture-design.md` §9
- commit `a709a36`'s message

The 81 was inflated by the same cause. The real figure is **62 audits that
give a verdict about a site the scan never reached**, and 15 of those are the
robots.txt bot family warning "robots.txt not found" about a host that never
answered.

### The two fixtures

| fixture               | asserts                                                                                                       | exemptions                                                                  |
| :-------------------- | :------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------- |
| **A — unreachable**   | the scan failed: `judgeable: false`, no pages, no root files, reasons populated. **Every** audit returns `na` | **none, ever.** A verdict here claims something about a site nobody reached |
| **B — bare but real** | the scan worked: one minimal page, evidence met. Verdicts are legal and expected                              | not a law. A snapshot of what a minimal real site scores                    |

One fixture was being asked to be a law and a snapshot at once, so it was
neither, and its contradictory evidence manufactured 19 phantom violations
including all 7 phantom passes.

Fixture A is a stronger law than the design proposed: no exemption map, no
written reasons, no `EMPTY_SCAN_VERDICTS`. It is enforceable today against 62
real failures.

**Fixture B is not yet measured.** The first attempt hand-rolled a
`PageContext` and 29 audits threw on missing fields. It must be built from
`mockPageContext` in `packages/core/src/__tests__/test-utils` before any number
from it is trusted.

**Status:** ratified. Law 6 splits into two laws — one absolute, one
observational. The design document's change A is superseded: no exemption map
is needed for fixture A.

---

## Running tally

|  law | ruling                     | effect on the design                                                                     |
| ---: | :------------------------- | :--------------------------------------------------------------------------------------- |
|    1 | note, not a verdict        | re-draft; the precondition-reuse law is law 5's guard                                    |
|    2 | note, not a verdict        | keep mechanism, add a freshness law, record the unused `reviewed:` stamp as debt         |
|    3 | note, not a verdict        | parked; see the `usablePageTypes` review below                                           |
|    4 | correct                    | ratified                                                                                 |
|    5 | **ratified, version 3**    | four-case split confirmed; declaration becomes a running guard                           |
|    6 | **ratified, two fixtures** | fixture A is absolute with no exemptions; 7 vacuous passes retracted; 81 corrected to 62 |
|    7 | objection sustained        | re-draft around operator intent, not address class                                       |
|    8 | deeper objection           | inventory the 33 fetching audits; ask why the gatherer layer does not cover them         |
| 9–10 | not yet asked              | —                                                                                        |

**Two laws ratified of eight asked, and one published claim retracted.**

---

## Law 3 — resolved: page type is declared, never detected

Parked after the first pass, reopened, and settled.

### Why detection was rejected

`detectPageType` (`packages/core/src/parser.ts:574`) is four rules in fixed
order, and the fourth has no test:

```ts
if (isFirstPage && pathname === "/") return "homepage";
if (isProductPage(pathname, $, jsonLd, meta)) return "product";
if (isCategoryPage(pathname, $, jsonLd)) return "category";
return "content"; // no test — the else branch
```

Three named failures, all in the shipped code:

- `/shop/sourdough` matches the **category** regex — `^/(...|shop|...)` — before
  the product branch is reached. A product page with full `Product` JSON-LD
  classifies as `category`.
- Product detection by markup is `[class*="add-to-cart"]` plus `.price`. Both
  are CSS class names any theme may spell differently.
- `content` means "we could not classify this". A blog post, a contact page and
  a privacy policy are one type, and fourteen audits gated on it.

**Ruling:** remove the detection. If a page's type matters, the operator
supplies it with the URL. If detection is ever reintroduced, its unreliability
is stated to the user rather than hidden behind a verdict.

### Deletions

| what                                                | where                                        |
| :-------------------------------------------------- | :------------------------------------------- |
| `detectPageType`, `isProductPage`, `isCategoryPage` | `parser.ts:574-680`                          |
| `meta.applicablePageTypes`                          | 35 audits                                    |
| `evidence.usablePageTypes`                          | `scan-evidence.ts`                           |
| the `sample-adequate` per-audit override            | `audit-runner.ts:120-123`                    |
| the page-type skip and `TAG_SKIPPED_PAGE_TYPE`      | `audit-runner.ts:169-178`, `constants.ts:19` |
| `pageType` reads in audit bodies                    | 18 audits                                    |

Kept: `overrideTypeByKey` (`orchestrator.ts:299`) — the operator's declaration.
Declaration survives, detection does not.

### What replaces the gate

The four-case rule from law 5, applied to a page's own content rather than to an
origin artifact. No classification is involved.

| the audit asks             | page carries no `Product` schema   | example                                |
| :------------------------- | :--------------------------------- | :------------------------------------- |
| does this page carry it    | that is the finding — report it    | `structured-data/offer-schema`         |
| is what it carries correct | nothing to judge → `notApplicable` | `agentic-commerce/product-identifiers` |

`product-identifiers` has no `notApplicable` branch today. It returns
`fail: 'No Product schema found to check for identifiers.'`, and the page-type
gate was the only thing keeping that away from a bakery. **The gate was doing
the absence rule's job.** That is the same defect PR 23 fixed in the OpenAPI
family, hidden one level up in the runner instead of sitting in the audit.

This is why the order matters: `applicablePageTypes` cannot be removed until
each of the 35 audits owns its precondition. Remove the gate first and eight
commerce audits start failing bakeries.

### The circularity that had to be avoided

The obvious replacement — "decline when the page carries no Product schema" —
breaks the other direction. A real shop with add-to-cart controls, prices and no
JSON-LD would be excused by exactly the audits that exist to catch it. **An
audit that checks whether product data exists cannot use product data as its own
precondition.**

The split above avoids it without any classifier: the existence audit reports
the absence, the contents audits decline. Neither needs to know what kind of
page it is looking at.

**Status:** ratified.

---

## New direction — one page per scan, idempotent per URL

Recorded during the law 3 discussion. This supersedes the multi-page sampler.

Sizing, measured on this branch:

| group                                 | count |
| :------------------------------------ | ----: |
| audits touching `ctx.pages`           |   144 |
| audits looping every page             |   106 |
| audits reading only `ctx.pages[0]`    |    53 |
| audits computing a ratio across pages | **1** |
| audits reading `ctx.rootFiles`        |    54 |
| audits calling `ctx.fetch`            |    33 |

Only one audit computes a percentage over the page set, so multi-page semantics
were barely used. The 106 loops mostly ask "does any page have X" and become
"does this page have X", which is the more honest sentence.

### Two scopes replace page types

| scope      | subject                                                                                 | idempotent per |
| :--------- | :-------------------------------------------------------------------------------------- | :------------- |
| **page**   | the document at the URL the operator gave                                               | URL            |
| **origin** | `robots.txt`, `sitemap.xml`, `llms.txt`, `openapi.json`, `/.well-known/*`, MCP endpoint | origin         |

An audit declares its scope, not the kind of page it wants. This also answers
law 8's objection: origin artifacts are fetched once per origin and reused
across every page scan of that host, because the scope makes the cache key
obvious.

### What idempotence forbids

- no sampling, no discovery, no "first five links"
- no verdict depending on which pages happened to be found
- no verdict against "now" — `three-way-freshness-lag` must state dates, not
  judge staleness against the clock
- the 33 fetching audits must pick targets deterministically from the page's own
  content, in document order

### Open, not yet decided

1. **The 54 origin-scope audits under per-URL scans.** They produce the same
   verdict on every page of a host. Are they a separate scan with a separate
   score, a cached section inside every page scan, or informative on a page scan
   and scored only on an origin scan?
2. **Does a multi-page site scan survive**, and if so as what — a batch of
   independent per-URL scans supplied by the operator, or nothing at all?

Both change what a "score" means, so neither is decided here.

---

## Running tally

|  law | ruling                       | effect on the design                                                                     |
| ---: | :--------------------------- | :--------------------------------------------------------------------------------------- |
|    1 | note, not a verdict          | re-draft; the precondition-reuse law is law 5's guard                                    |
|    2 | note, not a verdict          | keep mechanism, add a freshness law, record the unused `reviewed:` stamp as debt         |
|    3 | **ratified**                 | page type is declared, never detected. Six deletions; the absence rule replaces the gate |
|    4 | correct                      | ratified                                                                                 |
|    5 | **ratified, version 3**      | four-case split confirmed; declaration becomes a running guard                           |
|    6 | **ratified, two fixtures**   | fixture A is absolute with no exemptions; 7 vacuous passes retracted; 81 corrected to 62 |
|    7 | objection sustained          | re-draft around operator intent, not address class                                       |
|    8 | **partly answered by scope** | origin artifacts cache per origin; the remaining question is the 33 `ctx.fetch` callers  |
| 9–10 | not yet asked                | —                                                                                        |

**Three laws ratified of eight asked.**

---

## Law 3 — amended: detection kept, informative only; declaration is consent

The earlier ruling deleted detection outright. Amended: detection stays, but it
can never reach a verdict. The operator may supply the page type; detection is
the fallback.

### The rule

> **A page's type is a label. A detected label may never affect a verdict. A
> declared label is operator consent and may.**

|                       | detected               | declared by the operator |
| :-------------------- | :--------------------- | :----------------------- |
| appears in the report | yes, marked as a guess | yes, marked as declared  |
| may affect a verdict  | **never**              | yes — it is consent      |

### Condition 1 — informative is enforced, not intended _(accepted)_

Fourteen audits gate on `content` today because nothing stopped them. If
`pageType` remains on `PageContext`, a future audit reads it again and the rule
rots the way the NA contract did.

> **Gate:** no audit source may reference `pageType`. One registry-enumerating
> test over the audit sources, same shape as `scripts/check-requires.mjs`.

Without that gate the rule is a comment, and this session has established what
comments are worth.

### Condition 2 — the label carries its provenance _(accepted)_

```jsonc
"pagesScanned": [
  { "url": "...", "pageType": "product",  "typeSource": "declared" },
  { "url": "...", "pageType": "category", "typeSource": "detected" }
]
```

A detected label published without that marker is the top law broken in the
report layer instead of the audit layer. `typeSource` is where "the detection
method is flawed" gets said.

### Condition 3 — declaration is consent _(accepted, and chosen over label-only)_

A detected type is our guess and may never move a score. A declared type is the
operator vouching for what the page is, which makes the finding relevant by
their own statement.

So `agentic-commerce/offer-schema` scanned against a URL declared `product` is
scored. The same audit against an undeclared URL still runs and still reports
"this page carries no Product schema" — it simply does not move the score.

This is the same distinction drawn in law 7: operator intent versus a value the
tool inferred. Consent is what separates them in both places.

### The collision with law 2, recorded before it is discovered

Law 2 is ratified: `weight = weightForGrade(grade, tier)`, and
`packages/core/src/audits/sunset.test.ts` enforces three invariants — a
non-scored tier implies weight 0 and `scoreDisplayMode: 'informative'`, grade C
in the scored tier is unregistrable, and `tier !== 'scored'` is equivalent to
`weight === 0`.

Consent makes an audit's contribution **scan-dependent**. A statically scored
audit must contribute nothing on a scan where consent was not given. Taken
naively that breaks all three invariants, because tier and weight would vary per
scan.

Three ways to express it. **C is recommended.**

|       | approach                                                                                                                           | cost                                                                                                                                    |
| :---- | :--------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `tier` becomes scan-dependent                                                                                                      | breaks law 2's invariants directly; `sunset.test.ts` would have to be re-expressed as a static ceiling rather than an identity          |
| B     | treat consent like an evidence key — no consent, audit skipped, reported `na` with "declare the page type to have this scored"     | reuses existing machinery, but the audit declines instead of reporting its finding, which loses the thing consent was meant to preserve |
| **C** | meta stays static; the **scorer** excludes unconsented audits from the denominator, the way `gatedMassShare` already inspects tags | law 2 untouched, the finding is still reported, and runtime-dependent scoring already exists in `scan-evidence`                         |

Under C an audit is always registered with one static grade, tier and weight.
Whether that weight enters a given scan's denominator is a scoring decision made
from the scan's consent state, not a mutation of the audit.

### What this changes about the earlier deletions

Still deleted: `evidence.usablePageTypes`, the `sample-adequate` per-audit
override, the page-type skip and `TAG_SKIPPED_PAGE_TYPE`, and every `pageType`
read in the 18 audit bodies.

**No longer deleted:** `detectPageType` and its helpers, which survive as the
fallback label. `meta.applicablePageTypes` survives in changed form — no longer
a runner gate, now the declaration of which consent applies to this audit.

Unchanged: the absence rule still replaces the gate. `product-identifiers`
still needs its own `notApplicable` branch, because on an undeclared page with
no `Product` schema it must report, not fail. Consent decides whether a finding
is scored; it never decides whether the finding is true.

**Status:** ratified as amended. Supersedes the previous law 3 entry.

---

## Running tally

|  law | ruling                         | effect on the design                                                                       |
| ---: | :----------------------------- | :----------------------------------------------------------------------------------------- |
|    1 | note, not a verdict            | re-draft; the precondition-reuse law is law 5's guard                                      |
|    2 | ratified, **with a collision** | consent makes contribution scan-dependent; resolved by option C at the scorer              |
|    3 | **ratified as amended**        | detected labels never move a verdict; declared labels are consent and may                  |
|    4 | correct                        | ratified                                                                                   |
|    5 | **ratified, version 3**        | four-case split confirmed; declaration becomes a running guard                             |
|    6 | **ratified, two fixtures**     | fixture A is absolute with no exemptions; 7 vacuous passes retracted; 81 corrected to 62   |
|    7 | objection sustained            | re-draft around operator intent, not address class — the same consent distinction as law 3 |
|    8 | **partly answered by scope**   | origin artifacts cache per origin; the 33 `ctx.fetch` callers remain                       |
| 9–10 | not yet asked                  | —                                                                                          |

**Four laws ratified of eight asked.**

---

## Option C, concrete: the scorer already has the hook

Ratified. Checked against `packages/core/src/scorer.ts`, C needs almost no new
machinery, because the predicate it wants already exists and is already the
single source of truth.

```ts
// scorer.ts:22
/**
 * Single source of truth for "this check is advisory only".
 * Informative checks are still shown to the user, but they must never
 * influence scores, recommendations, top fails/passes or readiness vitals.
 * Every surface that ranks or scores checks filters through this predicate
 * so the rule cannot drift per package.
 */
export function isInformative(
  check: Pick<CheckResult, "scoreDisplayMode">,
): boolean {
  return check.scoreDisplayMode === "informative";
}
```

"Still shown to the user, never influences a score" is exactly what an
unconsented finding needs. `scoreDisplayMode` already lives on `CheckResult`,
not only on meta.

### The change

```ts
// audit meta — the page types under which this audit is scored
const meta = { pageTypes: ["product"] satisfies PageType[] };

// runner, building the CheckResult
function scoreModeFor(meta: AuditMeta, ctx: CheckContext): ScoreDisplayMode {
  if (meta.scoreDisplayMode === "informative") return "informative";
  if (!meta.pageTypes?.length) return meta.scoreDisplayMode;

  const consented =
    ctx.typeSource === "declared" && meta.pageTypes.includes(ctx.pageType);
  return consented ? meta.scoreDisplayMode : "informative";
}
```

The runner applies the returned value to `CheckResult`. `AuditPlan` and static
meta stay unchanged.

### Why law 2 survives

`sunset.test.ts` validates **meta**, and meta is untouched: one grade, one
tier, one weight, permanently. All three invariants hold as identities. The
scan-dependent part lives on the result, which is already how `status: 'na'`
and `scoreDisplayMode` behave today.

### Two behaviours inherited; one scorer correction

| existing rule                                                    | effect on an unconsented finding                                                                         |
| :--------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| `calculateCategoryScore:29` excludes `na` and informative        | leaves the category denominator                                                                          |
| `gatedMassShare:126` skips informative before counting           | does **not** count toward the 0.35 unscored threshold — correct, because consent is not missing evidence |
| `calculateOverallScore` uses the category's static registry mass | **must change** to assessed mass so a partly informative category cannot amplify its remaining audits    |

The scorer keeps `registryMass` for coverage and uses `assessedMass` for the
overall formula. This preserves each audit's intrinsic weight.

> without it a site with no commerce surface paid the whole agentic-commerce
> evidence mass at score 0, which reads as a penalty for not being a shop

### Naming

One word everywhere. `consentTypes` was proposed and rejected as jargon.

| surface      | name                                                                 |
| :----------- | :------------------------------------------------------------------- |
| scan input   | `--page-type product`                                                |
| audit meta   | `pageTypes: PageType[]` — the types under which this audit is scored |
| page context | `pageType`, plus `typeSource: 'declared' \| 'detected'`              |

**Status:** ratified.

---

## Law 3 — final form

Three modes were proposed and reduced to two. Hiding findings was a report
nicety, not an architectural need, so it is gone.

### The rule

> **A page type moves a score only when the operator declared it. Detection
> produces a label, never a verdict.**

Two states in the audit model: consented, not consented. That is all the scorer
knows about.

| page type                            | comes from            | audits declaring `pageTypes` | score  | shown |
| :----------------------------------- | :-------------------- | :--------------------------- | :----- | :---- |
| **declared** — `--page-type product` | the operator          | scored                       | counts | yes   |
| **not declared**                     | detection, label only | informative                  | none   | yes   |

Everything is always reported. The only question the model asks is whether the
operator vouched for what the page is.

### The whole code change

```ts
// 1. meta — renamed; meaning changes from "gate" to "scored under"
pageTypes: ['product'],                    // was applicablePageTypes

// 2. runner — one pure result-mode function
function scoreModeFor(meta: AuditMeta, ctx: CheckContext): ScoreDisplayMode {
  if (meta.scoreDisplayMode === 'informative') return 'informative';
  if (!meta.pageTypes?.length) return meta.scoreDisplayMode;

  const consented =
    ctx.typeSource === 'declared' && meta.pageTypes.includes(ctx.pageType);
  return consented ? meta.scoreDisplayMode : 'informative';
}

// 3. page context — the label carries its provenance
{ url, pageType: 'product', typeSource: 'declared' | 'detected' }
```

`packages/core/src/scorer.ts` splits category mass into `registryMass` for
coverage and `assessedMass` for overall weighting. Every scoring surface still
filters through `isInformative`.

### Deleted

`evidence.usablePageTypes`; the `sample-adequate` per-audit override
(`audit-runner.ts:120-123`); the page-type skip and `TAG_SKIPPED_PAGE_TYPE`
(`audit-runner.ts:169-178`, `constants.ts:19`); the `pageType` reads in 18 audit
bodies.

### Kept

`detectPageType` and its helpers, as the fallback label. `overrideTypeByKey`,
as the operator's declaration.

### New gate

> No audit source may reference `pageType`.

One registry-enumerating test over the audit sources, same shape as
`scripts/check-requires.mjs`. Without it "informative" is a comment, and
fourteen audits gate on `content` today for exactly that reason.

### Why dropping audits was rejected

An earlier third mode would have skipped the type-specific audits entirely.
That penalises the site it was meant to help:

```ts
// scorer.ts:80
function hasAssessableCheck(cat: CategoryResult): boolean {
  if (cat.checks.length === 0) return true; // empty list stays in the score
  return cat.checks.some((c) => c.status !== "na" && !isInformative(c));
}
// scorer.ts:31
if (totalWeight === 0) return 0; // and scores 0
```

Drop every `agentic-commerce` audit and the category arrives with zero checks,
passes the early return, and contributes its full `CATEGORY_MASS` at score 0.
The informative path keeps the checks visible. Their weight does not enter
`assessedMass`, so they cannot move the overall score.

**Dropping punishes. Informative protects.**

### Prerequisite, unchanged

The 35 audits must own their preconditions before the gate is removed.
`product-identifiers` returns `fail: 'No Product schema found to check for
identifiers.'` and has no `notApplicable` branch; the page-type gate is the only
thing keeping that off a bakery.

**Status:** final. Supersedes both earlier law 3 entries.

---

## Law 7 — resolved: consent attaches to the origin

The objection was sustained: scanning a local development site before deploying
is a legitimate, arguably primary use of the tool, so a blanket private-address
refusal is wrong.

### The objection was already the code's own rule

`packages/core/src/fetcher.ts:292`:

```
// The gate is armed only when the starting URL is itself public: an
// operator who deliberately points the scanner at a dev host gains
// nothing from having its redirects refused.
```

`isSafeUrl` is called in exactly one place inside the fetcher — line 317, the
redirect gate. The orchestrator never gates the scan's entry URL. **Scanning
`http://localhost:3000` works today, deliberately.** The law was worded as
though it did not.

### The law

> **The operator's URL is trusted. A URL taken from scanned content is not.**

The same distinction settled in law 3, one layer down: declared versus
inferred. Consent, again.

### The hole

Nine of 33 fetching audits pass content-harvested URLs to `ctx.fetch` with no
gate, and the fetcher cannot cover for them:

```ts
gateArmed ??= await isSafeUrl(targetUrl);      // targetUrl is 127.0.0.1 -> false
if (gateArmed && !(await isSafeUrl(next))) {   // never runs
```

An unguarded first hop is fetched **and** disarms the redirect gate for the rest
of that chain. `machine-discovery/no-broken-links` — grade A, weight 1.0 —
supplies 20 URLs scraped from the page, filtered only by
`hostname.endsWith('.' + domain)`, which any wildcard DNS record satisfies.

### Resolution: the gate moves into `ctx.fetch`

Twenty-four audits call `isSafeUrl` correctly and nine forget. A test that
checks for the import is the weak form — an import can be present and unused,
which is the critique that killed `meta.subject`. Law 5's lesson, third
application: put the guard where it runs.

> **`ctx.fetch` gates by origin. The scan target's origin passes. Any other
> origin must clear `isSafeUrl`. Audits never call it.**

```ts
fetch: async (options) => {
  const sameOrigin =
    new URL(options.url).origin === new URL(ctx.baseUrl).origin;
  if (!sameOrigin && !(await isSafeUrl(options.url)))
    return refused(options.url);
  return fetcher.fetch(options);
};
```

| scan target             | audit fetches                      | result      | why                                                         |
| :---------------------- | :--------------------------------- | :---------- | :---------------------------------------------------------- |
| `http://localhost:3000` | `http://localhost:3000/robots.txt` | **allowed** | same origin — the operator named it                         |
| `http://localhost:3000` | `http://127.0.0.1:9200/`           | **refused** | different origin, private — SSRF into another local service |
| `https://shop.example`  | `https://shop.example/api`         | allowed     | same origin                                                 |
| `https://shop.example`  | `http://169.254.169.254/`          | **refused** | cloud metadata endpoint, harvested from a page              |

Origin, not address class. A blanket private-address rule breaks local
development scanning; an origin rule does not, because consent attaches to the
origin the operator typed.

### What it costs

- nine audits fixed by a change none of them contain
- twenty-four audits delete their `isSafeUrl` calls — the guard stops being
  theirs to remember
- the rule becomes unforgettable rather than enforced by a test that greps
  imports

### Verified before ratifying

- 51 test files already `vi.mock` the fetcher and 52 stub `isSafeUrl`, so no
  suite performs real DNS and moving the gate adds no DNS to the suites.
- At least eight audits fetch cross-origin by design —
  `operability-safety/wikidata-round-trip-verification`,
  `answer-readiness/author-page`, `machine-discovery/rss-feed`,
  `three-way-freshness-lag`, `llms-txt-links-valid`, `websub-hub-advertisement`,
  `agent-commerce-feed-parity`, `no-broken-ai-endpoints`. These now clear
  `isSafeUrl` on a path that previously had none, which is the intent.

### One gap the move creates

Audit unit tests construct their own `ctx.fetch` stub and therefore bypass the
gate entirely. That is correct for unit tests, but it means the gate needs its
own test where the context is built, not where audits are exercised.

**Status:** ratified.

---

## Running tally

|  law | ruling                     | effect on the design                                                            |
| ---: | :------------------------- | :------------------------------------------------------------------------------ |
|    1 | note, not a verdict        | re-draft; the precondition-reuse law is law 5's guard                           |
|    2 | ratified, with a collision | consent makes contribution scan-dependent; resolved at the result, not the meta |
|    3 | **ratified, final**        | two modes: declared is scored, undetected is informative. Everything reported   |
|    4 | correct                    | ratified                                                                        |
|    5 | **ratified, version 3**    | four-case split; the declaration is a running guard                             |
|    6 | **ratified, two fixtures** | fixture A is absolute; 7 vacuous passes retracted; 81 corrected to 62           |
|    7 | **ratified**               | consent attaches to the origin; the gate moves into `ctx.fetch`                 |
|    8 | partly answered by scope   | origin artifacts cache per origin; the 33 `ctx.fetch` callers remain            |
| 9–10 | not yet asked              | —                                                                               |

**Six laws ratified of eight asked.** Three of them — 3, 5 and 7 — resolved to
the same shape: put the guard where it runs, and let consent decide what the
tool may claim.

---

## The scan unit — two units, one score

Opened by the "one page per scan, idempotent per URL" direction and settled
here.

### Scoring mass by scope

Measured on this branch over all 215 registered audits, classifying by whether
the source reads `ctx.pages`, `ctx.rootFiles`, both or neither.

| scope                  |  audits |      mass |     share |
| :--------------------- | ------: | --------: | --------: |
| **page only**          |     134 |      88.4 | **66.0%** |
| **origin only**        |      50 |      31.8 | **23.7%** |
| both                   |      26 |      11.0 |      8.2% |
| neither — fetches live |       5 |       2.8 |      2.1% |
| **total**              | **215** | **134.0** |           |

Only 26 audits straddle, so the split is structurally available.

### The 26 straddlers break origin idempotence

They are not dual-subject. They are origin audits that also scrape a page for a
discovery link: `openapi-exists` reads `/openapi.json` **and**
`<link rel="service-desc">`; `llms-txt-exists` reads `/llms.txt` **and** checks
the page references it; `ai-usage-signal-coherence-across-channels` reads
robots.txt, RSL and AIPREF **and** page headers.

Under per-URL scans that is a defect. Scan the homepage and the
`service-desc` link is there; scan a product page and it is not. Same origin,
same artifact, different verdict, decided by which URL the operator typed.

> **Fix: the 26 belong to the origin scan and read the origin's homepage, never
> the scanned page.** Their subject is the origin, so their page source must be
> a fixed property of the origin too.

### Two scan units

|           | **origin scan**                                                                                                          | **page scan**                |
| :-------- | :----------------------------------------------------------------------------------------------------------------------- | :--------------------------- |
| cache key | origin                                                                                                                   | URL                          |
| runs      | 50 origin-only + the 26 straddlers                                                                                       | 134 page-only                |
| mass      | 42.8                                                                                                                     | 88.4                         |
| reads     | `robots.txt`, `sitemap.xml`, `llms.txt`, `openapi.json`, `/.well-known/*`, and the origin's homepage for discovery links | the one document at that URL |
| computed  | once per origin, cached                                                                                                  | per scan                     |

### One score, not two

Two scan units were initially proposed to mean two scores. Rejected: the scan
unit and the score unit do not have to follow each other.

Origin files genuinely affect every page — a `robots.txt` blocking GPTBot
degrades every URL on the host — so folding that mass into each page's score is
accurate rather than a distortion. Two pages of one site _should_ share that
baseline.

The repo already scores conditionally. `GATED_MASS_UNSCORED_THRESHOLD = 0.35`
is a disclaimer with teeth: past that share of missing evidence the honest
output is `overallScore: null`.

> **A score states the conditions under which it holds. Where the conditions
> cannot be stated, there is no score.**

The top law applied to the number itself.

### The four conditions a score must carry

Fields, not prose, so the renderers and the JSON output both carry them.

```jsonc
"score": 68,
"conditions": {
  "url":      "https://shop.example/p/sourdough",
  "pageType": { "value": "product", "source": "declared" },
  "origin":   { "readAt": "2026-08-30T14:02:11Z", "cached": true },
  "coverage": { "page": 88.4, "origin": 42.8, "gated": 0.0 },
  "unscored": ["12 audits informative: page type not declared"]
}
```

|   # | field                    | why a reader needs it                                                                                                     |
| --: | :----------------------- | :------------------------------------------------------------------------------------------------------------------------ |
|   1 | `url`                    | the score is about one document, not a site                                                                               |
|   2 | `pageType` with `source` | law 3 makes this decide what was scored — an undeclared scan silently drops the commerce mass, and the number must say so |
|   3 | `origin.readAt`          | a cached origin result is a fact from an earlier moment; undated it is a claim about now that nobody verified now         |
|   4 | `coverage.gated`         | already computed by `gatedMassShare`, currently used only to decide `null` and never shown                                |

### Open

The 5 audits that read neither pages nor root files — 2.1% of mass — need
individual placement: `access-crawl-control/web-bot-auth-request-tolerance`,
`bot-content-delta-declared`, `machine-discovery/websub-hub-advertisement`,
`feed-entry-identity-and-canonical-integrity`, and
`operability-safety/url-addressable-state-and-pagination-fallback`. Four look
origin-scoped; the last is page-scoped.

**Status:** ratified. Design only — no code written, per the standing
"report only" instruction.

---

## Law 9 — ratified, and the guide is stale

**Explanation.** `AuditResultSchema.details` takes three known string keys plus
a catchall accepting only `string | number | boolean | string[]` (100 items max,
1000 characters each). `validate()` calls `AuditResultSchema.parse`, which
**throws**. The runner catches it at `audit-runner.ts:246`, logs
`[scanner] Audit error`, and emits an errored `na` stub — so one bad `details`
value costs the audit its entire result. Unit tests call `audit.audit(ctx)`
directly and never reach `toCheckResult`, so they never see it.

**Ruling: correct, and fix the guide.**

`CLAUDE.md` says a number array is _"dropped by the result schema"_. That was
true before the catchall existed, and the schema's own comment records the
history: _"A closed object dropped all of it silently."_ Now a number array
matches no union member and throws exactly like an array of objects.

**Follow-up:** correct that sentence in `AGENTS.md` when the laws are written.

---

## Law 10 — ratified

**Explanation.** A per-audit fetch or parse that duplicates a gatherer costs
every scan and drifts. The OpenAPI family proved it: seven audits carried a
byte-identical private `getOpenApiSpec`, three also carried `getOperations`, and
one copy drifted every time the family was touched. The sitemap family is the
same story today — `gatherers/sitemap.ts` exists at 220 lines but never exported
the absent / malformed / readable split, so five audits carry private
`getSitemapResult` helpers: `machine-discovery/sitemap-lastmod.ts:13`,
`sitemap-exists.ts`, `sitemap-absolute-urls.ts`,
`discovery-index-coverage.ts:13`, `access-crawl-control/sensitive-paths.ts`.

**Ruling: correct.** Still a DEBT — nothing enforces it. Law 8's resolution
below supplies the gate.

---

## Law 2's sibling — the warrant expires

**Ruling:** none of the proposed options. A GitHub workflow instead.

> we need to have a workflow process in github that will sweep the metadata and
> flag it in an issue, so this issue can be processed and the audit can be
> updated in due time, let's say every 6 months the audit has to be reviewed

**Measured:** 215 of 216 dossiers carry a `reviewed:` date and every one falls
between 2026-08-20 and 2026-08-24 — one research sprint. The stamp exists, is
fully populated, and nothing reads it.

**The law.** A grade is a claim with a date. An audit must be re-reviewed every
**6 months**.

**The mechanism, and why it is not a CI gate.** A stale grade is not a broken
build and must not fail one — nobody should be blocked from shipping a fix
because a dossier needs re-reading. It is also not a demotion: a score must not
move because nobody did paperwork.

So: a scheduled GitHub workflow sweeps `reviewed:` across
`docs/evidence/audits/`, and opens or updates a single rolling issue listing
every audit past 6 months, oldest first, with its grade and category. One issue,
updated in place, not one per audit and not a new one per run.

This is deliberately the weakest enforcement of any law here, and that is
correct: the work it triggers is research, which a human does, on a schedule a
human controls. The gate's job is only to make the debt impossible to forget.

**Status:** ratified as a scheduled sweep, not a gate.

---

## Law 8 — resolved: audits do not fetch

**Ruling:** a question rather than an option.

> isn't makeing them a gatherer better in the long run?

**Yes, and it collapses law 8 into law 7.**

Law 7 moved the origin gate inside `ctx.fetch` so an audit cannot forget it.
Law 8 asks how to bound fetching. If audits cannot fetch at all, both answers
are the same answer:

```
today   audit -> ctx.fetch -> fetcher      33 call sites, 9 ungated, 33 private caps
after   audit -> gatherer  -> fetcher      one layer, gated once, counted once
```

**The objection, and why it does not hold.** Some fetches have exactly one
consumer — `operability-safety/wikidata-round-trip-verification` resolving P856,
`machine-discovery/no-broken-links` checking 20 links — so a single-consumer
gatherer looks like indirection for its own sake. Three things make it worth it,
and all three only exist under this architecture:

- **visible** — the fetch belongs to the scan, not to a private constant in an
  audit body
- **countable** — a budget can be enforced rather than declared, because there
  is one place that issues requests
- **cacheable** — the moment a second consumer appears, which is exactly how the
  OpenAPI family reached seven copies

**And it supplies law 10's missing gate.** If no audit imports the fetcher and
no audit calls `ctx.fetch`, the private-reader duplication cannot recur — there
is nowhere to put a private reader that reaches the network.

**The gate:** no audit source may call `ctx.fetch` or import from `../../fetcher`.
Registry-enumerating, same shape as `check-requires.mjs`.

**Cost:** 33 audits migrate. Rough grouping, to be confirmed by inventory:
cross-origin verification (wikidata, feeds, hubs), link liveness
(`no-broken-links`, `llms-txt-links-valid`), artifact probes
(`markdown-alternate`, `mcp-endpoint`), and UA parity second fetches.

**Status:** ratified. Law 8 and law 10 share one gate; law 7's gate moves into
the gatherer layer with it.

---

## Running tally — quiz complete

| law | ruling                                                                             |
| --: | :--------------------------------------------------------------------------------- |
|   1 | absorbed into law 5's guard                                                        |
|   2 | ratified, **plus** a 6-month re-review sweep that opens a rolling GitHub issue     |
|   3 | ratified, final — declared is scored, detected is informative, everything reported |
|   4 | ratified as written                                                                |
|   5 | ratified — four-case read, declaration is a running guard                          |
|   6 | ratified — two fixtures; fixture A absolute; two claims retracted                  |
|   7 | ratified — consent attaches to the origin                                          |
|   8 | ratified — audits do not fetch; gatherers do                                       |
|   9 | ratified, and `AGENTS.md` needs a correction                                       |
|  10 | ratified — gated by law 8's rule                                                   |

**Ten of ten ruled.** Six were corrected, sharpened or replaced by the ruling
rather than confirmed as explained, and two published claims were retracted
along the way.

Three sentences hold the whole architecture:

1. **Put the guard where it runs.** Laws 5, 7, 8, 10 — a precondition, an
   origin gate, a fetch, a shared read. None of them may be an audit author's
   responsibility to remember.
2. **A claim states the conditions under which it holds.** Laws 2, 3, 6 and the
   score's `conditions` block — including what absence means, what was consented
   to, and how old the evidence is.
3. **A law names its gate, or it is a wish.** The reason this document exists.

---

## Post-quiz architecture review — accepted 2026-08-31

The branch review found two composition errors and three boundary choices. The
following decisions are final and supersede any earlier sentence in this quiz
that says `scorer.ts` stays unchanged or that the production evidence gate may
default to off.

### 1. Audit weight is stable; score participation is conditional

An audit keeps the static weight derived from its grade and tier. When it is
scored, that exact weight participates. When its result is `informative` or
`na`, its effective mass for that scan is zero.

The scorer keeps separate values:

```ts
registryMass = sum(all registered audit weights);
assessedMass = sum(weights where status !== 'na' && !isInformative(result));
```

`registryMass` measures coverage. `assessedMass` weights a category in the
overall score. `gatedMass` remains separate and decides whether missing evidence
makes `overallScore` null.

This fixes the consent collision missed in the original Option C review. A
partly informative category must not retain its full static category mass.
Structured Data would otherwise use 9.6 category mass for 2.0 assessed mass,
making the remaining audits act 4.8 times heavier.

### 2. The public evidence gate is safe by default

`planAudits(ctx, config)` always enforces the universal unread-scan guard.
`runAudits(ctx, config)` uses that safe planner when no plan is supplied.
Production exports have no `enforceEvidence?: boolean` option whose omitted
value disables the guard.

The 215-audit bypass exists only under test helpers. It bypasses both evidence
and page-type filters so the whole registry can be exercised. It is not exported
from `packages/core`.

### 3. Page-type consent uses one pure result function

`AuditPlan.runnable` remains `{ reg, categoryId }`. The runner does not mutate
shared audit meta and does not store an effective mode in the plan.

```ts
function scoreModeFor(meta: AuditMeta, ctx: CheckContext): ScoreDisplayMode {
  if (meta.scoreDisplayMode === "informative") return "informative";
  if (!meta.pageTypes?.length) return meta.scoreDisplayMode;

  const consented =
    ctx.typeSource === "declared" && meta.pageTypes.includes(ctx.pageType);
  return consented ? meta.scoreDisplayMode : "informative";
}
```

The runner applies this value when it creates `CheckResult`. A declared type
scores. A detected type informs. A static informative audit is never promoted.

### 4. One source gate enforces the network boundary

Audits keep the existing context shape. No second fetch-free `AuditContext`
type is added. `pnpm check:audit-boundaries` scans production audit sources and
rejects `ctx.fetch`, destructured or global `fetch`, imports from the fetcher,
and imports from direct HTTP clients. Tests may mock gatherers.

### 5. DNS safety stays in two layers

The application keeps the pre-request DNS check and the check on every redirect.
It does not pin the checked IP inside the HTTP client. Hosted and multi-tenant
deployments must also block localhost, private networks and metadata endpoints
with an outbound network rule. The local CLI may reach the operator-selected
local origin.

### 6. Shared origin caching is anonymous only

Anonymous origin reads cache by `origin + ORIGIN_EVIDENCE_VERSION`. Every record
stores `readAt` and expires by a documented TTL. A scan with URL credentials,
an authorization header or explicit prefetched evidence bypasses the shared
cache. Raw credentials never enter the cache key.

### 7. The phase plans must contain executable proof

The Phase 1 plan keeps the 215-audit test. It uses a test-only full-registry
helper instead of disabling a production guard. Every test written in a phase
plan must be implemented and runnable; a proposed test that cannot run must be
corrected or removed before that phase starts.
