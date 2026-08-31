# Phase 1 — Truthful Fixtures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** make the runner refuse to run any audit on a scan that could not read
the site, so no audit's metadata and no audit's own code has to remember.

**Architecture:** one universal precondition in `planAudits`, consulted before
`requires`. Two honest test fixtures replace the self-contradictory
`emptyContext()`. One absolute registry-wide gate proves the precondition, and
one snapshot gate records what a bare-but-real site is told, so every later phase
has to explain any verdict it moves.

**Tech Stack:** TypeScript, vitest (root config only), Zod, oxlint, pnpm
workspaces.

**Spec:** `docs/architecture/audits.md`

**Roadmap:** `docs/superpowers/plans/2026-08-31-audit-architecture-migration.md`

**Plan authority:** the spec owns behavior. The roadmap owns phase boundaries.
This file owns Phase 1 execution only. Correct this file before execution if it
conflicts with either parent.

## Global Constraints

Inherited from `docs/superpowers/plans/2026-08-31-audit-architecture-migration.md`.
Repeated here because a task's implementer may see only this file.

- `weight = weightForGrade(grade, tier)` — A→1.0, B→0.6, C/D→0. Never hand-set
  a weight.
- Absence is `notApplicable`, not `fail`.
- An artifact precondition lives in its gatherer, never in `planAudits`, never
  as an `EvidenceKey`. **A scan-level precondition is the exception this phase
  relies on** — `planAudits` already consults `requires`, which is exactly that.
- `details` values are `string | number | boolean | string[]`. Anything else
  throws in `AuditResultSchema.parse`.
- Comments, JSDoc and inline config comments are English.
- oxlint only. `// oxlint-disable-*` if a suppression is genuinely needed.
- Prettier: `pnpm format`.
- Before every commit, all six in order:
  `pnpm build && pnpm test && pnpm typecheck && pnpm lint && pnpm check:dossiers && pnpm check:requires`
- Never run `npx tsc -b`. Never run vitest from inside a package directory — the
  config is at the repository root.
- `pnpm test` scans live sites. `AL_SKIP_NETWORK=1` skips that suite while
  working offline.

## Measured starting state

Taken 2026-08-31 over all 215 registered audits in `defaultConfig`.

| fact                                                                      | value                                                                                                                                                |
| :------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audits returning a verdict when `audit()` is called directly on fixture A | 62 — 38 `fail`, 24 `warn`, 0 `pass`, 0 throws                                                                                                        |
| What `planAudits` does with fixture A today                               | `runnable = 4`, `skipped = 211`                                                                                                                      |
| The 4 that run                                                            | `https-enabled`, `no-bot-detection`, `no-redirect-chains`, `no-blocking-captcha` — no `requires`, each hand-rolls `scanReadTheSite`, all return `na` |
| Audits hand-rolling `scanReadTheSite` inside `audit()`                    | 42                                                                                                                                                   |
| Audits whose test calls `expectNotApplicableOnEmpty`                      | 73 of 215                                                                                                                                            |
| Of the 62, how many the contract covers                                   | **0**                                                                                                                                                |

This phase changes public results for unread scans. The runner now replaces all
direct-audit verdicts with `na` stubs, including WAF failures, cross-origin
redirect failures, and plain-HTTP failures. It also changes what guarantees the
correctness.

## File Structure

| file                                                   | responsibility                                                                                                                                                                        |
| :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core/src/tests/fixtures.ts`                  | **Create.** The two fixtures, built through the real `buildScanEvidence`. Nothing else.                                                                                               |
| `packages/core/src/tests/plan-all-audits.ts`           | **Create.** Test-only full-registry planning. It bypasses production evidence and page-type gates and is never package-exported.                                                      |
| `packages/core/src/audit-runner.ts`                    | **Modify.** One universal precondition in `planAudits`, before the `requires` loop, and `PlanOptions.enforceEvidence` defaults to `true`. `PlanOptions` and the third parameter stay. |
| `packages/core/src/tests/unreachable-contract.test.ts` | **Create.** The absolute gate.                                                                                                                                                        |
| `packages/core/src/tests/bare-site.snapshot.test.ts`   | **Create.** The snapshot gate.                                                                                                                                                        |
| `packages/core/src/tests/na-contract.ts`               | **Modify, then delete `emptyContext`.** Re-export the fixtures; keep `expectNotApplicableOnEmpty` for the 73 tests that call it.                                                      |
| `.changeset/*.md`                                      | **Create.** One `major`.                                                                                                                                                              |

`fixtures.ts` is separate from `na-contract.ts` because the two gates and the 73
existing contract calls are three consumers of the same two objects, and the
fixtures must not import the assertion helper that consumes them.

---

### Task 1: The two fixtures

**Files:**

- Create: `packages/core/src/tests/fixtures.ts`
- Test: `packages/core/src/tests/fixtures.test.ts`

**Interfaces:**

- Consumes: `buildScanEvidence` from `../scan-evidence`, `mockPageContext` from
  `../__tests__/test-utils`, `CheckContext` from `../check-context`,
  `FetchResult` from `../fetcher`.
- Produces: `unreachableContext(overrides?: Partial<CheckContext>):
CheckContext` and `bareSiteContext(overrides?: Partial<CheckContext>):
CheckContext`, plus the constant `BARE_SITE_HTML: string`. Tasks 2, 3 and 4
  import all three.

**Why `mockPageContext` and not a hand-built `PageContext`:** a hand-built one
omits `structuredData`, `headLinks` and the parsed `$`, and 29 audits threw on
it. `mockPageContext` runs the real parser, so fixture B produces zero throws.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/tests/fixtures.test.ts
import { describe, it, expect } from "vitest";
import { unreachableContext, bareSiteContext } from "./fixtures";
import { scanReadTheSite } from "../scan-evidence";

describe("unreachableContext", () => {
  it("is not judgeable, and says why", () => {
    const ctx = unreachableContext();
    expect(scanReadTheSite(ctx.evidence)).toBe(false);
    expect(ctx.evidence.reasons["origin-reachable"]).toContain("ENOTFOUND");
  });

  // The fixture this replaces set `judgeable: true` and
  // `usablePageTypes: ALL_PAGE_TYPES` while supplying zero pages, so every
  // audit was tested against a scan that claimed to have read four page types
  // it had never fetched.
  it("claims no page types, having fetched no pages", () => {
    const ctx = unreachableContext();
    expect(ctx.pages).toHaveLength(0);
    expect(ctx.evidence.usablePageTypes.size).toBe(0);
    expect(ctx.evidence.met["rendered-body"]).toBe(false);
  });
});

describe("bareSiteContext", () => {
  it("is judgeable and served readable text", () => {
    const ctx = bareSiteContext();
    expect(scanReadTheSite(ctx.evidence)).toBe(true);
    expect(ctx.evidence.met["rendered-body"]).toBe(true);
    expect(ctx.evidence.usablePageTypes.has("homepage")).toBe(true);
  });

  it("adopted no optional convention", () => {
    const ctx = bareSiteContext();
    expect(ctx.rootFiles).toEqual({});
    expect(ctx.pages[0]!.jsonLd).toHaveLength(0);
    expect(ctx.pages[0]!.headLinks).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/tests/fixtures.test.ts`
Expected: FAIL — `Failed to resolve import "./fixtures"`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/core/src/tests/fixtures.ts
import type { CheckContext } from "../check-context";
import type { FetchOptions, FetchResult } from "../fetcher";
import { buildScanEvidence } from "../scan-evidence";
import { mockPageContext } from "../__tests__/test-utils";

const BASE_URL = "https://example.test";

/** A response that never arrived. */
const unreachable: FetchResult = {
  url: `${BASE_URL}/`,
  finalUrl: `${BASE_URL}/`,
  status: 0,
  headers: {},
  body: "",
  ttfbMs: 0,
  totalMs: 0,
  contentType: "",
  contentLength: 0,
  error: "ENOTFOUND",
};

/** Any URL an audit asks for, answered 404. Never a network call. */
const notFound = (options: FetchOptions): Promise<FetchResult> =>
  Promise.resolve({
    ...unreachable,
    url: options.url,
    finalUrl: options.url,
    status: 404,
    error: undefined,
  });

/**
 * Fixture A: the origin never answered.
 *
 * Built through the real `buildScanEvidence` rather than `allEvidenceMet()`,
 * which is the whole point. The fixture this replaces asserted that every
 * class of evidence had been obtained while supplying nothing, so an audit
 * could be tested against a scan that had read four page types it never
 * fetched. No verdict about this site can be correct, and the contract test in
 * `unreachable-contract.test.ts` holds the whole registry to that.
 */
export function unreachableContext(
  overrides: Partial<CheckContext> = {},
): CheckContext {
  return {
    rootFiles: {},
    pages: [],
    domain: "example.test",
    baseUrl: BASE_URL,
    fetch: notFound,
    evidence: buildScanEvidence({
      requestedUrl: `${BASE_URL}/`,
      homepageResult: unreachable,
      pages: [],
      rootFiles: {},
      wafProtection: null,
    }),
    ...overrides,
  };
}

/**
 * A real page that adopted nothing: valid HTML, a language, one `h1`, enough
 * prose to clear `pageRendersText`, and not one optional convention.
 */
export const BARE_SITE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sunrise Bakery</title>
  </head>
  <body>
    <h1>Sunrise Bakery</h1>
    <p>${"We bake bread every morning in a small shop on Mill Street. ".repeat(12)}</p>
  </body>
</html>`;

/**
 * Fixture B: a site that is entirely reachable and has done nothing wrong.
 *
 * The counterpart to fixture A, and the one that catches the opposite mistake:
 * an audit that fails a bakery for not being an API. Its verdicts are recorded
 * as a snapshot rather than asserted, because unlike fixture A there is no
 * single right answer — a page with no `<main>` really is harder to extract
 * from. What the snapshot buys is that no change to it can pass unexplained.
 */
export function bareSiteContext(
  overrides: Partial<CheckContext> = {},
): CheckContext {
  const page = mockPageContext(`${BASE_URL}/`, BARE_SITE_HTML, 0);
  return {
    rootFiles: {},
    pages: [page],
    domain: "example.test",
    baseUrl: BASE_URL,
    fetch: notFound,
    evidence: buildScanEvidence({
      requestedUrl: `${BASE_URL}/`,
      homepageResult: { ...page.fetchResult, contentType: "text/html" },
      pages: [page],
      rootFiles: {},
      wafProtection: null,
    }),
    ...overrides,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/tests/fixtures.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tests/fixtures.ts packages/core/src/tests/fixtures.test.ts
git commit -m "test(core): two scan fixtures that describe themselves truthfully"
```

---

### Task 2: The runner refuses an unread scan

**Files:**

- Modify: `packages/core/src/audit-runner.ts` — `planAudits`, around line 166
- Create: `packages/core/src/tests/plan-all-audits.ts`
- Test: `packages/core/src/audit-runner.test.ts`

**Interfaces:**

- Consumes: `unreachableContext` and `bareSiteContext` from Task 1;
  `scanReadTheSite` and `unreadSiteReason`, both already exported from
  `../scan-evidence`; `TAG_SKIPPED_NO_EVIDENCE` from `./constants`.
- Produces: `planAudits(ctx, config)` gated by default — the unread-scan
  precondition takes no option at all, and the `requires` gate is on unless a
  caller passes the documented diagnostic opt-out `{ enforceEvidence: false }`.
  `PlanOptions` and the third parameter stay, so `orchestrator.ts:490` and
  `ScanOptions.enforceEvidenceGate` keep working unchanged. Also test-only
  `planAllAuditsForTest(config): AuditPlan`, imported by tests through its file
  path and never exported from `packages/core` — it is the only full bypass of
  every gate. Task 3 relies on the production planner returning
  `runnable.length === 0` on fixture A, which holds for any value of
  `enforceEvidence` because the precondition sits above it.

- [ ] **Step 1: Write the failing test**

```ts
// append to packages/core/src/audit-runner.test.ts
import { unreachableContext, bareSiteContext } from "./tests/fixtures";
import { defaultConfig } from "./audit-config";
import { TAG_SKIPPED_NO_EVIDENCE } from "./constants";

describe("planAudits on a scan that read nothing", () => {
  // Four audits declare no `requires` and are therefore invisible to the
  // evidence gate. They are correct today only because each hand-rolls
  // `scanReadTheSite` inside `audit()`. That is the arrangement this removes:
  // an audit's protection must not depend on the audit remembering.
  it("runs nothing at all", () => {
    const plan = planAudits(unreachableContext(), defaultConfig);
    expect(plan.runnable).toHaveLength(0);
    expect(plan.skipped).toHaveLength(215);
  });

  it("tags every skip with the reason the scan gave", () => {
    const plan = planAudits(unreachableContext(), defaultConfig);
    for (const stub of plan.skipped) {
      expect(stub.status).toBe("na");
      expect(stub.tags).toContain(TAG_SKIPPED_NO_EVIDENCE);
      expect(stub.explanation).toContain("ENOTFOUND");
    }
  });

  // The precondition must not fire on a site that was read. A bare site is
  // still a site, and every verdict about it is a verdict about the site.
  it("does not fire on a bare but reachable site", () => {
    const plan = planAudits(bareSiteContext(), defaultConfig);
    expect(plan.runnable.length).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/audit-runner.test.ts -t 'planAudits on a scan that read nothing'`
Expected: FAIL on the first test — `expected length 0, received 4`.

- [ ] **Step 3: Write the implementation**

Add the import at the top of `packages/core/src/audit-runner.ts`:

```ts
import { scanReadTheSite, unreadSiteReason } from "./scan-evidence";
```

Then, inside `planAudits`, immediately after `const skipped: CheckResult[] = [];`
and **before** the `for (const cat of config.categories)` loop:

```ts
// One precondition above every other: the scan holds no response it can
// attribute to this site, so no audit may say anything about it.
//
// This is scan-level and domain-neutral, which is the only kind of
// precondition that belongs here — `requires` is already exactly that. An
// artifact precondition stays in the gatherer that performs the read; see
// docs/architecture/audits.md §12.
//
// It sits above `requires` rather than inside it because `requires` is the
// audit's own claim about itself. Four audits declare none and were correct
// only by hand-rolling this check inside `audit()`, and 142 of 215 audits
// have no contract test that would catch the omission. An audit's protection
// must not depend on the audit remembering.
const unread = !scanReadTheSite(ctx.evidence);
const unreadWhy = unread
  ? `Not assessed: ${unreadSiteReason(ctx.evidence)}`
  : "";
```

and inside the inner `for (const reg of regs)` loop, as its very first
statement:

```ts
if (unread) {
  skipped.push(stubCheck(reg.meta, TAG_SKIPPED_NO_EVIDENCE, unreadWhy));
  continue;
}
```

Then flip the `requires` gate to safe-by-default. Keep `PlanOptions`, keep the
third `options` parameter, and keep the orchestrator wiring at
`packages/core/src/orchestrator.ts:490` exactly as it is. Change only the
default: in `planAudits`, replace

```ts
if (options.enforceEvidence) {
```

with

```ts
if (options.enforceEvidence ?? true) {
```

and rewrite the `PlanOptions.enforceEvidence` JSDoc so it documents the new
default:

```ts
/** How `planAudits` should treat audits the scan cannot feed. */
export interface PlanOptions {
  /**
   * Skip audits whose `requires` the scan did not obtain. **Defaults to true.**
   *
   * An audit's `requires` decides what a blocked or client-rendered scan
   * reports, so a caller that omits this option gets the gated set — the same
   * set a scan gets. A production diagnostic may pass `false` to bypass only
   * these per-audit `requires` checks. It is never the default, and it never
   * bypasses the unconditional unread-scan guard.
   */
  enforceEvidence?: boolean;
}
```

**Why `enforceEvidenceGate` stays.** `ScanOptions.enforceEvidenceGate`
(`orchestrator.ts:54-62`) is a documented public `runScan` option and two
`orchestrator.test.ts` cases pass `enforceEvidenceGate: false` (`:133`, `:932`).
It keeps its documented behaviour as the explicit diagnostic opt-out. Deleting
`PlanOptions` would break that option, break the orchestrator call and break
those two tests; defaulting it to `true` closes the unsafe default without
removing anything a caller relies on.

**What this does not weaken.** The unread-scan precondition added above has no
option at all — it is unconditional in `planAudits`, and
`enforceEvidence: false` does not reach it. The only full bypass of every gate
is `planAllAuditsForTest` (Task 2, Step 7), which lives under
`packages/core/src/tests/` and is never package-exported.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/audit-runner.test.ts`
Expected: PASS, including the three new tests.

- [ ] **Step 5: Write the failing full-registry helper test**

```ts
// append to packages/core/src/audit-runner.test.ts
import { planAllAuditsForTest } from "./tests/plan-all-audits";

it("lets tests address every registered audit without weakening production", () => {
  const plan = planAllAuditsForTest(defaultConfig);

  expect(plan.runnable).toHaveLength(215);
  expect(plan.skipped).toEqual([]);
});
```

- [ ] **Step 6: Run the helper test to verify it fails**

Run: `npx vitest run packages/core/src/audit-runner.test.ts -t 'lets tests address every registered audit'`
Expected: FAIL because `./tests/plan-all-audits` does not exist.

- [ ] **Step 7: Implement the test-only helper**

```ts
// packages/core/src/tests/plan-all-audits.ts
import type { ScanConfig } from "../audit-config";
import type { AuditPlan } from "../audit-runner";

/** Test-only registry view. Production planning must never bypass its gates. */
export function planAllAuditsForTest(config: ScanConfig): AuditPlan {
  return {
    runnable: config.categories.flatMap((category) =>
      (config.audits[category.id] ?? []).map((reg) => ({
        reg,
        categoryId: category.id,
      })),
    ),
    skipped: [],
  };
}
```

- [ ] **Step 8: Run the helper test to verify it passes**

Run: `npx vitest run packages/core/src/audit-runner.test.ts -t 'lets tests address every registered audit'`
Expected: PASS, 215 runnable and zero skipped.

- [ ] **Step 9: Check nothing else moved**

Run: `AL_SKIP_NETWORK=1 npx vitest run packages/core`
Expected: PASS. `scan-invariants.test.ts` rule 3 asserts that no check passes
when `origin-reachable` is false; this change makes that unreachable rather than
merely unobserved, so it must stay green.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/audit-runner.ts packages/core/src/audit-runner.test.ts packages/core/src/tests/plan-all-audits.ts
git commit -m "fix(core): the runner refuses an unread scan, so no audit has to"
```

---

### Task 3: The absolute gate

**Files:**

- Create: `packages/core/src/tests/unreachable-contract.test.ts`

**Interfaces:**

- Consumes: `unreachableContext` from Task 1; the precondition from Task 2;
  `defaultConfig` from `../audit-config`; `planAudits` from `../audit-runner`.
- Produces: nothing. It is a gate.

**Why this replaces `expectNotApplicableOnEmpty` as the registry's guarantee:**
that helper is opt-in and 73 of 215 audits call it. This covers 215 by
construction. The helper stays for the 73 — it asserts something narrower and
useful, that a specific audit declines rather than passes.

- [ ] **Step 1: Write the test**

```ts
// packages/core/src/tests/unreachable-contract.test.ts
import { describe, it, expect } from "vitest";
import { planAudits } from "../audit-runner";
import { defaultConfig } from "../audit-config";
import { unreachableContext } from "./fixtures";

/**
 * The one absolute rule in the registry: a scan that could not read the site
 * says nothing about it.
 *
 * There is deliberately no exemption list here, and adding one is a visible
 * change to this file rather than a line in a meta somewhere. Every law this
 * project has lost, it lost to an exemption that looked reasonable on the day
 * it was added.
 */
describe("an unread scan verdicts nothing", () => {
  it("leaves no audit runnable", () => {
    const plan = planAudits(unreachableContext(), defaultConfig);

    const registered = defaultConfig.categories.reduce(
      (sum, cat) => sum + (defaultConfig.audits[cat.id]?.length ?? 0),
      0,
    );

    expect(plan.runnable.map((entry) => entry.reg.meta.id)).toEqual([]);
    expect(plan.skipped).toHaveLength(registered);
  });

  it("gives every skipped audit a reason a reader can act on", () => {
    const plan = planAudits(unreachableContext(), defaultConfig);
    for (const stub of plan.skipped) {
      expect(stub.status, stub.id).toBe("na");
      expect(stub.explanation, stub.id).toMatch(/^Not assessed: /);
      expect(stub.score, stub.id).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run packages/core/src/tests/unreachable-contract.test.ts`
Expected: PASS, 2 tests. It passes immediately because Task 2 landed the
behaviour; this task's deliverable is the gate that stops it regressing.

- [ ] **Step 3: Prove the gate bites**

Temporarily change `const unread = !scanReadTheSite(ctx.evidence)` in
`audit-runner.ts` to `const unread = false;`.

Run: `npx vitest run packages/core/src/tests/unreachable-contract.test.ts`
Expected: FAIL — `expected [] to deeply equal [ 'access-crawl-control/…' ]`.

Revert the change with `git checkout packages/core/src/audit-runner.ts` before
continuing.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/tests/unreachable-contract.test.ts
git commit -m "test(core): pin the absolute rule to the whole registry"
```

---

### Task 4: The snapshot gate

**Files:**

- Create: `packages/core/src/tests/bare-site.snapshot.test.ts`

**Interfaces:**

- Consumes: `bareSiteContext` from Task 1; `defaultConfig`.
- Produces: `packages/core/src/tests/__snapshots__/bare-site.snapshot.test.ts.snap`,
  which Phases 2 through 6 each have to explain any change to.

**Measured expectation:** 215 audits, `na` 113, `pass` 25, `warn` 30, `fail` 47,
0 throws. The snapshot records the per-audit table, not those totals, so a change
that keeps the counts and moves two audits still fails.

- [ ] **Step 1: Write the test**

```ts
// packages/core/src/tests/bare-site.snapshot.test.ts
import { describe, it, expect } from "vitest";
import { defaultConfig } from "../audit-config";
import { bareSiteContext } from "./fixtures";

/**
 * What a site that has done nothing wrong is told.
 *
 * A snapshot rather than an assertion, because unlike the unreachable fixture
 * there is no single right answer here: a page with no `<main>` really is
 * harder to extract from, and `https-enabled` really does pass. What this buys
 * is that no later change can move a verdict about a bare site without a
 * reviewer seeing exactly which one moved and saying why.
 *
 * Audits are constructed and called directly, not planned, so this records what
 * each audit decides rather than what the gate lets through.
 */
describe("a bare but real site", () => {
  it("is told this, and only this", async () => {
    const rows: string[] = [];
    for (const cat of defaultConfig.categories) {
      for (const reg of defaultConfig.audits[cat.id] ?? []) {
        const result = await reg.create().audit(bareSiteContext());
        rows.push(
          `${result.status.padEnd(4)} ${String(reg.meta.weight).padEnd(3)} ${reg.meta.id}`,
        );
      }
    }
    expect(rows.sort().join("\n")).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run it to write the snapshot**

Run: `npx vitest run packages/core/src/tests/bare-site.snapshot.test.ts`
Expected: PASS, `1 snapshot written`.

- [ ] **Step 3: Read the snapshot before committing it**

Open `packages/core/src/tests/__snapshots__/bare-site.snapshot.test.ts.snap`.
Confirm 215 rows and no row reading `THROW`. A snapshot committed unread is a
record of a bug, not a gate against one.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/tests/bare-site.snapshot.test.ts packages/core/src/tests/__snapshots__
git commit -m "test(core): record what a site that did nothing wrong is told"
```

---

### Task 5: Retire `emptyContext`

**Files:**

- Modify: `packages/core/src/tests/na-contract.ts`
- Modify: `packages/core/src/tests/na-contract.test.ts`

**Interfaces:**

- Consumes: `unreachableContext` from Task 1.
- Produces: `expectNotApplicableOnEmpty` keeps its exact signature, so the 73
  test files that call it are untouched. `emptyContext` stops being exported.

**Why the 73 stay green:** measured — of the 62 audits that verdict on the
truthful fixture, **zero** call `expectNotApplicableOnEmpty`. The 73 it does
cover return `na` on fixture A already.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/tests/na-contract.test.ts — replace the file's imports and
// add this case
import { describe, it, expect } from "vitest";
import { expectNotApplicableOnEmpty } from "./na-contract";

describe("expectNotApplicableOnEmpty", () => {
  it("rejects an audit that verdicts on a scan that read nothing", async () => {
    const passing = { audit: () => ({ status: "pass" as const, score: 1 }) };
    await expect(expectNotApplicableOnEmpty(passing)).rejects.toThrow(
      /vacuous pass/,
    );
  });

  it("accepts an audit that declines", async () => {
    const declining = { audit: () => ({ status: "na" as const, score: 0 }) };
    await expect(
      expectNotApplicableOnEmpty(declining),
    ).resolves.toBeUndefined();
  });

  // The fixture must not claim evidence it does not hold. The version this
  // replaces set `judgeable: true` with zero pages, so the helper's own name
  // was the only thing describing the scan.
  it("runs the audit against a scan that admits it read nothing", async () => {
    let sawJudgeable: boolean | undefined;
    await expectNotApplicableOnEmpty({
      audit: (ctx) => {
        sawJudgeable = ctx.evidence.judgeable;
        return { status: "na" as const, score: 0 };
      },
    });
    expect(sawJudgeable).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/tests/na-contract.test.ts`
Expected: FAIL on the third case — `expected true to be false`.

- [ ] **Step 3: Write the implementation**

Replace the body of `packages/core/src/tests/na-contract.ts` with:

```ts
import type { CheckContext } from "../check-context";
import type { AuditResult } from "../types";
import { unreachableContext } from "./fixtures";

/**
 * Contract test: on a site the scan could not read, an audit must decline.
 *
 * Narrower than `unreachable-contract.test.ts`, which proves the runner never
 * constructs the audit at all. This proves the audit itself declines when
 * called directly, which is what an audit's own unit test can check.
 *
 * The fixture is `unreachableContext`. The version this replaced handed out
 * `allEvidenceMet()` alongside zero pages, so an audit was asserted against a
 * scan claiming to have read four page types it had never fetched.
 */
export async function expectNotApplicableOnEmpty(audit: {
  audit(ctx: CheckContext): AuditResult | Promise<AuditResult>;
}): Promise<void> {
  const result = await audit.audit(unreachableContext());
  if (result.status !== "na") {
    throw new Error(
      `Expected notApplicable on a scan that read nothing, got "${result.status}" — a vacuous pass or a verdict here describes the scanner, not the site.`,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/tests/na-contract.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the 73 audit suites that call it**

Run: `AL_SKIP_NETWORK=1 npx vitest run packages/core`
Expected: PASS. If any audit suite fails here, that audit was relying on the old
fixture's false `judgeable: true` — record it and fix that audit rather than
softening the fixture.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/tests/na-contract.ts packages/core/src/tests/na-contract.test.ts
git commit -m "test(core): the na-contract runs against a fixture that admits what it read"
```

---

### Task 6: Delete the 42 hand-rolled guards

**Files:**

- Modify: the 42 audit sources listed below. Each loses its `scanReadTheSite` /
  `unreadSiteReason` import and the early-return block that uses them.

```
access-crawl-control/ai-content-declaration        access-crawl-control/ai-usage-signal-coherence-across-channels
access-crawl-control/aipref-content-usage-declaration-validity
access-crawl-control/canonical                     access-crawl-control/crawl-delay
access-crawl-control/https-enabled                 access-crawl-control/no-blanket-block
access-crawl-control/no-bot-detection              access-crawl-control/no-nofollow
access-crawl-control/no-redirect-chains            access-crawl-control/robots-ai-group-shadowing
access-crawl-control/robots-directives             access-crawl-control/tdm-rep
answer-readiness/content-without-clickthrough      answer-readiness/descriptive-urls
answer-readiness/extractor-survival-recall         answer-readiness/snippet-gate-coverage
answer-readiness/unique-meta                       content-extraction/article-element
content-extraction/content-depth                   content-extraction/css-hidden-ghost-content
content-extraction/data-tables                     content-extraction/extraction-determinism
content-extraction/fake-headings                   content-extraction/figure-figcaption
content-extraction/header-footer                   content-extraction/language-attribute
content-extraction/main-element                    content-extraction/preamble-tax
content-extraction/server-rendered                 content-extraction/server-responsiveness
content-extraction/single-h1                       content-extraction/token-ratio
machine-discovery/llms-full-txt                    machine-discovery/rss-feed
operability-safety/aria-layer-injection-scan       operability-safety/ghost-clickable-element-ratio
operability-safety/invisible-instruction-scan      operability-safety/no-blocking-captcha
operability-safety/third-party-dom-write-blast-radius
operability-safety/unicode-covert-channel-scan     operability-safety/unsafe-agent-triggerable-affordances
```

**Interfaces:**

- Consumes: the gate from Task 3 and the snapshot from Task 4. Both must be
  green before this task starts and green after it ends.
- Produces: nothing. `scanReadPageText` — a different, narrower guard about
  whether a page rendered text — **stays**. Only `scanReadTheSite` and
  `unreadSiteReason` come out.

**Why this is its own task and its own commit:** it is the only step that edits
audit sources, and it is pure deletion. Isolating it means a bisect can tell a
behaviour change from a cleanup.

- [ ] **Step 1: Confirm both gates are green before touching anything**

Run: `npx vitest run packages/core/src/tests/unreachable-contract.test.ts packages/core/src/tests/bare-site.snapshot.test.ts`
Expected: PASS, 3 tests, 0 snapshots written.

- [ ] **Step 2: Remove the guard from one audit and prove nothing moves**

In `packages/core/src/audits/content-extraction/single-h1.ts`, delete the import
of `scanReadTheSite` and `unreadSiteReason` (line 5) and the guard block at the
top of `audit()` (lines 33–41) that returns `notApplicable` when the scan read
nothing.

- [ ] **Step 3: Run the gates and that audit's own suite**

Run: `npx vitest run packages/core/src/tests/unreachable-contract.test.ts packages/core/src/tests/bare-site.snapshot.test.ts packages/core/src/audits/content-extraction/single-h1.test.ts`
Expected: PASS. If `single-h1.test.ts` fails, it is calling `audit()` directly
with an unreachable context — update that test to assert through `planAudits`,
or keep the guard in this one audit and record it in the changeset.

- [ ] **Step 4: Repeat for the remaining 41**

One audit at a time, and after each one run exactly what Step 3 ran — the two
gates **and that audit's own test file**:

```bash
npx vitest run \
  packages/core/src/tests/unreachable-contract.test.ts \
  packages/core/src/tests/bare-site.snapshot.test.ts \
  packages/core/src/audits/<category>/<slug>.test.ts
```

Do not batch: the snapshot is the only detector of a moved verdict, and a batch
that moves two verdicts reports one diff.

**Why the audit's own suite is not optional here.** Neither gate can see this
failure class. `unreachable-contract.test.ts` plans through `planAudits`, which
skips every audit on fixture A, so the deleted guard is never reached.
`bare-site.snapshot.test.ts` uses a reachable fixture, where the guard never
fired in the first place. The detector is the audit's own test: 16 of these 42
call `expectNotApplicableOnEmpty`, which after Task 5 calls `audit()` directly
on `unreachableContext()` and requires `na` — `access-crawl-control/tdm-rep`,
`answer-readiness/extractor-survival-recall` and
`operability-safety/aria-layer-injection-scan` among them. An audit whose
post-guard path does not fall through to `notApplicable` breaks that test. Left
to Step 6, the break surfaces after all 42 edits, which is the batch this task
exists to avoid. The Step 3 remedy applies unchanged: assert through
`planAudits`, or keep the guard in that one audit and name it in the changeset.

- [ ] **Step 5: Prove no guard is left**

Run:

```bash
grep -rn "scanReadTheSite\|unreadSiteReason" packages/core/src/audits/ || echo "none left"
```

Expected: `none left`.

- [ ] **Step 6: Full suite**

Run: `pnpm build && AL_SKIP_NETWORK=1 pnpm test && pnpm typecheck && rtk err pnpm lint && pnpm check:dossiers && pnpm check:requires`
Expected: all six pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/audits
git commit -m "refactor(core): drop 42 hand-rolled copies of the unread-scan guard"
```

---

### Task 7: The changeset

**Files:**

- Create: `.changeset/the-runner-refuses-an-unread-scan.md`

- [ ] **Step 1: Write it**

```markdown
---
"@forkpoint/agent-lighthouse-core": major
---

A scan that could not read the site now runs no audit at all.

The rule previously depended on separate mechanisms. The `requires` gate
skipped 211 of 215 audits. The other four declared no requirements and checked
the unread state inside `audit()`. In total, 42 audit files carried a local copy
of that check, while 142 of 215 audits had no test that would catch a missing
declaration.

`planAudits` now applies the check once, above every audit's own `requires`, and
`unreachable-contract.test.ts` holds the whole registry to it with no exemption
list. The 42 copies are gone.

What changes for a `runScan` caller: every audit on an unread scan now carries
the runner's `na` stub. This replaces more than the four local `na`
explanations. It also suppresses direct-audit WAF failures, cross-origin
redirect failures, and plain-HTTP failures because none may verdict when the
scan read no attributable site response. These changes affect the findings and
any score derived from them. Each stub names the scan reason, for example
`Not assessed: The homepage could not be fetched: ENOTFOUND.`

What changes for an SDK caller: the `requires` gate in `planAudits` is now on by
default. `PlanOptions.enforceEvidence` previously defaulted to `false`, so
`planAudits(ctx, config)` ran audits without checking their declared evidence.
Pass `{ enforceEvidence: false }` as the third argument to bypass only those
`requires` checks. `runAudits` has no `PlanOptions` argument. A caller that needs
that diagnostic mode first builds a plan with `planAudits`, then passes the
precomputed plan as the fourth `runAudits` argument. Without a plan, `runAudits`
uses the default gated plan.

`runScan`'s `enforceEvidenceGate` option stays available as the explicit
diagnostic opt-out for `requires`, and it already defaulted to `true`. Passing
`false` never bypasses the unread-scan precondition. The only full bypass of
every gate is a test-only helper that is not exported from the package.
```

- [ ] **Step 2: Commit**

```bash
git add .changeset/the-runner-refuses-an-unread-scan.md
git commit -m "docs(changeset): the runner refuses an unread scan"
```

---

## Exit criteria

- [ ] `unreachable-contract.test.ts` green, with no exemption list in the file.
- [ ] `bare-site.snapshot.test.ts` green, 215 rows, no `THROW`.
- [ ] `grep -rn "scanReadTheSite" packages/core/src/audits/` returns nothing.
- [ ] `emptyContext` is not exported from `na-contract.ts`.
- [ ] All six pre-commit commands pass.
- [ ] One `major` changeset.

## Self-review

**Spec coverage.** The roadmap's Phase 1 lists three work items — the runner
precondition (Task 2), the two honest fixtures (Task 1), and removing the 42
dead guards (Task 6) — plus two gates (Tasks 3, 4). Retiring `emptyContext`
(Task 5) is implied by "the fixtures replace it" and is called out separately
because the 73 dependent test files make it its own risk. All covered.

**Placeholders.** None. Every code step carries the code. The 42 files in Task 6
are named individually rather than described.

**Type consistency.** `unreachableContext` and `bareSiteContext` take
`Partial<CheckContext>` and return `CheckContext` in Task 1 and are called with
no argument in Tasks 2–5. `expectNotApplicableOnEmpty` keeps the exact signature
it has today, which is why the 73 callers are untouched. `planAudits` keeps its
three-parameter signature, so `orchestrator.ts:490` and its
`enforceEvidenceGate` wiring typecheck unchanged; only the omitted-option
default moves from `false` to `true`. `planAllAuditsForTest(config)` returns the
same `AuditPlan` shape and stays under `packages/core/src/tests/`.

**Known gap, stated rather than solved.** Task 6 Step 3 allows a single audit to
keep its guard if its own unit test depends on it. That is an escape hatch in the
_cleanup_, not in the gate — the gate in Task 3 has none — and any audit that
uses it must be named in the changeset.
