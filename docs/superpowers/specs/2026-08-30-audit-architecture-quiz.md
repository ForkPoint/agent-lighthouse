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

This is stronger than the design's law 5. Importing a *constant* is passive: an
audit can import `NO_OPENAPI_SPEC` and still branch wrongly around it. Importing
a *guard that runs* is active, and cannot be satisfied without being obeyed. It
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
and `operability-safety/no-blocking-captcha`. The reason: their subject *is* the
missing evidence. `no-bot-detection` cannot require `unblocked-fetches`, because
a blocked fetch is exactly what it reports on.

**Ruling.** **Correct.**

**Status:** ratified as written.

---

## Running tally

| law | ruling | effect on the design |
|--:|:--|:--|
| 1 | note, not a verdict | re-draft; add a law on precondition reuse |
| 2 | note, not a verdict | keep mechanism, add a freshness law, record the unused `reviewed:` stamp as debt |
| 3 | note, not a verdict | park as an open question; do not assert |
| 4 | correct | ratified |
| 5–10 | pending | — |

---

## Law 5 — Absent artifact, absent verdict

**Claude's explanation.** The gatherer that reads an artifact owns a four-way
split — absent (nothing readable arrived), empty (readable, declares nothing),
malformed (nothing readable and the author wrote the breakage), readable
(something survives, defects may sit beside it). Absent and empty decline;
malformed fails; readable grades what survived and names the rest. Following
law 1's note: the design wrote the declaration as importing a *constant*, but a
constant is passive — an audit can import `NO_OPENAPI_SPEC` and still branch
wrongly around it. A guard that *runs* cannot be satisfied without being obeyed.

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
URL is already public — so an unguarded first hop bypasses the check *and*
disarms the redirect gate behind it. Nine of 33 fetching audits never import it.

**Ruling.** No option selected. A design objection was raised instead.

> don't see why i wouldn't be scanning a local dev website before uploading to
> production

**Consequence.** This is a hit, and it is not about the mechanism. Scanning
`http://localhost:3000` before a deploy is a legitimate, arguably primary use of
the tool. A blanket private-address refusal breaks it. So the rule cannot be
"never touch a private address" — the real distinction is between an address the
*operator* named and an address the *scanned site* supplied. The first is
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

| law | ruling | effect on the design |
|--:|:--|:--|
| 1 | note, not a verdict | re-draft; add a law on precondition reuse |
| 2 | note, not a verdict | keep mechanism, add a freshness law, record the unused `reviewed:` stamp as debt |
| 3 | note, not a verdict | park as an open question; do not assert |
| 4 | correct | ratified |
| 5 | discuss | re-explain from first principles |
| 6 | discuss | re-frame around what a scan is |
| 7 | objection sustained | re-draft around operator intent, not address class |
| 8 | deeper objection | inventory the 33 fetching audits; ask why the gatherer layer does not cover them |
| 9–10 | not yet asked | — |

**One law ratified of eight asked.** The quiz found more than the design did.

---

## Law 5 — resolved

Re-explained from first principles rather than from the design's vocabulary.
Both questions answered.

**Question 1 — is the four-case split right, and does an empty artifact
decline?** Ruled: **yes.**

| case | example | verdict |
|:--|:--|:--|
| absent | `/openapi.json` 404s, returns HTML, or was never fetched | `notApplicable` |
| empty | `{ "openapi": "3.1.0", "paths": {} }` — legal, declares nothing | `notApplicable` |
| malformed | `{ "paths": "coming soon" }` — the author wrote the breakage | `fail`, naming it |
| readable | one good operation beside one broken entry | grade the good, name the broken |

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
  static reads = openApiContents;   // runs first: sorts the four cases

  judge(spec: OpenApiSpec, ctx: CheckContext): AuditResult {
    const servers = spec['servers'];   // guaranteed readable
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

| law | ruling | effect on the design |
|--:|:--|:--|
| 1 | note, not a verdict | re-draft; the precondition-reuse law is law 5's guard |
| 2 | note, not a verdict | keep mechanism, add a freshness law, record the unused `reviewed:` stamp as debt |
| 3 | note, not a verdict | park as an open question; do not assert |
| 4 | correct | ratified |
| 5 | **ratified, version 3** | four-case split confirmed; declaration becomes a running guard |
| 6 | discuss | re-frame around what a scan is |
| 7 | objection sustained | re-draft around operator intent, not address class |
| 8 | deeper objection | inventory the 33 fetching audits; ask why the gatherer layer does not cover them |
| 9–10 | not yet asked | — |

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
pages. The fixture asserts *nothing was read* and *everything was read* at the
same time. `buildScanEvidence` never produces that state: `judgeable` is
`met['origin-reachable'] && met['unblocked-fetches']`, both false when the
origin never answered.

Audits open with `if (!scanReadTheSite(ctx.evidence))`, which reads
`evidence.judgeable`. On the old fixture that guard returns `true`, so audits
walk past their own correct decline branch and start reading pages that are not
there.

### The measurement, re-run against a truthful fixture

| | old fixture | truthful fixture |
|:--|--:|--:|
| `na` | 134 | **153** |
| `fail` | 46 | 38 |
| `warn` | 28 | 24 |
| `pass` | 7 | **0** |
| non-`na` | 81 | **62** |

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

| fixture | asserts | exemptions |
|:--|:--|:--|
| **A — unreachable** | the scan failed: `judgeable: false`, no pages, no root files, reasons populated. **Every** audit returns `na` | **none, ever.** A verdict here claims something about a site nobody reached |
| **B — bare but real** | the scan worked: one minimal page, evidence met. Verdicts are legal and expected | not a law. A snapshot of what a minimal real site scores |

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

| law | ruling | effect on the design |
|--:|:--|:--|
| 1 | note, not a verdict | re-draft; the precondition-reuse law is law 5's guard |
| 2 | note, not a verdict | keep mechanism, add a freshness law, record the unused `reviewed:` stamp as debt |
| 3 | note, not a verdict | parked; see the `usablePageTypes` review below |
| 4 | correct | ratified |
| 5 | **ratified, version 3** | four-case split confirmed; declaration becomes a running guard |
| 6 | **ratified, two fixtures** | fixture A is absolute with no exemptions; 7 vacuous passes retracted; 81 corrected to 62 |
| 7 | objection sustained | re-draft around operator intent, not address class |
| 8 | deeper objection | inventory the 33 fetching audits; ask why the gatherer layer does not cover them |
| 9–10 | not yet asked | — |

**Two laws ratified of eight asked, and one published claim retracted.**

---

## Law 3 — resolved: page type is declared, never detected

Parked after the first pass, reopened, and settled.

### Why detection was rejected

`detectPageType` (`packages/core/src/parser.ts:574`) is four rules in fixed
order, and the fourth has no test:

```ts
if (isFirstPage && pathname === '/')            return 'homepage';
if (isProductPage(pathname, $, jsonLd, meta))   return 'product';
if (isCategoryPage(pathname, $, jsonLd))        return 'category';
return 'content';                                // no test — the else branch
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

| what | where |
|:--|:--|
| `detectPageType`, `isProductPage`, `isCategoryPage` | `parser.ts:574-680` |
| `meta.applicablePageTypes` | 35 audits |
| `evidence.usablePageTypes` | `scan-evidence.ts` |
| the `sample-adequate` per-audit override | `audit-runner.ts:120-123` |
| the page-type skip and `TAG_SKIPPED_PAGE_TYPE` | `audit-runner.ts:169-178`, `constants.ts:19` |
| `pageType` reads in audit bodies | 18 audits |

Kept: `overrideTypeByKey` (`orchestrator.ts:299`) — the operator's declaration.
Declaration survives, detection does not.

### What replaces the gate

The four-case rule from law 5, applied to a page's own content rather than to an
origin artifact. No classification is involved.

| the audit asks | page carries no `Product` schema | example |
|:--|:--|:--|
| does this page carry it | that is the finding — report it | `structured-data/offer-schema` |
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

| group | count |
|:--|--:|
| audits touching `ctx.pages` | 144 |
| audits looping every page | 106 |
| audits reading only `ctx.pages[0]` | 53 |
| audits computing a ratio across pages | **1** |
| audits reading `ctx.rootFiles` | 54 |
| audits calling `ctx.fetch` | 33 |

Only one audit computes a percentage over the page set, so multi-page semantics
were barely used. The 106 loops mostly ask "does any page have X" and become
"does this page have X", which is the more honest sentence.

### Two scopes replace page types

| scope | subject | idempotent per |
|:--|:--|:--|
| **page** | the document at the URL the operator gave | URL |
| **origin** | `robots.txt`, `sitemap.xml`, `llms.txt`, `openapi.json`, `/.well-known/*`, MCP endpoint | origin |

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

| law | ruling | effect on the design |
|--:|:--|:--|
| 1 | note, not a verdict | re-draft; the precondition-reuse law is law 5's guard |
| 2 | note, not a verdict | keep mechanism, add a freshness law, record the unused `reviewed:` stamp as debt |
| 3 | **ratified** | page type is declared, never detected. Six deletions; the absence rule replaces the gate |
| 4 | correct | ratified |
| 5 | **ratified, version 3** | four-case split confirmed; declaration becomes a running guard |
| 6 | **ratified, two fixtures** | fixture A is absolute with no exemptions; 7 vacuous passes retracted; 81 corrected to 62 |
| 7 | objection sustained | re-draft around operator intent, not address class |
| 8 | **partly answered by scope** | origin artifacts cache per origin; the remaining question is the 33 `ctx.fetch` callers |
| 9–10 | not yet asked | — |

**Three laws ratified of eight asked.**

---

## Law 3 — amended: detection kept, informative only; declaration is consent

The earlier ruling deleted detection outright. Amended: detection stays, but it
can never reach a verdict. The operator may supply the page type; detection is
the fallback.

### The rule

> **A page's type is a label. A detected label may never affect a verdict. A
> declared label is operator consent and may.**

| | detected | declared by the operator |
|:--|:--|:--|
| appears in the report | yes, marked as a guess | yes, marked as declared |
| may affect a verdict | **never** | yes — it is consent |

### Condition 1 — informative is enforced, not intended *(accepted)*

Fourteen audits gate on `content` today because nothing stopped them. If
`pageType` remains on `PageContext`, a future audit reads it again and the rule
rots the way the NA contract did.

> **Gate:** no audit source may reference `pageType`. One registry-enumerating
> test over the audit sources, same shape as `scripts/check-requires.mjs`.

Without that gate the rule is a comment, and this session has established what
comments are worth.

### Condition 2 — the label carries its provenance *(accepted)*

```jsonc
"pagesScanned": [
  { "url": "...", "pageType": "product",  "typeSource": "declared" },
  { "url": "...", "pageType": "category", "typeSource": "detected" }
]
```

A detected label published without that marker is the top law broken in the
report layer instead of the audit layer. `typeSource` is where "the detection
method is flawed" gets said.

### Condition 3 — declaration is consent *(accepted, and chosen over label-only)*

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

| | approach | cost |
|:--|:--|:--|
| A | `tier` becomes scan-dependent | breaks law 2's invariants directly; `sunset.test.ts` would have to be re-expressed as a static ceiling rather than an identity |
| B | treat consent like an evidence key — no consent, audit skipped, reported `na` with "declare the page type to have this scored" | reuses existing machinery, but the audit declines instead of reporting its finding, which loses the thing consent was meant to preserve |
| **C** | meta stays static; the **scorer** excludes unconsented audits from the denominator, the way `gatedMassShare` already inspects tags | law 2 untouched, the finding is still reported, and runtime-dependent scoring already exists in `scan-evidence` |

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

| law | ruling | effect on the design |
|--:|:--|:--|
| 1 | note, not a verdict | re-draft; the precondition-reuse law is law 5's guard |
| 2 | ratified, **with a collision** | consent makes contribution scan-dependent; resolved by option C at the scorer |
| 3 | **ratified as amended** | detected labels never move a verdict; declared labels are consent and may |
| 4 | correct | ratified |
| 5 | **ratified, version 3** | four-case split confirmed; declaration becomes a running guard |
| 6 | **ratified, two fixtures** | fixture A is absolute with no exemptions; 7 vacuous passes retracted; 81 corrected to 62 |
| 7 | objection sustained | re-draft around operator intent, not address class — the same consent distinction as law 3 |
| 8 | **partly answered by scope** | origin artifacts cache per origin; the 33 `ctx.fetch` callers remain |
| 9–10 | not yet asked | — |

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
export function isInformative(check: Pick<CheckResult, 'scoreDisplayMode'>): boolean {
  return check.scoreDisplayMode === 'informative';
}
```

"Still shown to the user, never influences a score" is exactly what an
unconsented finding needs. `scoreDisplayMode` already lives on `CheckResult`,
not only on meta.

### The change

```ts
// audit meta — the page types under which this audit is scored
pageTypes: ['product'],          // renamed from applicablePageTypes

// runner, building the CheckResult
scoreDisplayMode:
  meta.pageTypes?.length && !meta.pageTypes.includes(ctx.pageType)
    ? 'informative'              // reported in full, never scored
    : meta.scoreDisplayMode,
```

`scorer.ts` does not change at all.

### Why law 2 survives

`sunset.test.ts` validates **meta**, and meta is untouched: one grade, one
tier, one weight, permanently. All three invariants hold as identities. The
scan-dependent part lives on the result, which is already how `status: 'na'`
and `scoreDisplayMode` behave today.

### Three behaviours inherited for free

| existing rule | effect on an unconsented finding |
|:--|:--|
| `calculateCategoryScore:29` excludes `na` and informative | leaves the category denominator |
| `gatedMassShare:126` skips informative before counting | does **not** count toward the 0.35 unscored threshold — correct, because consent is not missing evidence |
| `hasAssessableCheck:80` drops a category whose checks are all `na` or informative | scanning an undeclared page removes `agentic-commerce` from the overall score rather than scoring it 0 |

The third inherits a protection the scorer already documents:

> without it a site with no commerce surface paid the whole agentic-commerce
> evidence mass at score 0, which reads as a penalty for not being a shop

### Naming

One word everywhere. `consentTypes` was proposed and rejected as jargon.

| surface | name |
|:--|:--|
| scan input | `--page-type product` |
| audit meta | `pageTypes: PageType[]` — the types under which this audit is scored |
| page context | `pageType`, plus `typeSource: 'declared' \| 'detected'` |

**Status:** ratified.
