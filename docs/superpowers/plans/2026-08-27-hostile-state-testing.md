# Hostile-State Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that no audit congratulates a site the scan never read, and that a real page cannot silently flip a verdict.

**Architecture:** Two registry-driven contract suites sit above the 222 per-audit test files. Part A builds five hostile `CheckContext` states and runs every registered audit against them, asserting no vacuous `pass`. Part B replaces a three-file hand-written corpus with frozen real pages plus a regenerable site list, and adds a nightly job over the wider list.

**Tech Stack:** TypeScript, vitest (root config only), cheerio, `node:zlib`, GitHub Actions.

Design: `docs/superpowers/specs/2026-08-27-hostile-state-testing-design.md`

## Global Constraints

- Run vitest from the repo root only. Never from inside a package directory.
- `pnpm build` before `pnpm check:dossiers` and `pnpm check:requires` — both read the built core bundle.
- Full gate before any commit that touches `packages/`: `pnpm build && pnpm test && pnpm typecheck && pnpm lint && pnpm check:dossiers && pnpm check:requires`.
- Never run bare `pnpm lint`. Use `rtk err pnpm lint`.
- oxlint is the only linter. Never add ESLint config, deps or `// eslint-disable-*`. Use `// oxlint-disable-*` if a suppression is genuinely needed.
- All code comments, JSDoc and inline config comments in English.
- `AL_SKIP_NETWORK=1` skips the live-site suite. The final run before finishing must not set it.
- Watch for stale `.js` or `.d.ts` under `packages/*/src/` — they shadow sources in vitest and turn a red suite green.
- Test-only changes need no changeset. An audit fix that comes out of these suites does: a changed verdict is `major`.
- `details` values must be scalars or arrays of strings. An array of objects throws inside `toCheckResult`.

---

## Part A — the hostile-state contract

### Task 1: The five states

**Files:**
- Create: `packages/core/src/tests/hostile-states.ts`
- Test: `packages/core/src/tests/hostile-states.test.ts`

**Interfaces:**
- Consumes: `CheckContext`, `PageContext` from `../check-context`; `FetchResult` from `../fetcher`; `ScanEvidence`, `EvidenceKey` from `../scan-evidence`; `WafProtection` from `../waf-detector`; `PageType` from `../types`.
- Produces:
  - `interface HostileState { name: string; missing: EvidenceKey[]; nothingObtained: boolean; build(): CheckContext }`
  - `const HOSTILE_STATES: HostileState[]` — all five.
  - `const NOTHING_OBTAINED: HostileState[]` — the four where no usable response arrived.
  - `const SHELL_STATE: HostileState` — the degraded one.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/tests/hostile-states.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HOSTILE_STATES, NOTHING_OBTAINED, SHELL_STATE } from './hostile-states';

describe('hostile scan states', () => {
  it('offers five states, four of which obtained nothing', () => {
    expect(HOSTILE_STATES).toHaveLength(5);
    expect(NOTHING_OBTAINED).toHaveLength(4);
    expect(SHELL_STATE.nothingObtained).toBe(false);
  });

  it('gives every nothing-obtained state an empty page list', () => {
    for (const state of NOTHING_OBTAINED) {
      expect(state.build().pages, state.name).toEqual([]);
    }
  });

  it('marks the missing evidence as unmet, and nothing else', () => {
    for (const state of HOSTILE_STATES) {
      const { met } = state.build().evidence;
      for (const key of state.missing) {
        expect(met[key], `${state.name}/${key}`).toBe(false);
      }
      const unexpected = (Object.keys(met) as Array<keyof typeof met>).filter(
        (key) => !met[key] && !state.missing.includes(key),
      );
      expect(unexpected, state.name).toEqual([]);
    }
  });

  it('hands the shell state one page that rendered no text', () => {
    const ctx = SHELL_STATE.build();
    expect(ctx.pages).toHaveLength(1);
    expect(Object.values(ctx.evidence.renderedByPage)).toEqual([false]);
  });

  it('names a bot wall on the blocked state and a throttle on the throttled one', () => {
    const blocked = HOSTILE_STATES.find((s) => s.name === 'blocked')!.build();
    const throttled = HOSTILE_STATES.find((s) => s.name === 'throttled')!.build();

    expect(blocked.wafProtection?.isBlocked).toBe(true);
    expect(blocked.wafProtection?.isRateLimit ?? false).toBe(false);
    expect(throttled.wafProtection?.isRateLimit).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/core/src/tests/hostile-states.test.ts`
Expected: FAIL — `Failed to resolve import "./hostile-states"`.

- [ ] **Step 3: Write the state builders**

Create `packages/core/src/tests/hostile-states.ts`:

```ts
import { parseHtml, extractJsonLd, extractMetaTags, extractHeadLinks } from '../parser';
import type { CheckContext, PageContext } from '../check-context';
import type { FetchResult } from '../fetcher';
import type { EvidenceKey, ScanEvidence } from '../scan-evidence';
import type { PageType } from '../types';

/**
 * Scan states in which an audit has the least to go on and the most freedom to
 * invent. Four of them are the states the evidence gate marks unscored; the
 * fifth is a page that arrived and said nothing.
 *
 * These are contexts, not fixtures: the contract suites run every registered
 * audit against each one, so an audit that congratulates a site the scan never
 * read is caught whoever wrote it.
 */
export interface HostileState {
  /** Short name, used in test titles and failure messages. */
  name: string;
  /** The evidence keys this state denies. */
  missing: EvidenceKey[];
  /** True when the scan obtained no usable response at all. */
  nothingObtained: boolean;
  build(): CheckContext;
}

const BASE_URL = 'https://example.test';

/** Root paths a scan always asks for, so a state can answer them uniformly. */
const ROOT_PATHS = ['/robots.txt', '/sitemap.xml', '/llms.txt'];

function fetchResult(over: Partial<FetchResult> = {}): FetchResult {
  const body = over.body ?? '';
  return {
    url: BASE_URL,
    finalUrl: BASE_URL,
    status: 200,
    headers: {},
    body,
    ttfbMs: 1,
    totalMs: 2,
    contentType: '',
    contentLength: body.length,
    ...over,
  };
}

/** Every root path answering the same way — a wall answers uniformly. */
function rootFiles(build: (path: string) => FetchResult): Record<string, FetchResult> {
  return Object.fromEntries(ROOT_PATHS.map((path) => [path, build(path)]));
}

function evidence(
  reasons: Partial<Record<EvidenceKey, string>>,
  renderedByPage: Record<string, boolean> = {},
  usablePageTypes: PageType[] = [],
): ScanEvidence {
  const met: Record<EvidenceKey, boolean> = {
    'origin-reachable': true,
    'unblocked-fetches': true,
    'rendered-body': true,
    'sample-adequate': true,
  };
  for (const key of Object.keys(reasons) as EvidenceKey[]) met[key] = false;

  return {
    met,
    reasons,
    renderedByPage,
    usablePageTypes: new Set(usablePageTypes),
    // Same rule the scan uses: a shell was still a response from the site.
    judgeable: met['origin-reachable'] && met['unblocked-fetches'],
  };
}

function page(url: string, html: string, pageType: PageType = 'homepage'): PageContext {
  const $ = parseHtml(html);
  return {
    url,
    pageType,
    fetchResult: fetchResult({ url, finalUrl: url, body: html, contentType: 'text/html' }),
    $,
    jsonLd: extractJsonLd($),
    meta: extractMetaTags($),
    headLinks: extractHeadLinks($),
  };
}

function context(over: Partial<CheckContext>): CheckContext {
  return {
    rootFiles: {},
    pages: [],
    domain: 'example.test',
    baseUrl: BASE_URL,
    fetch: async ({ url }) => fetchResult({ url, finalUrl: url, status: 404 }),
    evidence: evidence({}),
    ...over,
  };
}

/** A bot wall: every request refused, nothing read. */
const blocked: HostileState = {
  name: 'blocked',
  missing: ['unblocked-fetches', 'rendered-body', 'sample-adequate'],
  nothingObtained: true,
  build: () =>
    context({
      rootFiles: rootFiles((path) =>
        fetchResult({
          url: `${BASE_URL}${path}`,
          finalUrl: `${BASE_URL}${path}`,
          status: 403,
          headers: { 'cf-ray': '8a0f0000000-LHR', 'content-type': 'text/html' },
          body: '<html><body>Attention Required! | Cloudflare</body></html>',
        }),
      ),
      wafProtection: {
        isBlocked: true,
        provider: 'cloudflare',
        name: 'Cloudflare',
        reason: 'HTTP 403 with a cf-ray header',
        statusCode: 403,
      },
      evidence: evidence({
        'unblocked-fetches': 'Cloudflare answered the scanner with HTTP 403.',
        'rendered-body': 'No page was read.',
        'sample-adequate': 'No page was read.',
      }),
    }),
};

/** A throttle: the scan asked too fast. Says nothing about who the site admits. */
const throttled: HostileState = {
  name: 'throttled',
  missing: ['unblocked-fetches', 'rendered-body', 'sample-adequate'],
  nothingObtained: true,
  build: () =>
    context({
      rootFiles: rootFiles((path) =>
        fetchResult({
          url: `${BASE_URL}${path}`,
          finalUrl: `${BASE_URL}${path}`,
          status: 429,
          headers: { 'retry-after': '30' },
        }),
      ),
      wafProtection: {
        isBlocked: true,
        provider: 'rate-limited',
        name: 'Rate limit',
        reason: 'HTTP 429 on every request',
        statusCode: 429,
        isRateLimit: true,
      },
      evidence: evidence({
        'unblocked-fetches': 'The site answered HTTP 429 on every request.',
        'rendered-body': 'No page was read.',
        'sample-adequate': 'No page was read.',
      }),
    }),
};

/** A temporary hop to somewhere else: the site asked for was never reached. */
const redirectedAway: HostileState = {
  name: 'redirected-away',
  missing: ['origin-reachable', 'rendered-body', 'sample-adequate'],
  nothingObtained: true,
  build: () =>
    context({
      evidence: evidence({
        'origin-reachable': 'The homepage redirected to parked.example.net.',
        'rendered-body': 'No page was read.',
        'sample-adequate': 'No page was read.',
      }),
    }),
};

/** The origin answered, with a PDF. Nothing an HTML audit can read. */
const nonHtml: HostileState = {
  name: 'non-html',
  missing: ['rendered-body', 'sample-adequate'],
  nothingObtained: true,
  build: () =>
    context({
      rootFiles: {
        '/robots.txt': fetchResult({
          url: `${BASE_URL}/robots.txt`,
          finalUrl: `${BASE_URL}/robots.txt`,
          status: 404,
        }),
      },
      evidence: evidence({
        'rendered-body': 'The homepage served application/pdf.',
        'sample-adequate': 'No HTML page was read.',
      }),
    }),
};

/** A JS shell: a page arrived, carrying no text a non-JS consumer can read. */
const shell: HostileState = {
  name: 'shell',
  missing: ['rendered-body', 'sample-adequate'],
  nothingObtained: false,
  build: () => {
    const url = `${BASE_URL}/`;
    return context({
      pages: [page(url, '<html lang="en"><head><title>Shop</title></head><body><div id="root"></div></body></html>')],
      rootFiles: {
        '/robots.txt': fetchResult({
          url: `${BASE_URL}/robots.txt`,
          finalUrl: `${BASE_URL}/robots.txt`,
          body: 'User-agent: *\nAllow: /\n',
          contentType: 'text/plain',
        }),
      },
      evidence: evidence(
        {
          'rendered-body': 'The served HTML carried no readable text.',
          'sample-adequate': 'No page rendered text.',
        },
        { [url]: false },
      ),
    });
  },
};

export const NOTHING_OBTAINED: HostileState[] = [blocked, throttled, redirectedAway, nonHtml];
export const SHELL_STATE: HostileState = shell;
export const HOSTILE_STATES: HostileState[] = [...NOTHING_OBTAINED, shell];
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run packages/core/src/tests/hostile-states.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tests/hostile-states.ts packages/core/src/tests/hostile-states.test.ts
git commit -m "test(core): five hostile scan states, built once and shared"
```

---

### Task 2: No audit passes a site the scan never read

**Files:**
- Create: `packages/core/src/tests/hostile-state-contract.test.ts`
- Modify: audits this suite convicts (unknown until step 2 runs)

**Interfaces:**
- Consumes: `NOTHING_OBTAINED` from `./hostile-states`; `defaultConfig` from `../audit-config`; `AuditResultSchema` from `../schemas`.
- Produces: `VACUOUS_PASS_ALLOWLIST: Map<string, string>` — audit id to the reason it may pass with nothing fetched. Starts empty.

- [ ] **Step 1: Write the contract suite**

Create `packages/core/src/tests/hostile-state-contract.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../audit-config';
import { AuditResultSchema } from '../schemas';
import { NOTHING_OBTAINED } from './hostile-states';
import type { AuditResult } from '../types';

/**
 * A scan that obtained nothing holds no evidence about the site, so no audit
 * may congratulate it. `notApplicable` is right, and `fail` is right when the
 * missing response is itself the finding — `no-blocking-captcha` reports the
 * wall it met. Only `pass` is forbidden.
 *
 * This is registry-driven on purpose. `expectNotApplicableOnEmpty` says almost
 * the same thing and 73 of 222 audit test files call it, because calling it is
 * the author's job and the author forgets. Reading the registry covers every
 * audit whether or not anyone remembered.
 *
 * `operability-safety/no-blocking-captcha` shipped a vacuous pass here: it
 * looked for CAPTCHA markup in pages it never received, found none, and passed
 * the site that had just refused it.
 */

/**
 * Audits that may pass with nothing fetched, because they judge the request
 * rather than any response. Empty by design — `https-enabled` was the obvious
 * candidate and it already requires a 200 homepage before it passes. An entry
 * needs a one-line reason. If this grows past a handful, the rule is wrong.
 */
const VACUOUS_PASS_ALLOWLIST = new Map<string, string>();

const registrations = Object.values(defaultConfig.audits).flat();

describe('hostile-state contract — nothing obtained', () => {
  it('has audits to check', () => {
    expect(registrations.length).toBeGreaterThan(200);
  });

  // Build each state once. No audit mutates its context.
  const states = NOTHING_OBTAINED.map((state) => ({ state, ctx: state.build() }));

  for (const registration of registrations) {
    const { id } = registration.meta;

    it(`${id}: claims nothing when the scan read nothing`, async () => {
      for (const { state, ctx } of states) {
        let result: AuditResult;
        try {
          result = await registration.create().audit(ctx);
        } catch (err) {
          expect.fail(`${state.name}: threw instead of returning a result — ${String(err)}`);
        }

        const parsed = AuditResultSchema.safeParse(result);
        if (!parsed.success) {
          const issues = parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .slice(0, 3)
            .join('; ');
          expect.fail(`${state.name}: result rejected by AuditResultSchema — ${issues}`);
        }

        if (VACUOUS_PASS_ALLOWLIST.has(id)) continue;
        if (result.status === 'pass') {
          expect.fail(
            `${state.name}: passed a site the scan never read — "${result.message}". ` +
              `Return notApplicable, or fail if the missing response is the finding.`,
          );
        }
      }
    });
  }
});
```

- [ ] **Step 2: Run it and record what it convicts**

Run: `npx vitest run packages/core/src/tests/hostile-state-contract.test.ts 2>&1 | tail -40`
Expected: some FAILs. This is the point of the task — each one is a live vacuous pass or a throw.

Write the list of failing audit ids into the scratchpad before touching anything. Do not fix them yet.

- [ ] **Step 3: Triage each failure, one at a time**

For each convicted audit, decide between exactly two outcomes and record which:

1. **The audit is wrong.** It claims something no response supports. Fix the audit: return `notApplicable`, or `fail` when the missing response is the finding. Add the fix to the audit's own `.test.ts` as a named case, and record the change under `## Implementation deviations` in its dossier at `docs/evidence/audits/<category>/<slug>.md`.
2. **The audit judges the request, not a response.** Add it to `VACUOUS_PASS_ALLOWLIST` with a one-line reason.

There is no third outcome. "The state is unrealistic" is not one: all four states came off real scans in the calibration run.

- [ ] **Step 4: Run the suite until it is green**

Run: `npx vitest run packages/core/src/tests/hostile-state-contract.test.ts`
Expected: PASS, one test per registered audit.

- [ ] **Step 5: Run the whole suite**

Run: `AL_SKIP_NETWORK=1 npx vitest run`
Expected: PASS. An audit fix can move a per-audit test or a snapshot; update those deliberately, never by regenerating blind.

- [ ] **Step 6: Full gate**

Run: `pnpm build && pnpm test && pnpm typecheck && rtk err pnpm lint && pnpm check:dossiers && pnpm check:requires`
Expected: all pass.

- [ ] **Step 7: Changeset, only if an audit changed**

If step 3 changed any audit's verdict, add one changeset per audit — `major`, because a scan's output changes:

```bash
pnpm changeset
```

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/tests/hostile-state-contract.test.ts packages/core/src/audits docs/evidence .changeset
git commit -m "test(core): no audit may pass a site the scan never read"
```

---

### Task 3: No page-reading audit passes a shell

**Files:**
- Modify: `packages/core/src/tests/hostile-state-contract.test.ts`
- Modify: audits this suite convicts (unknown until step 2 runs)

**Interfaces:**
- Consumes: `SHELL_STATE` from `./hostile-states`; `registrations` and `VACUOUS_PASS_ALLOWLIST` already defined in the file.
- Produces: nothing new.

- [ ] **Step 1: Add the degraded-state block**

Append to `packages/core/src/tests/hostile-state-contract.test.ts`:

```ts
/**
 * A shell is not an empty scan: a page arrived, it just carried no text. Root
 * files were fetched and read, so a robots-based audit passing here is
 * correct. Only audits that declare `rendered-body` are held to the rule —
 * narrowing by the audit's own `requires` keeps the claim tied to what the
 * audit says it needs, rather than to its category.
 */
describe('hostile-state contract — a shell page', () => {
  const ctx = SHELL_STATE.build();
  const readsRenderedBody = registrations.filter((r) =>
    (r.meta.requires ?? []).includes('rendered-body'),
  );

  it('has page-reading audits to check', () => {
    expect(readsRenderedBody.length).toBeGreaterThan(20);
  });

  for (const registration of readsRenderedBody) {
    const { id } = registration.meta;

    it(`${id}: claims nothing about a page that rendered no text`, async () => {
      let result: AuditResult;
      try {
        result = await registration.create().audit(ctx);
      } catch (err) {
        expect.fail(`threw instead of returning a result — ${String(err)}`);
      }

      expect(AuditResultSchema.safeParse(result).success).toBe(true);
      if (VACUOUS_PASS_ALLOWLIST.has(id)) return;
      expect(
        result.status,
        `passed a page that rendered no text — "${result.message}"`,
      ).not.toBe('pass');
    });
  }
});
```

Add `SHELL_STATE` to the existing import from `./hostile-states`.

- [ ] **Step 2: Run it and record what it convicts**

Run: `npx vitest run packages/core/src/tests/hostile-state-contract.test.ts 2>&1 | tail -40`
Expected: some FAILs, or none. Record the ids before changing anything.

- [ ] **Step 3: Triage, same two outcomes as Task 2**

Fix the audit, or allowlist it with a reason. A `content-extraction/server-rendered`-style audit whose subject is the empty body must `fail` here, not pass and not skip.

- [ ] **Step 4: Run the suite until it is green**

Run: `npx vitest run packages/core/src/tests/hostile-state-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Full gate**

Run: `pnpm build && pnpm test && pnpm typecheck && rtk err pnpm lint && pnpm check:dossiers && pnpm check:requires`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/tests/hostile-state-contract.test.ts packages/core/src/audits docs/evidence .changeset
git commit -m "test(core): no page-reading audit may pass a shell"
```

---

### Task 4: A walled site reports no score

**Files:**
- Modify: `packages/core/src/orchestrator.test.ts` — inside `describe('runScan — the evidence gate')`, after the existing `reports no score for a shell` test

**Interfaces:**
- Consumes: the file's existing `set()` and `h.map` helpers, and `runScan`.
- Produces: nothing.

Two of the three scan-level invariants already exist in this file: a shell scores null, and `na` checks stay out of `recommendations`. Only the walled case is missing, and it is the one that produced the 43-out-of-100 score on `ridge.com` behind a Cloudflare 403.

- [ ] **Step 1: Write the failing test**

```ts
  it('reports no score for a site that refused the scanner', async () => {
    // Every request answered by the wall, which is what a 403 storefront does.
    h.map.set(url, {
      url,
      finalUrl: url,
      status: 403,
      headers: { 'cf-ray': '8a0f0000000-LHR', 'content-type': 'text/html' },
      body: '<html><body>Attention Required! | Cloudflare</body></html>',
      ttfbMs: 1,
      totalMs: 2,
      contentType: 'text/html',
      contentLength: 60,
    });

    const report = await runScan(url);

    expect(report.overallScore).toBeNull();
    expect(report.scoreTier).toBeNull();
    expect(report.scanValidity?.judgeable).toBe(false);
    expect(report.scanValidity?.unscoredReason).toBeTruthy();
  });
```

- [ ] **Step 2: Run it**

Run: `npx vitest run packages/core/src/orchestrator.test.ts -t 'refused the scanner'`
Expected: PASS. The gate already covers this path; the test pins it so a later change cannot quietly restore the score.

If it FAILs, the gate has a hole. Fix `buildScanEvidence` or the orchestrator's suppression branch, and say so in the commit message.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/orchestrator.test.ts
git commit -m "test(core): pin that a walled site reports no score"
```

---

## Part B — the real-page corpus

### Task 5: The site list

**Files:**
- Create: `scripts/build-site-list.ts`
- Create: `packages/core/test-data/sites/categories.json`
- Create: `packages/core/test-data/sites/sites.json` (generated, committed)
- Test: `packages/core/src/tests/site-list.test.ts`

**Interfaces:**
- Produces: `sites.json` as `Array<{ domain: string; category: string; source: 'tranco' | 'crux'; rankBucket: number }>`. `category` is `'unknown'` when the seed map has no entry.

Sources: the Tranco list (`https://tranco-list.eu/top-1m.csv.zip`, ranked, built to resist manipulation) and the CrUX top-origins CSVs (`https://github.com/zakird/crux-top-lists`, real-traffic origins in rank buckets). Neither carries categories, so `categories.json` is a hand-maintained seed map of domain to category, and everything unmatched is `'unknown'`. Saying `'unknown'` is honest; guessing a category from a domain name is not.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/tests/site-list.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface SiteEntry {
  domain: string;
  category: string;
  source: 'tranco' | 'crux';
  rankBucket: number;
}

const sites: SiteEntry[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../test-data/sites/sites.json'), 'utf8'),
);

describe('the site list', () => {
  it('holds enough sites to be worth scanning', () => {
    expect(sites.length).toBeGreaterThan(500);
  });

  it('carries a bare hostname per entry, never a URL', () => {
    for (const site of sites.slice(0, 200)) {
      expect(site.domain, site.domain).not.toMatch(/^https?:\/\//);
      expect(site.domain, site.domain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
    }
  });

  it('lists each domain once', () => {
    expect(new Set(sites.map((s) => s.domain)).size).toBe(sites.length);
  });

  it('reaches past storefronts, which is the point of building it', () => {
    const categories = new Set(sites.map((s) => s.category));
    categories.delete('unknown');
    expect(categories.size).toBeGreaterThanOrEqual(6);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/core/src/tests/site-list.test.ts`
Expected: FAIL — `ENOENT: no such file or directory ... sites.json`.

- [ ] **Step 3: Write the seed category map**

Create `packages/core/test-data/sites/categories.json` with at least six categories and enough domains that the generator can label a useful share of the list. Categories: `news`, `docs`, `saas`, `government`, `marketplace`, `forum`, `bank`, `storefront`.

```json
{
  "news": ["bbc.co.uk", "nytimes.com", "reuters.com", "lemonde.fr", "asahi.com"],
  "docs": ["developer.mozilla.org", "docs.python.org", "kubernetes.io", "reactjs.org"],
  "saas": ["stripe.com", "notion.so", "figma.com", "vercel.com"],
  "government": ["gov.uk", "irs.gov", "canada.ca", "europa.eu"],
  "marketplace": ["etsy.com", "ebay.com", "mercadolibre.com", "rakuten.co.jp"],
  "forum": ["reddit.com", "stackoverflow.com", "news.ycombinator.com"],
  "bank": ["chase.com", "hsbc.co.uk", "ing.com"],
  "storefront": ["allbirds.com", "gymshark.com", "velasca.com", "tattly.com"]
}
```

- [ ] **Step 4: Download the two source lists**

The script reads local files rather than downloading, so a regeneration is
reproducible and the script needs no zip library:

```bash
mkdir -p /tmp/site-lists
curl -sL https://tranco-list.eu/top-1m.csv.zip -o /tmp/site-lists/tranco.zip
unzip -p /tmp/site-lists/tranco.zip > /tmp/site-lists/tranco.csv
curl -sL https://raw.githubusercontent.com/zakird/crux-top-lists/main/data/global/current.csv.gz \
  | gunzip > /tmp/site-lists/crux.csv
```

- [ ] **Step 5: Write the generator**

Create `scripts/build-site-list.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Build the site list from two public ranked sources.
 *
 * Neither source carries categories, so `categories.json` is a hand-maintained
 * seed map and everything unmatched stays `'unknown'`. Saying `'unknown'` is
 * honest; guessing a category from a domain name is not.
 *
 * Both inputs are local files, downloaded by hand. A generator that fetches
 * cannot be re-run to the same output, and this one is meant to be.
 */

interface SiteEntry {
  domain: string;
  category: string;
  source: 'tranco' | 'crux';
  rankBucket: number;
}

function flag(name: string, fallback: string): string {
  const arg = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : fallback;
}

const LIMIT = Number(flag('limit', '1000'));
const TRANCO = flag('tranco', '/tmp/site-lists/tranco.csv');
const CRUX = flag('crux', '/tmp/site-lists/crux.csv');
const OUT = flag('out', 'packages/core/test-data/sites/sites.json');
const CATEGORIES = flag('categories', 'packages/core/test-data/sites/categories.json');

/** A bare lowercase hostname, or '' when the field is not one. */
function normalize(raw: string): string {
  const trimmed = raw.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const host = trimmed.toLowerCase().replace(/^www\./, '');
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : '';
}

/** Tranco rows are `rank,domain`. CrUX rows are `origin,rank`. */
function readRanked(file: string, domainColumn: number): string[] {
  if (!fs.existsSync(file)) {
    console.error(`missing input: ${file} — see the download step`);
    process.exit(1);
  }
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => normalize(line.split(',')[domainColumn] ?? ''))
    .filter(Boolean);
}

const seed: Record<string, string[]> = JSON.parse(fs.readFileSync(CATEGORIES, 'utf8'));
const categoryOf = new Map<string, string>();
for (const [category, domains] of Object.entries(seed)) {
  for (const domain of domains) categoryOf.set(normalize(domain), category);
}

const byDomain = new Map<string, SiteEntry>();

function add(domains: string[], source: SiteEntry['source']): void {
  domains.slice(0, LIMIT).forEach((domain, index) => {
    // First writer wins: the sources are added best-ranked first, so a domain
    // already present is already recorded at its better rank.
    if (byDomain.has(domain)) return;
    byDomain.set(domain, {
      domain,
      category: categoryOf.get(domain) ?? 'unknown',
      source,
      rankBucket: Math.floor(index / 1000) * 1000,
    });
  });
}

add(readRanked(TRANCO, 1), 'tranco');
add(readRanked(CRUX, 0), 'crux');

// Seeded domains are the reason the list reaches past storefronts, so they are
// kept even when they fall outside the rank cut.
for (const [domain, category] of categoryOf) {
  if (!byDomain.has(domain)) {
    byDomain.set(domain, { domain, category, source: 'tranco', rankBucket: 0 });
  }
}

const sites = [...byDomain.values()].sort((a, b) => a.rankBucket - b.rankBucket);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(sites, null, 2)}\n`);

const unknown = sites.filter((s) => s.category === 'unknown').length;
const tranco = sites.filter((s) => s.source === 'tranco').length;
console.log(
  `${sites.length} sites -> ${OUT} (tranco ${tranco}, crux ${sites.length - tranco}, unknown category ${unknown})`,
);
```

- [ ] **Step 6: Generate the list and check the test passes**

Run: `npx tsx scripts/build-site-list.ts --limit=1000`
Then: `npx vitest run packages/core/src/tests/site-list.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-site-list.ts packages/core/test-data/sites packages/core/src/tests/site-list.test.ts
git commit -m "test(core): a regenerable site list that reaches past storefronts"
```

---

### Task 6: Capture a page as a fixture

**Files:**
- Create: `scripts/capture-fixture.ts`
- Create: `packages/core/src/tests/fixture-io.ts`
- Test: `packages/core/src/tests/fixture-io.test.ts`

**Interfaces:**
- Produces:
  - `readFixture(name: string): { html: string; provenance: FixtureProvenance }`
  - `interface FixtureProvenance { url: string; capturedAt: string; sha256: string }`
  - `listFixtures(): string[]` — fixture names, without the `.html.gz` suffix.
- Fixture layout: `packages/core/test-data/corpus/real/<name>.html.gz` plus `<name>.json` holding the provenance.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/tests/fixture-io.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { listFixtures, readFixture } from './fixture-io';

describe('the real-page fixtures', () => {
  it('holds fixtures to read', () => {
    expect(listFixtures().length).toBeGreaterThan(0);
  });

  it('reads back HTML matching the SHA recorded at capture', () => {
    for (const name of listFixtures()) {
      const { html, provenance } = readFixture(name);
      const sha = createHash('sha256').update(html).digest('hex');
      expect(sha, `${name} does not match its recorded SHA`).toBe(provenance.sha256);
    }
  });

  it('records where and when each fixture came from', () => {
    for (const name of listFixtures()) {
      const { provenance } = readFixture(name);
      expect(provenance.url, name).toMatch(/^https:\/\//);
      expect(provenance.capturedAt, name).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/core/src/tests/fixture-io.test.ts`
Expected: FAIL — `Failed to resolve import "./fixture-io"`.

- [ ] **Step 3: Write the reader**

Create `packages/core/src/tests/fixture-io.ts`:

```ts
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

/**
 * Where a fixture came from and when. A fixture is a measurement of a page on
 * a date, and the date is part of the record: a page that changes upstream
 * does not invalidate what the fixture proved on the day it was taken.
 */
export interface FixtureProvenance {
  url: string;
  capturedAt: string;
  sha256: string;
}

const DIR = resolve(__dirname, '../../test-data/corpus/real');

export function listFixtures(): string[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((file) => file.endsWith('.html.gz'))
    .map((file) => file.replace(/\.html\.gz$/, ''))
    .sort();
}

export function readFixture(name: string): { html: string; provenance: FixtureProvenance } {
  const html = gunzipSync(readFileSync(resolve(DIR, `${name}.html.gz`))).toString('utf8');
  const provenance = JSON.parse(
    readFileSync(resolve(DIR, `${name}.json`), 'utf8'),
  ) as FixtureProvenance;
  return { html, provenance };
}
```

- [ ] **Step 4: Write the capture script**

Create `scripts/capture-fixture.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createFetcher } from '../packages/core/src/fetcher';

/**
 * Freeze one real page as a test fixture.
 *
 * The fetch goes through the scanner's own fetcher, so the fixture is the
 * bytes an audit would have seen — same user-agent, same redirect handling.
 * It runs once, by hand: fixtures are never re-fetched, which is what keeps
 * the corpus suite offline and deterministic.
 */

const OUT_DIR = path.resolve(__dirname, '../packages/core/test-data/corpus/real');
const MIN_BODY_BYTES = 200;

const args = process.argv.slice(2);
const rawUrl = args.find((a) => !a.startsWith('-'));
if (!rawUrl) {
  console.error('usage: npx tsx scripts/capture-fixture.ts <url> [--name=<name>] [--allow-small]');
  process.exit(1);
}

const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
const allowSmall = args.includes('--allow-small');
const nameFlag = args.find((a) => a.startsWith('--name='));
const name =
  nameFlag?.slice('--name='.length) ??
  new URL(url).hostname.replace(/^www\./, '').replace(/\./g, '-');

async function main(): Promise<void> {
  const result = await createFetcher().fetch({ url });

  if (result.status < 200 || result.status >= 300) {
    // A wall response is a legitimate fixture, but it has to be asked for:
    // capturing one by accident produces a fixture nobody can interpret.
    if (!allowSmall) {
      console.error(`${url} answered HTTP ${result.status} — pass --allow-small to keep it`);
      process.exit(1);
    }
  }

  if (result.body.length < MIN_BODY_BYTES && !allowSmall) {
    console.error(`${url} returned ${result.body.length} bytes — pass --allow-small to keep it`);
    process.exit(1);
  }

  const gz = gzipSync(Buffer.from(result.body, 'utf8'), { level: 9 });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.html.gz`), gz);
  fs.writeFileSync(
    path.join(OUT_DIR, `${name}.json`),
    `${JSON.stringify(
      {
        url: result.finalUrl || url,
        capturedAt: new Date().toISOString(),
        sha256: createHash('sha256').update(result.body).digest('hex'),
      },
      null,
      2,
    )}\n`,
  );

  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  console.log(
    `${name}: HTTP ${result.status}, ${kb(result.body.length)} raw, ${kb(gz.length)} gzipped`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Capture one page and watch the test pass**

Run: `npx tsx scripts/capture-fixture.ts https://velasca.com`
Then: `npx vitest run packages/core/src/tests/fixture-io.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/capture-fixture.ts packages/core/src/tests/fixture-io.ts packages/core/src/tests/fixture-io.test.ts packages/core/test-data/corpus/real
git commit -m "test(core): capture a real page as a dated fixture"
```

---

### Task 7: Freeze the corpus

**Files:**
- Create: `packages/core/test-data/corpus/real/*.html.gz` and `*.json` — about 40 pages
- Create: `docs/evidence/corpus.md` — what each fixture is for

**Interfaces:**
- Consumes: `scripts/capture-fixture.ts` from Task 6, `sites.json` from Task 5.
- Produces: the frozen corpus that Task 8 snapshots.

- [ ] **Step 1: Capture the pages that broke things**

These are known shapes, not guesses. Each one is why a defect shipped:

```bash
npx tsx scripts/capture-fixture.ts https://velasca.com          # one empty <main>, 194 words elsewhere
npx tsx scripts/capture-fixture.ts https://hiutdenim.co.uk      # four <main>, first holds 49 characters
npx tsx scripts/capture-fixture.ts https://gymshark.com         # <body> holds 1 word
npx tsx scripts/capture-fixture.ts https://tattly.com           # 20 words / 127 characters
npx tsx scripts/capture-fixture.ts https://quitenice.co --allow-small   # 114-byte body, parked origin
npx tsx scripts/capture-fixture.ts https://sokoglam.com --allow-small   # Kasada wall response body
```

- [ ] **Step 2: Capture a spread from the site list**

Take about 34 more from `sites.json`, at least three per category, favouring categories no storefront covers: `news`, `docs`, `government`, `bank`, `forum`, `marketplace`. Capture them one at a time; a site that refuses the scanner is itself worth keeping, with `--allow-small`.

- [ ] **Step 3: Check the corpus weight**

Run: `du -sh packages/core/test-data/corpus/real`
Expected: under 5 MB. If it is over, drop the largest fixtures whose shape another fixture already covers, and say which in the commit message.

- [ ] **Step 4: Write the corpus record**

Create `docs/evidence/corpus.md`: one line per fixture giving the domain, the capture date, and the shape it exists to cover. A fixture with no stated shape is a fixture nobody can prune later.

- [ ] **Step 5: Run the suite**

Run: `AL_SKIP_NETWORK=1 npx vitest run packages/core/src/tests/fixture-io.test.ts`
Expected: PASS — every fixture matches its SHA.

- [ ] **Step 6: Commit**

```bash
git add packages/core/test-data/corpus/real docs/evidence/corpus.md
git commit -m "test(core): freeze 40 real pages, picked for the shapes that broke things"
```

---

### Task 8: Snapshot every verdict on every real page

**Files:**
- Create: `packages/core/src/tests/real-page-corpus.test.ts`
- Create: `packages/core/src/tests/__snapshots__/real-page-corpus.test.ts.snap` (generated)

**Interfaces:**
- Consumes: `listFixtures`, `readFixture` from `./fixture-io`; `defaultConfig` from `../audit-config`; `mockCheckContext`, `mockPageContext` from `../__tests__/test-utils`.
- Produces: nothing.

- [ ] **Step 1: Write the test**

Create `packages/core/src/tests/real-page-corpus.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../audit-config';
import { mockCheckContext, mockPageContext } from '../__tests__/test-utils';
import { listFixtures, readFixture } from './fixture-io';

/**
 * Every registered audit, run against real pages, with its verdict snapshotted.
 *
 * The suite's blind spot is that audits are tested against HTML the audit
 * author wrote, which always has one clean `<main>` holding text. Real pages
 * ship empty ones, several of them, and bodies holding a single word.
 * `getMainContentText` read the first `<main>` and failed two live storefronts
 * at critical priority; no hand-written fixture could show that.
 *
 * A change here is not a failure. It is a diff to read: an audit change that
 * silently flips a verdict on a real page arrives as a review item instead of
 * shipping.
 */

const registrations = Object.values(defaultConfig.audits).flat();
const fixtures = listFixtures();

describe('real-page corpus', () => {
  it('has fixtures and audits to run', () => {
    expect(fixtures.length).toBeGreaterThan(0);
    expect(registrations.length).toBeGreaterThan(200);
  });

  for (const name of fixtures) {
    it(`${name}: verdicts hold`, async () => {
      const { html, provenance } = readFixture(name);
      const ctx = mockCheckContext([mockPageContext(provenance.url, html)]);

      const verdicts: Record<string, string> = {};
      for (const registration of registrations) {
        try {
          const result = await registration.create().audit(ctx);
          verdicts[registration.meta.id] = result.status;
        } catch (err) {
          // A throw is a verdict too: the runner stubs it as `scan-error`, so
          // record it rather than failing the whole page.
          verdicts[registration.meta.id] = `THREW: ${String(err).slice(0, 80)}`;
        }
      }

      expect(verdicts).toMatchSnapshot();
    });
  }
});
```

- [ ] **Step 2: Run it and generate the snapshot**

Run: `npx vitest run packages/core/src/tests/real-page-corpus.test.ts`
Expected: PASS, snapshots written.

- [ ] **Step 3: Read the snapshot before trusting it**

Run: `grep -c "THREW" packages/core/src/tests/__snapshots__/real-page-corpus.test.ts.snap`
Expected: `0`. Any throw is a live bug on a real page — fix the audit, add the case to its own test file, and record it in its dossier under `## Implementation deviations`.

Then scan the snapshot for `pass` verdicts on the shell fixtures (`gymshark`, `tattly`, `quitenice`). A `pass` there is the same vacuous claim Task 2 forbids, on a real page instead of a built one.

- [ ] **Step 4: Check the runtime**

Run: `npx vitest run packages/core/src/tests/real-page-corpus.test.ts 2>&1 | grep Duration`
Expected: under 120 s. 215 audits across 40 real pages is the largest single suite in the repo. If it runs longer, halve the corpus rather than let `pnpm test` grow a minutes-long tail, and say which fixtures went.

- [ ] **Step 5: Full gate**

Run: `pnpm build && pnpm test && pnpm typecheck && rtk err pnpm lint && pnpm check:dossiers && pnpm check:requires`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/tests/real-page-corpus.test.ts packages/core/src/tests/__snapshots__ packages/core/src/audits docs/evidence .changeset
git commit -m "test(core): snapshot every verdict on 40 real pages"
```

---

### Task 9: The nightly job

**Files:**
- Create: `.github/workflows/corpus-nightly.yml`
- Create: `scripts/scan-site-list.ts`

**Interfaces:**
- Consumes: `sites.json` from Task 5; `runScan` from `packages/core/src`.
- Produces: a JSON summary artifact, and a non-zero exit when an invariant breaks.

There is no ground truth for hundreds of third-party sites, so this job cannot assert verdicts. It asserts invariants.

- [ ] **Step 1: Write the runner**

Create `scripts/scan-site-list.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runScan } from '../packages/core/src';

/**
 * Scan the site list and assert what a scan may claim.
 *
 * There is no ground truth for hundreds of third-party sites, so this cannot
 * assert verdicts. It asserts invariants: nothing threw, nothing passed on a
 * scan that saw too little, and a site that served readable pages received a
 * score.
 *
 * The concurrency and delay defaults are deliberately low. Most storefronts
 * sit behind Cloudflare, whose rate limit is scoped to the source IP: a run at
 * higher settings had 36 of 48 stores answer HTTP 429 while a single `curl`
 * carrying the same user-agent got 200 from every one of them. It was
 * measuring its own throttling.
 */

interface SiteEntry {
  domain: string;
  category: string;
}

interface SiteOutcome {
  domain: string;
  category: string;
  score: number | null;
  unscoredReason?: string;
  statusCounts: Record<string, number>;
  violations: string[];
  durationMs: number;
}

function numericFlag(name: string, fallback: number): number {
  const arg = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  const value = arg ? Number(arg.slice(name.length + 3)) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const LIMIT = numericFlag('limit', 500);
const CONCURRENCY = numericFlag('concurrency', 2);
const DELAY_MS = numericFlag('delay', 3000);

const SITES_PATH = path.resolve(__dirname, '../packages/core/test-data/sites/sites.json');
const OUT_PATH = path.resolve(__dirname, '../reports/corpus-nightly.json');

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function scanOne(site: SiteEntry): Promise<SiteOutcome> {
  const started = Date.now();
  const base: SiteOutcome = {
    domain: site.domain,
    category: site.category,
    score: null,
    statusCounts: {},
    violations: [],
    durationMs: 0,
  };

  try {
    const report = await runScan(`https://${site.domain}`);
    const checks = report.categories.flatMap((c) => c.checks);

    for (const check of checks) {
      base.statusCounts[check.status] = (base.statusCounts[check.status] ?? 0) + 1;
    }
    base.score = report.overallScore;
    base.unscoredReason = report.scanValidity?.unscoredReason;

    // An unscored scan saw too little to judge the site, so nothing in it may
    // congratulate the site either.
    if (report.overallScore === null) {
      const passes = checks.filter((c) => c.status === 'pass');
      if (passes.length > 0) {
        base.violations.push(`unscored but ${passes.length} checks passed, e.g. ${passes[0]!.id}`);
      }
    }

    // The converse: a site that served readable pages must get a number.
    if (report.scanValidity?.evidence['rendered-body'] === true && report.overallScore === null) {
      base.violations.push('rendered readable text but received no score');
    }
  } catch (err) {
    base.violations.push(`threw: ${String(err).slice(0, 200)}`);
  }

  base.durationMs = Date.now() - started;
  return base;
}

async function main(): Promise<void> {
  const sites: SiteEntry[] = JSON.parse(fs.readFileSync(SITES_PATH, 'utf8')).slice(0, LIMIT);
  const queue = [...sites];
  const outcomes: SiteOutcome[] = [];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const site = queue.shift();
      if (!site) break;
      const outcome = await scanOne(site);
      outcomes.push(outcome);
      const verdict = outcome.violations.length > 0 ? 'VIOLATION' : `score ${outcome.score}`;
      console.log(`[${outcomes.length}/${sites.length}] ${site.domain}: ${verdict}`);
      if (queue.length > 0) await pause(DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // A summary, not the reports: the Free plan allows 500 MB of artifact
  // storage and 500 full scan reports overrun it.
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(outcomes, null, 2)}\n`);

  const broken = outcomes.filter((o) => o.violations.length > 0);
  console.log(`\n${outcomes.length} scanned, ${broken.length} with violations`);
  for (const outcome of broken.slice(0, 10)) {
    console.log(`  ${outcome.domain}: ${outcome.violations.join('; ')}`);
  }
  if (broken.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it small, locally**

Run: `npx tsx scripts/scan-site-list.ts --limit=10`
Expected: exit 0, `reports/corpus-nightly.json` written with 10 entries.

- [ ] **Step 3: Write the workflow**

Create `.github/workflows/corpus-nightly.yml`:

```yaml
name: Corpus nightly

on:
  schedule:
    # 03:17 UTC — off the hour, which is when scheduled runs queue worst.
    - cron: '17 3 * * *'
  workflow_dispatch:

# One at a time. Two concurrent runs would double the request rate every
# scanned origin sees from GitHub's address range.
concurrency: corpus-nightly

jobs:
  scan:
    runs-on: ubuntu-latest
    # The job cap is 6 hours. 500 sites at the measured rate is about 2.
    timeout-minutes: 300
    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Scan the site list
        run: npx tsx scripts/scan-site-list.ts --limit=500

      - name: Upload the summary
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: corpus-nightly
          path: reports/corpus-nightly.json
          retention-days: 14
```

- [ ] **Step 4: Run it once by hand**

Push the branch, then run the workflow through `workflow_dispatch` from the Actions tab and read the summary artifact. A scheduled workflow only runs from the default branch, so this is the only way to see it work before merge.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/corpus-nightly.yml scripts/scan-site-list.ts
git commit -m "ci: scan the site list nightly and assert what a scan may claim"
```

---

## Notes for whoever runs this

- Tasks 2, 3 and 8 are the ones that find bugs. Their step lists look short because the work is triage, not typing. Budget for it.
- The two invariant rules are not the same claim, and conflating them will produce false failures. Nothing-obtained forbids `pass` for every audit. Shell forbids `pass` only for audits declaring `rendered-body`, because root files really were fetched.
- Scheduled workflows in a public repository are disabled automatically after 60 days without repository activity. If the nightly job goes quiet, check that before debugging the script.
