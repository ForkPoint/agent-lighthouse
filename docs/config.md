# Configuration

Everything a scan can be told to do differently: the config file, the eight categories a scan can be narrowed to, the options the programmatic API accepts, the environment variables the engine reads, and the limits that are fixed and cannot be changed.

For the flags themselves see [cli.md](./cli.md); for what the resulting numbers mean see [scoring.md](./scoring.md).

## The config file

A config file lets a repository keep its scan settings under version control instead of in a long command line. The CLI looks for these names in the working directory, in this order, and uses the first that exists:

1. `agent-lighthouse.config.json`
2. `.agent-lighthouserc.json`
3. `.agent-lighthouserc`

All three are parsed as **JSON**. An auto-discovered file that fails to parse is reported as a warning and ignored, and the scan continues with defaults.

`--config <path>` overrides the search with an explicit file. In that case the file must exist and must parse: a missing path or invalid JSON is a fatal error rather than a fall back to auto-discovery.

```json
{
  "url": "https://staging.yourstore.com",
  "preset": "ecommerce",
  "minScore": 80,
  "assertCategories": {
    "structured-data": 90,
    "access-crawl-control": 75
  },
  "output": ["terminal", "html", "json", "md"],
  "outputDir": "./reports"
}
```

With that file in place, `agent-lighthouse audit` — the sub-command with no URL after it — scans the declared URL and enforces the declared budgets. Any invocation whose first argument is a flag reads the file too, so `agent-lighthouse --silent` and `agent-lighthouse --config ./ci/staging.json` also pick the URL up from it.

A bare `agent-lighthouse` with no arguments at all does **not**: it prints the usage block and exits 1 before the config file is opened. See [cli.md](./cli.md#invocation).

### Keys

| Key                | Type                                                      | Default                        | Effect                                                                                                       |
| :----------------- | :-------------------------------------------------------- | :----------------------------- | :----------------------------------------------------------------------------------------------------------- |
| `url`              | `string`                                                  | none                           | Target URL, used when the invocation gives none — see [cli.md](./cli.md#invocation) for which forms read it. |
| `preset`           | `"ecommerce" \| "saas" \| "content" \| "quick" \| "full"` | `"full"`                       | Preset name shown in the run header.                                                                         |
| `minScore`         | `number` (0–100)                                          | `0`                            | Overall-score budget; the run exits 1 below it.                                                              |
| `assertCategories` | `Record<string, number>`                                  | `{}`                           | Per-category budgets, keyed by category id.                                                                  |
| `output`           | `Array<"terminal" \| "html" \| "json" \| "md">`           | `["terminal", "html", "json"]` | Report formats to produce.                                                                                   |
| `outputDir`        | `string`                                                  | `"./reports"`                  | Where report files are written.                                                                              |
| `timeout`          | `number` (seconds)                                        | `180`                          | Wall-clock budget for the scan; `0` disables it. `--timeout` overrides it.                                   |
| `categories`       | `string[]`                                                | —                              | **Not read by the CLI.** Use the `--categories` flag instead.                                                |
| `maxPages`         | `number`                                                  | —                              | **Not read by anything.** The page budget is fixed; see [Fixed limits](#fixed-limits).                       |

The last two keys are part of the `AgentLighthouseConfig` type but no code path consumes them today. They are listed here so that a config file containing them is not mistaken for a scan that honours them.

### Precedence

For every setting that both surfaces expose, the order is:

**command-line flag → config file → built-in default.**

`assertCategories` is the one exception, and it merges rather than overrides: thresholds from the config file and thresholds from repeated `--assert-category` flags are combined, with a flag winning for a category named in both.

### `defineConfig`

`@forkpoint/agent-lighthouse-core` exports a `defineConfig` identity helper for authoring a config object in TypeScript with full type checking:

```ts
import { defineConfig } from "@forkpoint/agent-lighthouse-core";

export default defineConfig({
  url: "https://staging.yourstore.com",
  minScore: 80,
});
```

Note that the CLI's loader reads JSON only — it does not import a `.ts` or `.js` config. Use `defineConfig` when you build the object in your own script (and, if you want the CLI to read it, write the result out as JSON).

## The eight categories

Every audit belongs to exactly one category. These ids are what `--categories` and `assertCategories` accept, and what the JSON report keys its category results by.

| Id                     | Name                       | What it covers                                                                                                                                                                                                 |
| :--------------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `access-crawl-control` | Access & Crawl Control     | Whether named AI crawlers and agents are allowed in at all: `robots.txt` groups for GPTBot, ClaudeBot, PerplexityBot and their peers, blanket blocks, bot walls, edge parity, HTTPS, and declared usage terms. |
| `content-extraction`   | Content Extraction         | Whether a fetched page yields clean text: server-rendered HTML, a findable main content region, semantic structure, and the cost of getting to it.                                                             |
| `machine-discovery`    | Machine Discovery          | The machine-readable index of the site: `llms.txt` and `llms-full.txt`, sitemaps and their freshness, feeds, and `.well-known` surfaces.                                                                       |
| `structured-data`      | Structured Data            | Schema.org correctness: valid JSON-LD, Product, Offer, Organization, identifiers such as SKU and GTIN, and review and service markup.                                                                          |
| `answer-readiness`     | Answer Readiness           | Whether the content can be quoted as an answer: direct definitions, question headings, first-paragraph answers, comparison tables, dated and specific claims, trust signals.                                   |
| `agent-interfaces`     | Agent Interfaces           | The programmatic surface an agent can call: WebMCP tools, MCP server declarations, OpenAPI specs and their discovery, `agents.json`, and search actions.                                                       |
| `agentic-commerce`     | Agentic Commerce           | Whether a transaction can be completed by an agent: offer truth, availability, product identifiers, checkout eligibility and payment surfaces.                                                                 |
| `operability-safety`   | Agent Operability & Safety | Whether an agent can operate the site without breaking it: reachable endpoints, stability, accessible controls, `security.txt`, `tdmrep`, and safety signals.                                                  |

Narrow a scan with the flag:

```bash
agent-lighthouse https://yourstore.com --categories structured-data,agentic-commerce
```

Unlisted categories are not scanned at all, so their audits appear nowhere in the report and contribute nothing to the score. An unknown id is rejected before the scan starts, with the valid list printed and exit code 1.

## Experimental audits

`--categories` and `--experimental` are two independent filters over the same registry, applied together.

- `--categories` decides **which categories run**.
- `--experimental` decides **whether experimental-tier audits are part of the run**. They are excluded by default.

An experimental audit carries weight 0 whether or not it runs, so this flag can never move a score — it only adds results to the report. See [scoring.md](./scoring.md#the-three-tiers) for the tiers and the [evidence policy](./evidence/policy.md) for what puts an audit in each one.

## Programmatic options

`runScan(url, options)` from `@forkpoint/agent-lighthouse-core` takes the same decisions as `ScanOptions`:

| Option                | Type                         | Default   | Effect                                                                                                                            |
| :-------------------- | :--------------------------- | :-------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `categories`          | `string[]`                   | all eight | Restrict the scan to these category ids. Unknown ids match nothing — validate them at your entry point so a typo is heard.        |
| `includeExperimental` | `boolean`                    | `false`   | Include experimental-tier audits, reported but never scored.                                                                      |
| `onEvent`             | `(event: ScanEvent) => void` | none      | Progress callback; the CLI's progress display and its NDJSON stream are both built on it.                                         |
| `pages`               | `PageOverride[] \| null`     | none      | Scan these exact URLs with a declared page type instead of relying on discovery.                                                  |
| `signal`              | `AbortSignal`                | none      | Cancel an in-flight scan.                                                                                                         |
| `timeoutMs`           | `number`                     | `180000`  | Wall-clock budget. When it runs out the scan finishes with what it has and records it under `conditions.budget`; `0` disables it. |

```ts
import { runScan } from "@forkpoint/agent-lighthouse-core";

const report = await runScan("https://yourstore.com", {
  categories: ["structured-data", "agentic-commerce"],
  includeExperimental: false,
  pages: [
    { url: "https://yourstore.com/products/blue-widget", pageType: "product" },
    { url: "https://yourstore.com/collections/widgets", pageType: "category" },
  ],
  onEvent: (event) => console.error(JSON.stringify(event)),
});

console.log(report.overallScore, report.scoreTier);
```

A `PageOverride` declares `{ url, pageType }`, where `pageType` is `homepage`, `category`, `product` or `content`. The declared type is forced onto that page, so type-gated audits run against the page you meant rather than against whatever discovery guessed. Overrides are resolved, de-duplicated (ignoring a trailing slash) and any that collide with the homepage are dropped; the remaining page budget is filled by discovery.

Field-level product verification (`report.productFields`) is only produced when a page override with `pageType: 'product'` is supplied. Without one, the report marks it skipped rather than guessing from an auto-discovered page.

## Environment variables

| Variable                 | Default | Effect                                                                                                                                                                                                               |
| :----------------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LOG_LEVEL`              | `info`  | Engine log verbosity: `silent`, `error`, `warn`, `info` or `debug`. `--progress-json` forces `silent`.                                                                                                               |
| `SCANNER_A11Y_MAX_PAGES` | `3`     | How many pages get the jsdom-based accessibility pass. Accessibility problems are template-wide, so the first few pages are representative; `0` disables the pass entirely and its audits degrade to not-applicable. |
| `A11Y_CONCURRENCY`       | `3`     | How many of those accessibility passes run at once.                                                                                                                                                                  |

## Fixed limits

These are compile-time constants in [`packages/core/src/constants.ts`](../packages/core/src/constants.ts) and [`packages/core/src/fetcher.ts`](../packages/core/src/fetcher.ts). There is no flag, config key or environment variable for them. The scan budget is the one exception: its default is a constant, and `--timeout`, the `timeout` key and `timeoutMs` change it.

| Limit              | Value                                                                  |
| :----------------- | :--------------------------------------------------------------------- |
| Pages per scan     | 6 — the homepage plus five more, whether discovered or overridden      |
| Request timeout    | 10 seconds per request                                                 |
| Scan budget        | 180 seconds per scan by default; see `--timeout` in [cli.md](./cli.md) |
| Response body read | 5 MB, after which the body is truncated                                |
| Scanner user agent | `AgentLighthouse/1.0 (+https://github.com/ForkPoint/agent-lighthouse)` |

The user agent is deliberately identifiable so that site owners can recognise, rate-limit or allow a scan in their logs. Individual audits that probe crawler parity send other user agents on purpose, to compare how the site answers a named AI crawler versus an ordinary browser.
