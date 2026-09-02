# Pre-4.0.0 review findings

Reviewed range: `@forkpoint/agent-lighthouse@3.1.0..HEAD`, 33 commits.
Reviewed on 2026-09-02, against `5c8bf78`.

Every finding below was reproduced before it was written down. The proof column
names the script under `docs/architecture/proofs/` that demonstrates it; where a runtime proof
was not practical, the entry says so and cites the exact lines instead. No
finding here is a reading of the code alone unless it says it is.

Findings 1, 2, 3, 4 and 7 are fixed on this branch; each says so under its
heading and its proof scripts are deleted, per `proofs/README.md`. The rest is
the record, not the fix.

|   # | where                            | severity | ships broken in | proved by         |
| --: | :------------------------------- | :------- | :-------------- | :---------------- |
|   1 | `audit-runner.ts:330`            | high     | 4.0.0           | measurement       |
|   2 | `cli/src/options.ts:154`         | high     | 4.0.0           | measurement       |
|   3 | `gatherers/sitemap.ts:167`       | medium   | 4.0.0           | runtime           |
|   4 | `gatherers/sitemap.ts:285`       | medium   | 4.0.0           | runtime           |
|   5 | `orchestrator.ts:286`            | medium   | 4.0.0           | runtime           |
|   6 | `scorer.ts:109`                  | medium   | 4.0.0           | runtime           |
|   7 | `gatherers/sitemap.ts:53`        | low      | 4.0.0           | runtime           |
|   8 | `origin-cache.ts:23`             | low      | 4.0.0           | runtime, SDK-only |
|   9 | `origin-cache.ts:108`            | low      | 4.0.0           | runtime           |
|  10 | `fetcher.ts:265`                 | low      | partly 4.0.0    | runtime, SDK-only |
|  11 | `orchestrator.ts:582`            | low      | 4.0.0           | runtime           |
|  12 | `scripts/test-live-sites.ts:301` | low      | 4.0.0           | runtime           |
|  13 | `audit.ts:222`                   | low      | 4.0.0           | runtime           |

---

## 1. The per-audit context spread defeats every gatherer cache

`packages/core/src/audit-runner.ts:330`

```ts
const scopedCtx = scopedPages ? { ...ctx, pages: scopedPages } : ctx;
```

Twelve gatherer files hold sixteen `WeakMap<object, …>` caches keyed on the
`CheckContext` identity: `author`, `conditional`, `discovery`, `feeds` (three
maps), `mcp`, `media` (two), `openapi`, `rsl`, `sampled-pages`, `security`,
`sitemap` (two), `ua-parity`. `siteSitemapTree`'s own doc comment states the
contract: "walked once per scan … every audit in one scan shares one walk".

`scopeAudit` returns `{ pages, scoreDisplayMode }` on all three of its
non-null paths (`audit-runner.ts:158`, `:166`, `:173`). It never returns an
`AuditScope` whose `pages` is `undefined`. So `scopedPages` is always truthy
and the spread branch always runs. Each audit receives a fresh object, misses
the cache, and repeats the fetch.

Measured over the whole registry with a synthetic single-page site:

```
registered audits             : 215
scopeAudit returned null      : 29
scope.pages === undefined     : 0        <- the spread runs for all 186 runnable audits

total ctx.fetch calls         : 36
distinct URLs                 : 9
redundant calls (same URL)    : 27
  6x  https://example.com/sitemap.xml
  5x  https://example.com/feed
  5x  https://example.com/feed.xml
  5x  https://example.com/rss.xml
  5x  https://example.com/atom.xml
  5x  https://example.com/index.xml
  2x  https://example.com/
  2x  https://example.com/robots.txt
```

Three quarters of the engine's audit-time requests are repeats. A real site is
worse than this fixture: a sitemap index expands to up to ten child sitemaps,
and each of the thirteen sitemap-consuming audit files re-walks the whole tree.

Consumers per cached gatherer, counted in `packages/core/src/audits/`:

| gatherer             | audit files |
| :------------------- | ----------: |
| `siteSitemapTree`    |          10 |
| `mcp`                |           9 |
| `ua-parity`          |           6 |
| `feeds`              |           6 |
| `discovery`          |           6 |
| `security`           |           5 |
| `probeOpenApiServer` |           4 |
| `media`              |           4 |
| `readSitemap`        |           3 |
| `author`             |           3 |
| `rsl`                |           2 |
| `conditional`        |           1 |

Proof: three scripts, deleted with the fix. They showed the same context object
making 1 fetch against 2 for a spread copy, every one of 186 runnable audits
taking the spread branch, and the duplicate-URL table above.

**Fixed.** `CheckContext` carries an optional `cacheOwner`, the runner stamps
it on every scoped copy, and `gatherers/cache-owner.ts` resolves it for all
sixteen caches. The runner also hands the original context through unchanged
when the scope is the whole page list. Rerunning the duplicate measurement on
the same fixture: redundant calls fell from 27 to 4, and the 4 that remain are
the bot-versus-baseline probes in `ua-parity`, which request the same URL under
a different user agent on purpose. Pinned by
`packages/core/src/gatherers/cache-owner.test.ts` and the "gatherer cache
identity" case in `packages/core/src/audit-runner.test.ts`.

---

## 2. `--page-type` is parsed, then dropped

`packages/cli/src/options.ts:154`

```ts
pageType: getArgValue(args, "", "--page-type") as PageType | undefined,
```

The value lands on `CliOptions.pageType` (`options.ts:47`) and is read nowhere.
`main.ts:171` calls:

```ts
const report = await runScan(url, {
  onEvent,
  ...(categories ? { categories } : {}),
  includeExperimental,
  ...(onAuditTrace ? { onAuditTrace } : {}),
});
```

`pageType` is absent. The core side is wired correctly and waiting:
`ScanOptions.pageType` exists at `orchestrator.ts:57` and is honoured at
`orchestrator.ts:350`. Only the CLI hand-off is missing.

The consequence chains. With no declared type, `scopeAudit` falls to its
detected branch and overrides `scoreDisplayMode` to `"informative"`
(`audit-runner.ts:173`); `toCheckResult` then stamps `weight: 0`
(`audit.ts:225`). Every page-typed audit becomes advisory.

Measured on a one-page scan, which is the only shape a scan has since
`MAX_PAGES_PER_SCAN = 1`:

```
page-typed audits in registry : 35

--page-type=homepage   :  6 audits demoted,  5.2 weight unscored
--page-type=product    : 11 audits demoted,  9.8 weight unscored
--page-type=category   :  2 audits demoted,  1.6 weight unscored
```

Scanning a product page from the CLI silently drops 9.8 weight — audits such as
`structured-data/product-schema` and the commerce field checks — out of the
score. The Phase 3 feature is unreachable from the shipped CLI.

Second defect on the same line: `as PageType` is an unchecked cast. It is
latent today, because the value is dropped before `runScan`. Once the hand-off
is wired, `--page-type=produtc` reaches `conditions.pageType.type` and fails
`ScanConditionsSchema`'s enum at report time, not at argument parsing. The two
fixes have to land together.

Proof: two scripts, deleted with the fix. They produced the two tables above.

**Fixed.** `parseCliOptions` checks the value against `PAGE_TYPE_LABELS` and
splits it into `pageType` or `invalidPageType`; `main` refuses an invalid one
with the valid list, the way it refuses an unknown category, and passes a valid
one to `runScan`. `--page-type` is in `--help`. Pinned by the `--page-type`
cases in `packages/cli/src/options.test.ts`.

Related, not a defect: the changeset for Phase 3 records a rename of
`applicablePageTypes` to `pageTypes`. The type carries both, `scopeAudit` reads
`meta.pageTypes ?? meta.applicablePageTypes`, and **0** audits use the new name
while 35 still use the old one. The rename was declared but never carried out.
Behaviour is correct through the fallback.

---

## 3. Only the first sitemap declared in robots.txt is read

`packages/core/src/gatherers/sitemap.ts:167`

The `for (const root of roots)` loop ends with an unconditional `break`, under
the comment "Stop probing fallback sitemap paths once a valid sitemap file is
found." `roots` is built at `sitemap.ts:209` as
`[...declared, /sitemap.xml, /sitemap-index.xml, /sitemap_index.xml]`, where
`declared` is every `Sitemap:` line in robots.txt. The break cannot tell a
declared entry from a fallback probe, so it stops after the first one that
parses.

Reproduced against a robots.txt declaring two sitemaps:

```
robots.txt declares  : sitemap-posts.xml, sitemap-pages.xml
URLs actually fetched: [ 'https://example.com/sitemap-posts.xml' ]
entries found        : [ 'https://example.com/post-1', 'https://example.com/post-2' ]
```

`sitemap-pages.xml` is never requested. Every downstream audit —
`discovery-index-coverage`, `three-way-freshness-lag`, `sensitive-paths`,
`ai-crawler-surface-reachability` — then judges a partial URL set as if it were
the site's whole sitemap.

The comment states the correct intent. The break needs to fire only once
`declared` is exhausted.

Proof: one script, deleted with the fix. It produced the transcript above.

**Fixed.** `siteRoots` now returns the declared roots and the conventional
paths apart, and `collectSitemapEntries` reads every declared root. The
conventional paths travel as `opts.fallbackRoots`, probed only when no declared
root parsed, first hit wins. Pinned by the "every declared root" cases and the
"reads every sitemap robots.txt declares" case in
`packages/core/src/gatherers/sitemap.test.ts`.

---

## 4. The `??` fallback chain in `readSitemap` never falls through

`packages/core/src/gatherers/sitemap.ts:285`

```ts
const sitemapFile =
  ctx.rootFiles["/sitemap.xml"] ??
  ctx.rootFiles["/sitemap-index.xml"] ??
  ctx.rootFiles["/sitemap_index.xml"];
```

`orchestrator.ts:209` fetches `/sitemap.xml` on every scan, so
`ctx.rootFiles["/sitemap.xml"]` is always a defined `FetchResult` — a 404 is
still an object. `??` falls through on `undefined` and `null` only, never on a
status. Operands two and three are unreachable. Operand three is doubly dead:
`/sitemap_index.xml` is not in `rootFilePaths` at all, so it is never fetched.

Reproduced on a site that serves only `/sitemap-index.xml`, and serves it
broken:

```
site serves: /sitemap.xml 404, /sitemap-index.xml 200 but malformed
readSitemap kind : absent
reason           : No readable sitemap found.
```

The correct verdict is `malformed`. This is the exact case the "absent means
absent, broken means broken" rule in `CLAUDE.md` exists to separate:
`sitemap-exists`, `sitemap-lastmod` and `sitemap-absolute-urls` decline instead
of naming the defect, and the site is never told its sitemap is unreadable.

Each candidate needs a `status === 200` test, not a nullish check.

Proof: one script, deleted with the fix. It produced the transcript above.

**Fixed.** The verdict now follows the walk instead of the first root file.
`SitemapTree` records `readableFiles` and `malformedFiles`, and `readSitemap`
reads `empty` when a file parsed, `malformed` when a file answered 200 and did
not, and `absent` only when nothing did. That also covers the case the nullish
chain could never reach: a broken sitemap declared only in robots.txt. The
`result` attached to the verdict is the first conventional root file that
answered 200, or nothing. Pinned by the two "returns malformed when only …"
cases in `packages/core/src/gatherers/sitemap.test.ts`.

---

## 5. The origin homepage is fetched, cached as `undefined`, and read by nobody

`packages/core/src/orchestrator.ts:286`, `:298`, `:314`, `:415`

Three problems in one block.

**It is never delivered.** `CheckContext.originEvidence` is declared at
`check-context.ts:54` with an `originHomepage` field. The `ctx` literal at
`orchestrator.ts:415` does not set it, and no audit reads it. On a
non-homepage scan the orchestrator spends a full page fetch — with 429 retry,
up to a 30 second wait — on a result that reaches no consumer.

**The cache stores the wrong thing.** Line 286 sets `originHomepageResult` to
`undefined` for a homepage scan. Line 298 writes that `undefined` into the
origin cache. Line 314 then repairs the variable from `pageResult` — after the
cache write, so the repair never reaches the cache.

Reproduced against a live origin:

```
scanned                    : https://example.com/ (a homepage scan)
origin cache entry present : true
rootFiles cached           : 26
originHomepage cached      : undefined
```

**So the evidence depends on scan order.** Scan `https://site/` first, then
`https://site/product`: the second scan hits the cache and gets no origin
homepage. Scan `https://site/product` first: it fetches one. Same two scans,
different evidence, decided by which ran first.

Proof: `docs/architecture/proofs/f3-originhomepage.mts`. The "read by nobody" half is a code
reading, not a runtime proof: `grep -rn "\.originEvidence"` across
`packages/*/src` returns one hit, in `report/src/hydrate.ts:135`, which reads
the report field and not the context field.

---

## 6. `assessedMass` never reaches the scorer on the scan path

`packages/core/src/scorer.ts:109`

```ts
const mass = cat.assessedMass ?? cat.weight ?? 0;
```

`CategoryResult.assessedMass` is optional (`types.ts:214`). Two builders exist
and they disagree:

- `buildCategoryResult` (`scorer.ts:59`) computes and sets `assessedMass` and
  `registryMass`. It is exported from `index.ts:88` as public SDK surface and
  covered by `scorer.test.ts`. **The engine never calls it.**
- `buildWeightedCategoryResult` (`audit-runner.ts:368`) is what `runAudits`
  actually uses (`audit-runner.ts:359`). It sets neither field.

Measured by running the full registry through `runAudits`:

```
categories produced by runAudits : 8
  with assessedMass set          : 0
  with registryMass set          : 0
```

So `calculateOverallScore` takes the `cat.weight` fallback on every scan and
weights by full registry mass. The Phase 3 changeset's claim, "Category mass
calculations updated to use `assessedMass`", does not hold for any scan. The
`conditions.coverage` block reports an assessed/registry split that the score
itself does not apply.

Proof: `docs/architecture/proofs/f5-assessedmass.mts`.

---

## 7. `sameHost` accepts a parent domain

`packages/core/src/gatherers/sitemap.ts:53`

```ts
return (
  candHost === refHost ||
  candHost.endsWith(`.${refHost}`) || // subdomain — matches the doc comment
  refHost.endsWith(`.${candHost}`) // parent domain — does not
);
```

The doc comment reads "Same site host or subdomain — a sitemap index may not
hand us another origin's URLs." The third arm breaks that guarantee on every
shared public suffix: `*.github.io`, `*.pages.dev`, `*.vercel.app`,
`*.myshopify.com`.

Reproduced:

```
scanning        : https://foo.github.io
child sitemaps  : [ 'https://github.io/attacker-sitemap.xml' ]
entries         : [ 'https://github.io/not-your-page' ]
```

A sitemap index on `foo.github.io` pulled in a sitemap and a URL belonging to a
different party. Those URLs then feed link and freshness audits as if the
scanned site owned them.

The subdomain arm alone matches the stated intent. At
`@forkpoint/agent-lighthouse@3.1.0` (`af0518b`) the gatherer had only the
subdomain check; the parent-domain arm arrived with the four-way sitemap read
in `9c0f4b8` (2026-09-01). It is a 4.0.0 regression, not pre-existing.

Proof: one script, deleted with the fix. It produced the transcript above.

**Fixed.** The parent-domain arm is removed; `sameHost` accepts the same host
or a subdomain of it, as its comment always said. Pinned by "skips a child
sitemap on the parent domain" in `packages/core/src/gatherers/sitemap.test.ts`.

---

## 8. The origin cache key ignores request headers

`packages/core/src/origin-cache.ts:23`

`computeOriginCacheKey` returns `${origin}|${version}`.
`shouldBypassOriginCache` bypasses only for `authorization`, `cookie`,
`proxy-authorization` and URL credentials. A scan that sets any other header —
`User-Agent` above all — shares a cache slot with a default scan.

```
default scan key : https://example.com|v1
GPTBot scan key  : https://example.com|v1
keys identical   : true
GPTBot bypasses  : false
Authorization bypasses : true
```

For a scanner whose subject includes bot-versus-default parity, this swaps the
artifact under the audit for the whole 1 hour TTL.

**Reachability.** `ScanOptions.headers` is public SDK surface and is applied to
every fetch, but neither the CLI nor the MCP server passes it — `grep -rn
"headers" packages/cli/src packages/mcp/src` returns nothing. So no shipped
entry point can trigger this today. It is an SDK-only hazard.

Proof: `docs/architecture/proofs/f7-cachekey.mts`.

---

## 9. `OriginCache` has no size bound

`packages/core/src/origin-cache.ts:108`

`defaultOriginCache` is a module-level singleton over a plain `Map`. There is no
maximum size and no sweep. The only eviction is inside `get`, which drops an
entry when someone asks for that exact expired key — which is exactly what a
never-rescanned origin never gets.

```
entries written         : 5000
TTL                     : 1 ms, elapsed 20 ms
cache.size after expiry : 5000
```

Each entry holds 26 root-file `FetchResult`s, and `MAX_RESPONSE_BODY_BYTES` is
5 MB. In a short-lived CLI process this is harmless. In the MCP server or under
`scripts/test-live-sites.ts --loop`, it grows for the life of the process.

Needs a bound, a periodic sweep, or both.

Proof: `docs/architecture/proofs/f8-unbounded.mts`.

---

## 10. Header keys merge case-sensitively

`packages/core/src/fetcher.ts:265`

```ts
const reqHeaders: Record<string, string> = {
  ...fetcherOptions.headers,
  ...extraHeaders,
  "User-Agent": userAgent ?? SCANNER_USER_AGENT,
  Accept: acceptHeader,
};
```

Object spread merges by exact key. A caller passing `user-agent` in lowercase —
the casing `shouldBypassOriginCache` itself normalises to at
`origin-cache.ts:53` — keeps its key beside the capitalised one:

```
merged object keys : [ 'user-agent', 'User-Agent', 'Accept' ]
what undici sends  : user-agent = CallerBot/1.0, AgentLighthouse/1.0
```

The two are not deduplicated — they are joined into one malformed value. The
same collision applies to a lowercase `authorization` against the
`Authorization` set from URL credentials at `fetcher.ts:272`.

**Reachability.** Same as finding 8: SDK-only, since nothing in the CLI or MCP
passes headers.

**Age.** Only partly pre-existing. At 3.1.0 the spread had `...extraHeaders`
alone, so a per-request header could already collide. The
`...fetcherOptions.headers` operand, and with it the `ScanOptions.headers`
collision, is new in 4.0.0.

Proof: `docs/architecture/proofs/f10-headers.mts`.

---

## 11. `conditions.pageType` can describe a different page than `conditions.url`

`packages/core/src/orchestrator.ts:582`

```ts
const primaryPage = pages[0];
```

`pages` is filtered to `status === 200 && body` at `orchestrator.ts:340` before
it is mapped. When the target URL does not return 200 but a `pages` override
does, `pages[0]` is the override. `conditions.url` still names the target.

Reproduced against a live origin:

```
target scanned      : https://example.com/this-path-does-not-exist-404
conditions.url      : https://example.com/this-path-does-not-exist-404
conditions.pageType : {"type":"product","source":"declared"}
pagesScanned        : [{"url":"https://example.com/","pageType":"product"}]
```

The conditions block states the scan's own terms. Here it names one URL and
describes another. Key off the entry whose original index is 0, or fall back
explicitly when the target did not survive the filter.

Proof: `docs/architecture/proofs/f11-conditions.mts`.

---

## 12. An empty round aborts the whole live-site run

`scripts/test-live-sites.ts:301`

```ts
if (selected.length === 0) {
  console.log("⚠️ No sites matched the selection criteria.");
  return;
}
```

This sits inside `for (let loopRound = 1; loopRound <= options.loop; …)` which
opens at line 222. `return` leaves `main()` entirely. Remaining rounds are
skipped, and the summary write at line 501 never runs.

```
$ pnpm test:live --limit=0 --out=/tmp/al-probe-summary.json
exit=0
$ ls /tmp/al-probe-summary.json
ls: /tmp/al-probe-summary.json: No such file or directory
```

Two consequences. With `--loop=N --shuffle`, one empty round silently discards
every earlier round's results. And CI's own smoke step
(`pnpm test:live --limit=0`, `.github/workflows/ci.yml`) takes this branch every
time, so the summary-writing path it is meant to smoke-test is never reached.

Should be `continue`, with a deliberate decision about the exit code.

Proof: the shell transcript above.

---

## 13. Informative checks report `score: 0` in JSON

`packages/core/src/audit.ts:222`

```ts
score: isInformative ? 0 : result.score,
```

Introduced in `111cdbf` (Phase 3), which changed `score: result.score` to this.
It overwrites whatever the audit measured.

Impact is narrower than it looks, and the record should say so:

- No score moves. `calculateCategoryScore` (`scorer.ts:41`) filters informative
  checks out of both numerator and denominator before reading `score`.
- No renderer shows it. Terminal, Markdown and HTML print category and group
  scores; none prints a per-check `score`.

What remains is the JSON output: every informative check reports 0 to an SDK or
`--json` consumer, regardless of what it measured. For audits whose purpose is
to report a number without moving the score, that is the number gone.

`weight: 0` on the next line is correct and should stay.

Proof: read of `scorer.ts:41` and a grep of `packages/report/src` for per-check
score rendering; both are cited above.

---

## Suggested order

Findings 1 and 2 were regressions this release introduced, both in the
release's headline features. Both are fixed on this branch and should land
before `ci(release): version packages` (#27) merges.

Findings 3, 4, 5 and 6 are wrong verdicts and wrong scores, not crashes. 3 and
4 are fixed on this branch, with 7. 5 and 6 can ship in 4.0.1 if 4.0.0 is
time-boxed, but 6 contradicts a claim the 4.0.0 changesets make, so the
changeset text needs a correction either way.

Findings 7 through 13 are cleanup. 8 and 10 are unreachable from any shipped
entry point today and can wait for whoever exposes `headers`. Finding 7 is a
4.0.0 regression despite its low severity and belongs with 3 and 4.
