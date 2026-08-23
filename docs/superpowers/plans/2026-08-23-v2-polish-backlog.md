# v2 Polish and Backlog Implementation Plan (Plan 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close v2 by fixing the engine's four latent bugs, surfacing the evidence tier everywhere a check is shown, wiring the two documented-but-dead CLI flags, regenerating the website data, and clearing the behavior-affecting half of the two ledgers' deferred-minor backlog.

**Architecture:** Five independent groups, in dependency order. Group A changes the engine's own contracts (result schema, recommendation code, redirect safety, scoring law) and everything downstream inherits it. Group B carries `CheckResult.tier` — already stamped by `Audit.toCheckResult` — out to the four report surfaces. Group C adds two filter fields to `ScanOptions` and parses the matching CLI flags. Group D regenerates `packages/website/audits-data.json` from the live registry and updates the static copy that surrounds it. Group E is the triaged backlog: audit-behavior fixes, test-strength fixes, then one documentation sweep.

**Tech Stack:** TypeScript pnpm monorepo (`@forkpoint/agent-lighthouse-core`, `-report`, `-cli`, `-mcp`), vitest, zod, undici, cheerio, jsdom, changesets, oxlint, tsup.

## Global Constraints

- **Registry is 172 audits, 8 categories.** No audit is added or removed by this plan. `node scripts/check-dossiers.mjs` must keep printing `172 audits OK … no orphans` at every task boundary.
- **Weight law unchanged:** `weight = weightForGrade(grade, tier)` — never a hand-written number. Grade A + scored = 1.0, B + scored = 0.6, every non-scored tier = 0.
- **Audit ids** match `/^[a-z-]+\/[a-z0-9-]+$/`, max 64 characters.
- **No new runtime dependencies.** `packages/core` dependencies stay `cheerio`, `domhandler`, `jsdom`, `undici`, `zod`. `packages/report` and `packages/cli` gain none.
- **New URL fetches stay `isSafeUrl()`-gated.** Test suites `vi.mock('../../fetcher')` with the offline stand-in used across the repo (copy it from `packages/core/src/audits/agent-interfaces/mcp-version-downgrade.test.ts`).
- **Code comments in English**, in every file.
- **Commands run from the repo root:** `pnpm test <path>`, `pnpm test`, `pnpm typecheck` (never `npx tsc -b`), `rtk err pnpm lint` (never bare `pnpm lint`), `pnpm --filter @forkpoint/agent-lighthouse-core build && node scripts/check-dossiers.mjs`.
- **Implementers never push.** Commit locally; the controller pushes after user approval.
- **Never commit `.lavish/` or `.playwright-mcp/`.**
- Every task ends green on all four gates before its commit.

## File Structure

| File | Responsibility in this plan |
| :-- | :-- |
| `packages/core/src/schemas.ts` | `AuditResultSchema.details` stops stripping unknown keys (Task 1) |
| `packages/core/src/types.ts` | `AuditResult.details` / `CheckResult.details` index signature (Task 1) |
| `packages/core/src/audit.ts` | `fail()` / `warn()` carry a per-result `code` (Task 2) |
| `packages/core/src/fetcher.ts` | Manual redirect walk, `isSafeUrl` per hop, real `finalUrl` (Task 3) |
| `packages/core/src/scorer.ts` | All-na categories leave the overall denominator (Task 4) |
| `packages/report/src/view-model.ts` | `tier` reaches `CheckView`; advisory counts per category (Task 5) |
| `packages/report/src/html-generator.ts` | Tier badge on each check card + legend (Task 5) |
| `packages/cli/src/main.ts` | Terminal tier markers (Task 6), `--categories` (Task 8), `--experimental` (Task 9) |
| `packages/report/src/markdown-generator.ts` | Advisory-check line in the PR comment (Task 7) |
| `packages/core/src/orchestrator.ts` | `ScanOptions.categories`, `ScanOptions.includeExperimental`, config filtering (Tasks 8, 9) |
| `packages/core/src/audit-config.ts` | `filterConfig()` helper the orchestrator calls (Task 8) |
| `scripts/build-docs-data.ts` | Emits `tier`, `evidenceGrade`, `dossier` (Task 10) |
| `packages/website/audits-data.json`, `packages/website/index.html` | Regenerated data + tier badge, filter, corrected counts (Task 10) |
| audit sources listed per item | Behavior fixes (Tasks 11–13) |
| docs and comments listed per item | Documentation sweep (Task 14) |

---

## Triage record — what this plan does not fix

The user's decision was: fix every deferred minor that changes an audit verdict, changes a message a user reads, or strengthens a test; sweep the documentation-only ones; record the rest. These are recorded as **not fixed**, with the reason:

- **`A11Y_RULES` side-effect accumulator → static composition** (taxonomy ledger, Plan 4 Task 1). A refactor with no behavior change, and the module already passes its tests. Carry to a future cleanup.
- **`_test-utils.ts` lives in `src/audits/operability-safety/` rather than `__tests__/`** — file placement, no behavior.
- **`engine/checks.ts` is-on-screen dead code** — verified unreferenced; deleting it is a separate cleanup commit, not worth a test cycle here.
- **`presets.ts` content-preset weighting revisit** — a product question about preset tuning, not a defect.
- **`html-generator.ts:92` multi-line `found` collapsing to one line** — superseded: Task 5 rewrites that region, and the fix lands there.
- **`report/cli/mcp` patch-vs-major changeset bumps** — the release-time decision, made when v2 ships, not now.
- **`AuditMeta` optional-field tightening** — the zod schema already requires the fields; tightening the TS type is a compiler-only change with no runtime effect.
- **`buildCategoryResult` mass default** — Task 4 rewrites the scoring path and adds the pinning test; the parameter default stays for external callers.

---

## Group A — engine contracts

### Task 1: `details` stops silently stripping keys

**Files:**
- Modify: `packages/core/src/schemas.ts:14-20`
- Modify: `packages/core/src/types.ts` (the `details` field on `AuditResult` and `CheckResult`)
- Test: `packages/core/src/audit.test.ts`

**Interfaces:**
- Produces: `AuditResult['details']` and `CheckResult['details']` accept arbitrary extra keys of type `string | number | boolean | undefined` alongside the known `expected` / `found` / `code` / `docsUrl` / `effort`.

The latent bug, from the merges ledger (Task 2): `AuditResultSchema` declares `details` as a closed object, so `agent-governance.ts` sets `trainingAgents` / `realtimeAgents` / `hasCatchAll` and zod drops all three before they reach `CheckResult`. Every audit that wants structured detail has to smuggle it through `found` as prose.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/audit.test.ts`:

```ts
it('carries unknown details keys through validation into the CheckResult', () => {
  class DetailAudit extends Audit {
    static override meta: AuditMeta = { ...BASE_META, id: 'machine-discovery/detail-probe' };
    audit(): AuditResult {
      return {
        status: 'pass',
        score: 1,
        message: 'ok',
        expected: 'e',
        found: 'f',
        details: { expected: 'e', found: 'f', trainingAgents: 3, hasCatchAll: false, note: 'kept' },
      };
    }
  }
  const check = new DetailAudit().toCheckResult(new DetailAudit().audit());
  expect(check.details).toMatchObject({ trainingAgents: 3, hasCatchAll: false, note: 'kept' });
});
```

`BASE_META` is the meta literal already used by the other cases in that file; reuse it rather than writing a new one.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test packages/core/src/audit.test.ts`
Expected: FAIL — `details` comes back with only `expected`, `found`, `code`, `docsUrl`, `effort`.

- [ ] **Step 3: Open the schema**

In `packages/core/src/schemas.ts`, replace the closed `details` object with one that keeps unknown scalar keys:

```ts
  details: z
    .object({
      expected: z.string().max(10000).optional(),
      found: z.string().max(10000).optional(),
      code: z.string().max(10000).optional(),
    })
    // Audits attach structured evidence beside the prose — counts, booleans,
    // ids. A closed object dropped all of it silently, which is how
    // agent-governance's trainingAgents/realtimeAgents/hasCatchAll never
    // reached a report. Unknown keys are kept, but only as scalars: nested
    // objects would let an audit smuggle unbounded payloads into the JSON
    // report.
    .catchall(z.union([z.string().max(10000), z.number(), z.boolean()]))
    .optional(),
```

- [ ] **Step 4: Widen the two TypeScript types**

In `packages/core/src/types.ts`, both `AuditResult['details']` and `CheckResult['details']` gain the same index signature next to their existing named fields:

```ts
  details?: {
    expected?: string;
    found?: string;
    code?: string;
    docsUrl?: string;
    effort?: FixEffort;
    /** Structured evidence an audit attaches beside the prose. */
    [key: string]: string | number | boolean | undefined;
  };
```

- [ ] **Step 5: Run the test and the suite**

Run: `pnpm test packages/core/src/audit.test.ts && pnpm typecheck`
Expected: PASS, 0 type errors.

- [ ] **Step 6: Un-work-around `agent-governance`**

`packages/core/src/audits/access-crawl-control/agent-governance.ts` computes `trainingAgents`, `realtimeAgents` and `hasCatchAll` and currently only spells them into `found`. Keep the `found` prose exactly as it is — the report shows it — and additionally pass the three values in `details`. Add one assertion to `agent-governance.test.ts`:

```ts
it('exposes the agent counts as structured details', async () => {
  const result = await runWithRobots(ROBOTS_WITH_TRAINING_AND_REALTIME);
  const check = new AgentGovernanceAudit().toCheckResult(result);
  expect(check.details?.trainingAgents).toBeGreaterThan(0);
});
```

Use whichever fixture in that file already produces both agent classes; do not invent a new one.

- [ ] **Step 7: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
pnpm --filter @forkpoint/agent-lighthouse-core build && node scripts/check-dossiers.mjs
git add -A
git commit -m "fix(core): stop stripping unknown keys from AuditResult.details

The details object was closed, so structured evidence an audit attached beside
the prose was dropped by validation before it reached CheckResult. Unknown
scalar keys are now kept; nested objects still are not, so a report cannot grow
an unbounded payload. agent-governance now exposes its agent counts as details
rather than only as prose."
```

---

### Task 2: `fail()` / `warn()` stop discarding a per-result `code`

**Files:**
- Modify: `packages/core/src/audit.ts:49-100` (the `warn` and `fail` bodies)
- Test: `packages/core/src/audit.test.ts`

**Interfaces:**
- Consumes: Task 1's widened `details` type.
- Produces: `warn()` and `fail()` accept `{ priority, code }` and the `code` reaches `CheckResult.details.code`, overriding `meta.guidance.code`.

Both methods accept `recommendationOrPriority?: { priority: CheckPriority; [key: string]: unknown } | string`, read `priority` off it and throw the rest away. `toCheckResult` then falls back to `meta.guidance.code`, so an audit that computed a site-specific fix snippet silently ships the generic one. Plan 4 Task 11 worked around it by writing `details.code` directly.

- [ ] **Step 1: Write the failing test**

```ts
it('carries a per-result code from fail() into the check details', () => {
  class CodeAudit extends Audit {
    static override meta: AuditMeta = {
      ...BASE_META,
      id: 'machine-discovery/code-probe',
      guidance: { ...BASE_META.guidance!, code: 'GENERIC' },
    };
    audit(): AuditResult {
      return this.failPublic();
    }
    failPublic(): AuditResult {
      return this.fail('m', 'e', 'f', { priority: 'high', code: 'SITE-SPECIFIC' });
    }
  }
  const audit = new CodeAudit();
  const check = audit.toCheckResult(audit.audit());
  expect(check.details?.code).toBe('SITE-SPECIFIC');
  expect(check.priority).toBe('high');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test packages/core/src/audit.test.ts`
Expected: FAIL — `check.details.code` is `'GENERIC'`.

- [ ] **Step 3: Keep the code in both builders**

In `packages/core/src/audit.ts`, inside `warn()` and `fail()`, after the existing `priority` extraction, add:

```ts
    // A recommendation object may also carry a fix snippet computed from what
    // this scan actually found. It used to be dropped here, so every report
    // showed the generic snippet from meta.guidance.code.
    const code =
      typeof recommendationOrPriority === 'object' && typeof recommendationOrPriority.code === 'string'
        ? recommendationOrPriority.code
        : undefined;
```

and add to each returned object:

```ts
      ...(code ? { details: { code } } : {}),
```

`toCheckResult` already prefers `result.details?.code` over `meta.guidance?.code`, so no change is needed there.

- [ ] **Step 4: Run the test**

Run: `pnpm test packages/core/src/audit.test.ts`
Expected: PASS.

- [ ] **Step 5: Check the workaround sites still behave**

Run: `pnpm test packages/core/src/audits/operability-safety/`
Expected: PASS. The Plan 4 Task 11 audits set `details.code` directly, which still wins — the new path only fills in when `details` was not set.

- [ ] **Step 6: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
git add -A
git commit -m "fix(core): keep a per-result fix snippet from fail() and warn()

Both builders read priority off the recommendation object and discarded
everything else, so an audit that computed a site-specific code snippet shipped
the generic meta.guidance.code instead. The snippet now lands in details.code,
which toCheckResult already prefers."
```

---

### Task 3: the `isSafeUrl` gate survives redirects

**Files:**
- Modify: `packages/core/src/fetcher.ts:11-12` and `:150-205`
- Test: `packages/core/src/fetcher.test.ts`

**Interfaces:**
- Produces: `FetchResult.finalUrl` is the URL that actually answered, after redirects. A redirect chain that leaves public HTTP(S) space is stopped and reported as `error: 'redirect-refused'` with the last safe URL in `finalUrl`.

Today `followRedirects` hands the request to `new Agent().compose(interceptors.redirect({ maxRedirections: 5 }))`. The `isSafeUrl` gate runs once, on the URL the caller passed. A site that answers `302 Location: http://169.254.169.254/latest/meta-data/` is followed. The same code path is also why `finalUrl` is a lie today — the file says so at line 199: `finalUrl: targetUrl, // undici doesn't expose final URL after redirects easily`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/fetcher.test.ts` (that file already stands up a local server for its cases; follow its existing helper):

```ts
it('refuses to follow a redirect into a private address', async () => {
  const server = await startServer((req, res) => {
    if (req.url === '/start') {
      res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' });
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('should not be reached');
  });
  const result = await createFetcher().fetch({ url: `${server.url}/start` });
  expect(result.error).toBe('redirect-refused');
  expect(result.body).toBe('');
});

it('reports the URL that actually answered as finalUrl', async () => {
  const server = await startServer((req, res) => {
    if (req.url === '/start') {
      res.writeHead(301, { location: '/end' });
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('arrived');
  });
  const result = await createFetcher().fetch({ url: `${server.url}/start` });
  expect(result.status).toBe(200);
  expect(result.finalUrl).toBe(`${server.url}/end`);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test packages/core/src/fetcher.test.ts`
Expected: FAIL — the first follows the redirect, the second reports `/start` as `finalUrl`.

- [ ] **Step 3: Walk the chain by hand**

Replace the `redirectAgent` dispatcher path with an explicit loop. Keep `noRedirectAgent` as the only dispatcher; `followRedirects: false` keeps its current single-request behavior.

```ts
/** How many hops a redirect chain may take before we give up. */
const MAX_REDIRECTS = 5;
/** Statuses that carry a Location a client is expected to follow. */
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
```

Inside the fetch body, after the first response is read and before the result is assembled:

```ts
      // Follow redirects ourselves rather than handing the chain to undici.
      // The isSafeUrl gate only ever saw the URL the caller passed, so a site
      // could redirect the scanner into link-local or RFC 1918 space — the
      // classic SSRF pivot. Walking the chain here means every hop is gated,
      // and it is also the only way to report a truthful finalUrl.
      let currentUrl = targetUrl;
      let hops = 0;
      while (
        followRedirects &&
        REDIRECT_STATUS.has(response.statusCode) &&
        response.headers['location'] &&
        hops < MAX_REDIRECTS
      ) {
        const next = new URL(String(response.headers['location']), currentUrl).href;
        if (!(await isSafeUrl(next))) {
          return errorResult(currentUrl, 'redirect-refused');
        }
        currentUrl = next;
        hops += 1;
        response = await request(currentUrl, { /* same options, method GET after 303 */ });
      }
```

Follow the file's existing conventions for building the error result and for reusing the request options — read `fetcher.ts` before writing, and keep the timeout, header and body handling exactly as they are. A 303 becomes a GET without a body; 307 and 308 keep the method and body.

Then set `finalUrl: currentUrl` where the result object is assembled, and delete the stale comment at line 199.

- [ ] **Step 4: Run the tests**

Run: `pnpm test packages/core/src/fetcher.test.ts`
Expected: PASS, including every pre-existing case in that file.

- [ ] **Step 5: Run the audits that read `finalUrl`**

Run: `pnpm test packages/core/src/audits/`
Expected: PASS. `finalUrl` becoming truthful can change a canonical or redirect-chain audit's message; if a test fails, the fixture was pinning the old lie — fix the fixture, not the fetcher, and say so in the commit body.

- [ ] **Step 6: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
git add -A
git commit -m "fix(core): gate every redirect hop, and report a truthful finalUrl

The isSafeUrl check ran once, on the URL the caller passed, while undici's
redirect interceptor followed up to five hops unchecked — so a site could
redirect the scanner into link-local or RFC 1918 space. The chain is now walked
here, one isSafeUrl check per hop, refusing with error 'redirect-refused'.
Walking it also lets FetchResult.finalUrl name the URL that actually answered
instead of the one we asked for."
```

---

### Task 4: an all-notApplicable category leaves the denominator

**Files:**
- Modify: `packages/core/src/scorer.ts:72-83` (`calculateOverallScore`)
- Test: `packages/core/src/scorer.test.ts`

**Interfaces:**
- Produces: `calculateOverallScore` skips any category whose checks are all `na`. `CategoryResult` gains no new field — the decision is read off the checks the category already carries.

The product decision (taxonomy ledger, Task 11): a blog scores 0 for `agentic-commerce` and pays that category's full evidence mass, which is a hidden penalty for not being a shop. Since the checks are all `na`, the category has nothing to say.

- [ ] **Step 1: Write the failing test**

```ts
it('drops a category whose checks are all notApplicable from the overall score', () => {
  const commerce = buildCategoryResult('agentic-commerce', [naCheck(), naCheck()], 4);
  const discovery = buildCategoryResult('machine-discovery', [passCheck(1), failCheck(1)], 4);
  expect(calculateOverallScore([commerce, discovery])).toBe(50);
});

it('still counts a category that has one non-na check', () => {
  const commerce = buildCategoryResult('agentic-commerce', [naCheck(), failCheck(1)], 4);
  const discovery = buildCategoryResult('machine-discovery', [passCheck(1), passCheck(1)], 4);
  expect(calculateOverallScore([commerce, discovery])).toBe(50);
});
```

`naCheck()`, `passCheck(weight)` and `failCheck(weight)` are the fixture builders already in `scorer.test.ts`; reuse them and add only what is missing.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test packages/core/src/scorer.test.ts`
Expected: FAIL — the first case returns 50 only after the fix; before it, the all-na category contributes score 0 at mass 4 and the answer is 25.

- [ ] **Step 3: Implement**

```ts
/**
 * A category whose every check is notApplicable has nothing to assess, so it
 * leaves both sums — the same rule `calculateCategoryScore` already applies to
 * an individual na check, lifted one level. Without this a non-commerce site
 * pays the whole agentic-commerce evidence mass at score 0, which reads as a
 * penalty for not being a shop.
 */
function hasAssessableCheck(cat: CategoryResult): boolean {
  return cat.checks.some((c) => c.status !== 'na' && !isInformative(c));
}

export function calculateOverallScore(categories: CategoryResult[]): number {
  let weighted = 0;
  let totalMass = 0;
  for (const cat of categories) {
    const mass = cat.weight ?? 0;
    if (mass <= 0) continue;
    if (!hasAssessableCheck(cat)) continue;
    weighted += cat.score * mass;
    totalMass += mass;
  }
  if (totalMass === 0) return 0;
  return Math.round(weighted / totalMass);
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test packages/core/src/scorer.test.ts && pnpm test packages/core/src/audit-runner.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the doc comment above the function**

The existing block comment says a category with no mass drops out. Extend it with the new rule in the same voice, one sentence.

- [ ] **Step 6: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
git add -A
git commit -m "fix(core): an all-notApplicable category leaves the overall denominator

A category where every check is na has nothing to assess, but it still paid its
full evidence mass at score 0 — so a blog was scored down for having no
checkout. The rule na checks already follow inside a category now applies to
the category itself. Sites whose registry coverage is partial score higher;
that is the intended correction, not a regression."
```

---

## Group B — surfacing the evidence tier

### Task 5: tier in the view model and the HTML report

**Files:**
- Modify: `packages/report/src/view-model.ts` (`CheckView`, `CategoryView`)
- Modify: `packages/report/src/html-generator.ts:72-95` (the check card) and the report legend
- Test: `packages/report/src/view-model.test.ts`, `packages/report/src/html-generator.test.ts`

**Interfaces:**
- Consumes: `CheckResult.tier` (already stamped by `Audit.toCheckResult`) and `CheckResult.evidenceGrade`.
- Produces: `CheckView.tier?: AuditTier`, `CheckView.evidenceGrade?: EvidenceGrade`, `CategoryView.counts.advisory: number` — the number of non-`na` checks in that category whose tier is not `scored`.

A weight-0 informative check currently renders identically to a scored one, so `structured-data/claimreview-advisory` reads as a failed audit when it is an advisory that deliberately moves nothing.

- [ ] **Step 1: Write the failing tests**

In `view-model.test.ts`:

```ts
it('carries the tier and grade onto each check view', () => {
  const view = buildReportView(reportWith([check({ id: 'structured-data/claimreview-advisory', tier: 'informative', evidenceGrade: 'A', scoreDisplayMode: 'informative' })]));
  const check0 = view.groups[0]!.categories[0]!.checks[0]!;
  expect(check0.tier).toBe('informative');
  expect(check0.evidenceGrade).toBe('A');
});

it('counts advisory checks per category', () => {
  const view = buildReportView(reportWith([
    check({ tier: 'scored' }),
    check({ id: 'structured-data/claimreview-advisory', tier: 'informative', scoreDisplayMode: 'informative' }),
  ]));
  expect(view.groups[0]!.categories[0]!.counts.advisory).toBe(1);
});
```

`reportWith` and `check` are the fixture helpers already in that file — extend them with the two new fields rather than writing new ones.

In `html-generator.test.ts`:

```ts
it('marks an informative check with an advisory badge and does not badge a scored one', () => {
  const html = generateHtmlReport(reportWith([
    check({ id: 'structured-data/claimreview-advisory', title: 'Advisory', tier: 'informative', scoreDisplayMode: 'informative' }),
    check({ id: 'machine-discovery/canonical', title: 'Scored', tier: 'scored' }),
  ]));
  expect(html).toContain('Advisory — not scored');
  expect(html.match(/Advisory — not scored/g)).toHaveLength(1);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test packages/report/src/`
Expected: FAIL — `tier` is undefined on the view, and the badge string is absent.

- [ ] **Step 3: Carry the fields through the view model**

Add `tier` and `evidenceGrade` to `CheckView` and copy them where the other check fields are mapped. Add `advisory` to `CheckCounts` and compute it beside the existing `pass` / `warn` / `fail` / `na` tallies:

```ts
      // Tier is not a status: an informative check can pass or fail like any
      // other, it just never moves a score. Counting it separately is what
      // stops a deliberate advisory from reading as a defect.
      advisory: checks.filter((c) => c.status !== 'na' && c.tier && c.tier !== 'scored').length,
```

- [ ] **Step 4: Badge the check card**

In `html-generator.ts`, inside the `<div class="font-semibold …">` that already renders the title, the id and the deprecated badge, add one more badge next to them:

```ts
                            ${c.tier && c.tier !== 'scored' ? `<span class="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300" title="${c.tier === 'experimental' ? 'Experimental check — excluded from scoring while it is validated.' : 'Advisory check — reported, never scored.'}">${c.tier === 'experimental' ? 'Experimental — not scored' : 'Advisory — not scored'}</span>` : ''}
```

Then, in the category header row that already prints the pass/warn/fail/na counts, append the advisory count when it is above zero, in the same style as the `na` count:

```ts
                    ${cat.counts.advisory > 0 ? `<span>•</span><span>${cat.counts.advisory} Advisory</span>` : ''}
```

- [ ] **Step 5: Fix the multi-line `found` collapse while you are here**

The merges ledger flagged `html-generator.ts:92`: a `found` string with newlines collapses to one line. The "What we found" block already renders with `whitespace-pre-line`; the `displayValue` line above it does not. Add `whitespace-pre-line` to the `displayValue` div so a multi-line `found` reads as written.

- [ ] **Step 6: Run the tests**

Run: `pnpm test packages/report/src/`
Expected: PASS.

- [ ] **Step 7: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
git add -A
git commit -m "feat(report): badge advisory and experimental checks in the HTML report

An informative check carries weight 0 and moves no score, but it rendered
exactly like a scored one, so a deliberate advisory read as a defect. The tier
now reaches the view model, each non-scored check carries a badge naming why it
is not scored, and each category header counts its advisories. Also stops a
multi-line found value from collapsing onto one line."
```

---

### Task 6: tier markers in the terminal

**Files:**
- Modify: `packages/cli/src/main.ts` (the category check listing and the debug listing)
- Test: `packages/cli/src/progress-renderer.test.ts` is unrelated; add `packages/cli/src/tier-marker.test.ts`

**Interfaces:**
- Consumes: `CheckView.tier` from Task 5.
- Produces: `export function tierMarker(tier?: AuditTier): string` in `packages/cli/src/main.ts`, returning `' \x1b[36m(advisory)\x1b[0m'`, `' \x1b[36m(experimental)\x1b[0m'` or `''`.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/tier-marker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tierMarker } from './main';

describe('tierMarker', () => {
  it('marks an informative check as advisory', () => {
    expect(tierMarker('informative')).toContain('(advisory)');
  });

  it('marks an experimental check', () => {
    expect(tierMarker('experimental')).toContain('(experimental)');
  });

  it('says nothing for a scored check or an unknown tier', () => {
    expect(tierMarker('scored')).toBe('');
    expect(tierMarker(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test packages/cli/src/tier-marker.test.ts`
Expected: FAIL — `tierMarker` is not exported.

- [ ] **Step 3: Implement and use it**

Add the function near the other formatting helpers in `main.ts`, exported so the test can reach it:

```ts
/**
 * A check with a non-scored tier is reported but never scored. Without a marker
 * a failing advisory reads as a defect the operator has to fix.
 */
export function tierMarker(tier?: AuditTier): string {
  if (tier === 'informative') return ' \x1b[36m(advisory)\x1b[0m';
  if (tier === 'experimental') return ' \x1b[36m(experimental)\x1b[0m';
  return '';
}
```

Append `${tierMarker(check.tier)}` to the per-check title line in the audit-debugger output (the line that prints `[${check.id}] ${check.title}`), and to any per-check line in the top-fails listing.

- [ ] **Step 4: Run the test and the CLI suite**

Run: `pnpm test packages/cli/`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
git add -A
git commit -m "feat(cli): mark advisory and experimental checks in terminal output

A non-scored check printed exactly like a scored one, so a failing advisory read
as work the operator owes. Each now carries its tier inline."
```

---

### Task 7: tier in the markdown summary, pinned in JSON

**Files:**
- Modify: `packages/report/src/markdown-generator.ts`
- Test: `packages/report/src/markdown-generator.test.ts` (create), `packages/core/src/orchestrator.test.ts` (one added assertion)

**Interfaces:**
- Consumes: `CategoryView.counts.advisory` from Task 5.

- [ ] **Step 1: Write the failing tests**

Create `packages/report/src/markdown-generator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateMarkdownSummary } from './markdown-generator';

describe('generateMarkdownSummary', () => {
  it('states how many checks were advisory', () => {
    const md = generateMarkdownSummary(reportWithAdvisory());
    expect(md).toContain('1 advisory check');
  });

  it('says nothing about advisories when there are none', () => {
    const md = generateMarkdownSummary(reportWithoutAdvisory());
    expect(md).not.toContain('advisory');
  });
});
```

Build `reportWithAdvisory` / `reportWithoutAdvisory` from the same fixture shape `view-model.test.ts` uses; import that helper rather than duplicating it if it is exported, otherwise write the two fixtures inline in this file.

In `packages/core/src/orchestrator.test.ts`, add one assertion to the existing full-scan case:

```ts
  it('stamps the evidence tier on every check in the report', async () => {
    const report = await runScan(TEST_URL);
    const all = report.categories.flatMap((c) => c.checks);
    expect(all.every((c) => c.tier === 'scored' || c.tier === 'informative' || c.tier === 'experimental')).toBe(true);
  });
```

Use whatever offline scan helper that file already uses; do not add a network call.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test packages/report/src/markdown-generator.test.ts`
Expected: FAIL — module has no advisory line.

- [ ] **Step 3: Add the line**

In `generateMarkdownSummary`, after the category table, add:

```ts
  const advisory = view.groups
    .flatMap((g) => g.categories)
    .reduce((sum, cat) => sum + cat.counts.advisory, 0);

  const advisoryLine = advisory > 0
    ? `\n> ${advisory} advisory check${advisory === 1 ? '' : 's'} ran and are reported above without affecting the score.\n`
    : '';
```

and interpolate `advisoryLine` after the table in the returned template.

- [ ] **Step 4: Run the tests**

Run: `pnpm test packages/report/ && pnpm test packages/core/src/orchestrator.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
git add -A
git commit -m "feat(report): name advisory checks in the markdown summary

A PR comment showed category scores with no hint that some checks are advisory,
so a reviewer could not tell why a reported failure moved nothing. Adds one line
naming the count, and pins that every check in a scan report carries its tier."
```

---

## Group C — the two dead CLI flags

### Task 8: `--categories` actually filters

**Files:**
- Modify: `packages/core/src/audit-config.ts` (add `filterConfig`)
- Modify: `packages/core/src/orchestrator.ts:30-34` (`ScanOptions`) and `:371-381`
- Modify: `packages/cli/src/main.ts` (parse the flag, validate, pass it through)
- Test: `packages/core/src/audit-config.test.ts` (create if absent), `packages/core/src/orchestrator.test.ts`

**Interfaces:**
- Produces:
  - `export function filterConfig(config: ScanConfig, opts: { categories?: string[]; includeExperimental?: boolean }): ScanConfig`
  - `ScanOptions.categories?: string[]`
  - `export const CATEGORY_IDS: readonly string[]` — the 8 ids, for CLI validation.

`--categories <list>` has been in the CLI help since v1 and has never been parsed.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { defaultConfig, filterConfig, CATEGORY_IDS } from './audit-config';

describe('filterConfig', () => {
  it('keeps only the named categories', () => {
    const filtered = filterConfig(defaultConfig, { categories: ['machine-discovery'] });
    expect(filtered.categories.map((c) => c.id)).toEqual(['machine-discovery']);
    expect(Object.keys(filtered.audits)).toEqual(['machine-discovery']);
  });

  it('returns the config untouched when no filter is given', () => {
    expect(filterConfig(defaultConfig, {})).toBe(defaultConfig);
  });

  it('exposes exactly the 8 v2 category ids', () => {
    expect([...CATEGORY_IDS].sort()).toEqual([
      'access-crawl-control',
      'agent-interfaces',
      'agentic-commerce',
      'answer-readiness',
      'content-extraction',
      'machine-discovery',
      'operability-safety',
      'structured-data',
    ]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test packages/core/src/audit-config.test.ts`
Expected: FAIL — `filterConfig` and `CATEGORY_IDS` are not exported.

- [ ] **Step 3: Implement in `audit-config.ts`**

```ts
/** Every registered category id, in report order. */
export const CATEGORY_IDS: readonly string[] = CATEGORY_AUDITS.map(([id]) => id);

/**
 * Narrow a scan to a subset of the registry.
 *
 * Returns the same object when there is nothing to filter, so the common path
 * allocates nothing and identity comparisons in tests stay meaningful.
 */
export function filterConfig(
  config: ScanConfig,
  opts: { categories?: string[]; includeExperimental?: boolean },
): ScanConfig {
  const wanted = opts.categories && opts.categories.length > 0 ? new Set(opts.categories) : undefined;
  if (!wanted && opts.includeExperimental !== false) return config;

  const categories = config.categories.filter((cat) => !wanted || wanted.has(cat.id));
  const audits = Object.fromEntries(
    categories.map((cat) => [
      cat.id,
      (config.audits[cat.id] ?? []).filter(
        (reg) => opts.includeExperimental === true || reg.meta.tier !== 'experimental',
      ),
    ]),
  );
  return { categories, audits };
}
```

- [ ] **Step 4: Call it from the orchestrator**

`ScanOptions` gains:

```ts
  /** Restrict the scan to these category ids. Unknown ids are the caller's problem — validate before calling. */
  categories?: string[];
  /** Include audits whose tier is 'experimental'. Off by default. */
  includeExperimental?: boolean;
```

and the two `defaultConfig` uses at `orchestrator.ts:371` and `:380` become one local:

```ts
  const config = filterConfig(defaultConfig, {
    categories: options?.categories,
    includeExperimental: options?.includeExperimental ?? false,
  });
  const auditPlan = planAudits(ctx, config);
```

- [ ] **Step 5: Pin it at the orchestrator level**

In `orchestrator.test.ts`, beside the existing category-count case:

```ts
  it('scans only the requested categories', async () => {
    const report = await runScan(TEST_URL, { categories: ['machine-discovery'] });
    expect(report.categories.map((c) => c.id)).toEqual(['machine-discovery']);
  });
```

- [ ] **Step 6: Parse the flag in the CLI**

In `packages/cli/src/main.ts`, beside the other `getArgValue` calls:

```ts
  const categoriesArg = getArgValue("", "--categories");
  const categories = categoriesArg
    ? categoriesArg.split(",").map((c) => c.trim()).filter(Boolean)
    : undefined;
  const unknownCategories = (categories ?? []).filter((c) => !CATEGORY_IDS.includes(c));
  if (unknownCategories.length > 0) {
    console.error(
      `\x1b[31mUnknown category: ${unknownCategories.join(", ")}\x1b[0m\nValid categories: ${CATEGORY_IDS.join(", ")}`,
    );
    process.exit(1);
  }
```

and pass `categories` into the `runScan` options object.

- [ ] **Step 7: Verify end to end**

```bash
pnpm --filter @forkpoint/agent-lighthouse-core build
pnpm --filter @forkpoint/agent-lighthouse build
node packages/cli/dist/main.js https://example.com --categories machine-discovery --output json --output-dir /tmp/al-cat
node packages/cli/dist/main.js https://example.com --categories nonsense
```

Expected: the first writes a report containing one category; the second exits 1 with `Unknown category: nonsense` and the valid list.

- [ ] **Step 8: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
git add -A
git commit -m "feat(cli): wire --categories to the registry

The flag has been in the help text since v1 and was never parsed, so a scan
narrowed to one category silently ran all of them. filterConfig now narrows the
config the orchestrator plans from, and an unknown id exits 1 naming the valid
ones instead of being ignored."
```

---

### Task 9: `--experimental` opts in to the experimental tier

**Files:**
- Modify: `packages/cli/src/main.ts` (flag + help text)
- Test: `packages/core/src/audit-config.test.ts`

**Interfaces:**
- Consumes: `filterConfig` and `ScanOptions.includeExperimental` from Task 8.

The registry has no experimental audit today; the tier exists in `AuditTier` and Plan 5b will land the first ones. The gate has to exist before they do, or their first release scores sites on unvalidated checks.

- [ ] **Step 1: Write the failing test**

```ts
it('excludes experimental audits by default and includes them on request', () => {
  const experimental = { meta: { ...SOME_META, id: 'machine-discovery/probe-x', tier: 'experimental', weight: 0 } };
  const withExperimental: ScanConfig = {
    categories: [{ id: 'machine-discovery', name: 'Machine Discovery', weight: 4 }],
    audits: { 'machine-discovery': [...(defaultConfig.audits['machine-discovery'] ?? []), experimental as AuditRegistration] },
  };
  const off = filterConfig(withExperimental, { includeExperimental: false });
  const on = filterConfig(withExperimental, { includeExperimental: true });
  const ids = (c: ScanConfig) => c.audits['machine-discovery']!.map((r) => r.meta.id);
  expect(ids(off)).not.toContain('machine-discovery/probe-x');
  expect(ids(on)).toContain('machine-discovery/probe-x');
});
```

`SOME_META` is any registered audit's meta, read via `defaultConfig`; clone it rather than writing a full literal.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test packages/core/src/audit-config.test.ts`
Expected: FAIL until Task 8's `filterConfig` handles `includeExperimental: false` with no `categories` filter — which is exactly the branch the early return must not swallow. Fix the early return if it does.

- [ ] **Step 3: Add the flag**

In `main.ts`:

```ts
  const includeExperimental = args.includes("--experimental");
```

pass it into `runScan` options, and add one line to the usage block next to `--categories`:

```
  --experimental               Include experimental-tier audits (excluded by default; they do not affect scores)
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter @forkpoint/agent-lighthouse build
node packages/cli/dist/main.js --help | grep experimental
```

Expected: the line is printed.

- [ ] **Step 5: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
git add -A
git commit -m "feat(cli): add --experimental to opt in to experimental-tier audits

The experimental tier exists in AuditTier and Plan 5b lands the first audits
that use it. Without a gate their first release would run unvalidated checks on
every scan. They are excluded unless the flag is passed, and they carry weight 0
either way."
```

---

## Group D — the website

### Task 10: regenerate the audit explorer

**Files:**
- Modify: `scripts/build-docs-data.ts`
- Regenerate: `packages/website/audits-data.json`
- Modify: `packages/website/index.html` (the audit-count copy, the category list, the explorer's badge and filter)
- Test: `scripts/build-docs-data.test.ts` (create)

**Interfaces:**
- Produces: each record in `audits-data.json` gains `tier`, `evidenceGrade` and `dossier`.

`audits-data.json` is v1-era: 207 records with numeric ids (`"1.1"`) and dead category names. `index.html:335` still advertises 207 audits. The page fetches the JSON at runtime, so regenerating the file is most of the work.

- [ ] **Step 1: Write the failing test**

Create `scripts/build-docs-data.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildAuditList } from './build-docs-data';

describe('buildAuditList', () => {
  it('emits one record per registered audit, with the v2 fields', () => {
    const list = buildAuditList();
    expect(list).toHaveLength(172);
    expect(list.every((a) => /^[a-z-]+\/[a-z0-9-]+$/.test(a.id))).toBe(true);
    expect(list.every((a) => a.tier === 'scored' || a.tier === 'informative' || a.tier === 'experimental')).toBe(true);
    expect(list.every((a) => a.dossier?.startsWith('docs/evidence/audits/'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test scripts/build-docs-data.test.ts`
Expected: FAIL — the script has no exported function; it runs at import time.

- [ ] **Step 3: Split the script into a function plus a main**

Refactor `scripts/build-docs-data.ts` so the loop that builds `auditList` becomes `export function buildAuditList()`, returning the sorted array, and the file write happens only when the module is run directly. Add the three new fields inside the record:

```ts
      tier: meta.tier,
      evidenceGrade: meta.evidenceGrade,
      dossier: meta.dossier,
```

Drop the `any[]` annotation in favour of an explicit `AuditDoc` interface declared in the same file — `any` hides exactly the drift this test exists to catch.

- [ ] **Step 4: Run the test, then regenerate**

```bash
pnpm test scripts/build-docs-data.test.ts
npx tsx scripts/build-docs-data.ts
```

Expected: PASS, then `Extracted metadata for 172 audits`.

- [ ] **Step 5: Fix the static copy in `index.html`**

- Line 335: `Explore all 207 audits` → `Explore all 172 audits`.
- Search the file for every other three-digit audit count and for v1 category names (`content-discoverability`, `answer-engine`, `technical-readiness`, `agent-tools`, `generative-engine`) and replace them with the 8 v2 category names as rendered by `CATEGORY_NAMES`.
- In the explorer card template, add a badge beside the audit id, mirroring the report:

```html
<span class="tier-badge" data-tier="${a.tier}">${a.tier === 'scored' ? `Grade ${a.evidenceGrade}` : a.tier === 'experimental' ? 'Experimental' : 'Advisory'}</span>
```

- Add a tier filter next to the existing category filter, with options `All`, `Scored`, `Advisory`, `Experimental`, filtering on the same `tier` field.

- [ ] **Step 6: Verify the page against the data**

```bash
python3 -m http.server 8899 --directory packages/website
```

Open `http://localhost:8899/`, confirm the explorer lists 172 audits, the badge renders, and the tier filter narrows the list. Stop the server.

- [ ] **Step 7: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
git add -A
git commit -m "chore(website): regenerate the audit explorer for the v2 registry

audits-data.json still carried the 207 v1 records with numeric ids and dead
category names, and the page advertised 207 audits. The generator now emits
tier, evidenceGrade and dossier, is unit-tested against the live registry, and
the explorer badges and filters by tier so an advisory check is not read as a
scored one."
```

---

## Group E — the triaged backlog

### Task 11: robots and description messages that misdescribe what happened

**Files:**
- Modify: `packages/core/src/audits/access-crawl-control/ai-bot-directives.ts`
- Modify: `packages/core/src/audits/answer-readiness/meta-description.ts:97-110`
- Test: the matching `.test.ts` beside each

Three ledger lines, all of them text a user reads and acts on.

- [ ] **Step 1: Write the failing tests**

In `ai-bot-directives.test.ts`:

```ts
it('does not claim wildcard-only access when robots.txt has no wildcard group', async () => {
  const result = await runWithRobots('User-agent: GPTBot\nAllow: /\n');
  expect(result.message).not.toContain('allowed only through the wildcard rule');
});

it('uses a title that fits the warn path', async () => {
  const result = await runWithRobots(ROBOTS_THAT_WARNS);
  const check = new AiBotDirectivesAudit().toCheckResult(result);
  expect(check.title).not.toBe('A documented AI bot is blocked in robots.txt');
});

it('pins the priority on the fail path', async () => {
  const result = await runWithRobots('User-agent: GPTBot\nDisallow: /\n');
  expect(result.status).toBe('fail');
  expect(result.priority).toBe('medium');
});
```

Reuse the file's existing `runWithRobots` helper and pick `ROBOTS_THAT_WARNS` from a fixture already in the file that produces a warn.

In `meta-description.test.ts`:

```ts
it('does not warn about relevance when the page subject is only the brand name', async () => {
  const result = await run(
    '<title>Acme</title>',
    '<meta name="description" content="Refurbished espresso machines shipped within two days.">',
  );
  expect(result.status).not.toBe('warn');
});
```

Match the file's existing helper signature; if it takes full HTML, pass full HTML.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test packages/core/src/audits/access-crawl-control/ai-bot-directives.test.ts packages/core/src/audits/answer-readiness/meta-description.test.ts`
Expected: FAIL on all four.

- [ ] **Step 3: Fix the wildcard claim**

At `ai-bot-directives.ts:166` the warn reads `"… are allowed only through the wildcard rule — no explicit directive."`. It fires whether or not a wildcard group exists. Branch on the parsed groups: when there is no `User-agent: *` group, say `"… have no directive of any kind in robots.txt, so they are allowed by default."`.

- [ ] **Step 4: Fix the title on the warn path**

`meta.failureTitle` is `'A documented AI bot is blocked in robots.txt'`, and `toCheckResult` uses `failureTitle` for every non-pass status, so a warn about wildcard-only access renders under a blocked-bot headline. Give the audit a `title`/`failureTitle` pair that is true on both non-pass paths — `'AI crawler directives'` for the title and `'AI crawler directives need attention'` for the failure title — and move the specific claim into the message, where it is already conditioned correctly.

- [ ] **Step 5: Fix the brand-only relevance check**

In `meta-description.ts`, guard the relevance branch:

```ts
      const subject = pageSubject(page);
      const subjectTerms = subject ? contentTerms(subject) : new Set<string>();
      // A brand-only title ("Acme") yields one term, and an accurate
      // description that never repeats the brand shares nothing with it. That
      // is not an irrelevant description, it is a thin subject — so the check
      // needs at least two terms to have something to compare against.
      if (subjectTerms.size >= 2) {
```

Keep the rest of the branch as it is.

- [ ] **Step 6: Run the tests**

Run: `pnpm test packages/core/src/audits/access-crawl-control/ packages/core/src/audits/answer-readiness/`
Expected: PASS. `_robots-consumers.differential.test.ts` pins the old wildcard sentence at line 566 — update that snapshot deliberately and note it in the commit body.

- [ ] **Step 7: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
pnpm --filter @forkpoint/agent-lighthouse-core build && node scripts/check-dossiers.mjs
git add -A
git commit -m "fix(core): three audit messages that described the wrong situation

ai-bot-directives claimed wildcard-only access on sites with no wildcard group,
and rendered every non-pass under a 'bot is blocked' headline. meta-description
warned that an accurate description was irrelevant whenever the title was just
the brand name. Also pins the priority on the ai-bot-directives fail path, and
updates the differential snapshot for the corrected sentence."
```

---

### Task 12: audit-behavior fixes

**Files:** one commit, each item its own test.

| # | File | Locate by | Current behavior | Required behavior |
| :-- | :-- | :-- | :-- | :-- |
| 1 | `operability-safety/security-header-hygiene.ts` | `const enforced = header ?? meta;` | An empty `Content-Security-Policy` header shadows a valid `<meta http-equiv>` policy, because `??` only falls through on null/undefined | Use `||` so an empty header falls through to the meta policy; `source` already branches on truthiness |
| 2 | `machine-discovery/ai-file-delivery.ts:47-59` | `function cachingState` | `no-store` plus an `ETag` returns `'validator'`, so a file that must not be cached is not counted as uncached | When a `no-store` or `no-cache` directive is present, return `'none'` regardless of validators |
| 3 | `machine-discovery/discovery-index-coverage.ts:37` | `decodeURI(url.pathname)` | A path with a malformed `%` escape throws, the `catch` returns the empty key, and the page is permanently "uncovered" | Wrap only the `decodeURI` call and fall back to the raw `url.pathname` |
| 4 | `machine-discovery/rss-feed.ts:12-17,36` | `FEED_TYPES` | The same feed URL linked from N pages is fetched N times | Deduplicate `found` by URL before fetching; keep the first `pageUrl` |
| 5 | `access-crawl-control/ai-content-declaration.ts:88` | `page.meta[INVENTED_NAME] !== undefined` | A valueless `<meta name="…">` may never reach `page.meta`, so the invented-name check misses it | Read the DOM: `page.$(\`meta[name="${INVENTED_NAME}"]\`).length > 0` |
| 6 | `agent-interfaces/cors-api-routes.ts:273` | `no Access-Control-Allow-Origin on any` | Says no endpoint answered with the header even when some probes were refused or unreachable, overstating the finding | Count refused/unreachable probes separately and name them: `N of M endpoint(s) answered, none with Access-Control-Allow-Origin; K unreachable` |
| 7 | `agent-interfaces/openapi-operation-ids.ts:150` | the duplicate-id push | One illegal id that appears twice is reported twice | Deduplicate the reported ids before building the message |
| 8 | `structured-data/review-signals.ts` (locate with `rg -l review-signals packages/core/src/audits`) | `"review"` truthiness | `"review": []` counts as strong social proof, and a `ratingCount`-only node is labelled `reviewCount` in `found` | An empty array is not social proof; label the field by the key that was actually present |
| 9 | `operability-safety/trust-signals.ts` | the social-proof regex | Matches carousel counters such as `1 / 5` as review counts | Require a digit group of at least two digits or an explicit review word adjacent |

- [ ] **Step 1: Write nine failing tests**

One `it` per row, in the test file beside each audit, each asserting the required behavior in the table. Follow each file's existing fixture helpers. Example for row 2:

```ts
it('counts a no-store file as uncached even when it carries an ETag', async () => {
  const result = await runWithFile('/llms.txt', {
    'cache-control': 'no-store',
    etag: '"abc"',
  });
  expect(result.message).toContain('llms.txt');
  expect(result.status).not.toBe('pass');
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test packages/core/src/audits/`
Expected: nine failures, one per row.

- [ ] **Step 3: Apply the nine fixes**

Each is a one- to five-line change described in the table. Read the surrounding function before editing; keep the existing message voice.

- [ ] **Step 4: Run the whole audit suite**

Run: `pnpm test packages/core/src/audits/`
Expected: PASS. Any differential snapshot that pinned an old message is updated deliberately.

- [ ] **Step 5: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
pnpm --filter @forkpoint/agent-lighthouse-core build && node scripts/check-dossiers.mjs
git add -A
git commit -m "fix(core): nine audit-behavior defects from the Plan 3 and Plan 4 ledgers

An empty CSP header no longer shadows a meta policy; a no-store file counts as
uncached whatever validators it carries; a malformed percent escape no longer
makes a page permanently uncovered; a feed linked from many pages is fetched
once; a valueless meta tag is detected in the DOM; the CORS finding no longer
overstates when probes were unreachable; a duplicated illegal operationId is
reported once; an empty review array is not social proof; and a carousel counter
is not a review count."
```

---

### Task 13: tests that pass when they should not

**Files:**
- Modify: `packages/core/src/migration-map.test.ts:110-160`
- Modify: `packages/core/src/tests/v2-meta.test.ts:91`
- Modify: `packages/core/src/__tests__/verify-scan-results.test.ts:97`
- Modify: `packages/core/src/audits/access-crawl-control/_robots-consumers.differential.test.ts`
- Modify: `packages/report/src/view-model.test.ts`

| # | Test | Weakness | Fix |
| :-- | :-- | :-- | :-- |
| 1 | `migration-map.test.ts` | Compares the *set* of shared merge targets, so a sixth accidental row pointing at an existing target passes silently | Compare fold sizes: build `Map<target, count>` and assert the exact counts |
| 2 | `migration-map.test.ts` | Dead `'merging'` tolerance for a status the map no longer contains | Assert no entry has status `merging` or `interim`, and delete the tolerance branch |
| 3 | `v2-meta.test.ts:91` | Tautological length assertion, and no upper-bound rejection case | Assert every id is at most 64 characters, and add a case proving a 65-character id is rejected by the schema |
| 4 | `verify-scan-results.test.ts:97` | The live-network describe runs unguarded, so an offline machine fails the suite for the wrong reason | Wrap it in `describe.skipIf(process.env.AL_SKIP_NETWORK === '1')` and document the variable in the file header |
| 5 | `_robots-consumers.differential.test.ts` | Pins status/score/message/found but not `details` or `priority`, so a priority regression passes | Add both fields to the pinned shape |
| 6 | `view-model.test.ts` | Fixture uses weight 0.15 for `machine-discovery` where the real mass is 0.18, so the fixture cannot catch a mass drift | Derive the fixture weight from `CATEGORY_MASS` instead of hard-coding it |

- [ ] **Step 1: Apply each fix and watch it fail first**

For rows 1, 3 and 5, first make the test stronger and run it — it must fail against a deliberately broken input you construct in the same run (add the sixth row, the 65-character id, the changed priority), then pass once you revert the break. Record in the commit body that you verified each strengthened assertion actually bites.

- [ ] **Step 2: Run the suites**

Run: `pnpm test packages/core/ packages/report/`
Expected: PASS.

- [ ] **Step 3: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
git add -A
git commit -m "test(core): strengthen six assertions that passed when they should not

The migration map compared a set where it needed fold sizes and still tolerated
a dead status; the id-length case asserted nothing and never tried a 65-char id;
the live-network describe ran unguarded; the robots differential ignored details
and priority; and the view-model fixture hard-coded a category mass that has
since changed. Each strengthened assertion was verified to fail against a
deliberately broken input before being committed."
```

---

### Task 14: documentation sweep

**Files:** documentation and comments only. No behavior change, one commit.

| # | File | Change |
| :-- | :-- | :-- |
| 1 | `docs/evidence/audits/README.md:7` | "columns are v1 identity" is false for the 24 v2-native rows — say so |
| 2 | `docs/evidence/audits/README.md:87` | Link text `fast-page-load` is a dead slug |
| 3 | `packages/mcp/README.md:22` | Three sunset category names |
| 4 | `docs/evidence/v2-audit-map.md:360` | "189 registered audits" → 172, with the v2 framing |
| 5 | `MIGRATION.md:94-100` | Quotes a 1.2 row as a "merging" example with a dead dossier path |
| 6 | `MIGRATION.md:108` | Claims merging `to` ids do not exist yet; 20 of 23 are registered |
| 7 | `README.md:65` and `docs/evidence/audits/README.md` | Index prose not updated for the Plan 4 merges |
| 8 | `packages/core/src/audit-config.ts:61` | "Order is canonical report order" — `sections.ts` owns order now |
| 9 | `packages/core/src/presets.ts:53` | "all 10 audit categories" → 8 |
| 10 | `packages/core/src/audits/access-crawl-control/index.ts:7,30` | Stale class names in comments |
| 11 | `packages/core/src/audits/*/`(several) | TODO comments naming pre-rename paths: `server-responsiveness.ts:1`, `in-content-links.ts`, `openapi-link.ts:5`, `proposed/competitor-gap-verify/offer-dom-price-parity.ts:14` |
| 12 | `packages/core/src/scorer.test.ts:192,225` | Stale formula comments |
| 13 | `REWORK-TODO.md:30,38` | "pending — 14" is false; dangling link to a sunset dossier |
| 14 | `docs/evidence/audits/robots-directives.md:112` | "168 → 167" — the fold removed two |
| 15 | renamed dossiers across Plan 3 Tasks 3-6 | Body H1/subtitle still name the v1 slug — fix each to its v2 title |

- [ ] **Step 1: Apply every row**

Read each site before editing. These are prose fixes: keep each file's voice, change only what the row names.

- [ ] **Step 2: Verify nothing executable moved**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
pnpm --filter @forkpoint/agent-lighthouse-core build && node scripts/check-dossiers.mjs
git diff --stat HEAD
```

Expected: all gates green, `check-dossiers` still 172, and the diff touches only `.md` files and comment lines.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: clear the v2 documentation backlog from both ledgers

Fifteen stale claims left by the taxonomy and merge waves: dead slugs in link
text, sunset category names, pre-rename paths in TODO comments, counts that
predate the folds, and dossier headings still carrying their v1 titles. No
executable change."
```

---

### Task 15: close the plan

**Files:**
- Modify: `docs/superpowers/HANDOFF-v2.md`
- Create: `.changeset/v2-polish-backlog.md`
- Modify: `.superpowers/sdd/2026-08-21-v2-taxonomy/progress.md`, `.superpowers/sdd/2026-08-22-v2-merges-rewrites/progress.md`

- [ ] **Step 1: Run every gate one final time**

```bash
pnpm test
pnpm typecheck
rtk err pnpm lint
pnpm --filter @forkpoint/agent-lighthouse-core build && node scripts/check-dossiers.mjs
npx changeset status
```

Expected: full suite green; `172 audits OK … no orphans`; changeset status without error.

- [ ] **Step 2: Mark the ledgers**

At the end of each ledger, append one line: `Plan 6 (2026-08-23) cleared the deferred-minor backlog; the items it deliberately left are listed under "Triage record" in docs/superpowers/plans/2026-08-23-v2-polish-backlog.md.` Do not delete the ledger lines — they are the record of what was found.

- [ ] **Step 3: Update the handoff**

Move Plan 6 into the "Executed plans" table with this plan's path. In "Remaining scope", delete the Plan 6 section, leaving Plan 5b and the endgame. Update the gate line with the final test count.

- [ ] **Step 4: Write the changeset**

Create `.changeset/v2-polish-backlog.md`:

```markdown
---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": patch
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

v2 polish wave: engine fixes, tier surfacing, two live CLI flags.

**Scoring change.** A category where every check is notApplicable now leaves the
overall denominator. A site with no commerce surface is no longer scored down
for having no checkout, so narrow sites score higher than they did on the same
registry. That is the intended correction.

**Security fix.** `isSafeUrl` now gates every hop of a redirect chain, not just
the URL the caller passed — a site could previously redirect the scanner into
link-local or RFC 1918 space. `FetchResult.finalUrl` is now the URL that
actually answered.

**Fixed:** `AuditResult.details` no longer silently drops unknown keys, so an
audit's structured evidence reaches the report; `fail()` and `warn()` no longer
discard a per-result fix snippet in favour of the generic one.

**New:** advisory and experimental checks are badged in the HTML report, marked
in terminal output, counted in the markdown summary and filterable in the audit
explorer, so a weight-0 check no longer reads as a defect. `--categories <list>`
finally filters the registry and rejects unknown ids; `--experimental` opts in
to experimental-tier audits, which are excluded by default.

Also: nine audit-behavior defects, six strengthened tests, and the website
audit explorer regenerated from the live 172-audit registry.
```

- [ ] **Step 5: Commit and report**

```bash
git add -A
git commit -m "chore: close Plan 6 — v2 polish and backlog

Ledgers marked, handoff updated, changeset written."
```

Report to the user: the final `check-dossiers` line, the `pnpm test` counts, the scoring-law change and its effect on scores, and the triage record's list of what was deliberately not fixed. **Do not push** — the controller pushes after approval.

---

## Self-review

**Spec coverage.** Tier badges → Tasks 5, 6, 7, 10. `--experimental` → Task 9. Website regeneration → Task 10. Deferred-minor backlog → Tasks 11–14, with the triage record naming every exclusion. Latent bugs → Tasks 1, 2, 3; the fourth (repeated response headers) was already fixed in `fetcher.ts:189-193` during Plan 3/4 and needs no task — verified before this plan was written. All-na category mass → Task 4. `--categories` → Task 8.

**Type consistency.** `filterConfig(config, { categories, includeExperimental })` is defined in Task 8 and reused unchanged in Task 9. `CheckView.tier` is added in Task 5 and consumed in Tasks 6 and 7. `tierMarker(tier?: AuditTier)` is defined and used only in Task 6. `buildAuditList()` is defined and used only in Task 10. `CATEGORY_IDS` is defined in Task 8 and consumed by the CLI in the same task.

**Ordering.** Group A must land before Group B (Task 5's badge reads a field Group A does not change, but Task 4 changes scores that Task 5's fixtures assert). Task 8 must land before Task 9 — Task 9's test calls `filterConfig`.
