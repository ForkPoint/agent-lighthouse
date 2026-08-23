# Plan 5b Wave A — graduate the 12 operability-safety grade-B proposals

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 12 feasible `agent-operability` and `injection-safety` proposals out of `packages/core/src/audits/proposed/` into the live `operability-safety` registry, so the registry grows 172 → 184.

**Architecture:** Every audit follows the graduation recipe proven across 24 audits in Plan 5: read the stub's implementation sketch and its proposal dossier (the dossier governs on conflict), write the failing test, implement, register in the category index, `git mv` the dossier into `docs/evidence/audits/`, record the id in `NEW_IN_V2`, delete the stub. All 12 land in one category, so the whole wave is one `git` history and one changeset.

**Tech Stack:** TypeScript, vitest, cheerio, zod, tsup, changesets, oxlint.

## Global Constraints

- **Meta law (spec §4):** `weight = weightForGrade(grade, tier)`. Grade B → `scored` at 0.6; grade C → `informative` at 0, and an informative audit must also carry `scoreDisplayMode: 'informative'`. `sunset.test.ts` enforces `tier !== 'scored' ⟺ weight === 0`. Grade C in the `scored` tier is unregistrable.
- **Grade is fixed by the dossier.** Do not re-grade an audit while implementing it. If the implementation cannot reach the dossier's mechanism, record that under `## Deferred` in the dossier rather than lowering the grade.
- **One audit = one file + one dossier.** `docs/evidence/audits/operability-safety/<slug>.md`, `packages/core/src/audits/operability-safety/<slug>.ts`, `<slug>.test.ts` beside it.
- **`notApplicable` is never a vacuous pass.** Every test file calls `expectNotApplicableOnEmpty(audit)` from `../../tests/na-contract`.
- **Every new URL fetch is `isSafeUrl()`-gated.** Test suites `vi.mock` the fetcher — no real DNS in tests.
- **Reuse the shared gatherers, do not duplicate them:**
  - `gatherers/css-rules.ts` — `parseCssRules(source, origin)`, `collectPageCss(ctx, page)`. Every CSS-reading task in this wave uses `collectPageCss`; it already fetches same-origin stylesheets and refuses cross-origin ones.
  - `gatherers/ua-parity.ts` — `AI_CRAWLER_UAS`, `BASELINE_UA`, `sharedUaProbes(ctx)`, `classifyResponse`, `UaProbe`, `BlockClass`.
  - `gatherers/sampled-pages.ts` — `fetchSampledPage(ctx, url)`, per-scan cached.
  - `gatherers/pages.ts` — `pagesOfType(ctx, ...types)`, `judgePages`.
  - `audits/operability-safety/invisible-instruction-scan.ts` — `INSTRUCTION_LEXICON`.
- **Comments in English**, in every file.
- **Lint only via `rtk err pnpm lint`.** Never bare `pnpm lint`, never ESLint.
- **Four gates at every task boundary:** `pnpm test`, `pnpm typecheck`, `rtk err pnpm lint`, and `pnpm --filter @forkpoint/agent-lighthouse-core build && node scripts/check-dossiers.mjs`.
- **Do not push.** The controller pushes after user approval.

---

## File Structure

| File | Responsibility |
| :-- | :-- |
| `packages/core/src/audits/operability-safety/<slug>.ts` | one graduated audit, one exported class |
| `packages/core/src/audits/operability-safety/<slug>.test.ts` | its acceptance tests, one `it` per "Test must pin" row |
| `packages/core/src/audits/operability-safety/index.ts` | export + import + `OPERABILITY_SAFETY_AUDITS` array entry, all three in the same order |
| `packages/core/src/audits/operability-safety/_agent-affordances.ts` | Task 1 — the clickability and state-token signal sets three tasks share |
| `packages/core/src/tests/new-in-v2.ts` | `NEW_IN_V2` gains 12 ids |
| `docs/evidence/audits/operability-safety/<slug>.md` | the moved dossier, frontmatter rewritten to the audit shape |
| `packages/core/src/audits/proposed/README.md` | stub count 52 → 40, 12 bullets deleted |
| `docs/evidence/proposals/README.md` | matching count decrement |
| `.changeset/v2-graduate-grade-b-wave-a.md` | one changeset for the wave |

---

## The per-audit recipe (Steps A–I)

Every task from Task 2 onward runs these nine steps. They are written once here; each task's own section supplies only what differs — the class name, the meta values, and the "Test must pin" table that is its acceptance criteria.

**Step A — read the source of truth.** Read the stub header's implementation sketch and the proposal dossier it links. On conflict the dossier governs. If the sketch names a signal the static tier cannot reach (anything requiring a live browser), note it now; it becomes a `## Deferred` entry in Step E, not a silent omission.

**Step B — write the failing test.** Create `packages/core/src/audits/operability-safety/<slug>.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { <ClassName> } from './<slug>';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';

describe('<ClassName>', () => {
  const audit = new <ClassName>();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  // ... one `it` per row of the task's "Test must pin" table
});
```

Run it: `pnpm test packages/core/src/audits/operability-safety/<slug>.test.ts` → FAIL, module not found.

**Step C — implement.** Create `packages/core/src/audits/operability-safety/<slug>.ts`. Copy `title`, `failureTitle`, `description` and `guidance.impact` **verbatim** from the stub — they are already written and reviewed. Everything else comes from this template:

```ts
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class <ClassName> extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/<slug>',
    category: 'operability-safety',
    title: '<verbatim from stub>',
    failureTitle: '<the failing-state phrasing — the stub repeats the title; write the real one>',
    description: '<verbatim from stub>',
    scoreDisplayMode: '<binary | ternary | informative>',
    weight: weightForGrade('<B | C>', '<scored | informative>'),
    evidenceGrade: '<B | C>',
    tier: '<scored | informative>',
    dossier: 'docs/evidence/audits/operability-safety/<slug>.md',
    defaultPriority: '<critical | high | medium | low>',
    guidance: {
      impact: '<verbatim from stub>',
      fix: '<WRITE THIS — the stub says "TODO: written when the audit is implemented.">',
      code: '<the copy-pasteable correct form>',
      effort: '<trivial | easy | moderate | complex>',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/operability-safety/<slug>.md',
      tags: [<the stub's tags, minus 'proposed', minus the old domain name, plus 'operability-safety'>],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // The stub's implementation sketch is the specification; this task's
    // "Test must pin" table is its acceptance criteria. Every row of that
    // table is a branch of this method.
  }
}
```

Run it: PASS.

**Step D — register.** In `packages/core/src/audits/operability-safety/index.ts` add the `export { <ClassName> } from './<slug>';` line, the matching `import`, and the class in the `OPERABILITY_SAFETY_AUDITS` array. Keep all three blocks in the same order.

**Step E — move the dossier.**

```bash
git mv docs/evidence/proposals/<domain>/<stub>.md docs/evidence/audits/operability-safety/<slug>.md
```

Replace its frontmatter with the shape `check-dossiers.mjs` validates:

```yaml
---
audit: operability-safety/<slug>
category: operability-safety
source_file: packages/core/src/audits/operability-safety/<slug>.ts
slug: <slug>
evidence_grade: <B | C>
tier: <scored | informative>
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
---
```

Keep the whole body — the mechanism, evidence and competitor sections are the proof behind the grade. Append `## Implementation deviations` when Step A required a substitution, and `## Deferred` naming anything the sketch specified that this implementation does not do (for this wave that is almost always the headless-browser tier).

**Step F — record the new id.** Append `'operability-safety/<slug>',` to `NEW_IN_V2` in `packages/core/src/tests/new-in-v2.ts`.

**Step G — delete the stub.**

```bash
git rm packages/core/src/audits/proposed/<domain>/<stub>.ts
```

Delete its bullet from `packages/core/src/audits/proposed/README.md` and decrement that file's stub count in the opening line. Do the same in `docs/evidence/proposals/README.md`.

**Step H — gates.**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
pnpm --filter @forkpoint/agent-lighthouse-core build && node scripts/check-dossiers.mjs
```

Expected: full suite green; `check-dossiers` reports one more audit than the previous task and **no orphans**.

**Step I — commit.**

```bash
git add -A
git commit -m "feat(core): graduate operability-safety/<slug> from proposal

<Two to four sentences: what the audit asserts, the falsifiable mechanism from
the dossier, and what it deliberately does not do.>

Registry <N-1> -> <N>."
```

---

### Task 1: `_agent-affordances.ts` — the shared signal sets

Three tasks in this wave (2, 3, 5) each need the same two answers: "does this element look clickable?" and "does this class name carry state?". Writing the regexes three times guarantees they drift.

**Files:**
- Create: `packages/core/src/audits/operability-safety/_agent-affordances.ts`
- Test: `packages/core/src/audits/operability-safety/_agent-affordances.test.ts`

**Interfaces:**
- Produces:
  - `NATIVE_INTERACTIVE: ReadonlySet<string>` — `a`, `button`, `input`, `select`, `textarea`, `summary`, `details`, `option`, `label`.
  - `CLICKABILITY_CLASS_RE: RegExp` — `/(^|[-_])(btn|button|cta|link|clickable|tile|card-link|toggle)([-_]|$)/`
  - `STATE_CLASS_RE: RegExp` — `/(^|[-_])(is-)?(active|selected|on|off|open|expanded|checked|current|enabled)([-_]|$)/`
  - `hasClickSignal(el, $, css): boolean` — true when the element carries an inline `onclick`/`onmousedown`/`onkeydown`, a class or `data-*` name matching `CLICKABILITY_CLASS_RE`, or a `PageCss` rule that sets `cursor: pointer` and whose selector matches it.
  - `accessibleName(el, $): string` — accname resolution in order: `aria-labelledby` target text, `aria-label`, own text content, `title`, `alt` of a child `img`, `<title>` of a child `svg`. Returns `''` when none resolve.

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { hasClickSignal, accessibleName, STATE_CLASS_RE } from './_agent-affordances';
import { parseCssRules } from '../../gatherers/css-rules';

const load = (html: string) => cheerio.load(html);

describe('_agent-affordances', () => {
  it('reads cursor:pointer out of a stylesheet as a click signal', () => {
    const $ = load('<div class="tile-x">Buy</div>');
    const css = { rules: parseCssRules('.tile-x { cursor: pointer }'), unreachable: [] };
    expect(hasClickSignal($('.tile-x')[0]!, $, css)).toBe(true);
  });

  it('does not call a plain div clickable', () => {
    const $ = load('<div class="wrapper">Buy</div>');
    expect(hasClickSignal($('.wrapper')[0]!, $, { rules: [], unreachable: [] })).toBe(false);
  });

  it('resolves an accessible name from aria-labelledby before own text', () => {
    const $ = load('<span id="n">Add to cart</span><button aria-labelledby="n">+</button>');
    expect(accessibleName($('button')[0]!, $)).toBe('Add to cart');
  });

  it('returns an empty name for an icon-only button with no label', () => {
    const $ = load('<button><svg></svg></button>');
    expect(accessibleName($('button')[0]!, $)).toBe('');
  });

  // "action" must not match: it contains "active" only as a substring, not as
  // a hyphen- or underscore-delimited token.
  it('matches state tokens on delimiters, not as substrings', () => {
    expect(STATE_CLASS_RE.test('is-active')).toBe(true);
    expect(STATE_CLASS_RE.test('tab_selected')).toBe(true);
    expect(STATE_CLASS_RE.test('transaction')).toBe(false);
    expect(STATE_CLASS_RE.test('inactive-warning')).toBe(false);
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `pnpm test packages/core/src/audits/operability-safety/_agent-affordances.test.ts`
Expected: FAIL — `Cannot find module './_agent-affordances'`.

- [x] **Step 3: Implement the module**

Write the five exports above. `hasClickSignal` takes the `PageCss` shape `collectPageCss` returns so callers pass the gatherer's result straight through. Match a CSS rule to an element with cheerio's own `$(el).is(rule.selector)` inside a `try`, because a stylesheet may carry selectors cheerio cannot parse — an unparseable selector is skipped, not fatal.

- [x] **Step 4: Run it and watch it pass**

Run: `pnpm test packages/core/src/audits/operability-safety/_agent-affordances.test.ts`
Expected: PASS.

- [x] **Step 5: Gates and commit**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
git add -A
git commit -m "feat(core): shared agent-affordance signal sets for the grade-B wave

Three graduating audits each need the same clickability, state-token and
accessible-name resolution. One module so the regexes cannot drift apart."
```

---

### Task 2: `operability-safety/ghost-clickable-element-ratio`

**Files:** stub `proposed/agent-operability/ghost-clickable-element-ratio.ts` · class `GhostClickableElementRatioAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'moderate'`

Uses `hasClickSignal`, `accessibleName`, `NATIVE_INTERACTIVE` from Task 1 and `collectPageCss`.

**Test must pin:**
- A page of native `<button>`s with text → `pass`, ratio 1.0.
- A `<div onclick="…">Add to cart</div>` with no role → counted ghost, named in `found`.
- A `<div class="btn-primary">Buy</div>` with no listener and no CSS → counted ghost (class signal alone is enough).
- A `<div>` matched by a stylesheet rule `cursor: pointer` → counted ghost; the same `<div>` with `role="button"` and text → semantic, not ghost.
- `<a>` with no `href` → ghost, message says a link without `href` has no link role.
- `<button><svg></svg></button>` with no label → ghost on the empty-accessible-name arm, not the click-signal arm; `found` distinguishes the two arms.
- Ratio at exactly 0.9 → `warn`; below 0.9 → `fail`; the boundary is asserted at both sides.
- A page with zero click targets of either kind → `notApplicable`, not a division by zero.
- The headless CDP tier from the sketch is **not** implemented — assert `meta.description` does not promise it, and record it under `## Deferred` in the dossier.

---

### Task 3: `operability-safety/stateful-control-introspectability`

**Files:** stub `proposed/agent-operability/stateful-control-introspectability.ts` · class `StatefulControlIntrospectabilityAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'moderate'`

Uses `STATE_CLASS_RE`, `hasClickSignal` from Task 1.

**Test must pin:**
- `<div role="switch" aria-checked="false">` → introspectable.
- `<div role="switch">` with no `aria-checked` → opaque; message names the missing attribute.
- `<button class="tab is-active">` with no `aria-selected`/`aria-pressed`/`aria-current` → opaque; `found` quotes the class `is-active`, because that class is the remediation target.
- The same button with `aria-pressed="true"` → introspectable even though the class is still there.
- A trigger whose `id` is the target of `aria-controls` but which carries no `aria-expanded` → opaque.
- `<details><summary>` → introspectable automatically, contributes no finding.
- A sortable `<th>` inside a table with a sort control and no `aria-sort` → opaque.
- Score = `1 - opaque/(opaque+introspectable)`; assert one mixed page's exact ratio.
- A page with no state-bearing control → `notApplicable`.

---

### Task 4: `operability-safety/hover-only-content-and-navigation`

**Files:** stub `proposed/agent-operability/hover-only-content-and-navigation.ts` · class `HoverOnlyContentAndNavigationAudit` · `scoreDisplayMode: 'binary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'moderate'`

Uses `collectPageCss`. This audit is `async` — `collectPageCss` fetches stylesheets.

**Test must pin:**
- A submenu whose only visibility rule is `.nav li:hover .submenu { display: block }`, whose trigger has no `aria-expanded` and no `aria-haspopup`, and for which no `:focus-within` or `[aria-expanded="true"]` rule exists → `fail`; `found` lists each unreachable destination URL, because those are the pages the agent never discovers.
- The same markup plus `.nav li:focus-within .submenu { display: block }` → `pass`.
- The same markup where the trigger carries `aria-expanded="false"` and `aria-controls` resolving to the submenu → `pass` (a JS toggle is plausible).
- Information carried only by a `title` attribute on a non-form element → reported as its own finding, separate from the navigation findings.
- A `.tooltip` container not referenced by any `aria-describedby` → reported.
- A cross-origin stylesheet → not fetched; `found` says so rather than silently treating the rules as absent.
- A page with no `:hover` rule at all → `notApplicable`.
- The headless snapshot-diff tier is **not** implemented — `## Deferred`.

---

### Task 5: `operability-safety/drag-and-slider-dependency`

**Files:** stub `proposed/agent-operability/drag-and-slider-dependency.ts` · class `DragAndSliderDependencyAudit` · `scoreDisplayMode: 'binary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'moderate'`

**Test must pin:**
- `<input type="range">` with a sibling `<input type="number">` in the same labelled field group → no finding.
- `<input type="range">` alone → finding (a), naming the missing numeric input as the remediation.
- `role="slider"` missing `aria-valuenow` → finding (a) on the APG arm, reported distinctly from the missing-alternative arm.
- `role="slider"` with all three `aria-value*` and an accessible name, plus a paired `<select>` → no finding.
- A `draggable="true"` list item inside `/checkout` with no move-up/move-down buttons → finding (b).
- The same list on `/blog` → **no** finding: path criticality is what makes it count, and the test pins that difference.
- A `.file-drop` div with no descendant or sibling `<input type="file">` → finding (c).
- A carousel whose only next/prev affordance is a swipe handler attribute, no rendered buttons → finding (d).
- A page with none of the four constructs → `notApplicable`.

---

### Task 6: `operability-safety/url-addressable-state-and-pagination-fallback`

**Files:** stub `proposed/agent-operability/url-addressable-state-and-pagination-fallback.ts` · class `UrlAddressableStateAndPaginationFallbackAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'complex'`

Multi-page. Uses `pagesOfType(ctx, 'category', 'listing')` where the page-type set provides one, and `fetchSampledPage` for the facet probe. Every probe URL is `isSafeUrl()`-gated.

**Test must pin:**
- A listing with `<a href="?page=2">` links → `pass`; `found` reports the deepest item index reachable by URL alone.
- A listing with `<link rel="next">` and no anchor pagination → `pass`.
- A listing whose only affordance is a `.infinite-sentinel` div → `fail`.
- A listing whose only affordance is a `Load more` `<button>` → `warn`, scoring between the sentinel and href pagination; the test asserts the three-way ordering, not just the labels.
- A declared total (`numberOfItems: 100`) against 20 items in the initial HTML and no pagination → `fail`, message naming both numbers.
- A facet link `?colour=red` whose fetched response is byte-identical to the unfiltered page → the facet is reported client-only.
- The same facet returning a different item count → URL-addressable, no finding.
- A site with no listing page → `notApplicable`.
- The headless tab/modal extension is **not** implemented — `## Deferred`.

---

### Task 7: `operability-safety/unicode-covert-channel-scan`

**Files:** stub `proposed/injection-safety/unicode-covert-channel-scan.ts` · class `UnicodeCovertChannelScanAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'critical'` · `effort: 'moderate'`

Scans page text nodes, the listed attributes, every JSON-LD string value, and `ctx.rootFiles` for `/robots.txt`, `/llms.txt`, `/sitemap.xml`.

**Test must pin:**
- A tag-block run in `U+E0000–U+E007F` → `fail`; the decoded ASCII (`codepoint - 0xE0000`) appears in the message, escaped as `\uXXXX` so the report stays copy-paste-safe.
- Unbalanced `U+202E` with no matching pop → `fail`.
- A balanced `U+202B`/`U+202C` pair around genuine Arabic text → `pass`.
- A single `U+200B` mid-word in Latin text → `warn`.
- 21 zero-width characters on one page → `fail` (the >20 threshold), asserted at 20 and 21.
- A ZWJ inside an emoji sequence → no finding.
- A soft hyphen run inside a Latin word → `warn`.
- The same tag-block payload inside `/llms.txt` → `fail`, and `found` names the file, because a root file is ingested with high trust and rarely read by a human.
- `<script>` and `<style>` bodies are stripped before scanning — a zero-width character inside a script does not fire.
- A clean page → `pass`.

---

### Task 8: `operability-safety/third-party-dom-write-blast-radius`

**Files:** stub `proposed/injection-safety/third-party-dom-write-blast-radius.ts` · class `ThirdPartyDomWriteBlastRadiusAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'moderate'`

Reads CSP from the response header **and** `<meta http-equiv>` — the same two delivery paths `security-header-hygiene` accepts. Do not import that audit; extract nothing from it, this audit answers a different question.

**Test must pin:**
- No third-party script at all → `pass`, `found` says zero uncontrolled origins.
- One third-party script, `script-src 'self' 'nonce-abc'` → `pass`.
- One third-party script, no CSP, no `integrity` → `fail`.
- One third-party script, `script-src 'unsafe-inline' https:` → `fail`: a scheme-wide source is decorative, and the test pins that judgement.
- Three third-party origins with a non-constraining CSP → `warn` at the 1–3 tier; nine → the 4–9 tier; eleven → the 10+ tier. Assert the tier boundaries.
- `found` always lists the actual registrable domains, because "these eleven companies can write text into what agents read" is the finding an owner can act on.
- Two scripts on `cdn.example.com` and `static.example.com` → **one** origin, grouped by eTLD+1.
- A cross-origin `<iframe>` with no `sandbox` → reported alongside, with its dimensions.
- The runtime tag-manager tier is **not** implemented — `## Deferred`, and it is named in `found` so the count is not read as complete.

---

### Task 9: `operability-safety/unsafe-agent-triggerable-affordances`

**Files:** stub `proposed/injection-safety/unsafe-agent-triggerable-affordances.ts` · class `UnsafeAgentTriggerableAffordancesAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'critical'` · `effort: 'easy'`

**Markup analysis only. This audit must never fetch a flagged URL** — following a `?action=delete` link would perform the destructive action it is reporting. The test asserts `ctx.fetch` is never called.

**Test must pin:**
- `<a href="/?action=delete&id=7">` with no confirmation affordance → `fail`.
- The same link with `data-turbo-confirm="Are you sure?"` → no finding.
- The same link with `rel="nofollow"` → no finding (the documented minimum mitigation).
- The same URL inside a `<form method="post">` → no finding.
- `<a href="/logout">` → `fail` on the path-pattern arm.
- `<a href="/add-to-cart?sku=1">` → `fail`.
- `<form method="get" action="/unsubscribe">` → `warn`, not `fail`.
- `/logout` listed under `Disallow:` in robots.txt → still reported, and the message states the partial mitigation explicitly: ChatGPT-User is documented as not necessarily bound by robots.txt for user-initiated fetches.
- `ctx.fetch` is not called once during the whole audit — pinned with a spy.
- A page with no state-verb link → `pass`.

---

### Task 10: `operability-safety/reflected-parameter-injection-canary`

**Files:** stub `proposed/injection-safety/reflected-parameter-injection-canary.ts` · class `ReflectedParameterInjectionCanaryAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'critical'` · `effort: 'moderate'`

This audit sends probes to the scanned origin. Constraints, all pinned by tests:
- **At most five probes**, ever, per scan.
- **Read-only GETs only.** No `POST`, no authenticated path, no path outside the scanned origin.
- Every probe URL is `isSafeUrl()`-gated.
- The canary is a random token per scan; the instruction-shaped variant exists so the audit can tell a raw reflection from an escaped one — it is a detection string, not an exploit.

**Test must pin:**
- The canary reflected into `<title>` → `fail`.
- Into `og:description` → `fail`.
- Into `link rel="canonical"` href → `fail`.
- Into a JSON-LD string value → `fail`.
- Into a rendered text node only, on a page carrying `<meta name="robots" content="noindex">` → `warn`.
- The same text-node reflection on an indexable page → `fail`.
- No reflection anywhere → `pass`.
- `found` states whether the canary came back HTML-escaped or raw, and whether angle brackets survived.
- Exactly five `ctx.fetch` calls at most — asserted with a counting stub on a site that reflects nothing.
- A site whose probes all fail to connect → `notApplicable`, not `pass`.

---

### Task 11: `operability-safety/ugc-trust-boundary-markers`

**Files:** stub `proposed/injection-safety/ugc-trust-boundary-markers.ts` · class `UgcTrustBoundaryMarkersAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'moderate'`

Imports `INSTRUCTION_LEXICON` from `./invisible-instruction-scan` for the arm that escalates on a hidden payload found inside a UGC region. **Detection is read-only — never submit the comment form.** The test asserts no `POST`.

**Test must pin:**
- A `#comments` region containing a comment body with an inline `style=` attribute → `fail`: visitor-authored markup survived the sanitizer.
- A comment body containing `<iframe>` → `fail`.
- A `Review` JSON-LD node plus a `.review` region with no `data-nosnippet` and no `rel="ugc"` link → `warn`.
- The same region wrapped in `<div data-nosnippet>` → no finding.
- `data-nosnippet` on a `<p>` → **not** honoured; Google honours it on `span`, `div` and `section` only, and the message says so.
- A Disqus embed script with no containment → `warn`.
- A `<form action="wp-comments-post.php">` with a `textarea name="comment"` → detected as a UGC region even with no rendered comments.
- A comment containing an `INSTRUCTION_LEXICON` hit inside an unmarked region → `fail`, escalated above the plain unmarked-region `warn`.
- Findings are reported per region, so the fix maps to one template file.
- A page with no UGC region → `notApplicable`.

---

### Task 12: `operability-safety/agent-ua-content-divergence-diff`

**Files:** stub `proposed/injection-safety/agent-ua-content-divergence-diff.ts` · class `AgentUaContentDivergenceDiffAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'complex'`

Uses `sharedUaProbes(ctx)` — do **not** issue a second round of UA probes; the gatherer already fetches the AI-crawler UA set once per scan and other audits consume the same result.

**Test must pin:**
- Identical main content across every UA → `pass`.
- An agent UA served content with Jaccard 0.5 against the Chrome baseline → `fail`; `found` carries a word-level diff of the largest divergent block.
- Jaccard at exactly 0.85 → `pass`; just below → `fail`. Assert both sides of the boundary.
- An agent variant containing an `INSTRUCTION_LEXICON` hit absent from the Chrome variant → `fail` regardless of similarity.
- A JSON-LD block that differs between variants → `fail`.
- A `403` to `GPTBot` → reported **separately and non-punitively**: a deliberate opt-out is not a safety defect, and the test pins that it does not lower the score.
- The nonsense-UA control diverging the same way as the agent UAs → treated as bot-management noise, not as UA branching.
- A site that answers every UA identically except for a cache-varying timestamp → `pass` after normalization.
- No probe reachable → `notApplicable`.

---

### Task 13: `operability-safety/first-contact-consent-gate-operability`

**Files:** stub `proposed/agent-operability/first-contact-consent-gate-operability.ts` · class `FirstContactConsentGateOperabilityAudit` · `scoreDisplayMode: 'informative'` · `tier: 'informative'` · grade **C** · `weight: weightForGrade('C', 'informative')` = 0 · `defaultPriority: 'low'` · `effort: 'moderate'`

The sketch says to report an action-cost number rather than a pass/fail score, and grade C forbids the `scored` tier anyway. This audit reports; it never moves the score.

**Test must pin:**
- No CMP detected → `notApplicable`.
- A OneTrust `otSDKStub` script plus main content present in the HTML → reported with an action cost, status `pass`.
- A page whose `<main>` is replaced by an interstitial → reported; the message names the missing main entity.
- A consent dialog whose root is a cross-origin `<iframe>` → reported as unreachable to an agent.
- `<main aria-hidden="true">` while the dialog is open → reported.
- A reject control reachable in one click → action cost 1; behind "manage preferences" → cost 2; the test pins both numbers.
- `meta.weight` is `0` and `meta.tier` is `'informative'` — pinned, because a grade-C audit in the `scored` tier is unregistrable and `sunset.test.ts` would reject it.

---

### Task 14: close the wave

**Files:**
- Create: `.changeset/v2-graduate-grade-b-wave-a.md`
- Modify: `docs/superpowers/HANDOFF-v2.md`, `packages/core/src/audits/proposed/README.md`, `docs/evidence/proposals/README.md`

- [ ] **Step 1: Verify the counts moved together**

```bash
pnpm --filter @forkpoint/agent-lighthouse-core build
node scripts/check-dossiers.mjs
grep -c "'operability-safety/" packages/core/src/tests/new-in-v2.ts
head -3 packages/core/src/audits/proposed/README.md
find packages/core/src/audits/proposed -name '*.ts' | wc -l
```

Expected: `check-dossiers` reports **184 audits OK … no orphans**; `NEW_IN_V2` carries 12 more ids than before the wave; both proposal READMEs say **40** stubs; the stub file count is 40.

- [ ] **Step 2: Run every gate**

```bash
pnpm test && pnpm typecheck && rtk err pnpm lint
npx changeset status
```

- [ ] **Step 3: Write the changeset**

```markdown
---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": patch
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

Plan 5b Wave A: 12 grade-B proposals graduate into `operability-safety`. The
registry grows from 172 to 184 audits.

Each carries evidence grade B — a documented consumer path, proved in its
dossier under `docs/evidence/audits/operability-safety/` — so each lands in the
scored tier at weight 0.6, except
`operability-safety/first-contact-consent-gate-operability`, which is
informative at weight 0: its honest finding is an action cost, not a defect.

New in this release:

- **Agent operability**: drag-and-slider-dependency,
  ghost-clickable-element-ratio, hover-only-content-and-navigation,
  stateful-control-introspectability,
  url-addressable-state-and-pagination-fallback,
  first-contact-consent-gate-operability
- **Injection safety**: agent-ua-content-divergence-diff,
  reflected-parameter-injection-canary, third-party-dom-write-blast-radius,
  ugc-trust-boundary-markers, unicode-covert-channel-scan,
  unsafe-agent-triggerable-affordances

`operability-safety` gains 6.6 evidence mass, so its share of the overall score
rises and every other category's share falls. A site that scored well on the
172-audit registry is not guaranteed the same number here. That is the intended
effect of adding proven checks, not a regression.

`operability-safety/reflected-parameter-injection-canary` sends at most five
read-only GET probes to the scanned origin, carrying a random per-scan canary
token, to find out whether a query parameter is reflected into the fields an AI
answer lifts verbatim. It never probes an authenticated path and never sends
anything but GET.
```

- [ ] **Step 4: Update the handoff**

Move Wave A into the "Executed plans" table with this plan's path and its commit range. In "Remaining scope", change Plan 5b's counts: 40 stubs left, 36 feasible across Waves B–D, 3 infra-blocked, 1 deferred on the operator base URL. Update the gate line with the new test count and `184 audits OK`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: close Plan 5b Wave A — 12 operability-safety graduations

Registry 172 -> 184. Handoff updated, changeset written."
```

Report to the user: the `check-dossiers` line, the `pnpm test` counts, the evidence-mass shift and its effect on scores, and what each audit deliberately does not do. **Do not push** — the controller pushes after approval.

---

## Self-review

**Spec coverage.** All 12 feasible `agent-operability` + `injection-safety` stubs have a task: agent-operability's 6 in Tasks 2–6 and 13, injection-safety's 6 in Tasks 7–12. `overlay-interception-hazard` is deliberately absent — it is the wave's only `headless-browser` stub and stays a stub, as the handoff records.

**Placeholder scan.** Every task names its class, its four meta values, the stub it consumes, and a "Test must pin" table with concrete assertions. The one code block that is a template (Step C) is explicitly marked as such and every `<placeholder>` in it is filled from the task's own header line.

**Type consistency.** `hasClickSignal(el, $, css)` and `accessibleName(el, $)` are defined in Task 1 and consumed unchanged in Tasks 2, 3 and 5. `STATE_CLASS_RE` is defined in Task 1 and consumed in Task 3. `collectPageCss` returns the `PageCss` shape `hasClickSignal` takes, so Task 4's call site needs no adapter. `INSTRUCTION_LEXICON` is imported from the already-shipped `invisible-instruction-scan.ts` in Tasks 11 and 12 — it is not redefined.

**Ordering.** Task 1 must land before Tasks 2, 3 and 5. Everything else is independent; Task 14 is last because it pins the final counts.
