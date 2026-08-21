# Engine Foundation Implementation Plan (Restructure Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the gatherer layer and scoring fixes from spec §7/§4 so the five systemic defects (soft-404 blindness, BOM/robots parsing gaps, JSON-LD entity hoisting, `pages[0]`-only checks, vacuous-pass inflation) are fixed once, engine-side, before the taxonomy restructure.

**Architecture:** New `packages/core/src/gatherers/` module with pure functions consumed by audits via `CheckContext`. Existing audits keep working (v1-compatible); adoption sweeps happen in Plan 3. Weighted scoring lands behind the existing `AuditMeta.weight` field.

**Tech Stack:** TypeScript, vitest, cheerio, undici. Monorepo: pnpm. Lint: **oxlint only** — run `rtk err pnpm lint`, never bare `pnpm lint`/eslint.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-21-audit-restructure-design.md` §4, §7, §10.
- One audit/module per file; tests colocated as `<name>.test.ts`.
- All code comments in English.
- Never edit `packages/core/src/audits/**` behavior in this plan except where a task names the file — audit adoption is Plan 3.
- Run tests with `pnpm --filter @forkpoint/agent-lighthouse-core test -- run <path>` (vitest).
- Commit after every task; branch `docs/audit-evidence-review` (rename to `feat/v2-engine` at execution start: `git checkout -b feat/v2-engine`).
- Property to preserve everywhere: adding a `na` CheckResult never changes any score.

---

### Task 1: Fetch classification (`gatherers/fetch-classify.ts`)

Soft-404 detection + BOM/CRLF normalization. Today `isOk()` in audits is `status === 200`, so an SPA returning its HTML shell at `/robots.txt` or `/llms.txt` counts as "file exists".

**Files:**
- Create: `packages/core/src/gatherers/fetch-classify.ts`
- Test: `packages/core/src/gatherers/fetch-classify.test.ts`

**Interfaces:**
- Consumes: `FetchResult` from `../fetcher` (fields: `status: number`, `headers: Record<string,string>`, `body: string`, `contentType: string`).
- Produces (later tasks + Plan 3 audits rely on these exact names):
  - `stripBom(text: string): string`
  - `normalizeNewlines(text: string): string`
  - `type FetchClass = 'ok' | 'soft-404' | 'blocked' | 'missing' | 'error'`
  - `classifyFetch(result: FetchResult | undefined, expected: 'text' | 'json' | 'xml' | 'html'): FetchClass`
  - `isRealFile(result: FetchResult | undefined, expected: 'text' | 'json' | 'xml' | 'html'): boolean` (sugar: `classifyFetch(...) === 'ok'`)

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/gatherers/fetch-classify.test.ts
import { describe, it, expect } from 'vitest';
import { classifyFetch, isRealFile, stripBom, normalizeNewlines } from './fetch-classify';
import type { FetchResult } from '../fetcher';

const fr = (over: Partial<FetchResult>): FetchResult => ({
  url: 'https://x.test/robots.txt',
  finalUrl: 'https://x.test/robots.txt',
  status: 200,
  headers: {},
  body: 'User-agent: *\nAllow: /',
  ttfbMs: 10,
  totalMs: 20,
  contentType: 'text/plain',
  contentLength: 22,
  ...over,
});

describe('classifyFetch', () => {
  it('classifies a plain text file as ok', () => {
    expect(classifyFetch(fr({}), 'text')).toBe('ok');
  });
  it('classifies an HTML body served for a text file as soft-404', () => {
    const spa = fr({
      body: '<!doctype html><html><head><title>App</title></head><body><div id="root"></div></body></html>',
      contentType: 'text/html',
    });
    expect(classifyFetch(spa, 'text')).toBe('soft-404');
    expect(isRealFile(spa, 'text')).toBe(false);
  });
  it('classifies HTML content-type with JSON expectation as soft-404', () => {
    const spa = fr({ contentType: 'text/html', body: '<!doctype html><p>not found</p>' });
    expect(classifyFetch(spa, 'json')).toBe('soft-404');
  });
  it('accepts JSON that parses when json expected, regardless of loose content-type', () => {
    const j = fr({ contentType: 'application/octet-stream', body: '{"a":1}' });
    expect(classifyFetch(j, 'json')).toBe('ok');
  });
  it('classifies 401/403/429 as blocked', () => {
    expect(classifyFetch(fr({ status: 403 }), 'text')).toBe('blocked');
    expect(classifyFetch(fr({ status: 429 }), 'text')).toBe('blocked');
  });
  it('classifies 404/410 and undefined as missing', () => {
    expect(classifyFetch(fr({ status: 404 }), 'text')).toBe('missing');
    expect(classifyFetch(undefined, 'text')).toBe('missing');
  });
  it('classifies 5xx and fetch errors as error', () => {
    expect(classifyFetch(fr({ status: 503 }), 'text')).toBe('error');
    expect(classifyFetch(fr({ status: 0, error: 'ENOTFOUND' }), 'text')).toBe('error');
  });
  it('html expectation accepts an HTML body as ok', () => {
    expect(classifyFetch(fr({ contentType: 'text/html', body: '<!doctype html><p>hi</p>' }), 'html')).toBe('ok');
  });
});

describe('stripBom / normalizeNewlines', () => {
  it('strips UTF-8 BOM', () => {
    expect(stripBom('﻿User-agent: *')).toBe('User-agent: *');
  });
  it('leaves BOM-free text alone', () => {
    expect(stripBom('abc')).toBe('abc');
  });
  it('normalizes CRLF and CR to LF', () => {
    expect(normalizeNewlines('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/gatherers/fetch-classify.test.ts`
Expected: FAIL — module `./fetch-classify` not found.

- [ ] **Step 3: Write the implementation**

```ts
// packages/core/src/gatherers/fetch-classify.ts
import type { FetchResult } from '../fetcher';

export type FetchClass = 'ok' | 'soft-404' | 'blocked' | 'missing' | 'error';
export type ExpectedKind = 'text' | 'json' | 'xml' | 'html';

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

const HTML_SIGNATURE = /^\s*(?:<!doctype\s+html|<html[\s>])/i;

function looksLikeHtml(result: FetchResult): boolean {
  return (
    result.contentType.includes('text/html') ||
    HTML_SIGNATURE.test(stripBom(result.body).slice(0, 512))
  );
}

/**
 * Classify a fetched root file honestly. `status === 200` alone is not
 * "the file exists": SPAs and some CDNs return the HTML app shell (200)
 * for any unknown path — a soft 404 that inflated v1 scores.
 */
export function classifyFetch(
  result: FetchResult | undefined,
  expected: ExpectedKind,
): FetchClass {
  if (!result) return 'missing';
  if (result.error) return 'error';
  if (result.status === 404 || result.status === 410) return 'missing';
  if (result.status === 401 || result.status === 403 || result.status === 429) return 'blocked';
  if (result.status >= 500 || result.status === 0) return 'error';
  if (result.status !== 200) return 'missing';

  if (expected === 'html') return 'ok';
  if (expected === 'json') {
    try {
      JSON.parse(stripBom(result.body));
      return 'ok';
    } catch {
      return looksLikeHtml(result) ? 'soft-404' : 'error';
    }
  }
  // text / xml: an HTML document where a machine file should be is a soft 404.
  return looksLikeHtml(result) ? 'soft-404' : 'ok';
}

export function isRealFile(result: FetchResult | undefined, expected: ExpectedKind): boolean {
  return classifyFetch(result, expected) === 'ok';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/gatherers/fetch-classify.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Export from core index and commit**

Add to `packages/core/src/index.ts` (follow existing export style there):

```ts
export { classifyFetch, isRealFile, stripBom, normalizeNewlines } from './gatherers/fetch-classify';
export type { FetchClass, ExpectedKind } from './gatherers/fetch-classify';
```

```bash
git add packages/core/src/gatherers/fetch-classify.ts packages/core/src/gatherers/fetch-classify.test.ts packages/core/src/index.ts
git commit -m "feat(core): fetch classification gatherer with soft-404 detection"
```

---

### Task 2: Robots parser hardening (`gatherers/robots.ts`)

One RFC 9309 parser for all bot audits. Fixes from the review: BOM makes `parseRobotsTxt` return zero groups; `User-agent: GPTBot/1.1` groups are invisible to exact-match lookup; `Disallow: /*` is not detected as blanket block; consecutive `User-agent:` lines then rules produce wrong grouping when a UA repeats across the file (RFC says merge).

**Files:**
- Create: `packages/core/src/gatherers/robots.ts`
- Test: `packages/core/src/gatherers/robots.test.ts`
- Modify: `packages/core/src/audits/crawler-permissions/_robots-txt-helpers.ts` (turn into re-export shim so existing audits keep compiling)

**Interfaces:**
- Consumes: `stripBom`, `normalizeNewlines` from `./fetch-classify` (Task 1).
- Produces:
  - `interface RobotsRule { type: 'allow' | 'disallow'; path: string }`
  - `interface RobotsGroup { userAgent: string; rules: RobotsRule[]; crawlDelay?: number }`
  - `parseRobots(body: string): RobotsGroup[]` (BOM-stripped, 500 KiB cap, comment/CRLF handling)
  - `matchesUserAgent(groupUserAgent: string, botToken: string): boolean` (case-insensitive; `GPTBot/1.1` matches token `gptbot`)
  - `groupsForBot(groups: RobotsGroup[], botToken: string): RobotsGroup[]` (all matching groups, RFC merge; falls back to `*` groups when none match)
  - `isPathAllowed(groups: RobotsGroup[], botToken: string, path: string): boolean` (longest-match wins, `*` wildcard and `$` anchor per RFC 9309; allow wins ties)
  - `isBlanketBlocked(groups: RobotsGroup[], botToken: string): boolean` (true for `Disallow:` path `/`, `/*`, or `*` with no overriding allow)

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/gatherers/robots.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseRobots, matchesUserAgent, groupsForBot, isPathAllowed, isBlanketBlocked,
} from './robots';

describe('parseRobots', () => {
  it('parses a BOM-prefixed file (v1 returned zero groups)', () => {
    const groups = parseRobots('﻿User-agent: *\nDisallow: /private/');
    expect(groups).toHaveLength(1);
    expect(groups[0].rules).toEqual([{ type: 'disallow', path: '/private/' }]);
  });
  it('handles CRLF and comments', () => {
    const groups = parseRobots('User-agent: GPTBot # openai\r\nDisallow: /a\r\n');
    expect(groups[0].userAgent).toBe('GPTBot');
    expect(groups[0].rules[0].path).toBe('/a');
  });
  it('merges repeated groups for the same user-agent (RFC 9309 §2.2.1)', () => {
    const body = 'User-agent: GPTBot\nDisallow: /a\n\nUser-agent: GPTBot\nDisallow: /b\n';
    const merged = groupsForBot(parseRobots(body), 'gptbot');
    const paths = merged.flatMap((g) => g.rules.map((r) => r.path)).sort();
    expect(paths).toEqual(['/a', '/b']);
  });
  it('caps parsing at 500 KiB', () => {
    const big = 'User-agent: *\n' + 'Disallow: /x\n'.repeat(60000);
    expect(big.length).toBeGreaterThan(512_000);
    const groups = parseRobots(big);
    const totalRules = groups.reduce((n, g) => n + g.rules.length, 0);
    expect(totalRules).toBeLessThan(60000);
  });
});

describe('matchesUserAgent', () => {
  it('matches case-insensitively', () => {
    expect(matchesUserAgent('gptbot', 'GPTBot')).toBe(true);
  });
  it('matches versioned tokens: group "GPTBot/1.1" for bot token gptbot', () => {
    expect(matchesUserAgent('GPTBot/1.1', 'gptbot')).toBe(true);
  });
  it('does not match a different bot', () => {
    expect(matchesUserAgent('ClaudeBot', 'gptbot')).toBe(false);
  });
});

describe('isPathAllowed', () => {
  const groups = parseRobots(
    'User-agent: GPTBot\nDisallow: /private/\nAllow: /private/press/\n\nUser-agent: *\nDisallow: /tmp/',
  );
  it('applies longest-match precedence: allow overrides shorter disallow', () => {
    expect(isPathAllowed(groups, 'gptbot', '/private/press/kit.html')).toBe(true);
    expect(isPathAllowed(groups, 'gptbot', '/private/mail.html')).toBe(false);
  });
  it('bot-specific group supersedes the wildcard group entirely', () => {
    // GPTBot group exists, so the * group's /tmp/ rule does not apply to GPTBot.
    expect(isPathAllowed(groups, 'gptbot', '/tmp/x')).toBe(true);
  });
  it('supports * wildcard inside paths', () => {
    const g = parseRobots('User-agent: *\nDisallow: /*.pdf');
    expect(isPathAllowed(g, 'gptbot', '/whitepaper.pdf')).toBe(false);
    expect(isPathAllowed(g, 'gptbot', '/whitepaper.html')).toBe(true);
  });
  it('supports $ end anchor', () => {
    const g = parseRobots('User-agent: *\nDisallow: /draft$');
    expect(isPathAllowed(g, 'gptbot', '/draft')).toBe(false);
    expect(isPathAllowed(g, 'gptbot', '/drafts')).toBe(true);
  });
  it('empty disallow value allows everything', () => {
    const g = parseRobots('User-agent: *\nDisallow:');
    expect(isPathAllowed(g, 'gptbot', '/anything')).toBe(true);
  });
});

describe('isBlanketBlocked', () => {
  it.each(['/', '/*', '*'])('detects Disallow: %s as blanket block', (path) => {
    const g = parseRobots(`User-agent: GPTBot\nDisallow: ${path}`);
    expect(isBlanketBlocked(g, 'gptbot')).toBe(true);
  });
  it('is false when an Allow: / overrides', () => {
    const g = parseRobots('User-agent: GPTBot\nDisallow: /\nAllow: /');
    expect(isBlanketBlocked(g, 'gptbot')).toBe(false);
  });
  it('is false when only other bots are blocked', () => {
    const g = parseRobots('User-agent: ClaudeBot\nDisallow: /');
    expect(isBlanketBlocked(g, 'gptbot')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/gatherers/robots.test.ts`
Expected: FAIL — module `./robots` not found.

- [ ] **Step 3: Write the implementation**

```ts
// packages/core/src/gatherers/robots.ts
import { stripBom, normalizeNewlines } from './fetch-classify';

export interface RobotsRule {
  type: 'allow' | 'disallow';
  path: string;
}

export interface RobotsGroup {
  userAgent: string;
  rules: RobotsRule[];
  crawlDelay?: number;
}

/** RFC 9309 §2.4: parsers must handle at least 500 KiB; we stop there. */
const MAX_BYTES = 500 * 1024;

export function parseRobots(body: string): RobotsGroup[] {
  const text = normalizeNewlines(stripBom(body)).slice(0, MAX_BYTES);
  const groups: RobotsGroup[] = [];
  let agents: string[] = [];
  let rules: RobotsRule[] = [];
  let crawlDelay: number | undefined;
  let inRules = false;

  const flush = () => {
    for (const agent of agents) {
      groups.push({ userAgent: agent, rules: [...rules], crawlDelay });
    }
    agents = [];
    rules = [];
    crawlDelay = undefined;
    inRules = false;
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const directive = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (directive === 'user-agent') {
      if (inRules) flush();
      agents.push(value);
    } else if (directive === 'disallow' || directive === 'allow') {
      inRules = true;
      rules.push({ type: directive, path: value });
    } else if (directive === 'crawl-delay') {
      inRules = true;
      const parsed = Number.parseFloat(value);
      if (!Number.isNaN(parsed)) crawlDelay = parsed;
    }
  }
  flush();
  return groups;
}

/** Group UA "GPTBot/1.1" matches bot token "gptbot": compare the product token. */
export function matchesUserAgent(groupUserAgent: string, botToken: string): boolean {
  const product = groupUserAgent.trim().toLowerCase().split('/')[0];
  return product === botToken.trim().toLowerCase();
}

export function groupsForBot(groups: RobotsGroup[], botToken: string): RobotsGroup[] {
  const specific = groups.filter((g) => matchesUserAgent(g.userAgent, botToken));
  if (specific.length > 0) return specific;
  return groups.filter((g) => g.userAgent.trim() === '*');
}

/** Compile an RFC 9309 path pattern (* wildcard, $ anchor) to a RegExp. */
function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const core = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${core}${anchored ? '$' : ''}`);
}

export function isPathAllowed(groups: RobotsGroup[], botToken: string, path: string): boolean {
  const applicable = groupsForBot(groups, botToken);
  let best: { length: number; type: 'allow' | 'disallow' } | undefined;
  for (const group of applicable) {
    for (const rule of group.rules) {
      if (rule.path === '') continue; // empty Disallow/Allow matches nothing
      const normalized = rule.path === '*' ? '/*' : rule.path;
      if (!patternToRegex(normalized).test(path)) continue;
      const length = normalized.replace(/\*/g, '').length;
      // Longest match wins; on a tie, allow wins (RFC 9309 §2.2.2).
      if (!best || length > best.length || (length === best.length && rule.type === 'allow')) {
        best = { length, type: rule.type };
      }
    }
  }
  return !best || best.type === 'allow';
}

export function isBlanketBlocked(groups: RobotsGroup[], botToken: string): boolean {
  return !isPathAllowed(groups, botToken, '/');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/gatherers/robots.test.ts`
Expected: PASS.

- [ ] **Step 5: Shim the old helpers and run the whole crawler suite**

Replace the parsing internals of `packages/core/src/audits/crawler-permissions/_robots-txt-helpers.ts` with re-exports so all existing audits pick up the fixes without edits — keep the old exported names as aliases:

```ts
// _robots-txt-helpers.ts (new content, keep the file)
export type { RobotsRule as RobotsTxtRule, RobotsGroup as RobotsTxtGroup } from '../../gatherers/robots';
export {
  parseRobots as parseRobotsTxt,
  matchesUserAgent,
  groupsForBot,
  isPathAllowed,
  isBlanketBlocked,
} from '../../gatherers/robots';
```

Then reconcile the remaining old helper functions in that file (e.g. any `isAllowed`) by re-implementing them on top of `isPathAllowed` with identical signatures — read the file first and keep every currently-exported symbol exported.

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/audits/crawler-permissions`
Expected: PASS. Some v1 tests may assert the buggy behavior (BOM → zero groups, versioned UA invisible); update those assertions to the correct behavior and note it in the commit message.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/gatherers/robots.ts packages/core/src/gatherers/robots.test.ts packages/core/src/audits/crawler-permissions/_robots-txt-helpers.ts packages/core/src/audits/crawler-permissions
git commit -m "feat(core): RFC 9309 robots gatherer; fix BOM, versioned UA, wildcard blanket blocks"
```

---

### Task 3: JSON-LD without entity hoisting (`parser.ts`)

`flattenJsonLd` pushes every nested object to the top level, so `{ "@type": "Article", "publisher": { "@type": "Organization" } }` makes audits see a top-level Organization that the page never declared — inventing entities.

**Files:**
- Modify: `packages/core/src/parser.ts:44-62`
- Test: `packages/core/src/parser.test.ts` (add cases; existing hoisting assertions get corrected)

**Interfaces:**
- Produces:
  - `topLevelJsonLd(blocks: object[]): object[]` — expands arrays and `@graph` members only; nested property objects stay nested.
  - `allJsonLdNodes(blocks: object[]): object[]` — the old deep walk, renamed, for audits that genuinely search nested nodes (review audits looking for nested `AggregateRating`).
  - `flattenJsonLd` stays exported as a deprecated alias of `allJsonLdNodes` (v1 audits keep compiling; Plan 3 migrates call sites and deletes it).

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/parser.test.ts`:

```ts
import { topLevelJsonLd, allJsonLdNodes } from './parser';

describe('topLevelJsonLd', () => {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'X',
    publisher: { '@type': 'Organization', name: 'Acme' },
  };
  it('does not hoist nested property objects to the top level', () => {
    const tops = topLevelJsonLd([article]);
    expect(tops).toHaveLength(1);
    expect((tops[0] as { '@type': string })['@type']).toBe('Article');
  });
  it('expands @graph members as top-level entities', () => {
    const graph = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'S' },
        { '@type': 'Organization', name: 'Acme' },
      ],
    };
    const types = topLevelJsonLd([graph]).map((o) => (o as { '@type': string })['@type']).sort();
    expect(types).toEqual(['Organization', 'WebSite']);
  });
  it('expands top-level arrays', () => {
    const tops = topLevelJsonLd([[{ '@type': 'FAQPage' }, { '@type': 'WebSite' }] as unknown as object]);
    expect(tops).toHaveLength(2);
  });
  it('propagates @context onto @graph members that lack one', () => {
    const graph = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite' }] };
    const tops = topLevelJsonLd([graph]);
    expect((tops[0] as Record<string, unknown>)['@context']).toBe('https://schema.org');
  });
});

describe('allJsonLdNodes', () => {
  it('still walks nested objects for deep searches', () => {
    const article = { '@type': 'Article', publisher: { '@type': 'Organization' } };
    const types = allJsonLdNodes([article]).map((o) => (o as { '@type'?: string })['@type']);
    expect(types).toContain('Organization');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/parser.test.ts -t topLevelJsonLd`
Expected: FAIL — `topLevelJsonLd` is not exported.

- [ ] **Step 3: Write the implementation**

In `parser.ts`, replace the `flattenJsonLd` block (lines 44–62) with:

```ts
/**
 * Top-level JSON-LD entities only: expands arrays and `@graph` members,
 * propagating `@context` downward. Nested property objects (an Article's
 * `publisher`, a Product's `offers`) are NOT hoisted — v1's deep flatten
 * made audits "find" entities the page never declared at top level.
 */
export function topLevelJsonLd(blocks: object[]): object[] {
  const tops: object[] = [];
  const visit = (node: unknown, inheritedContext?: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, inheritedContext);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const ctx = obj['@context'] ?? inheritedContext;
    if (!obj['@context'] && ctx) obj['@context'] = ctx;
    const graph = obj['@graph'];
    if (Array.isArray(graph)) {
      for (const member of graph) visit(member, ctx);
      return;
    }
    tops.push(obj);
  };
  for (const block of blocks) visit(block);
  return tops;
}

/**
 * Every JSON-LD node including nested ones — for audits that legitimately
 * search deep (e.g. AggregateRating nested under Product).
 */
export function allJsonLdNodes(blocks: object[]): object[] {
  const flat: object[] = [];
  const visit = (node: unknown, inheritedContext?: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, inheritedContext);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const ctx = obj['@context'] ?? inheritedContext;
    if (!obj['@context'] && ctx) obj['@context'] = ctx;
    flat.push(obj);
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') visit(value, ctx);
    }
  };
  for (const block of blocks) visit(block);
  return flat;
}

/** @deprecated v1 name for the deep walk. Use topLevelJsonLd (structure) or allJsonLdNodes (deep search). Removed in v2. */
export const flattenJsonLd = allJsonLdNodes;
```

- [ ] **Step 4: Run the full parser + structured-data suites**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/parser.test.ts src/audits/structured-data`
Expected: PASS — `flattenJsonLd` alias keeps v1 behavior for existing call sites.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/parser.ts packages/core/src/parser.test.ts
git commit -m "feat(core): topLevelJsonLd without entity hoisting; deep walk renamed allJsonLdNodes"
```

---

### Task 4: Per-bot UA probe (`gatherers/bot-probe.ts`)

Edge blocks (Cloudflare "Block AI Scrapers") 403 the bot UA while the scanner UA sees 200 — v1 has no way to detect this and PASSes blocked sites.

**Files:**
- Create: `packages/core/src/gatherers/bot-probe.ts`
- Test: `packages/core/src/gatherers/bot-probe.test.ts`

**Interfaces:**
- Consumes: `CheckContext.fetch` (signature `(options: FetchOptions) => Promise<FetchResult>`); `FetchOptions` currently has no UA field — this task adds `userAgent?: string` to `FetchOptions` and threads it through the `request()` headers in `fetcher.ts`.
- Produces:
  - `interface BotProbeResult { botUserAgent: string; baselineStatus: number; botStatus: number; edgeBlocked: boolean }`
  - `probeAsBot(fetch: CheckContext['fetch'], url: string, botUserAgent: string, baseline: FetchResult): Promise<BotProbeResult>`
  - `edgeBlocked` = baseline 2xx/3xx while bot status is 401/403/429/503, or bot fetch errored with a challenge marker.

- [ ] **Step 1: Add `userAgent` to FetchOptions (failing type usage first)**

Write the probe test; it will not compile until `FetchOptions.userAgent` exists.

```ts
// packages/core/src/gatherers/bot-probe.test.ts
import { describe, it, expect } from 'vitest';
import { probeAsBot } from './bot-probe';
import type { FetchOptions, FetchResult } from '../fetcher';

const result = (status: number): FetchResult => ({
  url: 'https://x.test/',
  finalUrl: 'https://x.test/',
  status,
  headers: {},
  body: '',
  ttfbMs: 1,
  totalMs: 2,
  contentType: 'text/html',
  contentLength: 0,
});

const fetchReturning = (status: number) => {
  const calls: FetchOptions[] = [];
  const fn = async (options: FetchOptions): Promise<FetchResult> => {
    calls.push(options);
    return result(status);
  };
  return { fn, calls };
};

describe('probeAsBot', () => {
  it('sends the bot user-agent on the probe request', async () => {
    const { fn, calls } = fetchReturning(200);
    await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(200));
    expect(calls[0].userAgent).toBe('GPTBot/1.4');
  });
  it('flags edgeBlocked when baseline is 200 and bot gets 403', async () => {
    const { fn } = fetchReturning(403);
    const probe = await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(200));
    expect(probe.edgeBlocked).toBe(true);
    expect(probe.baselineStatus).toBe(200);
    expect(probe.botStatus).toBe(403);
  });
  it('is not edgeBlocked when both see 200', async () => {
    const { fn } = fetchReturning(200);
    const probe = await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(200));
    expect(probe.edgeBlocked).toBe(false);
  });
  it('is not edgeBlocked when the baseline itself is blocked (site-wide, not bot-targeted)', async () => {
    const { fn } = fetchReturning(403);
    const probe = await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(403));
    expect(probe.edgeBlocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/gatherers/bot-probe.test.ts`
Expected: FAIL — module not found / `userAgent` not in `FetchOptions`.

- [ ] **Step 3: Implement fetcher change + probe**

In `fetcher.ts`: add `userAgent?: string;` to `FetchOptions` (after `contentType`), and where request headers are assembled (find the object containing `'user-agent': SCANNER_USER_AGENT`), use `options.userAgent ?? SCANNER_USER_AGENT`.

```ts
// packages/core/src/gatherers/bot-probe.ts
import type { FetchOptions, FetchResult } from '../fetcher';

export interface BotProbeResult {
  botUserAgent: string;
  baselineStatus: number;
  botStatus: number;
  edgeBlocked: boolean;
}

const BLOCK_STATUSES = new Set([401, 403, 429, 503]);

/**
 * Refetch a URL presenting a real bot's User-Agent and compare with the
 * baseline scanner fetch. A clean baseline + blocked bot response is the
 * signature of UA-based edge blocking (e.g. Cloudflare "Block AI Scrapers"),
 * which robots.txt-based audits cannot see.
 */
export async function probeAsBot(
  fetch: (options: FetchOptions) => Promise<FetchResult>,
  url: string,
  botUserAgent: string,
  baseline: FetchResult,
): Promise<BotProbeResult> {
  const probe = await fetch({ url, userAgent: botUserAgent, followRedirects: true });
  const baselineOk = baseline.status >= 200 && baseline.status < 400;
  const botBlocked = BLOCK_STATUSES.has(probe.status);
  return {
    botUserAgent,
    baselineStatus: baseline.status,
    botStatus: probe.status,
    edgeBlocked: baselineOk && botBlocked,
  };
}
```

- [ ] **Step 4: Run tests, including fetcher suite**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/gatherers/bot-probe.test.ts src/fetcher.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gatherers/bot-probe.ts packages/core/src/gatherers/bot-probe.test.ts packages/core/src/fetcher.ts
git commit -m "feat(core): per-bot UA probe gatherer; FetchOptions.userAgent"
```

---

### Task 5: Multi-page helpers (`gatherers/pages.ts`)

Review found meta-tags (and others) silently judging only `ctx.pages[0]`. Give audits one obvious correct way to look at all pages.

**Files:**
- Create: `packages/core/src/gatherers/pages.ts`
- Test: `packages/core/src/gatherers/pages.test.ts`

**Interfaces:**
- Consumes: `CheckContext`, `PageContext` from `../check-context`; `PageType` from `../types`.
- Produces:
  - `pagesOfType(ctx: CheckContext, ...types: PageType[]): PageContext[]` (empty `types` = all pages)
  - `interface PageJudgement { page: PageContext; ok: boolean; detail?: string }`
  - `judgePages(pages: PageContext[], judge: (page: PageContext) => { ok: boolean; detail?: string }): { judged: PageJudgement[]; passRate: number; failures: PageJudgement[] }` — `passRate` is 0..1 over judged pages; empty input gives `passRate: 1, judged: []` so callers must gate `notApplicable` on `judged.length === 0`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/gatherers/pages.test.ts
import { describe, it, expect } from 'vitest';
import { pagesOfType, judgePages } from './pages';
import { parseHtml } from '../parser';
import type { CheckContext, PageContext } from '../check-context';
import type { PageType } from '../types';

const page = (url: string, pageType: PageType, title: string): PageContext => ({
  url,
  pageType,
  fetchResult: {
    url, finalUrl: url, status: 200, headers: {}, body: '', ttfbMs: 1, totalMs: 1,
    contentType: 'text/html', contentLength: 0,
  },
  $: parseHtml(`<title>${title}</title>`),
  jsonLd: [],
  meta: title ? { description: title } : {},
  headLinks: [],
});

const ctx = {
  pages: [
    page('https://x.test/', 'homepage', 'Home'),
    page('https://x.test/p', 'product', ''),
    page('https://x.test/c', 'category', 'Cat'),
  ],
} as unknown as CheckContext;

describe('pagesOfType', () => {
  it('returns all pages when no types given', () => {
    expect(pagesOfType(ctx)).toHaveLength(3);
  });
  it('filters by page type', () => {
    expect(pagesOfType(ctx, 'product').map((p) => p.url)).toEqual(['https://x.test/p']);
  });
});

describe('judgePages', () => {
  it('judges every page, not just the first', () => {
    const { judged, passRate, failures } = judgePages(pagesOfType(ctx), (p) => ({
      ok: Boolean(p.meta['description']),
      detail: p.url,
    }));
    expect(judged).toHaveLength(3);
    expect(passRate).toBeCloseTo(2 / 3);
    expect(failures.map((f) => f.page.url)).toEqual(['https://x.test/p']);
  });
  it('empty page set gives passRate 1 and empty judged (caller must return na)', () => {
    const { judged, passRate } = judgePages([], () => ({ ok: true }));
    expect(judged).toHaveLength(0);
    expect(passRate).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/gatherers/pages.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// packages/core/src/gatherers/pages.ts
import type { CheckContext, PageContext } from '../check-context';
import type { PageType } from '../types';

export function pagesOfType(ctx: CheckContext, ...types: PageType[]): PageContext[] {
  if (types.length === 0) return ctx.pages;
  const wanted = new Set(types);
  return ctx.pages.filter((p) => wanted.has(p.pageType));
}

export interface PageJudgement {
  page: PageContext;
  ok: boolean;
  detail?: string;
}

/**
 * Run one judgement over a set of pages. v1 audits frequently judged only
 * pages[0] and generalized to the whole site; this makes per-page judgement
 * the path of least resistance. Callers MUST return notApplicable when
 * `judged.length === 0` — an empty set proves nothing.
 */
export function judgePages(
  pages: PageContext[],
  judge: (page: PageContext) => { ok: boolean; detail?: string },
): { judged: PageJudgement[]; passRate: number; failures: PageJudgement[] } {
  const judged = pages.map((page) => ({ page, ...judge(page) }));
  const failures = judged.filter((j) => !j.ok);
  const passRate = judged.length === 0 ? 1 : (judged.length - failures.length) / judged.length;
  return { judged, passRate, failures };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/gatherers/pages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gatherers/pages.ts packages/core/src/gatherers/pages.test.ts
git commit -m "feat(core): multi-page judgement gatherer"
```

---

### Task 6: Weighted category scoring (`scorer.ts`)

Spec §4: audit weight A=1.0 / B=0.6 lives in `AuditMeta.weight`; category score = weighted mean over applicable checks. Current `calculateCategoryScore` (scorer.ts:4-12) ignores weight entirely.

**Files:**
- Modify: `packages/core/src/scorer.ts`
- Modify: `packages/core/src/types.ts` (add `weight?: number` to `CheckResult` — audits already carry weight in meta; the runner copies it onto the result)
- Modify: `packages/core/src/audit-runner.ts` (copy `meta.weight` onto each produced `CheckResult` — find where `CheckResult` objects are assembled from `AuditResult` and add `weight: meta.weight`)
- Test: `packages/core/src/scorer.test.ts` (extend)

**Interfaces:**
- Produces: `calculateCategoryScore(checks: CheckResult[]): number` — same name/signature, now weighted: `round(100 * Σ(score·weight) / Σ(weight))` over `status !== 'na'` checks; missing/zero `weight` treated as 0 (informative checks never move the score); returns 0 when total weight is 0.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/scorer.test.ts`:

```ts
import { calculateCategoryScore } from './scorer';
import type { CheckResult } from './types';

const check = (over: Partial<CheckResult>): CheckResult =>
  ({
    id: 'x', name: 'x', status: 'pass', score: 1, message: '', expected: '', found: '',
    priority: 'medium',
    ...over,
  }) as CheckResult;

describe('weighted category score', () => {
  it('weights A (1.0) over B (0.6)', () => {
    const checks = [
      check({ status: 'pass', score: 1, weight: 1.0 }),
      check({ status: 'fail', score: 0, weight: 0.6 }),
    ];
    // (1*1.0 + 0*0.6) / 1.6 = 0.625
    expect(calculateCategoryScore(checks)).toBe(63);
  });
  it('weight 0 (informative) never moves the score', () => {
    const base = [check({ status: 'pass', score: 1, weight: 1.0 })];
    const withInformative = [...base, check({ status: 'fail', score: 0, weight: 0 })];
    expect(calculateCategoryScore(withInformative)).toBe(calculateCategoryScore(base));
  });
  it('property: adding a na check never changes the score', () => {
    const base = [
      check({ status: 'pass', score: 1, weight: 1.0 }),
      check({ status: 'fail', score: 0, weight: 0.6 }),
    ];
    const withNa = [...base, check({ status: 'na', score: 0, weight: 1.0 })];
    expect(calculateCategoryScore(withNa)).toBe(calculateCategoryScore(base));
  });
  it('all-na or zero-total-weight scores 0', () => {
    expect(calculateCategoryScore([check({ status: 'na', weight: 1 })])).toBe(0);
    expect(calculateCategoryScore([check({ status: 'fail', score: 0, weight: 0 })])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/scorer.test.ts`
Expected: FAIL — current implementation divides by count, not weight (first case yields 50, not 63), and `weight` is not on `CheckResult`.

- [ ] **Step 3: Implement**

`types.ts` — in `interface CheckResult` add:

```ts
  /** Evidence-derived weight copied from AuditMeta.weight (A=1.0, B=0.6, informative=0). */
  weight?: number;
```

`scorer.ts` — replace `calculateCategoryScore`:

```ts
export function calculateCategoryScore(checks: CheckResult[]): number {
  // Not-applicable checks leave the denominator entirely: "nothing to
  // assess" must not move a score in either direction.
  const scored = checks.filter((c) => c.status !== 'na');
  const totalWeight = scored.reduce((sum, c) => sum + (c.weight ?? 0), 0);
  if (totalWeight === 0) return 0;
  const weighted = scored.reduce((sum, c) => sum + c.score * (c.weight ?? 0), 0);
  return Math.round((weighted / totalWeight) * 100);
}
```

`audit-runner.ts` — locate where the `CheckResult` is built from an audit's `AuditResult` + `meta` and add `weight: meta.weight,` to that object literal.

- [ ] **Step 4: Run scorer + runner + full core suite**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/scorer.test.ts src/audit-runner.test.ts`
Then: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run`
Expected: scorer/runner PASS. Snapshot-style score expectations elsewhere may shift (v1 meta weights vary) — update those assertions to the weighted values and list them in the commit body.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/scorer.ts packages/core/src/scorer.test.ts packages/core/src/types.ts packages/core/src/audit-runner.ts
git commit -m "feat(core)!: weighted category scoring; na excluded from denominator"
```

---

### Task 7: Un-silence the axe parity test

`packages/core/src/audits/accessibility/engine/parity.test.ts:247` — `describe.skipIf(!axeAvailable)` silently skips the whole parity suite when `axe-core` is not installed. The review flagged this: the a11y engine's correctness gate never runs.

**Files:**
- Modify: `packages/core/package.json` (add `axe-core@4.12.1` + `jsdom` to `devDependencies` if absent)
- Modify: `packages/core/src/audits/accessibility/engine/parity.test.ts:247`

**Interfaces:** none new.

- [ ] **Step 1: Reproduce the silent skip**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/audits/accessibility/engine/parity.test.ts`
Record whether output says "skipped". If it runs (axe already installed), this task is only Step 3.

- [ ] **Step 2: Install the pinned dev dependency**

```bash
pnpm --filter @forkpoint/agent-lighthouse-core add -D axe-core@4.12.1
```

- [ ] **Step 3: Make missing axe a loud failure, not a skip**

In `parity.test.ts`, replace `describe.skipIf(!axeAvailable)(...)` with:

```ts
if (!axeAvailable) {
  throw new Error(
    'axe-core is not installed — the a11y parity suite is the correctness gate for the ported rules and must run. `pnpm --filter @forkpoint/agent-lighthouse-core add -D axe-core@4.12.1`',
  );
}
describe('a11y port parity with axe-core@4.12.1', () => {
```

- [ ] **Step 4: Run the parity suite; fix any real divergences it reveals**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/audits/accessibility/engine/parity.test.ts`
Expected: PASS. If parity failures surface (the suite has not been running), fix the ported rule in `engine/` to match axe behavior — the axe result is the reference, per the suite's own assertions. Each divergence fix is its own commit.

- [ ] **Step 5: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml packages/core/src/audits/accessibility/engine/parity.test.ts
git commit -m "test(core): make axe parity suite mandatory, pin axe-core@4.12.1"
```

---

### Task 8: `notApplicable` test helper

Spec §10: test template asserts the `notApplicable` path exists. Give Plan 3/4 implementers the helper now.

**Files:**
- Create: `packages/core/src/tests/na-contract.ts` (the `tests/` dir already exists)
- Test: `packages/core/src/tests/na-contract.test.ts`

**Interfaces:**
- Consumes: `Audit` class from `../audit` (audits expose `audit(ctx: CheckContext): AuditResult` and static `meta`); `CheckContext`.
- Produces:
  - `emptyContext(overrides?: Partial<CheckContext>): CheckContext` — minimal context: no pages, no root files, `domain: 'example.test'`, `baseUrl: 'https://example.test'`, `fetch` that returns a 404 `FetchResult` for any URL.
  - `expectNotApplicableOnEmpty(audit: { audit(ctx: CheckContext): AuditResult | Promise<AuditResult> }): Promise<void>` — runs the audit against `emptyContext()` and asserts `status === 'na'`; the assertion message names the vacuous-pass defect.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/tests/na-contract.test.ts
import { describe, it, expect } from 'vitest';
import { emptyContext, expectNotApplicableOnEmpty } from './na-contract';
import type { CheckContext } from '../check-context';
import type { AuditResult } from '../types';

const naAudit = {
  audit(_ctx: CheckContext): AuditResult {
    return { status: 'na', score: 0, message: 'nothing to assess', expected: '', found: '' } as AuditResult;
  },
};
const vacuousAudit = {
  audit(_ctx: CheckContext): AuditResult {
    return { status: 'pass', score: 1, message: 'passes on nothing', expected: '', found: '' } as AuditResult;
  },
};

describe('na contract', () => {
  it('emptyContext has no pages and 404s every fetch', async () => {
    const ctx = emptyContext();
    expect(ctx.pages).toHaveLength(0);
    const result = await ctx.fetch({ url: 'https://example.test/llms.txt' });
    expect(result.status).toBe(404);
  });
  it('accepts an audit that returns na on an empty site', async () => {
    await expectNotApplicableOnEmpty(naAudit);
  });
  it('rejects a vacuous pass', async () => {
    await expect(expectNotApplicableOnEmpty(vacuousAudit)).rejects.toThrow(/vacuous/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/tests/na-contract.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// packages/core/src/tests/na-contract.ts
import type { CheckContext } from '../check-context';
import type { FetchOptions, FetchResult } from '../fetcher';
import type { AuditResult } from '../types';

const notFound = (url: string): FetchResult => ({
  url,
  finalUrl: url,
  status: 404,
  headers: {},
  body: '',
  ttfbMs: 0,
  totalMs: 0,
  contentType: '',
  contentLength: 0,
});

export function emptyContext(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    rootFiles: {},
    pages: [],
    domain: 'example.test',
    baseUrl: 'https://example.test',
    fetch: async (options: FetchOptions) => notFound(options.url),
    ...overrides,
  };
}

/**
 * Contract test: on a site with nothing to assess, an audit must return
 * notApplicable — a `pass` here is the vacuous-pass score inflation the
 * v2 restructure removes. Every audit's test file calls this once.
 */
export async function expectNotApplicableOnEmpty(audit: {
  audit(ctx: CheckContext): AuditResult | Promise<AuditResult>;
}): Promise<void> {
  const result = await audit.audit(emptyContext());
  if (result.status !== 'na') {
    throw new Error(
      `Expected notApplicable on an empty site, got "${result.status}" — vacuous ${result.status} inflates scores for features the site does not have.`,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core test -- run src/tests/na-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + full suite + commit**

Run: `rtk err pnpm lint` (never bare `pnpm lint`), then `pnpm --filter @forkpoint/agent-lighthouse-core test -- run`
Expected: lint 0 errors, tests PASS.

```bash
git add packages/core/src/tests/na-contract.ts packages/core/src/tests/na-contract.test.ts
git commit -m "test(core): notApplicable contract helper for audit tests"
```

---

## Follow-up plans (not in this plan)

- Plan 2 — v1 final minor: sunset audits → informative + deprecation notices, `migration-map.json`.
- Plan 3 — taxonomy restructure: 8 category dirs, slug ids, `_a11y` split, merges/splits/consolidations, 24 redemption rewrites, gatherer adoption sweep (audits switch to `isRealFile`, `topLevelJsonLd`, `judgePages`, `probeAsBot`), a11y snapshot/CSS-strip ordering guard (spec §7 dom row — lands with the `_a11y` split), CI dossier linkage.
- Plan 4 — 83 proposed audits graduate, grade A first.
- Plan 5 — report/cli/mcp surfaces, evidence-mass overall score switch, safety cap, major changeset.
