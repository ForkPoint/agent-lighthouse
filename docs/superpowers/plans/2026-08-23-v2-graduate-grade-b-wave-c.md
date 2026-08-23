# Plan 5b Wave C — graduate the feeds-indexing, bot-auth-access and content-signal proposals

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 11 `feeds-indexing`, `bot-auth-access` and `competitor-gap-verify/content-signal-coherence` proposals out of `packages/core/src/audits/proposed/`. Ten become new audits — 5 in `access-crawl-control`, 5 in `machine-discovery` — and one merges into another proposal in the same wave. The registry grows 193 → 203.

**Architecture:** Same graduation recipe as Waves A and B. Three departures, all decided before the plan was written:

1. `competitor-gap-verify/content-signal-coherence` does **not** become its own audit. Its mechanism — robots.txt `Content-Signal` lines read with RFC 9309 group precedence — is one channel of `bot-auth-access/ai-usage-signal-coherence-across-channels`, which reads five. They ship as one audit, `access-crawl-control/ai-usage-signal-coherence-across-channels`, and the content-signal dossier folds into `docs/evidence/merged/access-crawl-control/`.
2. `feeds-indexing/three-way-freshness-lag-and-orphaned-fresh-content` ships as its freshness half only. Its orphan half — pages reachable from the site but absent from the sitemap and the feed — is already `machine-discovery/discovery-index-coverage`, shipped, grade B, scored. Recomputing it here would fail a site twice for one defect off two different page samples.
3. Every id is capped at 64 characters by `schemas.ts` (`id: z.string().max(64)`). Six proposal slugs are longer than the cap allows once the category prefix is added, so they are renamed. The proposal's full name survives as the audit title, and each rename is recorded under `## Implementation deviations` in its dossier.

**Tech Stack:** TypeScript, vitest, cheerio, undici, `node:crypto` (Ed25519, RFC 9421), zod, tsup, changesets, oxlint.

## Global Constraints

- **Meta law:** `weight = weightForGrade(grade, tier)`. Grade B → `scored` at 0.6; grade C → `informative` at 0 with `scoreDisplayMode: 'informative'`. `sunset.test.ts` enforces `tier !== 'scored' ⟺ weight === 0`. Grade C in `scored` is unregistrable.
- **Grade is fixed by the dossier.** Never re-grade while implementing. What the implementation cannot reach goes under `## Deferred` in the dossier.
- **Ids are at most 64 characters**, category prefix included. Task 0 lists every rename; use those exact slugs.
- **One audit = one file + one dossier.** `<category>/<slug>.ts`, `<slug>.test.ts` beside it, `docs/evidence/audits/<category>/<slug>.md`.
- **`notApplicable` is never a vacuous pass.** Every test file calls `expectNotApplicableOnEmpty(audit)`.
- **Every new URL fetch is `isSafeUrl()`-gated.** Test suites `vi.mock('../../fetcher')` — no real DNS in tests.
- **Probe budget.** This wave is the most network-hungry of the four. Reuse `gatherers/ua-parity.ts` (`sharedUaProbes`, `sharedControlProbe`), `gatherers/sitemap.ts` (`siteSitemapTree`), `gatherers/sampled-pages.ts` and `ctx.rootFiles` rather than adding per-audit fetches. Task 1's `gatherers/feeds.ts` and `gatherers/conditional.ts` each cache per scan. `verify-scan-results.test.ts` runs the whole registry against live sites at a 150s per-describe timeout.
- **Read-only probes only.** Every request this wave sends is a GET or a HEAD. No POST, no authenticated path, no request outside the scanned origin except a HEAD of a declared WebSub hub.
- **The signed-agent probe carries a per-scan ephemeral Ed25519 key.** It proves nothing about identity and claims nothing: it exists to find out whether an origin rejects a request *because* it carries RFC 9421 signature headers. It is never presented as a verified agent.
- **Comments in English**, in every file.
- **Lint only via `rtk err pnpm lint`.** Never bare `pnpm lint`, never ESLint.
- **Four gates at every task boundary:** `AL_SKIP_NETWORK=1 pnpm test`, `pnpm typecheck`, `rtk err pnpm lint`, and `pnpm --filter @forkpoint/agent-lighthouse-core build && node scripts/check-dossiers.mjs`.
- **Check the dossier's Evidence section against its mechanism paragraph.** Wave B found the `answer-selection-forensics` dossiers carrying an evidence block pasted from an unrelated proposal. Where the sources do not match the mechanism, the dossier is wrong: restate the sources the mechanism names and say what was replaced.
- **Do not push.** The controller pushes after user approval.

---

## Task 0: the slug renames

| Proposal | Shipped id | Length |
| :-- | :-- | --: |
| `bot-auth-access/ai-usage-signal-coherence-across-channels` | `access-crawl-control/ai-usage-signal-coherence-across-channels` | 62 |
| `bot-auth-access/aipref-content-usage-declaration-validity` | `access-crawl-control/aipref-content-usage-declaration-validity` | 62 |
| `bot-auth-access/rsl-licensing-terms-discoverable-and-conformant` | `access-crawl-control/rsl-licensing-terms-conformance` | 52 |
| `bot-auth-access/machine-actionable-402-paid-access-response` | `access-crawl-control/machine-actionable-402-paid-access` | 55 |
| `bot-auth-access/signed-agent-web-bot-auth-request-tolerance` | `access-crawl-control/web-bot-auth-request-tolerance` | 50 |
| `feeds-indexing/conditional-request-support-on-discovery-surfaces` | `machine-discovery/conditional-request-support` | 45 |
| `feeds-indexing/feed-entry-identity-and-canonical-integrity` | `machine-discovery/feed-entry-identity-and-canonical-integrity` | 60 |
| `feeds-indexing/root-text-file-resolution-integrity-indexnow-key-file-precon` | `machine-discovery/root-text-file-resolution-integrity` | 52 |
| `feeds-indexing/three-way-freshness-lag-and-orphaned-fresh-content` | `machine-discovery/three-way-freshness-lag` | 40 |
| `feeds-indexing/websub-hub-advertisement-and-self-link-correctness` | `machine-discovery/websub-hub-advertisement` | 41 |

`competitor-gap-verify/content-signal-coherence` ships no id of its own.

---

## File Structure

| File | Responsibility |
| :-- | :-- |
| `packages/core/src/gatherers/feeds.ts` | `discoverFeeds`, `parseFeed`, `FeedDocument`, `FeedEntry` — one feed discovery and parse per scan, cached |
| `packages/core/src/gatherers/conditional.ts` | `revalidationProbe(ctx, url)` — the four-request conditional-request probe, cached per URL |
| `packages/core/src/gatherers/structured-fields.ts` | `parseDictionary` — the RFC 8941 subset AIPREF needs |
| `packages/core/src/audits/access-crawl-control/_robots-txt-helpers.ts` | gains `directiveLines(group, name)` — non-rule directives kept per group |
| `packages/core/src/audits/access-crawl-control/<slug>.ts` + `.test.ts` | 5 new audits |
| `packages/core/src/audits/machine-discovery/<slug>.ts` + `.test.ts` | 5 new audits |
| `packages/core/src/tests/new-in-v2.ts` | `NEW_IN_V2` gains 10 ids |
| `docs/evidence/audits/<category>/<slug>.md` | 10 moved dossiers |
| `docs/evidence/merged/access-crawl-control/content-signal-coherence.md` | the folded dossier, with a row in `docs/evidence/merged/README.md` |
| `packages/core/src/audits/proposed/README.md` | stub count 28 → 17, 11 bullets deleted |
| `docs/evidence/proposals/README.md` | matching count decrement |
| `.changeset/v2-graduate-grade-b-wave-c.md` | one changeset for the wave |

---

## The per-audit recipe (Steps A–I)

Identical to Waves A and B. Each task supplies only what differs: the class name, the meta values, and the "Test must pin" list that is its acceptance criteria.

**Step A** — read the stub sketch and the proposal dossier; the dossier governs on conflict.
**Step B** — write the failing test at `<category>/<slug>.test.ts`, one `it` per pinned row, plus `expectNotApplicableOnEmpty`.
**Step C** — implement `<category>/<slug>.ts`.
**Step D** — register: export, import, array entry in the category `index.ts`, all three in the same order.
**Step E** — `git mv` the dossier to `docs/evidence/audits/<category>/<slug>.md`, rewrite its frontmatter to the audit shape, append `## Implementation deviations` and `## Deferred`.
**Step F** — append the id to `NEW_IN_V2`.
**Step G** — `git rm` the stub, decrement both proposal READMEs.
**Step H** — all four gates.
**Step I** — commit, one commit per audit.

---

### Task 1: shared modules

Three new gatherers plus one helper extension. No audit lands until these exist, because six of the ten would otherwise each grow their own feed parser.

**`gatherers/feeds.ts`**

```ts
export interface FeedEntry {
  id: string;            // atom:id or rss guid, '' when absent
  idIsPermalink: boolean; // rss isPermaLink, true by default per the RSS spec
  link: string;          // resolved absolute item link, '' when absent
  updated: number | undefined; // epoch ms, UTC, undefined when unparseable or timezone-less
  title: string;
  summaryPresent: boolean;
  contentSrc: string;    // atom:content/@src, '' when absent
  contentType: string;   // atom:content/@type, '' when absent
}

export interface FeedDocument {
  url: string;
  contentType: string;
  declaredType: 'rss' | 'atom' | 'json' | 'unknown';
  status: number;
  bomOrLeadingSpace: boolean;
  parsed: boolean;
  selfLink: string;      // atom:link rel=self or Link header rel=self
  hubLinks: string[];    // rel=hub, header first then document
  lastBuild: number | undefined;
  entries: FeedEntry[];
}

/** Autodiscovered plus conventional feed URLs, deduped, same-host only. */
export function discoverFeedUrls(ctx: CheckContext): string[];

/** Fetch and parse, once per scan per URL. */
export function sharedFeed(ctx: CheckContext, url: string): Promise<FeedDocument | undefined>;
```

**`gatherers/conditional.ts`**

```ts
export interface RevalidationResult {
  url: string;
  status: number;
  etag: string;
  lastModified: string;
  cacheControl: string;
  bytes: number;          // decoded body length of the first GET
  bodyStable: boolean;    // second GET returned the same body hash
  etagStable: boolean;    // ...and the same ETag
  honoursIfNoneMatch: boolean | undefined; // undefined when no ETag was sent
  honoursIfModifiedSince: boolean | undefined;
}

/** Up to four GETs of one URL, cached per scan. */
export function sharedRevalidation(ctx: CheckContext, url: string): Promise<RevalidationResult | undefined>;
```

**`gatherers/structured-fields.ts`**

```ts
/** RFC 8941 dictionary, the subset AIPREF uses: bare keys, token and boolean values. */
export function parseDictionary(input: string): { ok: true; value: Map<string, string> } | { ok: false; error: string };
```

**`_robots-txt-helpers.ts`** gains:

```ts
/** Non-rule directive lines (`Content-Signal`, `Content-Usage`, `License`) kept per group. */
export function directiveLines(robotsTxt: string, name: string): Array<{ group: string; value: string; line: number }>;
```

**Test must pin:**
- `discoverFeedUrls` returns the `<link rel="alternate">` targets of the homepage plus the conventional paths, deduped, same-host only, and drops a cross-host feed.
- `sharedFeed` fetches one URL once when two audits ask for it.
- An RSS `<guid>` with no `isPermaLink` attribute reads as a permalink; `isPermaLink="false"` does not.
- A timezone-less date parses to `undefined`, never to a guessed UTC value.
- `sharedRevalidation` sends at most four GETs, and reports `honoursIfNoneMatch: undefined` when the surface emitted no `ETag`.
- `parseDictionary('train-ai=n, search=y')` yields both pairs; `parseDictionary('train-ai=yes')` fails with an error naming the legacy syntax.
- `directiveLines` returns a `Content-Signal` line under the group it was written in, with its line number.

Commit: `feat(core): feed, revalidation and structured-field gatherers for Wave C`.

---

### Task 2: `access-crawl-control/ai-usage-signal-coherence-across-channels`

Class `AiUsageSignalCoherenceAcrossChannelsAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'moderate'`.

Merges `competitor-gap-verify/content-signal-coherence`. Five channels: robots.txt (`Content-Usage`, `Content-Signal`, `License`, per-agent `Allow`/`Disallow`), response headers (`Content-Usage`, `tdm-reservation`, `tdm-policy`, `X-Robots-Tag` including `noai`), HTML meta (`tdm-reservation`, `tdm-policy`, `robots: noai`), `/.well-known/tdmrep.json`, and the discovered RSL document.

**Test must pin:**
- Each channel maps into the AIPREF category space: `tdm-reservation: 1` → `train-ai=n`; RSL `<prohibits type="usage">ai-input</prohibits>` → `ai-input=n`; `Content-Signal: ai-train=no` → `train-ai=n`; `Disallow: /` for GPTBot → `train-ai=n` for that agent; `noai` → `train-ai=n`.
- Two channels disagreeing on one category over overlapping path scope → `fail`, naming both channels and both source lines.
- A `Content-Signal` line inside a named group does not silently apply to `*` — RFC 9309 group precedence, the same rule `robots-ai-group-shadowing` applies to rules.
- The edge-override case: a `Content-Signal` block above the operator's own directives that disagrees with a signal published elsewhere → its own finding, distinct from an ordinary contradiction.
- No signal in any channel → `warn`, with a remediation different from the contradiction one.
- Coherent, or coherently silent plus one declaration → `pass`.
- `/.well-known/tdmrep.json` that is a bare object rather than an array → reported as non-conformant, and its signal is not used.
- The audit sends no request the scan has not already made.

Fold: `git mv docs/evidence/proposals/competitor-gap-verify/content-signal-coherence.md docs/evidence/merged/access-crawl-control/content-signal-coherence.md`, add its row to `docs/evidence/merged/README.md`, and record the merge under `## Implementation deviations` in the surviving dossier.

---

### Task 3: `access-crawl-control/aipref-content-usage-declaration-validity`

Class `AiprefContentUsageDeclarationValidityAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

**Test must pin:**
- `Content-Usage: train-ai=n` at file scope and inside a `User-agent` group are both collected, with their group.
- A leading path token (`Content-Usage: /ai-ok/ train-ai=y`) is split off before the dictionary is parsed.
- An unknown category token → `fail`; `train-ai=yes` → `fail` naming the legacy `Content-Signal` syntax specifically.
- A declaration attached only to a path the same group disallows → `fail` as inert, naming the deciding rule.
- The robots.txt directive and the `Content-Usage` response header disagreeing for the same path → `fail`.
- Only legacy `Content-Signal` present → `warn` as a migration gap.
- At least one valid non-inert declaration, header and robots agreeing → `pass`.
- No declaration anywhere → `notApplicable`, never a failure.

---

### Task 4: `access-crawl-control/rsl-licensing-terms-conformance`

Class `RslLicensingTermsConformanceAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

**Test must pin:**
- Candidates are collected from all four channels: robots.txt `License:`, `Link:` response header with `rel=license` **and** `type=application/rsl+xml`, `<link rel="license" type="application/rsl+xml">`, and inline `<script type="application/rsl+xml">`.
- A relative `License:` value → non-conformant, reported, and not resolved.
- A document found only at `/license.xml` or `/rsl.xml` → reported as "present but not discoverable", not as a pass.
- Root element must be `<rsl>` with `xmlns="https://rslstandard.org/rsl"`; a wrong namespace fails.
- `<content url="/blog/">` while the audited pages live under `/articles/` → fail, naming the uncovered path.
- Enumerated attributes are validated: `<permits|prohibits>` type in {usage,user,geo}; `<payment>` type in {purchase,subscription,crawl,use,attribution,free}; `<amount>` carries an ISO 4217 currency and a parseable decimal; `<copyright>` carries `contactEmail` or `contactUrl`.
- No RSL document anywhere → `notApplicable`.

---

### Task 5: `access-crawl-control/machine-actionable-402-paid-access`

Class `MachineActionable402PaidAccessAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

Reads the responses `gatherers/ua-parity.ts` already captured. It issues no request of its own.

**Test must pin:**
- A 402 is machine-actionable on any of: a `crawler-price` header matching `/^[A-Z]{3}\s+\d+(\.\d+)?$/` with a real ISO 4217 currency; a `PAYMENT-REQUIRED` header whose base64 decodes to JSON with `x402Version` and a non-empty `accepts` array whose items each carry scheme, network, amount, asset and payTo; or an RSL `<payment type="crawl">` with an `<amount currency>` whose `<content url>` covers the 402'd path.
- A 402 with `content-type: text/html` and none of the three → `fail`.
- A malformed currency token or an unparseable amount → its own sub-finding.
- A `Cache-Control` on the 402 that would let a shared cache serve it to other clients → reported: a cached 402 locks out crawlers that already paid.
- A 402 returned to the browser baseline as well as to crawler UAs → reported as a rule hitting humans.
- No 402 observed anywhere → `notApplicable`, never a failure. A free site is not a defective site.

---

### Task 6: `access-crawl-control/web-bot-auth-request-tolerance`

Class `WebBotAuthRequestToleranceAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'complex'`.

Two GETs of the site root: a baseline with a neutral UA, and the identical request carrying RFC 9421 signature headers signed with a per-scan ephemeral Ed25519 key from `node:crypto`.

**Test must pin:**
- The signature base is built per RFC 9421 over `("@authority" "@method" "@path")` with `created`, `expires`, `keyid`, `alg="ed25519"`, `nonce` and `tag="web-bot-auth"`, and the emitted `Signature` header is the base64 signature of exactly that base.
- `keyid` is the JWK thumbprint of the ephemeral public key.
- Baseline 2xx with signed 400, 403 or 421 → `fail`.
- Signed 431 → its own finding: a header-size limit is fixed differently from a WAF rule.
- Signed 2xx whose body collapses relative to the baseline → `fail`.
- A 401 or 403 carrying `Accept-Signature` → informational positive, not a failure: the origin is negotiating signatures.
- Behaviour varying on the signature headers while `Vary` does not list them → reported.
- Both probes `isSafeUrl()`-gated; the test asserts exactly two fetches.
- The guidance says a pass means "the door is not nailed shut", not "signatures are verified".

---

### Task 7: `machine-discovery/conditional-request-support`

Class `ConditionalRequestSupportAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

Surfaces: `/robots.txt`, every `Sitemap:` target, up to 3 child sitemaps, and each discovered feed.

**Test must pin:**
- Identical body across two GETs but a changed `ETag` → `fail` as an unstable validator, reporting both values.
- `If-None-Match` answered 200 rather than 304 → `fail`.
- `If-Modified-Since` answered 200 rather than 304 → `fail`.
- Neither validator emitted → `fail` as "no revalidation possible", reporting the bytes every poll therefore costs.
- `Cache-Control: no-store` or `private` on a public discovery surface → `warn`.
- A sitemap over 50MB uncompressed or over 50,000 URLs → `warn`, both being hard spec limits.
- Per surface the report carries `validatorsPresent`, `honoursIfNoneMatch`, `honoursIfModifiedSince`, `validatorStable`, `bytesPerPoll`.
- The finding text says the 304 semantics are documented for Googlebot and generalized here by analogy; the assertion itself is HTTP conformance.
- No discovery surface at all → `notApplicable`.

---

### Task 8: `machine-discovery/feed-entry-identity-and-canonical-integrity`

Class `FeedEntryIdentityAndCanonicalIntegrityAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'complex'`.

The 20 newest entries; canonical comparison against the 5 newest item URLs.

**Test must pin:**
- Declared `Content-Type` must match the feed type, and the body must parse with no BOM and no leading whitespace.
- Atom: exactly one `atom:id` and one `atom:updated` per entry; `atom:summary` is required whenever `atom:content` carries `@src` or a non-text type (RFC 4287 MUST).
- RSS: a `<guid>` is required, and when `isPermaLink` is absent or `true` it must be an absolute resolvable URL.
- A duplicate id within one feed → `fail`.
- An item link that differs from the target page's `rel="canonical"`, or that 3xx-redirects, or that carries `utm_*`/`ref`/`fbclid` absent from the canonical → `fail`, naming the entry.
- Item link hrefs must be absolute HTTPS.
- No feed → `notApplicable`.

The re-fetch-at-end id-stability check and the stub-feed content-length ratio are deferred: the first needs a deploy to intervene, and the second is `machine-discovery/rss-feed-content`.

---

### Task 9: `machine-discovery/root-text-file-resolution-integrity`

Class `RootTextFileResolutionIntegrityAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'simple'`.

**Test must pin:**
- Two GETs of `https://{host}/{32 lowercase hex}.txt` with different random names, `Cache-Control: no-cache`, at most 3 redirects; both must end in 404 or 410.
- A 2xx is classified: body starting `<` or containing `<html` in the first 512 bytes → SPA/HTML catch-all; `Content-Type: text/html` → wrong content type; identical bodies across the two random names → static catch-all.
- Positive control: `/robots.txt` must be 200 with a `text/plain` content type; `application/octet-stream` or `text/html` → reported.
- `details.discoveryProbeReliable` is emitted as the derived flag, and the guidance says which checks it qualifies.
- `pass` requires both random probes 404/410 **and** robots.txt `text/plain`.
- Exactly three requests, all `isSafeUrl()`-gated.

Consuming the flag from other audits is deferred: it needs a scan-level artefact bus that does not exist. The dossier records that.

---

### Task 10: `machine-discovery/three-way-freshness-lag`

Class `ThreeWayFreshnessLagAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

Freshness half only. The orphan half is `machine-discovery/discovery-index-coverage`.

**Test must pin:**
- `newestOnPage` is the max of `datePublished`/`dateModified` across sampled pages; `newestSitemap` the max `lastmod`; `newestFeed` the max item date.
- `newestOnPage - newestSitemap > 7 days` → `fail`; same for the feed.
- Feed-level `<lastBuildDate>`/`<updated>` earlier than the newest item date → `fail` as a generator bug.
- Items not in newest-first order → `warn`.
- Every date normalizes to UTC, and a timezone-less value is ignored rather than guessed.
- Sitemap URLs that return 404, 410 or `noindex` → reported as advertised-but-dead.
- Fewer than two of the three surfaces carrying a date → `notApplicable`; one date cannot lag.
- The dossier records that the orphan half is deliberately not recomputed here, and names the audit that owns it.

---

### Task 11: `machine-discovery/websub-hub-advertisement`

Class `WebsubHubAdvertisementAudit` · `scoreDisplayMode: 'informative'` · `tier: 'informative'` · grade **C** · `weight: 0` · `defaultPriority: 'low'` · `effort: 'simple'`.

**Test must pin:**
- `Link:` response headers are read before the document, per the spec's precedence order.
- Document fallback: `<link rel="hub">` and `<atom:link rel="self">` inside the feed; in HTML, only within `<head>`.
- Exactly one `rel=self`, absolute, and equal after normalization to the URL the feed was fetched from; a relative href, an http/https mismatch or a different path is reported.
- At least one `rel=hub` with an absolute HTTPS href; a HEAD of the hub accepts 2xx, 400 and 405 as alive, and reports DNS failure, connection refused or 5xx.
- No hub declared → informational, never a failure.
- The audit never fails the page: `tier: 'informative'`, `weight: 0`. The test asserts both, and that no code path returns `fail`.

---

### Task 12: close the wave

- [ ] **Step 1: Verify the counts moved together**

```bash
pnpm --filter @forkpoint/agent-lighthouse-core build
node scripts/check-dossiers.mjs
grep -c "^  '" packages/core/src/tests/new-in-v2.ts
head -3 packages/core/src/audits/proposed/README.md
find packages/core/src/audits/proposed -name '*.ts' | wc -l
```

Expected: `check-dossiers` reports **203 audits OK … no orphans**; `NEW_IN_V2` carries 55 ids (45 + 10 — the merge adds none); both proposal READMEs say **17**; the stub file count is 17.

- [ ] **Step 2: Run every gate**, then `npx changeset status`.
- [ ] **Step 3: Write `.changeset/v2-graduate-grade-b-wave-c.md`** — major on core, patch on the rest. State the merge, the dropped orphan half, and every probe the wave adds, since those change what a scan sends.
- [ ] **Step 4: Regenerate the website** — `npx tsx scripts/build-docs-data.ts`.
- [ ] **Step 5: Update `docs/superpowers/HANDOFF-v2.md`** — Wave C into the executed table, remaining scope down to Wave D (13 feasible stubs), gate line at the new counts.
- [ ] **Step 6: Commit.** Do not push; report to the user.

---

## Self-review

**Spec coverage.** All 11 stubs in the three domains have a disposition: 10 graduate, 1 merges. `feeds-indexing` and `bot-auth-access` are then empty of feasible stubs.

**Placeholder scan.** Every task names its class, its meta values and its acceptance list. Task 1 gives the exact interfaces the other tasks consume.

**Type consistency.** `FeedDocument`, `FeedEntry`, `RevalidationResult` and `parseDictionary` are defined once in Task 1 and consumed unchanged in Tasks 2–11. `sharedFeed` is the only feed fetch in the wave; `sharedRevalidation` the only conditional-request probe.

**Ordering.** Task 1 blocks everything. Task 2 lands before Task 3 because the merged audit defines the category space the AIPREF validity audit reports against. Task 5 depends on nothing but the existing UA-parity probes. Task 12 is last because it pins the final counts.
