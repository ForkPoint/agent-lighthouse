# Working in this repository

Agent Lighthouse scans a website and reports whether AI agents can discover,
read, cite and act on it. This file is the contributor guide for anyone —
human or agent — changing the code.

One rule sits above the rest, and everything below is a consequence of it:

> **An audit may only claim what a source documents.** If no vendor documents a
> consumer, the check does not affect a site's score. Ever.

## Layout

| Package            | What it is                                                                                  |
| :----------------- | :------------------------------------------------------------------------------------------ |
| `packages/core`    | The audit registry, the scan orchestrator, the gatherer layer. Everything else consumes it. |
| `packages/cli`     | `npx @forkpoint/agent-lighthouse <url>`                                                     |
| `packages/report`  | Terminal, HTML, JSON and Markdown renderers                                                 |
| `packages/mcp`     | MCP server exposing a scan as a tool                                                        |
| `packages/website` | The Astro site, built from the registry and `docs/evidence/` at build time                  |

Audits live in `packages/core/src/audits/<category>/<slug>.ts`, one of eight
categories: `access-crawl-control`, `agent-interfaces`, `agentic-commerce`,
`answer-readiness`, `content-extraction`, `machine-discovery`,
`operability-safety`, `structured-data`. An audit's id is `category/slug`,
capped at 64 characters by `packages/core/src/schemas.ts`.

## Commands

```bash
pnpm build              # every package; core must build before check:dossiers
pnpm test               # vitest, from the repo root only
pnpm typecheck          # tsc --noEmit per package
pnpm lint               # oxlint
pnpm check:dossiers     # registry <-> dossier agreement, both directions
pnpm check:requires     # each audit's `requires` matches what its source reads
pnpm changeset          # one per user-visible change
```

`pnpm test` includes `packages/core/src/__tests__/verify-scan-results.test.ts`,
which scans live sites. Set `AL_SKIP_NETWORK=1` to skip it when you are
offline; CI runs it for real.

Never run `npx tsc -b`. Never run vitest from inside a package directory — the
config lives at the root.

## One audit, one file, one dossier

Every audit is three things that must agree:

1. `packages/core/src/audits/<category>/<slug>.ts` — the check
2. `packages/core/src/audits/<category>/<slug>.test.ts` — its tests
3. `docs/evidence/audits/<category>/<slug>.md` — its evidence dossier

`scripts/check-dossiers.mjs` proves the agreement in both directions: every
registered audit has a dossier whose `evidence_grade` and `slug` match its
meta, every `sources:` id resolves, and no dossier is left behind after its
audit is removed. A removed audit's record moves to `docs/evidence/sunset/`;
a merged-away one moves to `docs/evidence/merged/`. Neither is deleted.

Registering an audit means exporting it from the category `index.ts` — export,
import and array entry, in that order.

## The meta law

```ts
weight = weightForGrade(grade, tier); // A -> 1.0, B -> 0.6, C/D -> 0
```

Never hand-set a weight. Three constraints follow, and `sunset.test.ts`
enforces them:

- A non-scored tier implies weight 0 and `scoreDisplayMode: 'informative'`.
- Grade C in the `scored` tier is unregistrable — `weightForGrade` returns 0,
  and `tier !== 'scored' ⟺ weight === 0`.
- The grade is the strongest **proven** consumer path, not the most impressive
  one. Where the dossier and the code disagree, the dossier governs.

`docs/evidence/policy.md` defines the grades. Short form: **A** is documented
consumer behaviour or a ratified standard with known consumers; **B** is a
draft standard with real adoption, or strong empirical measurement; **C** is a
community convention nothing documents consuming; **D** is speculative.

## Writing an audit

- **Absence is usually `notApplicable`, not `fail`.** A site that never adopted
  an optional convention has done nothing wrong. Fail only what a source says
  costs the site something. `packages/core/src/tests/na-contract.ts` has the
  helper that pins this on an empty scan.
- **Absent artifact, absent verdict.** The sharper form of the rule above. An
  audit about an artifact's _contents_ returns `notApplicable` when the
  artifact is absent. Only a present-and-defective artifact may `fail`. Four
  `openapi-*` audits failed every site with no OpenAPI document at all — 2.4
  combined weight telling a bakery to add a `servers` array to a spec it had
  never written. Absent means absent: an artifact that is present and
  malformed is a finding, and the check that declines the absence still fails
  the breakage. `gatherers/openapi.ts` splits the two in one place so no
  caller has to guess.
- **Put that precondition beside the read.** The gatherer that reads the
  artifact owns it, next to the read, with the reasoning written down.
  `packages/core/src/gatherers/openapi.ts` is the worked example, and
  `packages/core/src/tests/absent-artifact-contract.test.ts` holds every audit
  that imports its precondition. Two places it must not go:
  - **Not the runner.** `planAudits` knows page types and `EvidenceKey`s, both
    scan-level and domain-neutral. Teach it one artifact type and api-catalog,
    MCP manifest, RSL and feeds follow, until the runner is a registry of
    artifact predicates.
  - **Never an `EvidenceKey`.** `gatedMassShare` counts skipped-for-no-evidence
    mass toward the 0.35 unscored threshold. An `openapi-spec-present` key
    would push that weight into the numerator on every site without an API and
    move a perfectly judgeable one toward `overallScore: null`.
- **Score the population the evidence covers.** A grade earned for coding
  agents does not license failing a retail store. Gate with
  `applicablePageTypes` or return `notApplicable`.
- **`details` values must be scalars or arrays of strings.** A number array is
  dropped by the result schema; an array of objects _throws_, and the runner
  reports `[scanner] Audit error` instead of a result. Unit tests call
  `audit.audit(ctx)` directly and never reach `toCheckResult`, so parse the
  result through `AuditResultSchema` in the test whenever `details` carries
  anything structured.
- **Reuse the gatherers.** `packages/core/src/gatherers/` shares fetches across
  audits — robots, sitemap, sampled pages, CSS rules, tokens, text metrics,
  extraction, feeds, media, commerce, UA parity. A per-audit fetch that
  duplicates one of these costs every scan.
- **Gate every URL taken from scanned content with `isSafeUrl()`** from
  `packages/core/src/fetcher.ts`. It resolves DNS and refuses localhost and
  private addresses, and the fetcher re-applies it on every redirect hop. Test
  suites `vi.mock('../../fetcher')` and stub it; no test performs real DNS.

## Writing a dossier

The dossier is the audit's evidence, and part of it is published. The site
slices it with a whitelist — `packages/website/src/lib/dossier-public.ts` —
and publishes only these sections, in this order:

```
What it checks · Why it matters · Evidence · Limits · How it scores ·
Example failure · Sources
```

Everything else is withheld: code review findings, review history,
implementation deviations, deferred work. Write those freely; they are the
working record. The two frontmatter escapes are `public_extra` and
`public_omit`.

A **scored** audit's published slice must clear the evidence bar
(`packages/website/src/lib/evidence-bar.ts`) or the site build fails. It must
carry an openable source URL, a `(verified YYYY-MM-DD)` stamp, and stated grade
reasoning. Informative and experimental audits are held to the first three
rules only.

Write for a reader, not for a researcher:

- Short sentences. One idea each.
- No pasted third-party source listings. State what a library _does_; name at
  most one symbol as the proof pointer.
- No first person, no shouted emphasis.
- Record every substitution under `## Implementation deviations` and every
  skipped step under `## Deferred`. That is where a future reader looks, so it
  is the only place the decision needs to live.

## Style

- Comments, JSDoc and inline config comments are **English**, always,
  regardless of the surrounding content.
- oxlint is the only linter. There is no ESLint config and none should appear.
  Use `// oxlint-disable-*` if a suppression is genuinely needed.
- Prettier for formatting: `pnpm format`.

## Before you commit

All six, in order:

```bash
pnpm build && pnpm test && pnpm typecheck && pnpm lint && pnpm check:dossiers && pnpm check:requires
```

`check:dossiers` and `check:requires` read the _built_ core bundle, so
`pnpm build` has to run first. Watch for stale build artifacts: an untracked `.js` or `.d.ts` under
`packages/*/src/` shadows its source in vitest and turns a red suite green.

Add a changeset for anything a user would notice. Removing an audit, changing
what one reports, or moving a tier is a `major` — a scan's output changes even
when the audit carried weight 0.
