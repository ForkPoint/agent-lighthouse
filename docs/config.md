# Configuration

Scan settings for the CLI config file, the SDK and the environment. Flags are in the [CLI reference](./cli.md); results are explained in [understand your score](./scoring.md).

The scanner checks public information. It does not request merchant sandbox
credentials or create checkout sessions. ACP coverage uses public storefront
evidence; UCP coverage reads public business profiles.

## The config file

The CLI uses the first of these files in the working directory:

1. `agent-lighthouse.config.json`
2. `.agent-lighthouserc.json`
3. `.agent-lighthouserc`

All three are JSON. An auto-discovered file that fails to parse logs a warning, and the CLI tries the next name. `--config <path>` names the file instead; a missing or invalid file is then fatal.

```json
{
  "url": "https://staging.example.com",
  "minScore": 80,
  "assertCategories": { "structured-data": 90, "access-crawl-control": 75 },
  "output": ["terminal", "html", "json", "md"],
  "outputDir": "./reports"
}
```

`agent-lighthouse audit`, or any command made only of flags, scans the file's `url`. A bare `agent-lighthouse` prints help instead. See [invocation](./cli.md#invocation).

### Keys

| Key                | Type                     | Default                        | Effect                                                                                    |
| :----------------- | :----------------------- | :----------------------------- | :---------------------------------------------------------------------------------------- |
| `url`              | `string`                 | none                           | Target URL when the command gives none.                                                   |
| `minScore`         | `number` (0–100)         | `0`                            | Exit 1 below this overall score. `--min-score` overrides it.                              |
| `assertCategories` | `Record<string, number>` | `{}`                           | Per-category thresholds. Merged with `--assert-category`; a flag wins.                    |
| `output`           | `string[]`               | `["terminal", "html", "json"]` | Report formats: `terminal`, `html`, `json`, `md`.                                         |
| `outputDir`        | `string`                 | `"./reports"`                  | Where report files go.                                                                    |
| `timeout`          | `number` (seconds)       | `180`                          | Scan budget; `0` disables it. `--timeout` overrides it.                                   |
| `pageType`         | `PageType`               | detected                       | Type of the target URL. `--page-type` overrides it.                                       |
| `pages`            | `PageOverride[] \| null` | none                           | More URLs with a declared type, read next to the target.                                  |
| `snapshots`        | `BrowserSnapshots`       | none                           | Browser-rendered DOM input; see [browser snapshots](./architecture/browser-snapshots.md). |

The CLI does not read a `categories` key. Use `--categories`.

`defineConfig` from `@forkpoint/agent-lighthouse-core` types a config object in TypeScript. The CLI reads JSON only, so write the object out as JSON for it to use.

## The eight categories

Every audit belongs to one category. `--categories`, `assertCategories` and the JSON report use these ids.

| Id                     | Name                       | Covers                                                                                                          |
| :--------------------- | :------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| `access-crawl-control` | Access & Crawl Control     | `robots.txt` rules for named AI crawlers, blanket blocks, bot walls, edge parity, HTTPS and usage terms.        |
| `content-extraction`   | Content Extraction         | Server-rendered HTML, a findable main region, semantic structure, and the cost of reading it.                   |
| `machine-discovery`    | Machine Discovery          | `llms.txt`, `llms-full.txt`, sitemaps and their freshness, feeds and `.well-known` files.                       |
| `structured-data`      | Structured Data            | Valid JSON-LD and Schema.org types: Product, Offer, Organization, identifiers, reviews, services.               |
| `answer-readiness`     | Answer Readiness           | Quotable content: definitions, question headings, first-paragraph answers, tables, dated claims, trust signals. |
| `agent-interfaces`     | Agent Interfaces           | WebMCP tools, MCP server declarations, OpenAPI specs and their discovery, `agents.json`, search actions.        |
| `agentic-commerce`     | Agentic Commerce           | Offer truth, availability, product identifiers, checkout and payment surfaces.                                  |
| `operability-safety`   | Agent Operability & Safety | Reachable endpoints, stability, accessible controls, `security.txt`, `tdmrep` and safety signals.               |

Unlisted categories do not run and do not count. An unknown id exits 1.

`getRegistrySummary()` from `@forkpoint/agent-lighthouse-core` reports what the installed version holds: its `version`, the number of audits and categories, the count per tier, the registry mass, and the same per category. Read the numbers from it instead of copying them. The `summary` block of `docs/evidence/audit-map.json` carries the same numbers for the current source.

## Experimental audits

`--categories` picks which categories run. `--experimental` adds experimental-tier audits, which are excluded by default. The two filters combine. An experimental audit carries weight 0, so the flag never moves a score. See [the three tiers](./scoring.md#the-three-tiers) and the [evidence policy](./evidence/policy.md).

## Programmatic options

`runScan(url, options)` from `@forkpoint/agent-lighthouse-core` takes these `ScanOptions`:

| Option                | Type                               | Default    | Effect                                                                             |
| :-------------------- | :--------------------------------- | :--------- | :--------------------------------------------------------------------------------- |
| `categories`          | `string[]`                         | all        | Category ids to run. Unknown ids match nothing; validate them yourself.            |
| `includeExperimental` | `boolean`                          | `false`    | Run experimental-tier audits, reported but never scored.                           |
| `pageType`            | `PageType`                         | detected   | Type of the target URL. Wins over a matching `pages` entry.                        |
| `pages`               | `PageOverride[] \| null`           | none       | More URLs with a declared type.                                                    |
| `snapshots`           | `BrowserSnapshots`                 | none       | Browser-rendered DOM input; adds `browserAssessment` to the report.                |
| `timeoutMs`           | `number`                           | `180000`   | Scan budget. Recorded under `conditions.budget` when it runs out; `0` disables it. |
| `signal`              | `AbortSignal`                      | none       | Cancel the scan. `runScan` then throws.                                            |
| `onEvent`             | `(event: ScanEvent) => void`       | none       | Progress callback. The CLI's progress display and NDJSON stream use it.            |
| `onAuditTrace`        | `(trace: AuditTrace) => void`      | none       | One record per audit, as `--trace` writes.                                         |
| `logger`              | pino-compatible logger             | built-in   | Every log line of the scan goes here, with `site`, `scan` and `component` fields.  |
| `scanId`              | `string`                           | random     | The report's `scanId` and the `scan` log field.                                    |
| `enforceEvidenceGate` | `boolean`                          | `true`     | `false` runs audits whose required evidence is missing. Diagnostic use only.       |
| `dispatcher`          | undici `Dispatcher`                | default    | Dispatcher for every request the scan makes.                                       |
| `maxConcurrent`       | `number`                           | no limit   | Requests the scan may have in flight at once.                                      |
| `requestScheduler`    | `RequestScheduler`                 | none       | Shared pacing for every request and redirect hop. See below.                       |
| `headers`             | `Record<string, string>`           | none       | Extra request headers on every fetch.                                              |
| `bypassOriginCache`   | `boolean`                          | `false`    | Skip the shared origin evidence cache.                                             |
| `originCache`         | `OriginCache`                      | shared     | A custom origin evidence cache.                                                    |
| `robotsTxt`           | `FetchResult`                      | none       | A `robots.txt` response the caller already has, used instead of fetching it.       |
| `onExchange`          | `(exchange: HttpExchange) => void` | none       | One record per request sent, redirect hops included. See below.                    |
| `fetcher`             | `Fetcher`                          | built      | The fetcher every request goes through. `createReplay` makes one. See below.       |
| `lookup`              | `HostLookup`                       | system     | Name resolution for the scan's address checks.                                     |
| `now`                 | `() => number`                     | `Date.now` | The scan's clock in epoch milliseconds.                                            |

`requestScheduler` lets several scans share one request queue per hostname. The scan calls `acquire(url, signal)` before each request and holds the returned release function until the response body is read. It calls `observe(url, status, retryAfter, { ownAgent })` after each response. `ownAgent` is `false` when the request used an AI crawler's User-Agent, as the crawler-parity checks do; a 403 to such a request is that check's finding, not a refusal of the scanner. The scanner's own User-Agent and the browser baseline of the parity checks count as the scanner's. Queue time does not count toward the 10-second request timeout or the reported response timings, but it does count toward the scan budget.

`createRequestScheduler(options)` is the default implementation. It keeps one queue per host, with apex and `www` sharing one, and sends one request at a time, `gapMs` apart. It stops a host on HTTP 429, on a 403 to the scanner's own User-Agent or the browser baseline, and on two 503s in a row. It waits out the `Retry-After` of a single 503, or 60 seconds when the header names no usable value. A 503 whose `Retry-After` is longer than `maxRetryAfterMs`, one scan budget by default, stops the host instead. A request to a stopped host fails with `HostStoppedError`, whose `reason` says why. `exportState()` returns each host's state as plain data, `importState(state)` or the `state` option restores it, and `onChange(state)` reports each change as it happens, so a caller can keep host stops and cooldowns across runs. A restored stop stays a stop and a restored cooldown keeps its remaining wait.

```ts
import {
  createRequestScheduler,
  runScan,
} from "@forkpoint/agent-lighthouse-core";

const requestScheduler = createRequestScheduler({
  gapMs: 1000,
  state: await loadHostState(),
  onChange: (host) => saveHostState(host),
});
const report = await runScan("https://example.com", { requestScheduler });
```

### Capture and replay

`onExchange` receives one `HttpExchange` per request the scan sends, redirect hops included. A request the scheduler refused is an exchange with an `error` and no `response`. Each record holds the request as sent, the response status, its headers as received (a field sent on several lines keeps one entry per line), the body bytes the fetcher read, whether the read stopped at the size limit, and the fetch's timings. `Authorization` and `Proxy-Authorization` values are recorded as `[redacted]`. The hop of a refused redirect is never sent, so it has no exchange.

`createReplay(exchanges)` rebuilds a scan's network from those records. Pass its `fetcher` and `lookup` to `runScan` with the capture's `scanId` and a `now` that returns the capture's scan time. The scan then reads the captures and sends no request and makes no DNS lookup. With the same captures, engine version and options, the report is the same: probe names and tokens derive from `scanId`, every date an audit compares against comes from `now`, and recorded timings stand in for measured ones. Set `now` on the live scan too when the two reports must match field for field, since `durationMs` is measured on that clock.

A replay answers each request with the first unused exchange of the same method, URL, headers and body, ignoring headers that change on every send, such as a request signature. It falls back to one with the same method, URL, User-Agent and Accept. A request the capture does not hold fails as an unanswered request does and is listed by `misses()`. Each exchange answers once, so make one replay per scan. A fetcher passed in `fetcher` also bypasses the shared origin evidence cache, and `dispatcher`, `maxConcurrent`, `requestScheduler`, `headers` and `onExchange` do not apply to it.

```ts
import { createReplay, runScan } from "@forkpoint/agent-lighthouse-core";

const exchanges = [];
const live = await runScan(url, { onExchange: (e) => exchanges.push(e) });

const replay = createReplay(exchanges);
const again = await runScan(url, {
  fetcher: replay.fetcher,
  lookup: replay.lookup,
  scanId: live.scanId,
  now: () => Date.parse(live.scannedAt),
});
```

A replay cannot reproduce a scan whose budget ran out, since the budget is measured on the wall clock of the run.

`buildOfflineContext(result, options)` builds the check context for one stored page the way a scan builds one: parsed, classified, checked for a bot wall, with the scan evidence derived from the response. It sends no request unless `options.fetch` is given. `runAudits(ctx, defaultConfig)` then judges the stored page alone.

```ts
import pino from "pino";
import { runScan } from "@forkpoint/agent-lighthouse-core";

const report = await runScan("https://example.com", {
  categories: ["structured-data", "agentic-commerce"],
  pages: [
    { url: "https://example.com/products/blue-widget", pageType: "product" },
    { url: "https://example.com/collections/widgets", pageType: "category" },
  ],
  logger: pino({ level: "debug" }),
});

console.log(report.overallScore, report.scoreTier);
```

### Page declarations

A `PageOverride` is `{ url, pageType }`. Types are `homepage`, `category`, `product`, `article` and `general`. `article` is an editorial page: post, news story or guide. `general` is any other page and never carries article obligations.

- The CLI config, SDK and MCP tool accept the same `pageType` and `pages`.
- An invalid type, a pre-v7 name (`unknown`, `content`) or a non-absolute URL fails before any fetch.
- Duplicates are matched ignoring a trailing slash. The first declaration wins; top-level `pageType` wins for the target.
- A declaration does not bypass evidence gates. Failed fetches stay in `pageAttempts` and coverage.
- Without a declaration, type-specific checks on detected pages stay advisory. Common checks use every eligible page.
- `report.productFields` is produced only when a page is declared `product`.

## Environment variables

| Variable                 | Default | Effect                                                                                                                                                 |
| :----------------------- | :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LOG_LEVEL`              | `info`  | `silent`, `error`, `warn`, `info`, `debug` or `trace`. The CLI uses `warn` when unset; `--log-level` overrides. An unknown value warns and falls back. |
| `LOG_FORMAT`             | `text`  | Log format on stderr: `text` or `json`.                                                                                                                |
| `SCANNER_A11Y_MAX_PAGES` | `3`     | Pages that get the jsdom accessibility pass. `0` disables it; its audits become not applicable.                                                        |
| `A11Y_CONCURRENCY`       | `3`     | Accessibility passes run at once.                                                                                                                      |

## Fixed limits

These are constants in [`constants.ts`](../packages/core/src/constants.ts). Only the scan budget can be changed.

| Limit              | Value                                                                  |
| :----------------- | :--------------------------------------------------------------------- |
| Pages per scan     | The target URL, declared `pages`, and at most one gateway target       |
| Request timeout    | 10 seconds                                                             |
| Scan budget        | 180 seconds by default                                                 |
| Response body read | 5 MB, then truncated                                                   |
| User agent         | `AgentLighthouse/1.0 (+https://github.com/ForkPoint/agent-lighthouse)` |

The user agent is identifiable so site owners can recognise a scan. Crawler-parity audits send other user agents on purpose, to compare how the site answers a named AI crawler and a browser.
