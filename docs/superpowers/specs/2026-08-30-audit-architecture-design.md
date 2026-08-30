# How an audit is built — the architecture rules

**Date:** 2026-08-30
**Status:** design, approved in outline — the law list below is settled; the `docs/architecture/audits.md` structure is not yet
**Branch:** `docs/audit-architecture`
**Companion:** [`2026-08-30-audit-architecture-review.md`](./2026-08-30-audit-architecture-review.md) — the measurement and the rejected proposal that produced this

This document defines what an audit is, states the laws that govern one, and names the gate that proves each law. It is the positive statement the review did not make: the review established which proposed rules were wrong, and this establishes which real ones exist.

---

## 1. The problem this solves

`AGENTS.md` — which `CLAUDE.md` symlinks to — is 162 lines and enters every session's context. Its "Writing an audit" section is five bullets. None of them names the four-way artifact read, the import-as-declaration rule, or which of the repo's rules are actually enforced.

The consequence, measured: an architecture proposal was built on four wrong facts, because nothing in the repo answered the question *which rules are load-bearing?* Three of its four rot numbers were grep artifacts over fields the schema already requires. See §4 of the review.

A guide that does not distinguish an enforced rule from an aspiration produces exactly that error.

---

## 2. Placement decision

| file | carries | why |
|:--|:--|:--|
| `AGENTS.md` | the laws only — short, imperative, each naming its gate | Loaded into every session. Its cost is paid on every turn; the reasoning behind a law is not needed on every turn |
| `docs/architecture/audits.md` *(new)* | the six-part model, the four-way read, worked examples, the evidence | Read when writing or changing an audit. Loaded on demand |

`CLAUDE.md` is a symlink to `AGENTS.md`. One file, one edit.

Rejected: putting everything in `AGENTS.md` (roughly doubles a file every session pays for), and putting everything in `docs/` behind a two-line pointer (a rule nobody loads is a rule nobody follows — the failure mode this document exists to fix).

---

## 3. What an audit is

> An audit is one claim about a site, backed by one source, in six parts.

| part | question it answers |
|:--|:--|
| **Identity** | which audit is this, and where is its record |
| **Warrant** | which documented consumer licenses the claim, and what the verdict costs |
| **Population** | which sites the claim covers |
| **Evidence** | what the scan must have obtained for the claim to mean anything |
| **Reading** | which bytes it reads, and what it may say when they are not there |
| **Conduct** | how it fetches: safely, and within a bound |

Six, not ten. Warrant and price are one decision — `weight = weightForGrade(grade, tier)`, so the grade is the only knob. Reading and subject are one thing under a different name. Lifecycle had zero members. Conduct is new, and it is the part with no gate at all.

---

## 4. The laws

Every law names the gate that proves it. A law marked **DEBT** is not enforced. It is written here so nobody mistakes it for a rule.

| # | law | proven by | status |
|--:|:--|:--|:--|
| 1 | One audit, one file, one dossier | `scripts/check-dossiers.mjs`, both directions | holds 215/215 |
| 2 | The grade sets the weight. Never hand-set one — `weight = weightForGrade(grade, tier)` | `packages/core/src/audits/sunset.test.ts` | holds 215/215 |
| 3 | Score only the population the evidence covers | `planAudits` at runtime | holds; omitting `applicablePageTypes` means all types |
| 4 | Declare what the scan must have obtained | `scripts/check-requires.mjs` + `GATE_EXEMPTIONS` | holds 215/215 |
| 5 | **Absent artifact, absent verdict.** The gatherer that reads an artifact owns the absent / empty / malformed / readable split and exports the precondition. An audit about that artifact's contents declares itself by **importing** it | `packages/core/src/tests/absent-artifact-contract.test.ts` | **DEBT** — one family (OpenAPI). Sitemap and feeds uncovered; 1.6 weight fails wrongly today |
| 6 | A scan that read nothing yields no verdict | `packages/core/src/tests/na-contract.ts`, opt-in | **DEBT** — holds 73 of 215. 81 cannot satisfy it; 61 could and never call it |
| 7 | Gate every URL taken from scanned content with `isSafeUrl()` | — | **DEBT** — nothing enforces it. 9 of 33 fetching audits skip it |
| 8 | Bound what you fetch | — | **DEBT** — 33 audits, 33 private caps, nothing sums them |
| 9 | `details` values are scalars or arrays of strings | `AuditResultSchema` at runtime | holds — unit tests bypass `toCheckResult`, so parse the result in the test |
| 10 | Reuse the gatherers | — | **DEBT** — five audits carry private sitemap readers today |

Six hold. Five are debts (5 is half-built and counted once).

---

## 5. Why law 5 is phrased around an import

This is the only idea from the original proposal that survived measurement, and it inverts what the proposal assumed.

The proposal wanted a `meta.subject` field declaring what each audit is about. Measurement killed it in one line:

```ts
static override meta: AuditMeta = {
  subject: { kind: 'artifact-contents', artifact: 'sitemap' },   // typechecks
};

audit(ctx: CheckContext): AuditResult {
  if (!getSitemapResult(ctx)) {
    return this.fail('No sitemap found; cannot check lastmod.', /* ... */);  // also typechecks
  }
}
```

A declaration can be green while the code contradicts it. The bug is a *value* bug inside `audit()`, and no type on `meta` reaches it.

An import cannot be green while the code contradicts it, because importing the precondition means using it:

```ts
import { NO_OPENAPI_SPEC, readOpenApiPaths } from '../../gatherers/openapi';
```

So the declaration **is** the import. `absent-artifact-contract.test.ts` already works this way, and its own docstring reaches the same conclusion independently:

> Registry-driven, and the marker is the import rather than a list… no syntactic test answers that… The shared precondition constant is the closest thing to a declaration, so a family pins its own instance by exporting one and importing it.

Law 5 promotes what one test file knows into a rule the repo states.

---

## 6. The four-way read

The shared vocabulary law 5 depends on. Implemented once in `packages/core/src/gatherers/openapi.ts`, and independently reinvented in `packages/core/src/audits/agent-interfaces/_ard.ts:76-84`.

| the read returns | meaning | the audit says |
|:--|:--|:--|
| **absent** | nothing readable arrived | `notApplicable` |
| **empty** | readable, and it declares nothing | `notApplicable` |
| **malformed** | nothing readable, and the author wrote the breakage | `fail`, naming it |
| **readable** | at least one item survives, defects may sit beside it | grade what survived, name the rest |

Two rules follow, both already written into `gatherers/openapi.ts`:

- **Broken is judged over what survives the read, not over the whole artifact.** One malformed entry beside twenty good ones does not erase the twenty.
- **The decline states what the read observed, not what the site did.** "No readable OpenAPI document at `/openapi.json`" — not "the site publishes no OpenAPI document", which the read never established.

---

## 7. Structure of `docs/architecture/audits.md`

*Proposed, not yet approved.*

1. What an audit is — the six parts
2. The ten laws, with the reasoning `AGENTS.md` has no room for
3. The four-way read, with `gatherers/openapi.ts` as the worked example
4. Why the declaration is an import — §5 above, at length
5. The kinds that do **not** exist, and why — the rejected taxonomy, so nobody proposes it twice
6. Anti-patterns with named instances: the private-reader duplication, the vacuous pass over an empty set, the unguarded first fetch hop
7. Standing debts, with their measurements and where each is tracked

Section 5 earns its place: the five-kind taxonomy is an attractive idea that fails for a non-obvious reason (`main-element` passes, `single-h1` fails, `aside-element` declines — same directory, same kind, same empty scan). Without a record, the next person proposes it again.

---

## 8. Scope

**In:** the two documents.

**Out, each needing its own spec:** the sitemap gatherer and its five rebinds; the family table in the absent-artifact contract; the `isSafeUrl` enumeration and nine fixes; the empty-scan contract and its exemption map; the fetch-budget number; the seven vacuous passes.

This document changes no code. It states the rules the code will be held to, and marks honestly which of them nothing currently holds.

---

## 9. Measurements this rests on

Taken on this branch, 2026-08-30, running all 215 registered audits against `emptyContext()`.

| measurement | value |
|:--|--:|
| registered audits | 215 |
| return `na` | 134 |
| return `fail` | 46 |
| return `warn` | 28 |
| return `pass` | 7 |
| test files calling `expectNotApplicableOnEmpty` | 73 |
| audits that both call it and return non-`na` | **0** |
| audits returning `na`, with a test file, that never call it | **61** |

The three sets partition the registry: 73 callers + 61 compliant non-callers + 81 non-`na` = 215.

**What this proves.** The opt-in gate is *sound but incomplete*. It produces no false greens — not one audit calls the contract and would fail it. It holds 34% of the registry when it could hold 63% for free. The review called this rot; it is not rot, it is coverage. Law 6's debt is stated on the true grounds.

The seven vacuous passes, all in one category: `content-extraction/main-element`, `article-element`, `header-footer`, `data-tables`, `content-depth`, `figure-figcaption`, `fake-headings`. Each returns `pass` on a scan that read nothing, because a ratio over an empty set reads as 100%.
