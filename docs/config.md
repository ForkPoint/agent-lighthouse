# Configuration

Scan settings for the CLI config file, the SDK and the environment. Flags are in the [CLI reference](./cli.md); results are explained in [understand your score](./scoring.md).

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
| `acpSandbox`       | `AcpSandboxConfig`       | none                           | Explicit authenticated sandbox probe; see below.                                          |
| `snapshots`        | `BrowserSnapshots`       | none                           | Browser-rendered DOM input; see [browser snapshots](./architecture/browser-snapshots.md). |

## ACP sandbox checkout probe

The optional `acpSandbox` key enables authenticated test-session requests. It
is available through CLI configuration and `runScan` options. Normal scans do
not send ACP mutation requests. The MCP tool and task server do not accept this
configuration.

```json
{
  "url": "https://shop.example",
  "acpSandbox": {
    "sandboxAcknowledged": true,
    "baseUrl": "https://sandbox-api.example/acp",
    "apiVersion": "2026-04-17",
    "tokenEnv": "ACP_SANDBOX_TOKEN",
    "currency": "usd",
    "testItems": [{ "id": "sandbox_product" }]
  }
}
```

Set `ACP_SANDBOX_TOKEN` in the process environment. The file stores only its
name. `baseUrl` explicitly authorizes that HTTPS API origin; it must not contain
credentials, a query or a fragment. The scanner disables redirects for these
requests and never applies the merchant token to ordinary website fetches.

The probe creates, retrieves, replays and cancels test sessions. It checks
response schemas and idempotency conflicts against the pinned protocol. It
never calls `/complete` or attempts a payment. An optional
`completedSessionId` selects an existing completed sandbox fixture for the
`405` cancellation test; without that fixture, this branch remains untested.

Cleanup has a separate bounded attempt after scan cancellation. A lost create
response may leave a session whose identifier the scanner never received;
`cleanupCertain: false` reports that uncertainty. Network refusal or incomplete
cleanup cannot produce a conformance pass. The result is informative and has
weight 0. See the [ACP audit dossier](./evidence/audits/agentic-commerce/acp-endpoint-conformance-probe.md)
for the exact tested contract and limits.

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

## Experimental audits

`--categories` picks which categories run. `--experimental` adds experimental-tier audits, which are excluded by default. The two filters combine. An experimental audit carries weight 0, so the flag never moves a score. See [the three tiers](./scoring.md#the-three-tiers) and the [evidence policy](./evidence/policy.md).

## Programmatic options

`runScan(url, options)` from `@forkpoint/agent-lighthouse-core` takes these `ScanOptions`:

| Option                | Type                          | Default  | Effect                                                                             |
| :-------------------- | :---------------------------- | :------- | :--------------------------------------------------------------------------------- |
| `categories`          | `string[]`                    | all      | Category ids to run. Unknown ids match nothing; validate them yourself.            |
| `includeExperimental` | `boolean`                     | `false`  | Run experimental-tier audits, reported but never scored.                           |
| `pageType`            | `PageType`                    | detected | Type of the target URL. Wins over a matching `pages` entry.                        |
| `acpSandbox`          | `AcpSandboxConfig`            | none     | Explicit sandbox probe; see the ACP section above.                                 |
| `pages`               | `PageOverride[] \| null`      | none     | More URLs with a declared type.                                                    |
| `snapshots`           | `BrowserSnapshots`            | none     | Browser-rendered DOM input; adds `browserAssessment` to the report.                |
| `timeoutMs`           | `number`                      | `180000` | Scan budget. Recorded under `conditions.budget` when it runs out; `0` disables it. |
| `signal`              | `AbortSignal`                 | none     | Cancel the scan. `runScan` then throws.                                            |
| `onEvent`             | `(event: ScanEvent) => void`  | none     | Progress callback. The CLI's progress display and NDJSON stream use it.            |
| `onAuditTrace`        | `(trace: AuditTrace) => void` | none     | One record per audit, as `--trace` writes.                                         |
| `logger`              | pino-compatible logger        | built-in | Every log line of the scan goes here, with `site`, `scan` and `component` fields.  |
| `scanId`              | `string`                      | random   | The report's `scanId` and the `scan` log field.                                    |
| `enforceEvidenceGate` | `boolean`                     | `true`   | `false` runs audits whose required evidence is missing. Diagnostic use only.       |
| `dispatcher`          | undici `Dispatcher`           | default  | Dispatcher for every request the scan makes.                                       |
| `maxConcurrent`       | `number`                      | no limit | Requests the scan may have in flight at once.                                      |
| `requestScheduler`    | `RequestScheduler`            | none     | Shared pacing for every request and redirect hop. See below.                       |
| `headers`             | `Record<string, string>`      | none     | Extra request headers on every fetch.                                              |
| `bypassOriginCache`   | `boolean`                     | `false`  | Skip the shared origin evidence cache.                                             |
| `originCache`         | `OriginCache`                 | shared   | A custom origin evidence cache.                                                    |
| `robotsTxt`           | `FetchResult`                 | none     | A `robots.txt` response the caller already has, used instead of fetching it.       |

`requestScheduler` lets several scans share one request queue per hostname. The scan calls `acquire(url, signal)` before each request and holds the returned release function until the response body is read. It calls `observe(url, status, retryAfter)` after each response. `answered(url)` tells whether any request to that hostname got an HTTP status. Queue time does not count toward the 10-second request timeout or the reported response timings, but it does count toward the scan budget. Callers supply the scheduler implementation. The package provides the hook, not a host pacing policy.

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
