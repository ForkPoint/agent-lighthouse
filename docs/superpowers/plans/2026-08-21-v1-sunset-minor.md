# v1 Sunset Minor Implementation Plan (Plan 2 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the final v1 minor release: the 18 sunset audits keep running but become informative (weight 0, excluded from every score and recommendation) and carry a public deprecation notice linking to NOT-A-FACTOR.md; a machine-readable migration map ships with the package.

**Architecture:** Additive meta field `deprecated` on `AuditMeta`/`CheckResult`, flowed through `toCheckResult`. Scoring exclusion keyed on the existing `scoreDisplayMode: 'informative'` (the 18 audits flip to it), applied in `calculateCategoryScore`, recommendations, topPasses. The HTML report renders a deprecation badge + notice. `migration-map.json` ships in the npm package.

**Tech Stack:** TypeScript, zod, vitest, changesets. Branch `feat/v1-sunset-minor` off `main` (v1 code — do NOT use v2 gatherer APIs; they exist only on `feat/v2-engine`).

**Spec:** `docs/superpowers/specs/2026-08-21-audit-restructure-design.md` §2 (graceful sunset), §4 tier table row "Deprecated", §9 step 2. Public rationale: `docs/evidence/NOT-A-FACTOR.md`.

## Global Constraints

- Run tests from REPO ROOT: `pnpm test <path>` for one file, plain `pnpm test` for the suite. Never `pnpm --filter ... test -- run <path>` (broken repo-wide).
- Typecheck with `pnpm typecheck`. NEVER run `npx tsc -b` (writes stale .js artifacts beside sources and corrupts the vitest run).
- Lint with `rtk err pnpm lint`. Never bare `pnpm lint`, never eslint anything.
- All code comments in English.
- This is a MINOR release: no breaking API changes. Only additive fields and score-exclusion behavior.
- The deprecation link base is `https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md` + per-audit anchor (given in Task 4's table).
- Commit after each task with the message given in the task.

---

### Task 1: `DeprecationNotice` type, schema, and result flow-through

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/schemas.ts`
- Modify: `packages/core/src/audit.ts` (method `toCheckResult`)
- Modify: `packages/core/src/audit-runner.ts` (function `stubCheck`)
- Test: `packages/core/src/deprecation.test.ts` (new)

**Interfaces:**
- Produces: `export interface DeprecationNotice { notice: string; link: string }` in types.ts; optional `deprecated?: DeprecationNotice` on both `AuditMeta` and `CheckResult`; `DeprecationNoticeSchema` in schemas.ts. Task 4 sets `deprecated` on 18 audit metas; Task 5 reads `check.deprecated` in the report.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/deprecation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Audit } from './audit';
import type { AuditMeta, AuditResult } from './types';
import { AuditMetaSchema } from './schemas';

const NOTICE = {
  notice: 'No consumer reads this signal.',
  link: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md#accessibilityskip-nav',
};

class DeprecatedAudit extends Audit {
  static override meta: AuditMeta = {
    id: '99.1',
    category: 'accessibility',
    title: 'Deprecated thing',
    failureTitle: 'Deprecated thing',
    description: 'Test audit.',
    scoreDisplayMode: 'informative',
    weight: 0,
    defaultPriority: 'low',
    deprecated: NOTICE,
  };
  audit(): AuditResult {
    return { status: 'pass', score: 1 };
  }
}

describe('deprecation notice flow', () => {
  it('AuditMetaSchema accepts a deprecated block and weight 0', () => {
    expect(() => AuditMetaSchema.parse(DeprecatedAudit.meta)).not.toThrow();
  });

  it('AuditMetaSchema rejects a deprecated block with an empty notice', () => {
    expect(() =>
      AuditMetaSchema.parse({
        ...DeprecatedAudit.meta,
        deprecated: { notice: '', link: NOTICE.link },
      }),
    ).toThrow();
  });

  it('AuditMetaSchema still rejects negative weight', () => {
    expect(() => AuditMetaSchema.parse({ ...DeprecatedAudit.meta, weight: -0.1 })).toThrow();
  });

  it('toCheckResult carries meta.deprecated onto the CheckResult', () => {
    const audit = new DeprecatedAudit();
    const check = audit.toCheckResult({ status: 'pass', score: 1 });
    expect(check.deprecated).toEqual(NOTICE);
  });

  it('toCheckResult leaves deprecated undefined for normal audits', () => {
    class NormalAudit extends DeprecatedAudit {
      static override meta: AuditMeta = {
        ...DeprecatedAudit.meta,
        id: '99.2',
        scoreDisplayMode: 'binary',
        weight: 1.0,
        deprecated: undefined,
      };
    }
    const check = new NormalAudit().toCheckResult({ status: 'pass', score: 1 });
    expect(check.deprecated).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/deprecation.test.ts`
Expected: FAIL — TypeScript/zod errors: `deprecated` not on `AuditMeta`, weight 0 rejected by `z.number().positive()`.

- [ ] **Step 3: Implement**

In `packages/core/src/types.ts`, directly above `export interface AuditMeta`:

```typescript
/** Public sunset notice for a deprecated audit (see docs/evidence/NOT-A-FACTOR.md). */
export interface DeprecationNotice {
  /** One sentence: why this signal is not a factor. */
  notice: string;
  /** Public rationale URL (NOT-A-FACTOR.md anchor). */
  link: string;
}
```

Add to `AuditMeta` (after `guidance?: AuditGuidance;`):

```typescript
  /** Present when the audit is sunset: shown as a notice, excluded from scores. */
  deprecated?: DeprecationNotice;
```

Add the same `deprecated?: DeprecationNotice;` to `CheckResult` (after `tags?: string[];`).

In `packages/core/src/schemas.ts`, above `AuditMetaSchema`:

```typescript
export const DeprecationNoticeSchema = z.object({
  notice: z.string().min(1).max(500),
  link: z.string().url(),
});
```

In `AuditMetaSchema`: change `weight: z.number().positive(),` to `weight: z.number().nonnegative(),` (deprecated audits carry weight 0) and add `deprecated: DeprecationNoticeSchema.optional(),` after `guidance`.

In `CheckResultSchema`: add `deprecated: DeprecationNoticeSchema.optional(),` after `tags`.

In `packages/core/src/audit.ts` `toCheckResult`, add to the returned object (next to `tags`/guidance fields):

```typescript
      deprecated: meta.deprecated,
```

In `packages/core/src/audit-runner.ts` `stubCheck`, add to the returned object:

```typescript
    deprecated: meta.deprecated,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/deprecation.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm typecheck` (must be clean), then:

```bash
git add packages/core/src/types.ts packages/core/src/schemas.ts packages/core/src/audit.ts packages/core/src/audit-runner.ts packages/core/src/deprecation.test.ts
git commit -m "feat(core): add DeprecationNotice meta carried onto check results"
```

---

### Task 2: Scorer excludes informative checks from category scores

**Files:**
- Modify: `packages/core/src/scorer.ts`
- Test: `packages/core/src/scorer.test.ts` (append)

**Interfaces:**
- Consumes: `CheckResult.scoreDisplayMode` (existing).
- Produces: `calculateCategoryScore` counts only checks with `status !== 'na'` AND `scoreDisplayMode !== 'informative'`. Task 4 relies on this to zero the 18 audits' score impact.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/scorer.test.ts` (reuse the file's existing CheckResult factory/helper if one exists — inspect the file first; otherwise build minimal `CheckResult` literals matching the existing test style):

```typescript
describe('informative checks are score-neutral', () => {
  it('adding an informative check never changes the category score', () => {
    const scored = [
      makeCheck({ status: 'pass', score: 1, scoreDisplayMode: 'binary' }),
      makeCheck({ status: 'fail', score: 0, scoreDisplayMode: 'binary' }),
    ];
    const before = calculateCategoryScore(scored);
    const withInformative = [
      ...scored,
      makeCheck({ status: 'fail', score: 0, scoreDisplayMode: 'informative' }),
      makeCheck({ status: 'pass', score: 1, scoreDisplayMode: 'informative' }),
    ];
    expect(calculateCategoryScore(withInformative)).toBe(before);
  });

  it('a category of only informative checks scores 0', () => {
    const only = [makeCheck({ status: 'pass', score: 1, scoreDisplayMode: 'informative' })];
    expect(calculateCategoryScore(only)).toBe(0);
  });
});
```

(`makeCheck` = whatever helper the existing scorer.test.ts uses to build a `CheckResult`; if it lacks one, add a local `function makeCheck(partial: Partial<CheckResult>): CheckResult` filling required fields with fixed dummies.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/scorer.test.ts`
Expected: FAIL — first test: informative fail (score 0) drags the mean down.

- [ ] **Step 3: Implement**

In `packages/core/src/scorer.ts` `calculateCategoryScore`, change the filter line:

```typescript
  // Not-applicable checks represent "nothing to assess"; informative checks
  // (deprecated / no proven consumer) are shown but never scored.
  const scored = checks.filter(
    (c) => c.status !== 'na' && c.scoreDisplayMode !== 'informative',
  );
```

(The rest of the function — `if (scored.length === 0) return 0;` and the mean — stays unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test packages/core/src/scorer.test.ts`
Expected: PASS, including all pre-existing scorer tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/scorer.ts packages/core/src/scorer.test.ts
git commit -m "feat(core): exclude informative checks from category scoring"
```

---

### Task 3: Exclude informative checks from recommendations and topPasses

**Files:**
- Modify: `packages/core/src/orchestrator.ts` (recommendations filter ~line 398; topPasses filter ~line 417)
- Test: `packages/core/src/orchestrator.test.ts` (append)

**Interfaces:**
- Consumes: `CheckResult.scoreDisplayMode`.
- Produces: `ScanReport.recommendations`, `topFails`, `topPasses` never contain informative checks. Task 4's audits therefore never appear as "top fixes" telling users to add a dead signal.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/orchestrator.test.ts`, following the file's existing pattern for building a scan/report fixture (inspect the file first; it already builds reports from stub audits — reuse that machinery):

```typescript
describe('informative checks stay out of recommendations and top lists', () => {
  it('a failing informative check is not recommended and not a top fail', async () => {
    // Build a report through the file's existing fixture path with at least
    // one failing check whose scoreDisplayMode is 'informative' and one
    // normal failing check.
    // Assert:
    // - report.recommendations.every((r) => /* the informative check's id */ r.id !== INFORMATIVE_ID)
    // - report.topFails.every((c) => c.id !== INFORMATIVE_ID)
    // - report.topPasses.every((c) => c.id !== INFORMATIVE_ID)
    // - the normal failing check IS present in recommendations.
  });
});
```

The implementer writes this concretely against the file's existing fixture helpers (the file already constructs `ScanReport`s in earlier tests — mirror the nearest existing test's setup; if `recommendations` entries carry no `id`, assert on the recommendation `description` not containing the informative audit's title instead).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/orchestrator.test.ts`
Expected: FAIL — informative failing check appears in recommendations.

- [ ] **Step 3: Implement**

In `packages/core/src/orchestrator.ts`, recommendations build:

```typescript
  const recommendations = allChecks
    .filter((c) => c.status !== 'pass' && c.scoreDisplayMode !== 'informative')
```

topPasses build:

```typescript
  const topPasses = allChecks
    .filter((c) => c.status === 'pass' && c.scoreDisplayMode !== 'informative')
```

(`topFails` derives from `recommendations` — no separate change.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test packages/core/src/orchestrator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/orchestrator.ts packages/core/src/orchestrator.test.ts
git commit -m "feat(core): keep informative checks out of recommendations and top lists"
```

---

### Task 4: Flip the 18 sunset audits to informative + deprecated

**Files:**
- Modify: the 18 audit sources listed below (each: `scoreDisplayMode` → `'informative'`, `weight` → `0`, add `deprecated` block after `defaultPriority`)
- Modify: their colocated `*.test.ts` files ONLY where a test asserts the old `scoreDisplayMode`/`weight` meta values (behavioral tests stay untouched — the audits still run)
- Test: `packages/core/src/audits/sunset.test.ts` (new)

**Interfaces:**
- Consumes: `DeprecationNotice` (Task 1), scoring exclusion (Tasks 2–3).

The 18 audits (path under `packages/core/src/audits/`, numeric id, notice sentence, anchor):

| Path | id | `notice` | anchor |
| :--- | :- | :--- | :--- |
| `accessibility/skip-nav.ts` | 7.1 | `Agents that read the accessibility tree receive the whole tree at once; nothing consumes a skip link, and the main landmark already marks the content boundary.` | `#accessibilityskip-nav` |
| `agent-tools/ai-plugin-json.ts` | 5.11 | `ChatGPT plugins — the only documented consumer of ai-plugin.json — were discontinued; OpenAI archived the format and removed its spec.` | `#agent-toolsai-plugin-json` |
| `agent-tools/data-action-ctas.ts` | 5.17 | `No vendor documents reading data-action attributes, and the attribute namespace collides with Stimulus/Hotwire semantics.` | `#agent-toolsdata-action-ctas` |
| `agent-tools/openapi-ai-instructions.ts` | 5.4 | `x-ai-instructions is not in the OpenAPI extensions registry and no consumer reads it.` | `#agent-toolsopenapi-ai-instructions` |
| `agent-tools/webmcp-action-coverage.ts` | 5.25 | `The WebMCP explainer rejected static manifests by name; WebMCP is client-side-only, so a static coverage manifest is unreadable by any agent.` | `#agent-toolswebmcp-action-coverage` |
| `content-discoverability/navigation-json.ts` | 1.21 | `No spec defines /navigation.json and no crawler fetches it; schema.org SiteNavigationElement already serves this purpose at million-domain adoption.` | `#content-discoverabilitynavigation-json` |
| `generative-engine/pagination-links.ts` | 10.12 | `Google, the only consumer ever documented, states it no longer uses rel=prev/next; the head-link form is invalid per the WHATWG HTML standard.` | `#generative-enginepagination-links` |
| `meta-tags/ai-instructions.ts` | 4.14 | `No spec defines an ai-instructions meta tag and Google states it ignores unsupported meta tags outright.` | `#meta-tagsai-instructions` |
| `meta-tags/llms-full-txt-link.ts` | 4.12 | `The llms.txt spec defines no such link tag, and none of the major publishers serving llms-full.txt emit one.` | `#meta-tagsllms-full-txt-link` |
| `meta-tags/mcp-discovery-link.ts` | 4.17 | `No MCP spec, draft, or client defines HTML link-rel discovery; MCP discovery is moving to .well-known server cards instead.` | `#meta-tagsmcp-discovery-link` |
| `semantic-html/address-element.ts` | 6.12 | `No consumer reads the address element: extractors strip it, the a11y tree flattens it, and Google routes contact data through schema.org PostalAddress.` | `#semantic-htmladdress-element` |
| `semantic-html/decorative-images.ts` | 6.16 | `Empty alt already maps to role presentation per HTML-AAM; the required explicit role is normatively redundant.` | `#semantic-htmldecorative-images` |
| `structured-data/action-schema.ts` | 3.16 | `Agentic checkout confirms transactions over APIs (ACP, Maps Booking), never by page markup; ConfirmAction deployment is under 1K domains.` | `#structured-dataaction-schema` |
| `structured-data/potential-action.ts` | 3.10 | `Two of the three accepted types do not exist in the schema.org vocabulary, and no consumer reads potentialAction for site actions.` | `#structured-datapotential-action` |
| `technical-readiness/framework-detection.ts` | 8.21 | `No vendor treats framework identity as an AI-readiness factor; Google frames the question purely as rendering outcome.` | `#technical-readinessframework-detection` |
| `technical-readiness/permissions-policy.ts` | 8.6 | `A missing Permissions-Policy header cannot cause an agent prompt; prompts fire only when page JavaScript calls a gated API.` | `#technical-readinesspermissions-policy` |
| `technical-readiness/preconnect-hints.ts` | 8.17 | `Preconnect only acts inside a rendering engine, and the major AI crawlers do not render JavaScript, so the hint is inert for them.` | `#technical-readinesspreconnect-hints` |
| `technical-readiness/referrer-policy.ts` | 8.5 | `Referrer-Policy governs outbound referrers from the site's own pages; it cannot affect how any crawler or agent reads the site.` | `#technical-readinessreferrer-policy` |

Link value = `https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md` + anchor.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/audits/sunset.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../audit-config';

const SUNSET_IDS = [
  '7.1', '5.11', '5.17', '5.4', '5.25', '1.21', '10.12', '4.14', '4.12',
  '4.17', '6.12', '6.16', '3.16', '3.10', '8.21', '8.6', '8.17', '8.5',
];

describe('sunset audits (NOT-A-FACTOR)', () => {
  const metas = Object.values(defaultConfig.audits)
    .flat()
    .map((reg) => reg.meta)
    .filter((m) => SUNSET_IDS.includes(m.id));

  it('all 18 sunset audits are registered', () => {
    expect(metas.map((m) => m.id).sort()).toEqual([...SUNSET_IDS].sort());
  });

  it.each(SUNSET_IDS)('audit %s is informative, weight 0, with a deprecation notice', (id) => {
    const meta = metas.find((m) => m.id === id);
    expect(meta).toBeDefined();
    expect(meta!.scoreDisplayMode).toBe('informative');
    expect(meta!.weight).toBe(0);
    expect(meta!.deprecated?.notice).toBeTruthy();
    expect(meta!.deprecated?.link).toMatch(
      /^https:\/\/github\.com\/ForkPoint\/agent-lighthouse\/blob\/main\/docs\/evidence\/NOT-A-FACTOR\.md#/,
    );
  });
});
```

(If `defaultConfig` is not exported from `../audit-config`, import it from wherever `orchestrator.ts` imports it — check that import line and mirror it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/audits/sunset.test.ts`
Expected: FAIL — modes are binary/ternary, weights are 1.0/0.6/etc., no `deprecated`.

- [ ] **Step 3: Edit the 18 audit metas**

In each file from the table: set `scoreDisplayMode: 'informative'`, set `weight: 0`, and add after `defaultPriority`:

```typescript
    deprecated: {
      notice: '<notice sentence from the table, verbatim>',
      link: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md<anchor from the table>',
    },
```

Do not change the `audit()` implementations — the audits keep running and reporting.

- [ ] **Step 4: Run the sunset test, then the full suite**

Run: `pnpm test packages/core/src/audits/sunset.test.ts` — expected PASS (19 tests).
Run: `pnpm test` — expected: failures ONLY in colocated tests that asserted the old meta values (e.g. a test checking `meta.scoreDisplayMode === 'binary'` or a snapshot with the old weight). Fix exactly those assertions to the new values. Behavioral pass/fail-detection tests must not be touched. Re-run `pnpm test` until 0 failures.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/audits
git commit -m "feat(core): sunset 18 not-a-factor audits to informative with deprecation notices"
```

---

### Task 5: HTML report renders the deprecation notice

**Files:**
- Modify: `packages/report/src/html-generator.ts` (check-item render, ~lines 76–125)
- Test: `packages/report/src/html-generator.test.ts` (append; if the file does not exist, create it following the package's existing test style — check `packages/report/src/` for the test file naming already in use)

**Interfaces:**
- Consumes: `CheckResult.deprecated` (Task 1).

- [ ] **Step 1: Write the failing test**

Append (or create) a test that builds a minimal `ScanReport` containing one check with:

```typescript
deprecated: {
  notice: 'No consumer reads this signal.',
  link: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md#accessibilityskip-nav',
},
```

and asserts on the generated HTML string:

```typescript
const html = generateHtmlReport(report);
expect(html).toContain('Deprecated — no longer a factor');
expect(html).toContain('docs/evidence/NOT-A-FACTOR.md#accessibilityskip-nav');
expect(html).toContain('No consumer reads this signal.');
```

Build the `ScanReport` fixture the way existing report tests do (`packages/report/src/view-model.test.ts` has the pattern — reuse its report factory/helper if exported, otherwise copy its minimal fixture shape).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/report/src/html-generator.test.ts`
Expected: FAIL — none of the three strings present.

- [ ] **Step 3: Implement**

In `packages/report/src/html-generator.ts`, inside the check-item `<details>` body (directly before the `${c.explanation ? ...}` block), add:

```typescript
                      ${c.deprecated ? `
                        <div class="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-300 dark:border-slate-700">
                          <strong class="text-slate-700 dark:text-slate-300 block mb-1">Deprecated — no longer a factor</strong>
                          <span>${escapeHtml(c.deprecated.notice)}</span>
                          <a href="${escapeHtml(c.deprecated.link)}" target="_blank" rel="noopener" class="block mt-1 underline text-slate-500">Why this is not a factor</a>
                        </div>
                      ` : ''}
```

And in the check-item title row (next to the `[${escapeHtml(c.id)}]` span), add a badge:

```typescript
                            ${c.deprecated ? '<span class="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">Deprecated</span>' : ''}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test packages/report/src/html-generator.test.ts` — PASS.
Run: `pnpm test packages/report` — PASS (no other report test broken).

- [ ] **Step 5: Commit**

```bash
git add packages/report/src
git commit -m "feat(report): render deprecation badge and notice for sunset audits"
```

---

### Task 6: Migration map shipped in the core package

**Files:**
- Create: `packages/core/migration-map.json`
- Create: `MIGRATION.md` (repo root)
- Modify: `packages/core/package.json` (`files` array)
- Test: `packages/core/src/migration-map.test.ts` (new)

**Interfaces:**
- Produces: `migration-map.json` — object keyed by v1 numeric audit id; each value `{ "slug": string, "status": "removed-in-v2", "reason": "not-a-factor", "link": string }`. v2 (Plan 5) extends the same file with `renamed-in-v2` entries for surviving audits.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/migration-map.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const map = JSON.parse(
  readFileSync(join(__dirname, '..', 'migration-map.json'), 'utf8'),
) as Record<string, { slug: string; status: string; reason: string; link: string }>;

const SUNSET_IDS = [
  '7.1', '5.11', '5.17', '5.4', '5.25', '1.21', '10.12', '4.14', '4.12',
  '4.17', '6.12', '6.16', '3.16', '3.10', '8.21', '8.6', '8.17', '8.5',
];

describe('migration-map.json', () => {
  it('contains every sunset audit id', () => {
    expect(Object.keys(map).sort()).toEqual([...SUNSET_IDS].sort());
  });

  it.each(SUNSET_IDS)('entry %s is removed-in-v2 with a NOT-A-FACTOR link', (id) => {
    const entry = map[id]!;
    expect(entry.status).toBe('removed-in-v2');
    expect(entry.reason).toBe('not-a-factor');
    expect(entry.slug).toMatch(/^[a-z-]+\/[a-z-]+$/);
    expect(entry.link).toContain('docs/evidence/NOT-A-FACTOR.md#');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/migration-map.test.ts`
Expected: FAIL — `ENOENT` on migration-map.json.

- [ ] **Step 3: Create the files**

`packages/core/migration-map.json` — 18 entries. Keys = numeric ids; `slug` = the path column from Task 4's table without `.ts` (e.g. `"accessibility/skip-nav"`); `link` = same NOT-A-FACTOR URL used in Task 4. Example entry (repeat the pattern for all 18, exact values from Task 4's table):

```json
{
  "7.1": {
    "slug": "accessibility/skip-nav",
    "status": "removed-in-v2",
    "reason": "not-a-factor",
    "link": "https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md#accessibilityskip-nav"
  }
}
```

`packages/core/package.json`: change `"files": ["dist"]` to `"files": ["dist", "migration-map.json"]`.

`MIGRATION.md` (repo root):

```markdown
# Migration

## v1 final minor → v2

18 audits are deprecated in the final v1 minor and removed in v2. They now run
as informative (weight 0): they no longer affect any category score, the
overall score, recommendations, or top lists, and each carries a notice in the
report linking to the public rationale in
[docs/evidence/NOT-A-FACTOR.md](docs/evidence/NOT-A-FACTOR.md).

The machine-readable map ships with the core package as
`@forkpoint/agent-lighthouse-core/migration-map.json`, keyed by v1 audit id:

    {
      "7.1": {
        "slug": "accessibility/skip-nav",
        "status": "removed-in-v2",
        "reason": "not-a-factor",
        "link": "https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md#accessibilityskip-nav"
      }
    }

Report consumers: treat `status: "removed-in-v2"` ids as gone in v2 — do not
build dashboards on them. v2 renames the surviving audits to `category/slug`
ids; those entries land in the same file with `status: "renamed-in-v2"` when
v2 ships.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/migration-map.test.ts`
Expected: PASS (19 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/migration-map.json packages/core/package.json MIGRATION.md packages/core/src/migration-map.test.ts
git commit -m "feat(core): ship v1-to-v2 migration map for sunset audits"
```

---

### Task 7: Changeset and full verification

**Files:**
- Create: `.changeset/sunset-not-a-factor-audits.md`

- [ ] **Step 1: Create the changeset**

`.changeset/sunset-not-a-factor-audits.md` (check `.changeset/config.json` first: the packages are in one `fixed` group, so dependents are version-bumped automatically; list them for changelog entries the way past changesets in git history do — `git log --oneline --all -- .changeset` and `git show` one):

```markdown
---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-report": minor
---

Sunset 18 audits with no proven consumer ("not a factor"). They still run but
are now informative: weight 0, excluded from category scores, the overall
score, recommendations, and top lists, and each result carries a deprecation
notice linking to the public evidence in docs/evidence/NOT-A-FACTOR.md. They
will be removed in the next major.

Additive API: `AuditMeta.deprecated` / `CheckResult.deprecated`
(`DeprecationNotice { notice, link }`), and `migration-map.json` shipped in
the package mapping each sunset v1 audit id to its status and rationale.

Deprecated audit ids: 1.21, 3.10, 3.16, 4.12, 4.14, 4.17, 5.4, 5.11, 5.17,
5.25, 6.12, 6.16, 7.1, 8.5, 8.6, 8.17, 8.21, 10.12.
```

Adjust the front-matter package list only if repo convention (past changesets) differs.

- [ ] **Step 2: Full verification**

Run: `pnpm test` — 0 failures.
Run: `pnpm typecheck` — clean.
Run: `rtk err pnpm lint` — zero errors/warnings.
Run: `npx changeset status` — parses, shows minor bump.

- [ ] **Step 3: Commit**

```bash
git add .changeset/sunset-not-a-factor-audits.md
git commit -m "docs(changeset): minor bump for not-a-factor audit sunset"
```
