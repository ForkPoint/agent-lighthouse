# Live Corpus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1913-domain blind site list with a curated, categorised corpus of about 365 domains, a learned per-domain status file, and a smoke tier, so one full live pass takes about an hour and dead domains stop costing time.

**Architecture:** Pure logic lives in `packages/core/src/tests/` where vitest can reach it (`site-list.ts` grows, `corpus-status.ts` is new). Scripts under `scripts/` are flags and file I/O only. `seeds.json` is the hand-curated source of truth; `sites.json` and `status.json` are generated and committed.

**Tech Stack:** TypeScript, vitest (run from the repo root only), `node --import tsx` for scripts, undici via `packages/core/src/fetcher.ts` for probes.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-02-live-corpus-design.md`. Where this plan and the spec disagree, the spec governs.
- `pnpm test` from the repo root only. Never run vitest inside a package. Set `AL_SKIP_NETWORK=1` for local runs.
- No test performs a real fetch. Scripts fetch; modules under `packages/core/src/tests/` do not.
- Comments in English. oxlint only. Prettier via `pnpm format`.
- `packages/core`'s `rootDir` is `src`: a test cannot import from `scripts/`. Anything a test needs goes in `packages/core/src/tests/`.
- Every domain in `seeds.json` is a bare lowercase hostname. The generator refuses anything else.
- States: `ok`, `unscored`, `blocked`, `dead`. `dead` needs two imports dated on different days.
- Before the final commit: `pnpm build && pnpm test && pnpm typecheck && pnpm lint && pnpm check:dossiers && pnpm check:requires && pnpm check:audit-map`.
- Commit messages end with `Claude-Session: https://claude.ai/code/session_01RT21vyEPL6uSMWwUTytw6p`.

---

## File map

| Path | Change | Responsibility |
| :-- | :-- | :-- |
| `packages/core/src/tests/corpus-status.ts` | create | Status types, outcome→state mapping, merge, report text. Pure. |
| `packages/core/src/tests/corpus-status.test.ts` | create | Tests for the above. |
| `packages/core/src/tests/site-list.ts` | modify | `SiteEntry.tier`, `readSeeds`, `TENANT_SUFFIXES`, `buildSiteList` with seeds, exclusions and tenant classification. |
| `packages/core/src/tests/site-list.test.ts` | modify | New committed-file checks and generator tests. |
| `packages/core/test-data/sites/seeds.json` | create | Curated seeds. Replaces `categories.json`. |
| `packages/core/test-data/sites/categories.json` | delete | Superseded. |
| `packages/core/test-data/sites/status.json` | create (generated) | Last observation per domain. |
| `packages/core/test-data/sites/sites.json` | regenerate | About 365 entries. |
| `packages/core/test-data/sites/candidates.json` | create | Draft domains per category for the probe. Kept so the next curation starts from it. |
| `scripts/corpus-status.ts` | create | `import <summary.json>` and `report`. |
| `scripts/probe-corpus.ts` | create | Fetch each candidate once; write a summary the status importer reads. |
| `scripts/build-site-list.ts` | modify | Read `seeds.json` and `status.json`; ranked slice is 50 by default. |
| `scripts/test-live-sites.ts` | modify | `--tier`, `--include-dead`, `--include-blocked`, status exclusion, help. |
| `scripts/scan-site-list.ts` | modify | `--include-dead=1`, `--include-blocked=1`, status exclusion, `limit` default 400. |
| `.github/workflows/corpus-nightly.yml` | modify | `--limit=400`. |
| `docs/evidence/corpus.md` | modify | Nightly section. |
| `package.json` | modify | `corpus:status`, `corpus:probe`, `build:sites` scripts. |
| `.changeset/live-corpus-curated.md` | create | `patch` for `@forkpoint/agent-lighthouse-core`. |

---

### Task 1: Status module (pure)

**Files:**
- Create: `packages/core/src/tests/corpus-status.ts`
- Test: `packages/core/src/tests/corpus-status.test.ts`

**Interfaces:**
- Produces:
  - `type CorpusState = "ok" | "unscored" | "blocked" | "dead"`
  - `interface CorpusObservation { state: CorpusState; reason?: string; seenAt: string; runs: number }`
  - `interface CorpusStatus { updatedAt: string; domains: Record<string, CorpusObservation> }`
  - `interface RunnerOutcome { domain: string; skipped?: string; score?: number | null; evidence?: Partial<Record<string, boolean>>; unscoredReason?: string; violations?: string[] }`
  - `function stateOf(outcome: RunnerOutcome): { state: CorpusState; reason?: string }`
  - `function mergeStatus(previous: CorpusStatus | undefined, outcomes: readonly RunnerOutcome[], date: string): CorpusStatus` — `date` is `YYYY-MM-DD`.
  - `function formatReport(status: CorpusStatus): string`
  - `function excludedDomains(status: CorpusStatus | undefined, include: { dead?: boolean; blocked?: boolean }): Set<string>`
  - `const EMPTY_STATUS: CorpusStatus`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/tests/corpus-status.test.ts
import { describe, it, expect } from "vitest";
import {
  EMPTY_STATUS,
  excludedDomains,
  formatReport,
  mergeStatus,
  stateOf,
  type CorpusStatus,
  type RunnerOutcome,
} from "./corpus-status";

const scored: RunnerOutcome = {
  domain: "ok.test",
  score: 61,
  evidence: {
    "origin-reachable": true,
    "unblocked-fetches": true,
    "rendered-body": true,
    "sample-adequate": true,
  },
};

const noHomepage: RunnerOutcome = {
  domain: "dead.test",
  score: null,
  evidence: {
    "origin-reachable": false,
    "unblocked-fetches": true,
    "rendered-body": false,
    "sample-adequate": false,
  },
  unscoredReason: "The homepage could not be fetched: getaddrinfo ENOTFOUND dead.test.",
};

const walled: RunnerOutcome = {
  domain: "wall.test",
  score: null,
  evidence: {
    "origin-reachable": false,
    "unblocked-fetches": false,
    "rendered-body": false,
    "sample-adequate": false,
  },
  unscoredReason: "Cloudflare Turnstile refused the scan: challenge page.",
};

const robots: RunnerOutcome = { domain: "robots.test", skipped: "robots-disallow" };

describe("stateOf", () => {
  it("maps a score to ok", () => {
    expect(stateOf(scored)).toEqual({ state: "ok" });
  });

  it("maps an unreachable origin that was not walled to dead, keeping the reason", () => {
    expect(stateOf(noHomepage)).toEqual({
      state: "dead",
      reason: noHomepage.unscoredReason,
    });
  });

  it("maps a walled or throttled origin to unscored, not dead", () => {
    expect(stateOf(walled)).toEqual({ state: "unscored", reason: walled.unscoredReason });
  });

  it("maps a robots skip to blocked with the skip reason", () => {
    expect(stateOf(robots)).toEqual({ state: "blocked", reason: "robots-disallow" });
  });

  it("maps a null score with a reachable origin to unscored", () => {
    const gated: RunnerOutcome = {
      ...scored,
      domain: "gated.test",
      score: null,
      unscoredReason: "The scan could not feed 57% of the registry's evidence mass.",
    };
    expect(stateOf(gated)).toEqual({ state: "unscored", reason: gated.unscoredReason });
  });
});

describe("mergeStatus", () => {
  it("records a first observation and stamps the date", () => {
    const status = mergeStatus(undefined, [scored], "2026-09-02");
    expect(status.domains["ok.test"]).toEqual({ state: "ok", seenAt: "2026-09-02", runs: 1 });
    expect(status.updatedAt.startsWith("2026-09-02")).toBe(true);
  });

  it("holds a dead verdict at unscored until a second import on another day", () => {
    const first = mergeStatus(undefined, [noHomepage], "2026-09-02");
    expect(first.domains["dead.test"]?.state).toBe("unscored");
    const sameDay = mergeStatus(first, [noHomepage], "2026-09-02");
    expect(sameDay.domains["dead.test"]?.state).toBe("unscored");
    const nextDay = mergeStatus(sameDay, [noHomepage], "2026-09-03");
    expect(nextDay.domains["dead.test"]?.state).toBe("dead");
    expect(nextDay.domains["dead.test"]?.runs).toBe(3);
  });

  it("returns a dead domain to ok when it scores again", () => {
    const dead: CorpusStatus = {
      updatedAt: "2026-09-01T00:00:00.000Z",
      domains: { "dead.test": { state: "dead", seenAt: "2026-09-01", runs: 2 } },
    };
    const revived = mergeStatus(dead, [{ ...scored, domain: "dead.test" }], "2026-09-05");
    expect(revived.domains["dead.test"]).toEqual({ state: "ok", seenAt: "2026-09-05", runs: 3 });
  });

  it("keeps domains the import did not mention", () => {
    const first = mergeStatus(undefined, [scored], "2026-09-02");
    const second = mergeStatus(first, [robots], "2026-09-03");
    expect(Object.keys(second.domains).sort()).toEqual(["ok.test", "robots.test"]);
  });

  it("sorts domains so the committed file diffs cleanly", () => {
    const status = mergeStatus(undefined, [robots, scored], "2026-09-02");
    expect(Object.keys(status.domains)).toEqual(["ok.test", "robots.test"]);
  });
});

describe("excludedDomains", () => {
  const status = mergeStatus(
    undefined,
    [scored, robots, { ...noHomepage }],
    "2026-09-02",
  );
  const withDead: CorpusStatus = {
    ...status,
    domains: { ...status.domains, "dead.test": { state: "dead", seenAt: "2026-09-03", runs: 2 } },
  };

  it("excludes dead and blocked by default", () => {
    expect([...excludedDomains(withDead, {})].sort()).toEqual(["dead.test", "robots.test"]);
  });

  it("lets each class back in on request", () => {
    expect([...excludedDomains(withDead, { dead: true })]).toEqual(["robots.test"]);
    expect([...excludedDomains(withDead, { blocked: true })]).toEqual(["dead.test"]);
    expect(excludedDomains(withDead, { dead: true, blocked: true }).size).toBe(0);
  });

  it("excludes nothing without a status file", () => {
    expect(excludedDomains(undefined, {}).size).toBe(0);
    expect(excludedDomains(EMPTY_STATUS, {}).size).toBe(0);
  });
});

describe("formatReport", () => {
  it("groups by state, then by reason, and shows date and run count", () => {
    const status: CorpusStatus = {
      updatedAt: "2026-09-03T00:00:00.000Z",
      domains: {
        "a.test": { state: "dead", reason: "The homepage could not be fetched: ENOTFOUND.", seenAt: "2026-09-03", runs: 2 },
        "b.test": { state: "dead", reason: "The homepage could not be fetched: ENOTFOUND.", seenAt: "2026-09-03", runs: 2 },
        "c.test": { state: "blocked", reason: "robots-disallow", seenAt: "2026-09-02", runs: 1 },
        "d.test": { state: "ok", seenAt: "2026-09-03", runs: 3 },
      },
    };
    const text = formatReport(status);
    expect(text).toContain("dead (2)");
    expect(text).toContain("The homepage could not be fetched: ENOTFOUND. (2)");
    expect(text).toContain("a.test  2026-09-03  runs 2");
    expect(text).toContain("blocked (1)");
    expect(text).toContain("ok (1)");
    expect(text.indexOf("dead (2)")).toBeLessThan(text.indexOf("ok (1)"));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `AL_SKIP_NETWORK=1 pnpm exec vitest run packages/core/src/tests/corpus-status.test.ts`
Expected: FAIL, cannot resolve `./corpus-status`.

- [ ] **Step 3: Write the module**

```ts
// packages/core/src/tests/corpus-status.ts
/**
 * What each corpus domain did the last time a runner saw it.
 *
 * Pure: the runners and `scripts/corpus-status.ts` read and write the file;
 * this module only maps outcomes to states and merges observations, so a
 * test can exercise every rule without a fetch or a file.
 */

export type CorpusState = "ok" | "unscored" | "blocked" | "dead";

export interface CorpusObservation {
  state: CorpusState;
  /** The scan's own `unscoredReason`, or the robots skip reason. */
  reason?: string;
  /** `YYYY-MM-DD` of the latest import that mentioned the domain. */
  seenAt: string;
  /** How many imports have mentioned the domain. */
  runs: number;
}

export interface CorpusStatus {
  updatedAt: string;
  domains: Record<string, CorpusObservation>;
}

/** The fields both runner summaries share in `outcomes[]`. */
export interface RunnerOutcome {
  domain: string;
  skipped?: string;
  score?: number | null;
  evidence?: Partial<Record<string, boolean>>;
  unscoredReason?: string;
  violations?: string[];
}

export const EMPTY_STATUS: CorpusStatus = { updatedAt: "", domains: {} };

/**
 * The state one outcome argues for.
 *
 * `dead` is an origin the scan could not reach while nothing was refusing
 * it: no DNS, no connection, no homepage. A wall or a throttle also leaves
 * the origin unreachable, but that origin exists and is saying no, so it
 * stays `unscored`.
 */
export function stateOf(outcome: RunnerOutcome): {
  state: CorpusState;
  reason?: string;
} {
  if (outcome.skipped) return { state: "blocked", reason: outcome.skipped };
  if (typeof outcome.score === "number") return { state: "ok" };
  const reachable = outcome.evidence?.["origin-reachable"];
  const unblocked = outcome.evidence?.["unblocked-fetches"];
  const reason = outcome.unscoredReason;
  if (reachable === false && unblocked !== false) return { state: "dead", reason };
  return { state: "unscored", reason };
}

/**
 * Merge one import into the status.
 *
 * State is the latest observation, with one exception: `dead` is entered
 * only when the previous observation was already arguing for it on an
 * earlier day. One failed night is not death. Until then the domain reads
 * `unscored` with the reason kept.
 */
export function mergeStatus(
  previous: CorpusStatus | undefined,
  outcomes: readonly RunnerOutcome[],
  date: string,
): CorpusStatus {
  const domains: Record<string, CorpusObservation> = {
    ...(previous?.domains ?? {}),
  };
  for (const outcome of outcomes) {
    const prior = domains[outcome.domain];
    const next = stateOf(outcome);
    let state = next.state;
    if (state === "dead") {
      const priorArguedDead =
        prior !== undefined &&
        (prior.state === "dead" ||
          (prior.state === "unscored" && prior.reason === next.reason));
      const earlierDay = prior !== undefined && prior.seenAt < date;
      if (!(priorArguedDead && earlierDay) && prior?.state !== "dead") {
        state = "unscored";
      }
    }
    const observation: CorpusObservation = {
      state,
      seenAt: date,
      runs: (prior?.runs ?? 0) + 1,
    };
    if (next.reason) observation.reason = next.reason;
    domains[outcome.domain] = observation;
  }
  const sorted = Object.fromEntries(
    Object.entries(domains).sort(([a], [b]) => a.localeCompare(b)),
  );
  return { updatedAt: `${date}T00:00:00.000Z`, domains: sorted };
}

/** The domains a runner leaves out unless asked to include them. */
export function excludedDomains(
  status: CorpusStatus | undefined,
  include: { dead?: boolean; blocked?: boolean },
): Set<string> {
  const out = new Set<string>();
  if (!status) return out;
  for (const [domain, observation] of Object.entries(status.domains)) {
    if (observation.state === "dead" && !include.dead) out.add(domain);
    if (observation.state === "blocked" && !include.blocked) out.add(domain);
  }
  return out;
}

const STATE_ORDER: readonly CorpusState[] = ["dead", "blocked", "unscored", "ok"];

/** The text a person reads before editing `seeds.json`. */
export function formatReport(status: CorpusStatus): string {
  const lines: string[] = [`corpus status as of ${status.updatedAt}`, ""];
  for (const state of STATE_ORDER) {
    const inState = Object.entries(status.domains).filter(
      ([, o]) => o.state === state,
    );
    if (inState.length === 0) continue;
    lines.push(`${state} (${inState.length})`);
    const byReason = new Map<string, Array<[string, CorpusObservation]>>();
    for (const entry of inState) {
      const key = entry[1].reason ?? "";
      const list = byReason.get(key) ?? [];
      list.push(entry);
      byReason.set(key, list);
    }
    for (const [reason, entries] of [...byReason.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    )) {
      if (reason) lines.push(`  ${reason} (${entries.length})`);
      for (const [domain, o] of entries) {
        lines.push(`    ${domain}  ${o.seenAt}  runs ${o.runs}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `AL_SKIP_NETWORK=1 pnpm exec vitest run packages/core/src/tests/corpus-status.test.ts`
Expected: PASS, 14 tests. If "holds a dead verdict" fails on the same-day step, the `earlierDay` guard is wrong; `prior.seenAt < date` must be a strict string comparison of `YYYY-MM-DD`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tests/corpus-status.ts packages/core/src/tests/corpus-status.test.ts
git commit -m "feat(corpus): status module — outcome to state, merge, report"
```

---

### Task 2: Status script and the first import

**Files:**
- Create: `scripts/corpus-status.ts`
- Modify: `package.json` (scripts block)
- Create (generated): `packages/core/test-data/sites/status.json`

**Interfaces:**
- Consumes: `mergeStatus`, `formatReport`, `RunnerOutcome`, `CorpusStatus` from Task 1.
- Produces: the committed `status.json`, and the `pnpm corpus:status` command.

- [ ] **Step 1: Write the script**

```ts
// scripts/corpus-status.ts
import * as fs from "node:fs";
import * as path from "node:path";
import {
  formatReport,
  mergeStatus,
  type CorpusStatus,
  type RunnerOutcome,
} from "../packages/core/src/tests/corpus-status";

/**
 * Read and write `status.json`.
 *
 *   pnpm corpus:status import <summary.json> [--date=YYYY-MM-DD]
 *   pnpm corpus:status report
 *
 * `import` accepts either runner's summary: both carry `outcomes[]` with a
 * `domain`, an optional `skipped`, the report's evidence map and its
 * `unscoredReason`. The date defaults to today, UTC; pass one to import an
 * older artifact under the day it ran.
 *
 * This file is flags and file I/O. The rules live in
 * `packages/core/src/tests/corpus-status.ts`, where they are tested.
 */

const STATUS_PATH = path.resolve(
  process.cwd(),
  "packages/core/test-data/sites/status.json",
);

function readStatus(): CorpusStatus | undefined {
  if (!fs.existsSync(STATUS_PATH)) return undefined;
  return JSON.parse(fs.readFileSync(STATUS_PATH, "utf8")) as CorpusStatus;
}

function flag(args: string[], name: string): string | undefined {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === "report") {
    const status = readStatus();
    if (!status) {
      console.log(`no status file at ${STATUS_PATH}`);
      return 0;
    }
    process.stdout.write(formatReport(status));
    return 0;
  }
  if (command === "import") {
    const file = rest.find((a) => !a.startsWith("--"));
    if (!file) {
      console.error("usage: corpus-status import <summary.json> [--date=YYYY-MM-DD]");
      return 2;
    }
    const date = flag(rest, "date") ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error(`--date must be YYYY-MM-DD, got "${date}"`);
      return 2;
    }
    const summary = JSON.parse(fs.readFileSync(path.resolve(file), "utf8")) as {
      outcomes?: RunnerOutcome[];
    };
    if (!Array.isArray(summary.outcomes)) {
      console.error(`${file} has no outcomes[]; is it a runner summary?`);
      return 2;
    }
    const next = mergeStatus(readStatus(), summary.outcomes, date);
    fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
    fs.writeFileSync(STATUS_PATH, `${JSON.stringify(next, null, 2)}\n`);
    const counts: Record<string, number> = {};
    for (const o of Object.values(next.domains)) {
      counts[o.state] = (counts[o.state] ?? 0) + 1;
    }
    console.log(
      `${summary.outcomes.length} outcome(s) imported for ${date} -> ${STATUS_PATH} ` +
        `(${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")})`,
    );
    return 0;
  }
  console.error("usage: corpus-status <import <summary.json> | report>");
  return 2;
}

process.exit(main(process.argv.slice(2)));
```

- [ ] **Step 2: Add the package scripts**

In `package.json`, next to `"test:live"`, add:

```json
"corpus:status": "node --import tsx scripts/corpus-status.ts",
"corpus:probe": "node --import tsx scripts/probe-corpus.ts",
"build:sites": "node --import tsx scripts/build-site-list.ts"
```

`corpus:probe` points at a script Task 5 creates; it is added here so the scripts block changes once.

- [ ] **Step 3: Import the full corpus run**

The full-corpus run from 2026-09-02 wrote its summary to
`/private/tmp/claude-501/-Users-kirov-dev-forkpoint-agent-lighthouse/045c040b-41c1-48cd-ada6-c57445afdc0b/scratchpad/live-corpus.json`.
If that file is gone, run `pnpm test:live --limit=2000 --concurrency=10 --out=reports/live-corpus.json` (about 2 hours) and use that path.

Run:
```bash
cp /private/tmp/claude-501/-Users-kirov-dev-forkpoint-agent-lighthouse/045c040b-41c1-48cd-ada6-c57445afdc0b/scratchpad/live-corpus.json reports/live-corpus-2026-09-02.json
pnpm corpus:status import reports/live-corpus-2026-09-02.json --date=2026-09-02
pnpm corpus:status report | head -40
```
Expected: one line naming the counts, then a report starting with `blocked (…)` or `unscored (…)`. No `dead` yet: one import cannot produce one. `reports/` is gitignored; check with `git status`.

- [ ] **Step 4: Commit**

```bash
git add scripts/corpus-status.ts package.json packages/core/test-data/sites/status.json
git commit -m "feat(corpus): status import and report script; first observations"
```

---

### Task 3: Seeds, tiers, exclusions and tenants in the list builder

**Files:**
- Modify: `packages/core/src/tests/site-list.ts`
- Test: `packages/core/src/tests/site-list.test.ts` (the `buildSiteList` and `normalize` describes; the committed-file describe is Task 4)

**Interfaces:**
- Produces:
  - `SiteEntry.tier?: "smoke"`
  - `interface SeedFile { smoke: string[]; categories: Record<string, { why: string; domains: string[] }> }`
  - `interface Seeds { categoryOf: Map<string, string>; smoke: Set<string> }`
  - `function readSeeds(file: SeedFile): Seeds` — throws `Error` naming every malformed hostname or smoke domain not under a category.
  - `const TENANT_SUFFIXES: readonly string[]`
  - `function tenantSuffixOf(domain: string): string | undefined`
  - `buildSiteList(ranked, seeds: Seeds, options: { limit: number; exclude?: ReadonlySet<string>; tenantLimit?: number })` — `limit` is the ranked slice size; `tenantLimit` defaults to 30.

- [ ] **Step 1: Write the failing tests**

Replace the `buildSiteList` describe in `site-list.test.ts` with this, and add the `readSeeds` and `tenantSuffixOf` describes:

```ts
describe("readSeeds", () => {
  it("maps every seeded domain to its category and keeps the smoke set", () => {
    const seeds = readSeeds({
      smoke: ["a.com"],
      categories: {
        news: { why: "x", domains: ["a.com", "B.com"] },
        forum: { why: "y", domains: ["offlist.com"] },
      },
    });
    expect(seeds.categoryOf.get("a.com")).toBe("news");
    expect(seeds.categoryOf.get("b.com")).toBe("news");
    expect(seeds.categoryOf.get("offlist.com")).toBe("forum");
    expect([...seeds.smoke]).toEqual(["a.com"]);
  });

  it("refuses a domain that is not a bare hostname, naming it", () => {
    expect(() =>
      readSeeds({
        smoke: [],
        categories: { news: { why: "x", domains: ["https://a.com/path"] } },
      }),
    ).toThrow(/news: "https:\/\/a.com\/path"/);
  });

  it("refuses a smoke domain that no category lists", () => {
    expect(() =>
      readSeeds({
        smoke: ["ghost.com"],
        categories: { news: { why: "x", domains: ["a.com"] } },
      }),
    ).toThrow(/smoke: "ghost.com"/);
  });

  it("refuses a domain seeded under two categories", () => {
    expect(() =>
      readSeeds({
        smoke: [],
        categories: {
          news: { why: "x", domains: ["a.com"] },
          docs: { why: "y", domains: ["a.com"] },
        },
      }),
    ).toThrow(/a.com.*news.*docs/);
  });
});

describe("tenantSuffixOf", () => {
  it("names the platform a tenant hostname sits on", () => {
    expect(tenantSuffixOf("foo.github.io")).toBe("github.io");
    expect(tenantSuffixOf("shop.myshopify.com")).toBe("myshopify.com");
    expect(tenantSuffixOf("docs.example.pages.dev")).toBe("pages.dev");
  });

  it("does not match the platform apex itself or an unrelated host", () => {
    expect(tenantSuffixOf("github.io")).toBeUndefined();
    expect(tenantSuffixOf("github.com")).toBeUndefined();
    expect(tenantSuffixOf("example.com")).toBeUndefined();
  });
});

describe("buildSiteList", () => {
  const seeds = readSeeds({
    smoke: ["a.com"],
    categories: {
      news: { why: "x", domains: ["a.com"] },
      forum: { why: "y", domains: ["offlist.com"] },
    },
  });

  it("prefers the better-ranked source when a domain appears in both", () => {
    const built = buildSiteList(
      [
        { domains: ["a.com", "b.com"], source: "tranco" },
        { domains: ["b.com", "c.com"], source: "crux" },
      ],
      seeds,
      { limit: 10 },
    );
    expect(built.find((s) => s.domain === "b.com")?.source).toBe("tranco");
    expect(built.find((s) => s.domain === "c.com")?.source).toBe("crux");
  });

  it("marks a seed carry-over 'seed' and ranks it past the cut", () => {
    const built = buildSiteList(
      [{ domains: ["a.com"], source: "tranco" }],
      seeds,
      { limit: 10 },
    );
    const carried = built.find((s) => s.domain === "offlist.com");
    expect(carried?.source).toBe("seed");
    expect(built.find((s) => s.domain === "a.com")?.source).toBe("tranco");
  });

  it("stamps the smoke tier on a seeded domain, ranked or not", () => {
    const built = buildSiteList(
      [{ domains: ["a.com"], source: "tranco" }],
      seeds,
      { limit: 10 },
    );
    expect(built.find((s) => s.domain === "a.com")?.tier).toBe("smoke");
    expect(built.find((s) => s.domain === "offlist.com")?.tier).toBeUndefined();
  });

  it("never emits an excluded ranked domain, and does not let it eat a slot", () => {
    const built = buildSiteList(
      [{ domains: ["dead.com", "b.com", "c.com"], source: "tranco" }],
      seeds,
      { limit: 2, exclude: new Set(["dead.com"]) },
    );
    const ranked = built.filter((s) => s.source !== "seed").map((s) => s.domain);
    expect(ranked).toEqual(["b.com", "c.com"]);
  });

  it("still emits an excluded domain when it is seeded", () => {
    const built = buildSiteList([], seeds, {
      limit: 0,
      exclude: new Set(["offlist.com"]),
    });
    expect(built.find((s) => s.domain === "offlist.com")?.source).toBe("seed");
  });

  it("files a ranked tenant hostname under tenant, up to tenantLimit, outside the slice", () => {
    const built = buildSiteList(
      [
        {
          domains: ["one.github.io", "b.com", "two.pages.dev", "three.vercel.app", "c.com"],
          source: "crux",
        },
      ],
      seeds,
      { limit: 2, tenantLimit: 2 },
    );
    const tenants = built.filter((s) => s.category === "tenant").map((s) => s.domain);
    expect(tenants).toEqual(["one.github.io", "two.pages.dev"]);
    const unknown = built.filter((s) => s.category === "unknown").map((s) => s.domain);
    expect(unknown).toEqual(["b.com", "c.com"]);
  });

  it.each([10, 99, 100, 150, 1000])(
    "keeps the seed bucket clear of every ranked bucket at limit %i",
    (limit) => {
      const ranked = Array.from(
        { length: limit },
        (_, i) => `r${String(i).padStart(5, "0")}.com`,
      );
      const built = buildSiteList(
        [{ domains: ranked, source: "tranco" }],
        seeds,
        { limit },
      );
      const seeded = built.filter((s) => s.source === "seed");
      const worstRanked = Math.max(
        ...built.filter((s) => s.source !== "seed").map((s) => s.rankBucket),
      );
      expect(seeded.length).toBeGreaterThan(0);
      for (const site of seeded) {
        expect(site.rankBucket, `limit ${limit}, ${site.domain}`).toBeGreaterThan(worstRanked);
      }
    },
  );

  it("spreads ranked entries across more than one bucket", () => {
    const ranked = Array.from(
      { length: 250 },
      (_, i) => `r${String(i).padStart(5, "0")}.com`,
    );
    const built = buildSiteList(
      [{ domains: ranked, source: "tranco" }],
      readSeeds({ smoke: [], categories: {} }),
      { limit: 250 },
    );
    const buckets = [...new Set(built.map((s) => s.rankBucket))].sort((a, b) => a - b);
    expect(buckets).toEqual([0, 100, 200]);
  });

  it("returns entries ordered by domain, whatever order the sources arrive in", () => {
    const built = buildSiteList(
      [{ domains: ["z.com", "m.com", "a.com"], source: "tranco" }],
      readSeeds({ smoke: [], categories: {} }),
      { limit: 10 },
    );
    expect(built.map((s) => s.domain)).toEqual(["a.com", "m.com", "z.com"]);
  });
});
```

Update the import line at the top of the test file to:

```ts
import {
  BUCKET_WIDTH,
  HOSTNAME,
  bucketOf,
  buildSiteList,
  normalize,
  readSeeds,
  tenantSuffixOf,
  type SiteEntry,
} from "./site-list";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `AL_SKIP_NETWORK=1 pnpm exec vitest run packages/core/src/tests/site-list.test.ts`
Expected: FAIL on `readSeeds` and `tenantSuffixOf` not exported, and on the `buildSiteList` signature.

- [ ] **Step 3: Extend `site-list.ts`**

Change `SiteEntry` to add the tier:

```ts
export interface SiteEntry {
  domain: string;
  source: "tranco" | "crux" | "seed";
  category: string;
  rankBucket: number;
  /** Present on the two domains per category the smoke run scans. */
  tier?: "smoke";
}
```

Add, after `bucketOf`:

```ts
/** The shape of `packages/core/test-data/sites/seeds.json`. */
export interface SeedFile {
  smoke: string[];
  categories: Record<string, { why: string; domains: string[] }>;
}

/** The seed file, parsed and checked. */
export interface Seeds {
  categoryOf: Map<string, string>;
  smoke: Set<string>;
}

/**
 * Parse the seed file, refusing what the generator must not carry forward.
 *
 * A malformed hostname would be scanned as `https:///robots.txt`; a smoke
 * domain no category lists would be a tier with no category; one domain under
 * two categories would be counted twice by a stratified sample. Each is a
 * typo in a hand-maintained file, so all of them are named in one error.
 */
export function readSeeds(file: SeedFile): Seeds {
  const categoryOf = new Map<string, string>();
  const problems: string[] = [];
  for (const [category, { domains }] of Object.entries(file.categories)) {
    for (const raw of domains) {
      const host = normalize(raw);
      if (host === "") {
        problems.push(`${category}: ${JSON.stringify(raw)} is not a bare hostname`);
        continue;
      }
      const seen = categoryOf.get(host);
      if (seen && seen !== category) {
        problems.push(`${host} is seeded under both ${seen} and ${category}`);
        continue;
      }
      categoryOf.set(host, category);
    }
  }
  const smoke = new Set<string>();
  for (const raw of file.smoke) {
    const host = normalize(raw);
    if (!categoryOf.has(host)) {
      problems.push(`smoke: ${JSON.stringify(raw)} is not seeded under any category`);
      continue;
    }
    smoke.add(host);
  }
  if (problems.length > 0) {
    throw new Error(`seeds.json:\n  ${problems.join("\n  ")}`);
  }
  return { categoryOf, smoke };
}

/**
 * Platforms whose tenants share a public suffix.
 *
 * A hostname under one of these is a `tenant` by definition, not by guess:
 * the suffix is what the category means. The apex itself is the platform,
 * not a tenant.
 */
export const TENANT_SUFFIXES: readonly string[] = [
  "github.io",
  "pages.dev",
  "vercel.app",
  "netlify.app",
  "myshopify.com",
  "wixsite.com",
  "squarespace.com",
  "webflow.io",
  "notion.site",
  "gitbook.io",
  "readthedocs.io",
  "substack.com",
  "blogspot.com",
  "wordpress.com",
];

/** The platform suffix a tenant hostname sits on, if any. */
export function tenantSuffixOf(domain: string): string | undefined {
  return TENANT_SUFFIXES.find((suffix) => domain.endsWith(`.${suffix}`));
}
```

Replace `buildSiteList` with:

```ts
/**
 * Merge the ranked sources and the seeds into the committed list.
 *
 * `limit` is the size of the ranked `unknown` slice, not the total: seeds
 * are always carried, and ranked tenant hostnames are filed under `tenant`
 * outside the slice, up to `tenantLimit`. `exclude` names ranked domains a
 * previous run found dead or blocked; they neither appear nor consume a slot.
 * A seeded domain is emitted even when excluded — removing it is a decision
 * made in `seeds.json`, and the generator reports it.
 *
 * Pure: callers pass the parsed rows, so a test can exercise the merge without
 * touching the filesystem.
 */
export function buildSiteList(
  ranked: ReadonlyArray<{
    domains: readonly string[];
    source: "tranco" | "crux";
  }>,
  seeds: Seeds,
  options: { limit: number; exclude?: ReadonlySet<string>; tenantLimit?: number },
): SiteEntry[] {
  const { limit } = options;
  const exclude = options.exclude ?? new Set<string>();
  const tenantLimit = options.tenantLimit ?? 30;
  const byDomain = new Map<string, SiteEntry>();
  let tenants = 0;

  for (const { domains, source } of ranked) {
    let taken = 0;
    for (const domain of domains) {
      if (taken >= limit && tenants >= tenantLimit) break;
      // First writer wins: the sources are added best-ranked first, so a domain
      // already present is already recorded at its better rank.
      if (byDomain.has(domain) || exclude.has(domain)) continue;
      const seeded = seeds.categoryOf.get(domain);
      const tenant = seeded === undefined && tenantSuffixOf(domain) !== undefined;
      if (tenant) {
        if (tenants >= tenantLimit) continue;
        tenants += 1;
      } else if (seeded === undefined) {
        if (taken >= limit) continue;
      }
      const entry: SiteEntry = {
        domain,
        source,
        category: seeded ?? (tenant ? "tenant" : "unknown"),
        rankBucket: bucketOf(seeded === undefined && !tenant ? taken : 0),
      };
      if (seeds.smoke.has(domain)) entry.tier = "smoke";
      byDomain.set(domain, entry);
      if (seeded === undefined && !tenant) taken += 1;
    }
  }

  // Seeded domains are the reason the list reaches past storefronts, so they
  // are kept even when they fall outside the rank cut. They are marked
  // `'seed'`, not `'tranco'`: claiming a source that never listed them would
  // let a consumer scan a hand-picked storefront believing it is top-ranked.
  for (const [domain, category] of seeds.categoryOf) {
    if (byDomain.has(domain)) continue;
    const entry: SiteEntry = {
      domain,
      source: "seed",
      category,
      // One bucket past the worst RANKED index, which is `limit - 1` — not
      // `bucketOf(limit)`, which collides with the last ranked bucket at any
      // limit that is not a multiple of the width.
      rankBucket: bucketOf(Math.max(limit, 1) - 1) + BUCKET_WIDTH,
    };
    if (seeds.smoke.has(domain)) entry.tier = "smoke";
    byDomain.set(domain, entry);
  }

  // Sorted by domain, not by rank: Tranco reorders daily, so a rank-ordered
  // file reshuffles unchanged lines on every regeneration and the diff stops
  // showing which sites actually joined or left.
  return [...byDomain.values()].sort((a, b) =>
    a.domain.localeCompare(b.domain),
  );
}
```

Note the rank bucket of a ranked seeded domain and of a tenant is `bucketOf(0)`: the slice index no longer tracks their rank. That is acceptable; the bucket exists so a `--rankBucket` filter can pick the top slice of `unknown`, and neither seeds nor tenants are selected that way.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `AL_SKIP_NETWORK=1 pnpm exec vitest run packages/core/src/tests/site-list.test.ts`
Expected: the `readSeeds`, `tenantSuffixOf` and `buildSiteList` describes PASS. The "the site list" describe may still fail on the committed file; Task 4 fixes it. If "keeps the seed bucket clear" fails at limit 10 with a tenant-free ranked set, check that `taken` and not the loop index feeds `bucketOf`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tests/site-list.ts packages/core/src/tests/site-list.test.ts
git commit -m "feat(corpus): seeds with smoke tier, exclusions and tenant classification in the list builder"
```

---

### Task 4: `seeds.json` from `categories.json`, generator rewrite, regenerate

**Files:**
- Create: `packages/core/test-data/sites/seeds.json`
- Delete: `packages/core/test-data/sites/categories.json`
- Modify: `scripts/build-site-list.ts`
- Modify: `packages/core/src/tests/site-list.test.ts` (the "the site list" describe)
- Regenerate: `packages/core/test-data/sites/sites.json`

**Interfaces:**
- Consumes: `readSeeds`, `buildSiteList`, `SeedFile` (Task 3); `excludedDomains`, `CorpusStatus` (Task 1).

- [ ] **Step 1: Write `seeds.json` from the existing categories**

Run this once; it carries the 132 seeded domains over and picks the first two of each category as smoke:

```bash
node -e '
const fs=require("fs");
const cats=require("./packages/core/test-data/sites/categories.json");
const why={
  news:"Large newsrooms: paywalls, AMP leftovers, NewsArticle schema, huge sitemaps.",
  docs:"Deep static sites, code blocks, llms.txt adopters.",
  saas:"Marketing shells over apps, pricing pages, OpenAPI.",
  government:"Old CMSes, PDFs, accessibility law, no commerce.",
  marketplace:"Heaviest WAFs, product schema at scale.",
  forum:"User content, robots policies, Discourse and Stack shapes.",
  bank:"Walled, no crawl consent, security headers.",
  storefront:"Shopify and Woo stores, product and offer schema."
};
const categories={};
const smoke=[];
for (const [name,domains] of Object.entries(cats)) {
  categories[name]={why:why[name],domains:[...domains].sort()};
  smoke.push(...categories[name].domains.slice(0,2));
}
fs.writeFileSync("packages/core/test-data/sites/seeds.json", JSON.stringify({smoke:smoke.sort(),categories},null,2)+"\n");
'
git rm -q packages/core/test-data/sites/categories.json
node -e 'const s=require("./packages/core/test-data/sites/seeds.json");console.log(Object.keys(s.categories).length,"categories",s.smoke.length,"smoke")'
```
Expected: `8 categories 16 smoke`.

- [ ] **Step 2: Rewrite the generator's seed and status handling**

In `scripts/build-site-list.ts`, replace everything from `const rawLimit = flag("limit", "1000");` to the end with:

```ts
const rawLimit = flag("limit", "50");
const limit = Number(rawLimit);
// Without this, `--limit=abc` yields NaN and the ranked slice is empty.
if (!Number.isInteger(limit) || limit < 0) {
  console.error(`--limit must be a non-negative integer, got: ${rawLimit}`);
  process.exit(1);
}

const TRANCO = flag("tranco", "/tmp/site-lists/tranco.csv");
const CRUX = flag("crux", "/tmp/site-lists/crux.csv");
const OUT = flag("out", "packages/core/test-data/sites/sites.json");
const SEEDS = flag("seeds", "packages/core/test-data/sites/seeds.json");
const STATUS = flag("status", "packages/core/test-data/sites/status.json");

let seeds: Seeds;
try {
  seeds = readSeeds(JSON.parse(fs.readFileSync(SEEDS, "utf8")) as SeedFile);
} catch (err) {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
}

const status: CorpusStatus | undefined = fs.existsSync(STATUS)
  ? (JSON.parse(fs.readFileSync(STATUS, "utf8")) as CorpusStatus)
  : undefined;
const exclude = excludedDomains(status, {});

const sites = buildSiteList(
  [
    { domains: readRanked(TRANCO, 1), source: "tranco" },
    { domains: readRanked(CRUX, 0), source: "crux" },
  ],
  seeds,
  { limit, exclude },
);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(sites, null, 2)}\n`);

// A seed the status file calls dead or blocked is still emitted. It is a
// person's decision to drop it, and the file that records that decision is
// seeds.json — so it is said out loud here rather than silently dropped.
const seededButExcluded = sites.filter(
  (s) => seeds.categoryOf.has(s.domain) && exclude.has(s.domain),
);
for (const s of seededButExcluded) {
  console.warn(
    `warning: ${s.domain} (${s.category}) is ${status?.domains[s.domain]?.state} in status.json but stays seeded`,
  );
}

const count = (source: SiteEntry["source"]) =>
  sites.filter((s) => s.source === source).length;
const byCategory = new Map<string, number>();
for (const s of sites) byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + 1);
console.log(
  `${sites.length} sites -> ${OUT} (tranco ${count("tranco")}, crux ${count("crux")}, ` +
    `seed ${count("seed")}; excluded ${exclude.size} by status)`,
);
for (const [category, n] of [...byCategory.entries()].sort()) {
  console.log(`  ${category.padEnd(12)} ${n}`);
}
```

Update the import at the top to:

```ts
import {
  buildSiteList,
  normalize,
  readSeeds,
  type SeedFile,
  type Seeds,
  type SiteEntry,
} from "../packages/core/src/tests/site-list";
import {
  excludedDomains,
  type CorpusStatus,
} from "../packages/core/src/tests/corpus-status";
```

Update the doc comment at the top: replace the sentence about `categories.json` with "`seeds.json` is the hand-maintained source of truth: every seeded domain carries its category, and everything unmatched in the ranked slice stays `'unknown'`. `status.json`, when present, keeps dead and blocked domains out of the ranked slice." Change the `--limit` line in the download comment to say the flag is the ranked slice size, default 50.

- [ ] **Step 3: Update the committed-file tests**

In `site-list.test.ts`, inside `describe("the site list", …)`, change and add:

```ts
  it("holds enough sites to be worth scanning, and few enough to finish in an hour", () => {
    expect(sites.length).toBeGreaterThanOrEqual(250);
    expect(sites.length).toBeLessThanOrEqual(500);
  });

  it("gives every category at least 10 domains", () => {
    const counts = new Map<string, number>();
    for (const s of sites) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
    for (const [category, n] of counts) {
      if (category === "unknown") continue;
      expect(n, category).toBeGreaterThanOrEqual(10);
    }
  });

  it("marks exactly two smoke domains per seeded category, all of them seeds", () => {
    const smoke = sites.filter((s) => s.tier === "smoke");
    const perCategory = new Map<string, number>();
    for (const s of smoke) {
      perCategory.set(s.category, (perCategory.get(s.category) ?? 0) + 1);
    }
    const seededCategories = new Set(
      sites.filter((s) => s.source === "seed" || s.category !== "unknown").map((s) => s.category),
    );
    seededCategories.delete("tenant");
    seededCategories.delete("unknown");
    for (const category of seededCategories) {
      expect(perCategory.get(category), category).toBe(2);
    }
  });

  it("carries no ranked domain the status file calls dead or blocked", () => {
    const statusPath = resolve(__dirname, "../../test-data/sites/status.json");
    const status: CorpusStatus = JSON.parse(readFileSync(statusPath, "utf8"));
    const excluded = excludedDomains(status, {});
    for (const s of sites) {
      if (s.source === "seed") continue;
      expect(excluded.has(s.domain), s.domain).toBe(false);
    }
  });
```

Replace the old size test (`toBeGreaterThan(500)`) with the first block above. Add to the imports:

```ts
import { excludedDomains, type CorpusStatus } from "./corpus-status";
```

The `tenant` category is exempt from the smoke rule because its members come from the ranked sources, not from seeds. Task 5 adds a seeded pair for it anyway; the exemption is for a regeneration where none survived.

- [ ] **Step 4: Regenerate the list**

The ranked inputs are hand-downloaded, as the generator's header says:

```bash
mkdir -p /tmp/site-lists
curl -sL https://tranco-list.eu/top-1m.csv.zip -o /tmp/site-lists/tranco.zip
unzip -p /tmp/site-lists/tranco.zip > /tmp/site-lists/tranco.csv
curl -sL https://raw.githubusercontent.com/zakird/crux-top-lists/main/data/global/current.csv.gz | gunzip > /tmp/site-lists/crux.csv
pnpm build:sites
```
Expected: a line like `212 sites -> … (tranco N, crux N, seed 132; excluded N by status)` and a per-category table with `tenant` up to 30 and `unknown` 50. The exact ranked numbers depend on the day's lists.

- [ ] **Step 5: Run the list tests**

Run: `AL_SKIP_NETWORK=1 pnpm exec vitest run packages/core/src/tests/site-list.test.ts`
Expected: "gives every category at least 10 domains" and the size floor of 250 FAIL, because Task 5 has not added the new categories yet. Everything else PASSES. Note the two failures; do not weaken them.

- [ ] **Step 6: Commit**

```bash
git add packages/core/test-data/sites/seeds.json packages/core/test-data/sites/sites.json scripts/build-site-list.ts packages/core/src/tests/site-list.test.ts
git commit -m "feat(corpus): seeds.json replaces categories.json; generator reads status and files tenants"
```

---

### Task 5: Probe script, candidates, curation

**Files:**
- Create: `scripts/probe-corpus.ts`
- Create: `packages/core/test-data/sites/candidates.json`
- Modify: `packages/core/test-data/sites/seeds.json`
- Regenerate: `packages/core/test-data/sites/sites.json`, `packages/core/test-data/sites/status.json`

**Interfaces:**
- Consumes: `createFetcher` from `packages/core/src/fetcher.ts`; `SCANNER_USER_AGENT` from `packages/core/src/constants.ts`; `normalize` from Task 3.
- Produces: a summary at `reports/corpus-probe.json` in the runner format (`outcomes[]` with `domain`, `score`, `evidence`, `unscoredReason`), so `corpus:status import` reads it unchanged.

- [ ] **Step 1: Write the candidates file**

`packages/core/test-data/sites/candidates.json`. Every domain is a draft; the probe decides. Shape: `{ "<category>": ["domain", …] }`. `exemplar` candidates must additionally serve an agent artifact.

```json
{
  "news": [
    "theatlantic.com", "wsj.com", "bloomberg.com", "axios.com", "theverge.com",
    "arstechnica.com", "politico.com", "dw.com", "france24.com", "corriere.it",
    "nzherald.co.nz", "thehindu.com", "abc.net.au", "cbc.ca", "rte.ie"
  ],
  "docs": [
    "docs.stripe.com", "tailwindcss.com", "vite.dev", "docs.astro.build", "svelte.dev",
    "vuejs.org", "angular.dev", "docs.rs", "pytorch.org", "redis.io",
    "docs.oracle.com", "laravel.com", "docs.npmjs.com", "developer.android.com", "docs.flutter.dev"
  ],
  "saas": [
    "intercom.com", "monday.com", "clickup.com", "calendly.com", "docusign.com",
    "okta.com", "datadoghq.com", "snowflake.com", "gitlab.com", "github.com",
    "canva.com", "loom.com", "miro.com", "typeform.com", "webflow.com"
  ],
  "government": [
    "nhs.uk", "gov.pl", "belgium.be", "gov.ie", "government.nl",
    "admin.ch", "govt.nz", "canada.ca", "ssa.gov", "sec.gov",
    "fda.gov", "epa.gov", "gov.scot", "gov.wales", "digital.gov"
  ],
  "marketplace": [
    "zalando.com", "shein.com", "temu.com", "bestbuy.com", "homedepot.com",
    "newegg.com", "reverb.com", "vinted.com", "cdiscount.com", "jd.com",
    "coupang.com", "lowes.com", "costco.com", "kroger.com", "ikea.com"
  ],
  "forum": [
    "forum.xda-developers.com", "community.cloudflare.com", "discourse.mozilla.org", "forums.swift.org", "users.rust-lang.org",
    "forum.gitlab.com", "community.home-assistant.io", "forum.obsidian.md", "community.spiceworks.com", "mathoverflow.net",
    "physics.stackexchange.com", "discuss.python.org", "forum.freecodecamp.org", "community.openai.com", "forums.unrealengine.com"
  ],
  "bank": [
    "nab.com.au", "commbank.com.au", "scotiabank.com", "bmo.com", "natwest.com",
    "credit-agricole.fr", "societegenerale.com", "unicredit.it", "intesasanpaolo.com", "dbs.com.sg",
    "ocbc.com", "revolut.com", "n26.com", "monzo.com", "starlingbank.com"
  ],
  "storefront": [
    "aloyoga.com", "awaytravel.com", "beardbrand.com", "blueland.com", "colourpop.com",
    "dollarshaveclub.com", "chubbiesshorts.com", "cocofloss.com", "boy-smells.com", "bruvi.com",
    "hiutdenim.co.uk", "mejuri.com", "ridgewallet.com", "fashionnova.com", "kyliecosmetics.com"
  ],
  "local": [
    "katzsdelicatessen.com", "joesstonecrab.com", "thefrenchlaundry.com", "russanddaughters.com", "zingermans.com",
    "tartinebakery.com", "franklinbarbecue.com", "pizzeriabianco.com", "levainbakery.com", "dominiqueansel.com",
    "magnoliabakery.com", "bluebottlecoffee.com", "stumptowncoffee.com", "intelligentsia.com", "counterculturecoffee.com",
    "powells.com", "strandbooks.com", "citylights.com", "farmgirlflowers.com", "bondvet.com",
    "hellotend.com", "drybar.com", "barrys.com", "soulcycle.com", "hugeinc.com",
    "instrument.com", "work.co", "metalab.com", "pentagram.com", "ustwo.com",
    "ramotion.com", "thehoxton.com", "acehotel.com", "chateaumarmont.com", "cooley.com",
    "wsgr.com", "kirkland.com", "skadden.com", "onemedical.com", "aspendental.com",
    "shakeshack.com", "sweetgreen.com", "chipotle.com", "dishoom.com", "hawksmoor.com"
  ],
  "tenant": [
    "google.github.io", "microsoft.github.io", "facebook.github.io", "mozilla.github.io", "netflix.github.io",
    "uber.github.io", "airbnb.github.io", "square.github.io", "spotify.github.io", "nasa.github.io",
    "jupyter.github.io", "kubernetes.github.io", "pytorch.github.io", "tensorflow.github.io", "electron.github.io",
    "next-blog-starter.vercel.app", "nextjs-commerce.vercel.app", "ai-sdk.vercel.app", "swr.vercel.app", "turbo.build",
    "gatsby-starter-blog.netlify.app", "docs.netlify.app", "astro-docs.netlify.app",
    "hono.pages.dev", "remix-run.pages.dev", "wrangler.pages.dev",
    "gymshark.myshopify.com", "allbirds.myshopify.com",
    "help.notion.site", "learn.notion.site",
    "requests.readthedocs.io", "flask.readthedocs.io", "numpy.readthedocs.io",
    "stratechery.substack.com", "platformer.substack.com", "astralcodexten.substack.com"
  ],
  "travel": [
    "delta.com", "united.com", "aa.com", "lufthansa.com", "britishairways.com",
    "ryanair.com", "easyjet.com", "emirates.com", "qantas.com", "airfrance.com",
    "klm.com", "marriott.com", "hilton.com", "hyatt.com", "ihg.com",
    "accor.com", "expedia.com", "kayak.com", "skyscanner.com", "trivago.com",
    "hostelworld.com", "tripadvisor.com", "amtrak.com", "eurostar.com", "bahn.de",
    "sncf-connect.com", "trainline.com", "viator.com", "getyourguide.com", "rome2rio.com"
  ],
  "health": [
    "mayoclinic.org", "clevelandclinic.org", "hopkinsmedicine.org", "webmd.com", "healthline.com",
    "medlineplus.gov", "who.int", "pfizer.com", "novartis.com", "roche.com",
    "gsk.com", "astrazeneca.com", "sanofi.com", "bayer.com", "merck.com",
    "jnj.com", "abbvie.com", "lilly.com", "cvs.com", "walgreens.com",
    "kaiserpermanente.org", "mountsinai.org", "cedars-sinai.org", "uclahealth.org", "nyulangone.org",
    "massgeneral.org", "stanfordhealthcare.org", "drugs.com", "zocdoc.com", "nhsinform.scot"
  ],
  "exemplar": [
    "anthropic.com", "docs.anthropic.com", "modelcontextprotocol.io", "code.claude.com", "llmstxt.org",
    "agents.md", "cloudflare.com", "developers.cloudflare.com", "vercel.com", "stripe.com",
    "mintlify.com", "resend.com", "supabase.com", "docs.perplexity.ai", "cursor.com",
    "zapier.com", "sentry.io", "posthog.com", "tailwindcss.com", "astro.build",
    "bun.sh", "hono.dev", "svelte.dev", "nuxt.com", "drizzle.team",
    "prisma.io", "expo.dev", "clerk.com", "neon.tech", "turso.tech",
    "fly.io", "railway.app", "render.com", "huggingface.co", "openai.com",
    "langchain.com", "llamaindex.ai", "pinecone.io", "weaviate.io", "cohere.com",
    "mistral.ai", "elevenlabs.io", "replicate.com", "fal.ai", "together.ai",
    "groq.com", "perplexity.ai", "x.ai", "answer.ai", "cal.com",
    "dub.co", "trigger.dev", "inngest.com", "upstash.com", "convex.dev",
    "liveblocks.io", "tldraw.com", "ui.shadcn.com", "tanstack.com", "remix.run",
    "deno.com", "effect.website", "biomejs.dev", "vitest.dev", "playwright.dev"
  ]
}
```

- [ ] **Step 2: Write the probe script**

```ts
// scripts/probe-corpus.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { createFetcher, boundedDispatcher } from "../packages/core/src/fetcher";
import { normalize } from "../packages/core/src/tests/site-list";

/**
 * Fetch each candidate once and say whether it can join the corpus.
 *
 *   pnpm corpus:probe [--candidates=<path>] [--out=<path>] [--concurrency=<n>]
 *
 * A candidate joins when its homepage answers 200 with HTML at the requested
 * host or a permanent redirect of it. An `exemplar` candidate must also serve
 * at least one of `/llms.txt`, `/.well-known/agents.json` or
 * `/.well-known/mcp.json` with 200. The output is a runner summary —
 * `outcomes[]` with `domain`, `score`, `evidence` and `unscoredReason` — so
 * `corpus:status import` reads it as a first observation, and a second file
 * `<out>.survivors.json` lists the domains per category that passed, ready to
 * paste into `seeds.json`.
 *
 * One request per URL, the scanner's own user agent, no retries. This is a
 * visit, not a scan.
 */

function flag(name: string, fallback: string): string {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const CANDIDATES = flag("candidates", "packages/core/test-data/sites/candidates.json");
const OUT = flag("out", "reports/corpus-probe.json");
const CONCURRENCY = Math.max(1, Number(flag("concurrency", "6")) || 6);

const AGENT_ARTIFACTS = ["/llms.txt", "/.well-known/agents.json", "/.well-known/mcp.json"];

const fetcher = createFetcher({ dispatcher: boundedDispatcher(2), maxConcurrent: 2 });

interface Outcome {
  domain: string;
  category: string;
  score: number | null;
  evidence: Record<string, boolean>;
  unscoredReason?: string;
  artifacts?: string[];
}

async function probe(domain: string, category: string): Promise<Outcome> {
  const home = await fetcher.fetch({ url: `https://${domain}/` });
  const finalHost = (() => {
    try {
      return new URL(home.finalUrl ?? home.url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const html = (home.contentType ?? "").toLowerCase().includes("html");
  const reachable =
    !home.error && home.status === 200 && html && (finalHost === domain || finalHost.endsWith(`.${domain}`));
  const evidence = {
    "origin-reachable": reachable,
    "unblocked-fetches": home.status !== 403 && home.status !== 429,
    "rendered-body": reachable && home.body.length > 0,
    "sample-adequate": reachable,
  };
  const outcome: Outcome = { domain, category, score: reachable ? 100 : null, evidence };
  if (!reachable) {
    outcome.unscoredReason = home.error
      ? `The homepage could not be fetched: ${home.error}.`
      : home.status !== 200
        ? `The homepage answered HTTP ${home.status}.`
        : finalHost !== domain
          ? `The requested host redirected to ${finalHost}, a different site.`
          : `The homepage served ${home.contentType || "no content type"}, not HTML.`;
    return outcome;
  }
  if (category === "exemplar") {
    const found: string[] = [];
    for (const artifact of AGENT_ARTIFACTS) {
      const r = await fetcher.fetch({ url: `https://${domain}${artifact}` });
      if (!r.error && r.status === 200 && r.body.trim().length > 0) found.push(artifact);
    }
    outcome.artifacts = found;
    if (found.length === 0) {
      outcome.score = null;
      outcome.unscoredReason = "No agent artifact: none of /llms.txt, /.well-known/agents.json, /.well-known/mcp.json answered 200.";
    }
  }
  return outcome;
}

async function main(): Promise<void> {
  const candidates = JSON.parse(fs.readFileSync(CANDIDATES, "utf8")) as Record<string, string[]>;
  const queue: Array<{ domain: string; category: string }> = [];
  for (const [category, domains] of Object.entries(candidates)) {
    for (const raw of domains) {
      const domain = normalize(raw);
      if (domain === "") {
        console.error(`skipping ${category}: ${JSON.stringify(raw)} is not a bare hostname`);
        continue;
      }
      queue.push({ domain, category });
    }
  }
  const outcomes: Outcome[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < queue.length) {
        const item = queue[next++]!;
        const outcome = await probe(item.domain, item.category);
        outcomes.push(outcome);
        const mark = outcome.score === null ? "✗" : "✓";
        console.log(`${mark} ${item.category.padEnd(11)} ${item.domain}${outcome.unscoredReason ? `  ${outcome.unscoredReason}` : ""}${outcome.artifacts?.length ? `  ${outcome.artifacts.join(" ")}` : ""}`);
      }
    }),
  );
  outcomes.sort((a, b) => a.domain.localeCompare(b.domain));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ probedAt: new Date().toISOString(), outcomes }, null, 2)}\n`);
  const survivors: Record<string, string[]> = {};
  for (const o of outcomes) {
    if (o.score === null) continue;
    (survivors[o.category] ??= []).push(o.domain);
  }
  const survivorsPath = OUT.replace(/\.json$/, ".survivors.json");
  fs.writeFileSync(survivorsPath, `${JSON.stringify(survivors, null, 2)}\n`);
  console.log(`\n${outcomes.length} probed -> ${OUT}; survivors -> ${survivorsPath}`);
  for (const [category, domains] of Object.entries(survivors).sort()) {
    console.log(`  ${category.padEnd(11)} ${domains.length} of ${candidates[category]?.length ?? 0}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Check the `FetchResult` fields the script reads exist: `finalUrl`, `contentType`, `error`, `status`, `body` are all declared in `packages/core/src/fetcher.ts`. If `finalUrl` is optional there, the `?? home.url` fallback above covers it.

- [ ] **Step 3: Run the probe**

Run: `pnpm corpus:probe`
Expected: one line per candidate, then a per-category survivor count. About 10 minutes. Read the `✗` lines: a `✗` for a domain you know is live usually means a `www.` redirect to a different registrable host or a WAF 403. Those stay out; a site that walls a single polite visit will wall the scan.

- [ ] **Step 4: Fold survivors into `seeds.json`**

For each category in `reports/corpus-probe.survivors.json`, append the survivors to `seeds.json` under that category (create the category with a `why` for the five new ones), keeping each domain list sorted and deduplicated. Then choose two smoke domains for each new category and add them to `smoke`. Use the `why` lines from the spec's category table. This is a hand edit; the `readSeeds` checks in Task 3 refuse duplicates and unlisted smoke domains.

Run afterwards:
```bash
node -e 'const s=require("./packages/core/test-data/sites/seeds.json");for(const [c,v] of Object.entries(s.categories))console.log(c.padEnd(12),v.domains.length);console.log("smoke",s.smoke.length)'
```
Expected: every category at or above its target from the spec table, or below it with a note for the PR; `smoke` equals 2 × the number of categories.

- [ ] **Step 5: Import the probe and regenerate**

```bash
pnpm corpus:status import reports/corpus-probe.json --date=2026-09-03
pnpm build:sites
AL_SKIP_NETWORK=1 pnpm exec vitest run packages/core/src/tests/site-list.test.ts
```
Expected: import reports counts; generator prints a table with 13 categories plus `unknown`; the whole `site-list.test.ts` PASSES, including the size floor and the 10-per-category rule. If a category is below 10, add candidates and re-probe rather than lowering the bar.

- [ ] **Step 6: Commit**

```bash
git add scripts/probe-corpus.ts packages/core/test-data/sites/candidates.json packages/core/test-data/sites/seeds.json packages/core/test-data/sites/sites.json packages/core/test-data/sites/status.json
git commit -m "feat(corpus): probe script; five new categories; regenerate the list"
```

---

### Task 6: `test:live` learns the status file and the smoke tier

**Files:**
- Modify: `scripts/test-live-sites.ts`

**Interfaces:**
- Consumes: `excludedDomains`, `CorpusStatus` (Task 1); `SiteEntry.tier` (Task 3).

- [ ] **Step 1: Add the options**

In `CliOptions` add:

```ts
  tier?: "smoke";
  includeDead: boolean;
  includeBlocked: boolean;
```

In `parseCliArgs` defaults add `includeDead: false, includeBlocked: false,`. In the boolean-flag block add:

```ts
    if (arg === "--include-dead") {
      options.includeDead = true;
      continue;
    }
    if (arg === "--include-blocked") {
      options.includeBlocked = true;
      continue;
    }
```

In the `switch (name)` add:

```ts
      case "tier":
        if (val.trim().toLowerCase() !== "smoke") {
          console.error(`--tier accepts "smoke", got "${val}"`);
          process.exit(2);
        }
        options.tier = "smoke";
        break;
```

- [ ] **Step 2: Apply the status file and the tier**

After `const allSites: SiteEntry[] = JSON.parse(fs.readFileSync(SITES_PATH, "utf8"));` add:

```ts
  const STATUS_PATH = path.resolve(
    process.cwd(),
    "packages/core/test-data/sites/status.json",
  );
  const status: CorpusStatus | undefined = fs.existsSync(STATUS_PATH)
    ? (JSON.parse(fs.readFileSync(STATUS_PATH, "utf8")) as CorpusStatus)
    : undefined;
  const excluded = excludedDomains(status, {
    dead: options.includeDead,
    blocked: options.includeBlocked,
  });
  const pool = allSites.filter((s) => {
    if (options.tier && s.tier !== options.tier) return false;
    return !excluded.has(s.domain);
  });
  if (excluded.size > 0) {
    console.log(
      `Status file: ${excluded.size} dead or blocked domain(s) left out (--include-dead, --include-blocked to add them)`,
    );
  }
  if (options.tier) console.log(`Tier: ${options.tier} (${pool.length} sites)`);
```

Then replace the three uses of `allSites` inside the loop (`allSites.filter((s) => specified.has(s.domain))`, `allSites.filter((s) => s.category…)`, `allSites.slice()`) with `pool`. Explicit `--domains` still bypass the status file: the `for (const d of options.domains)` fallback adds any domain not in `pool` as `custom`, which is what an operator asking for one domain by name wants.

Add the import:

```ts
import {
  excludedDomains,
  type CorpusStatus,
} from "../packages/core/src/tests/corpus-status";
```

- [ ] **Step 3: Update the help text**

In `printHelp`, after the `--stratified` line add:

```
  --tier=smoke        Only the smoke tier: two seeded sites per category, about five minutes
  --include-dead      Also scan domains status.json calls dead
  --include-blocked   Also scan domains status.json calls blocked (robots)
  --loop=<n>          Repeat the selection n times (default: 1)
  --shuffle, -r       Shuffle the pool before selecting
```

And an example: `  pnpm test:live --tier=smoke --limit=100 --concurrency=4`.

- [ ] **Step 4: Verify by hand**

```bash
pnpm test:live --help | grep -c -- "--tier"
pnpm test:live --limit=0 --tier=smoke --out=/tmp/al-smoke-0.json
pnpm test:live --tier=smoke --limit=100 --concurrency=4 --out=reports/smoke.json
```
Expected: `1`; then the `--limit=0` run prints `Tier: smoke (26 sites)` and the empty-selection warning and exits 0; then the real smoke run scans about 26 sites in about five minutes with `Invariant Violations: 0`.

- [ ] **Step 5: Import the smoke run and commit**

```bash
pnpm corpus:status import reports/smoke.json
git add scripts/test-live-sites.ts packages/core/test-data/sites/status.json
git commit -m "feat(corpus): test:live reads status.json and selects the smoke tier"
```

---

### Task 7: The nightly learns the status file and scans the whole list

**Files:**
- Modify: `scripts/scan-site-list.ts`
- Modify: `.github/workflows/corpus-nightly.yml`

**Interfaces:**
- Consumes: `excludedDomains`, `CorpusStatus` (Task 1).

- [ ] **Step 1: Add the flags**

`scan-site-list.ts` only takes numeric `--name=value` flags. In `DEFAULTS` add:

```ts
  /** 1 to scan domains `status.json` calls dead. */
  "include-dead": 0,
  /** 1 to scan domains `status.json` calls blocked by robots. */
  "include-blocked": 0,
```

Change `limit: 200,` to `limit: 400,` and rewrite its doc comment:

```ts
  /**
   * Sites per run.
   *
   * The list is about 365 curated domains, so the default window is the
   * whole list: `windowOf` returns everything when `size >= all.length`.
   * At concurrency 2 and 63 s per site per worker, 365 sites is about 190
   * minutes, inside the 240-minute deadline. The date-seeded offset still
   * applies when a smaller limit is passed.
   */
```

- [ ] **Step 2: Apply the status file**

In `main()`, replace `const all: SiteEntry[] = JSON.parse(fs.readFileSync(SITES_PATH, "utf8"));` with:

```ts
  const listed: SiteEntry[] = JSON.parse(fs.readFileSync(SITES_PATH, "utf8"));
  const STATUS_PATH = path.resolve(
    __dirname,
    "../packages/core/test-data/sites/status.json",
  );
  const status: CorpusStatus | undefined = fs.existsSync(STATUS_PATH)
    ? (JSON.parse(fs.readFileSync(STATUS_PATH, "utf8")) as CorpusStatus)
    : undefined;
  const excluded = excludedDomains(status, {
    dead: FLAGS["include-dead"] > 0,
    blocked: FLAGS["include-blocked"] > 0,
  });
  const all = listed.filter((s) => !excluded.has(s.domain));
  if (excluded.size > 0) {
    console.log(
      `[scan-site-list] ${excluded.size} domain(s) left out by status.json`,
    );
  }
```

Add the import:

```ts
import {
  excludedDomains,
  type CorpusStatus,
} from "../packages/core/src/tests/corpus-status";
```

- [ ] **Step 3: Update the workflow**

In `.github/workflows/corpus-nightly.yml`, change the scan step to `--limit=400 --allow-partial=1` and rewrite the timing comment above `timeout-minutes` to:

```yaml
    # The list is about 365 curated domains and a night scans all of it:
    # at concurrency 2 and about 63 s per site per worker that is about 190
    # minutes, inside the script's 240-minute deadline. status.json keeps
    # dead and robots-blocked domains out, which is most of what made the
    # old 1913-entry list slow. This cap is the backstop behind the deadline.
```

Also change the `1913 entries at 400 a night is full coverage in five nights.` sentence in the script's `DEFAULTS.limit` comment; Step 1 already replaced that comment.

- [ ] **Step 4: Smoke the wiring**

Run: `node --import tsx scripts/scan-site-list.ts --limit=0`
Expected: exits 0, prints the status-file line, writes an empty `reports/corpus-nightly.json`.

Run: `node --import tsx scripts/scan-site-list.ts --limit=1 --offset=0`
Expected: one site scanned, exit 0, a summary with one outcome.

- [ ] **Step 5: Commit**

```bash
git add scripts/scan-site-list.ts .github/workflows/corpus-nightly.yml
git commit -m "feat(corpus): nightly reads status.json and scans the whole curated list"
```

---

### Task 8: Docs, changeset, full gate, one-hour pass

**Files:**
- Modify: `docs/evidence/corpus.md`
- Create: `.changeset/live-corpus-curated.md`

- [ ] **Step 1: Update the nightly section of `docs/evidence/corpus.md`**

Replace the paragraph starting `**The window.**` with:

```markdown
**The list.** `sites.json` is generated from `seeds.json`, the hand-curated
source of truth: 13 categories of about 25 domains each, two per category
marked `tier: "smoke"`, plus a 50-domain `unknown` slice from the Tranco and
CrUX top lists and up to 30 ranked platform tenants. `pnpm build:sites`
regenerates it. `candidates.json` is the draft the last curation started
from; `pnpm corpus:probe` checks a draft before it is seeded.

**The status file.** `status.json` records what each domain did the last time
a runner saw it: `ok`, `unscored` with the scan's reason, `blocked` by
robots.txt, or `dead`. Both runners leave `dead` and `blocked` domains out
unless asked. `pnpm corpus:status import <summary.json>` merges a runner
summary into it; `pnpm corpus:status report` prints it grouped by state and
reason. A domain is `dead` only after two imports on different days say so.
CI never writes the file; import the nightly artifact by hand when wanted.

**The window.** The whole list, every night. About 365 sites at 63 s over
two workers is about 190 minutes, inside the 240-minute deadline.
```

Keep the summary table and the exit-code table as they are.

- [ ] **Step 2: Write the changeset**

```markdown
---
"@forkpoint/agent-lighthouse-core": patch
---

The live site corpus is curated. `sites.json` shrinks from 1913 blind entries to about 365 categorised domains across 13 categories, with a smoke tier of two per category. A new `status.json` records what each domain did last time, and both live runners skip dead and robots-blocked domains by default. `pnpm corpus:status`, `pnpm corpus:probe` and `pnpm build:sites` maintain it. Scan output is unchanged; only test data and scripts move.
```

- [ ] **Step 3: Run the full gate**

```bash
pnpm format
pnpm build && AL_SKIP_NETWORK=1 pnpm test && pnpm typecheck && pnpm lint && pnpm check:dossiers && pnpm check:requires && pnpm check:audit-map
```
Expected: all pass. `site-list.test.ts` and `corpus-status.test.ts` are part of `pnpm test`.

- [ ] **Step 4: The one-hour pass**

```bash
pnpm test:live --limit=1000 --concurrency=4 --out=reports/full-pass.json
pnpm corpus:status import reports/full-pass.json
pnpm corpus:status report | head -60
```
Expected: about 365 planned, `Invariant Violations: 0`, `Total Elapsed Time` about an hour. Read the report: any `unscored` domain with a "could not be fetched" reason is a candidate for removal on the next curation, once a second import confirms it.

- [ ] **Step 5: Commit**

```bash
git add docs/evidence/corpus.md .changeset/live-corpus-curated.md packages/core/test-data/sites/status.json
git commit -m "docs(corpus): curated list, status file, whole-list nightly; changeset"
```

---

## Self-review

- **Spec coverage.** Files: Task 2 (`status.json`), Task 4 (`seeds.json`, `sites.json`), Task 5 (`candidates.json`). Categories and sizes: Task 5. Status file rules: Task 1. Runners: Tasks 6 and 7. Status tooling: Task 2. Generator: Task 4. Curation: Task 5. Tests: Tasks 1, 3, 4. Documentation and changeset: Task 8. The spec's `--stratified` over 13 categories needs no change: it already groups by whatever categories the pool holds.
- **Deviation from the spec, recorded.** The spec drafts `tenant` domains by hand. The plan files ranked hostnames under `tenant` by public suffix (`TENANT_SUFFIXES`) as well, because a suffix is the category's definition and the ranked lists carry thousands of such hosts. Hand candidates still go through the probe. The spec's `buildSiteList(…, exclude)` became an options object because a third option, `tenantLimit`, arrived with it.
- **Type consistency.** `RunnerOutcome.evidence` is `Partial<Record<string, boolean>>` in Task 1; the probe in Task 5 writes `Record<string, boolean>`, which satisfies it. `Seeds` is produced by `readSeeds` (Task 3) and consumed by `buildSiteList` (Task 3) and the generator (Task 4). `excludedDomains(status, { dead, blocked })` is the one signature used in Tasks 4, 6 and 7.
- **Placeholders.** None. Every candidate list is written out; the probe decides what survives.
