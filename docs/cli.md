# CLI reference

`@forkpoint/agent-lighthouse` scans a website, prints a summary and writes HTML, JSON or Markdown reports.

Read [what your score means](./scoring.md) before comparing results. Saved settings and SDK options are in the [configuration guide](./config.md).

## Install

```bash
npx @forkpoint/agent-lighthouse https://example.com    # one-off scan, no install
npm i -g @forkpoint/agent-lighthouse                    # global
pnpm add -D @forkpoint/agent-lighthouse                 # project dev dependency, for CI
```

The installed binary is `agent-lighthouse`. Node.js 22.22.2+, 24.15.0+ or 26+ is required.

## Invocation

```
agent-lighthouse <url> [options]
agent-lighthouse audit <url> [options]
agent-lighthouse --help
```

- The first two forms are the same scan.
- Flags may come before or after the URL: `agent-lighthouse --timeout 30 https://example.com` works.
- The URL must be absolute, with its scheme (`https://example.com`, not `example.com`). Anything else exits 1.
- `-h` or `--help` anywhere prints usage and exits 0. So does running the command with no arguments.
- The URL may come from a [config file](./config.md#the-config-file) instead. `agent-lighthouse audit` with no URL, or a command made only of flags such as `agent-lighthouse --silent`, reads it. If neither the command nor the file names a URL, the CLI prints usage and exits 1.

Flags that take a value accept `--flag value` and `--flag=value`. In the space form the value must not start with `-`, or it is read as the next flag.

## Flags

| Flag                         | Default                | What it does                                                            |
| :--------------------------- | :--------------------- | :---------------------------------------------------------------------- |
| `-h`, `--help`               | —                      | Print usage and exit 0.                                                 |
| `-c`, `--config <path>`      | auto-discovered        | Load settings from this file.                                           |
| `--categories <list>`        | all eight              | Scan only these comma-separated category ids.                           |
| `--page-type <type>`         | detected               | Declare the target page's type.                                         |
| `--experimental`             | off                    | Also run experimental-tier audits. They are reported, never scored.     |
| `-o`, `--output <formats>`   | `terminal,html,json`   | Report formats: `terminal`, `html`, `json`, `md`.                       |
| `-d`, `--output-dir <path>`  | `./reports`            | Where report files go. Created if missing.                              |
| `-v`, `--view`               | off                    | Open the HTML report in the default browser.                            |
| `--timeout <seconds>`        | `180`                  | Wall-clock budget for the scan. `0` disables it.                        |
| `--min-score <number>`       | `0` (off)              | Exit 1 if the overall score is below this.                              |
| `--assert-category <id:min>` | none                   | Exit 1 if a category scores below its threshold. Repeatable.            |
| `--debug-audit <id\|fails>`  | none                   | Print a diagnostic block for matching audits.                           |
| `--trace [path]`             | off                    | Write one NDJSON record per audit.                                      |
| `--silent`                   | off                    | No banner, progress or terminal report. Files and assertions still run. |
| `--progress-json`            | off                    | Stream progress as NDJSON on stderr.                                    |
| `--log-level <level>`        | `LOG_LEVEL`, or `warn` | Terminal log level. Logs go to stderr.                                  |
| `--log-file <path>`          | off                    | Append every log line, down to `trace`, as JSON lines.                  |

Precedence is flag, then config file, then default.

### `-c`, `--config <path>`

Without the flag the CLI uses the first of `agent-lighthouse.config.json`, `.agent-lighthouserc.json` and `.agent-lighthouserc` in the working directory. With the flag, a missing or invalid file is a fatal error. Keys are in [config.md](./config.md).

### `--categories <list>`

```bash
agent-lighthouse https://example.com --categories structured-data,agentic-commerce
```

Only the named categories run and count. The ids are `access-crawl-control`, `content-extraction`, `machine-discovery`, `structured-data`, `answer-readiness`, `agent-interfaces`, `agentic-commerce` and `operability-safety`, described in [config.md](./config.md#the-eight-categories). An unknown id exits 1 and prints the valid list.

### `--page-type <type>`

```bash
agent-lighthouse https://example.com/product/widget --page-type product
```

Types: `homepage`, `category`, `product`, `article` (editorial: posts, news, guides) and `general` (any other page: about, FAQ, help, contact, policy).

- A declared type lets type-specific checks count toward the score. A detected type keeps them advisory.
- The flag overrides the config `pageType`. Config `pages` declares more URLs.
- A bare flag or an unknown type exits 1. The pre-v7 names `unknown` and `content` are refused with a hint to use `general`.
- Mixed scans keep declared and detected findings apart. Each audit counts once. `--debug-audit <id>` shows each population's selected, input and unread URLs.

Detection reads a path of `/` as `homepage`. A subpath such as `/shop/` or `/en-us/` is a homepage only when the page's own links say so: its site header's first same-origin link points back at that path, or every same-origin link stays under it across at least three paths. A detected or declared subpath homepage looks for sitemaps under that subpath first. Declare `--page-type` when detection is wrong.

### `--experimental`

Experimental audits are excluded by default. They carry weight 0, so this flag never changes a score; it only adds results. The [evidence policy](./evidence/policy.md) says what puts an audit in that tier.

### `-o`, `--output` and `-d`, `--output-dir`

`markdown` is accepted for `md`. `terminal` prints to stdout; the others write files into the output directory:

| Format | File                           |
| :----- | :----------------------------- |
| `json` | `agent-lighthouse-report.json` |
| `html` | `agent-lighthouse-report.html` |
| `md`   | `agent-lighthouse-report.md`   |

Repeat runs overwrite them. `--view` opens nothing when `html` is not in the list.

### `--timeout <seconds>`

When the budget runs out, requests in flight abort and no new ones start. Every audit not finished is reported `na` with the tag `skipped:scan-budget`, and the report records it under `conditions.budget`. If the cut, together with what the evidence gate removed, leaves more than 35% of the registry's evidence mass unassessed, the scan reports no score. The config key is `timeout`.

### `--min-score <number>` and `--assert-category <id:min>`

```bash
agent-lighthouse https://example.com --min-score 80 \
  --assert-category structured-data:90 --assert-category access-crawl-control:75
```

- Reports are written before assertions run, so they survive a failure.
- A scan with no score fails `--min-score`.
- A category id matches the id first, then the display name, case-insensitively.
- A threshold naming a category that did not run is ignored.
- A category that ran but reached no scored verdict fails as "not assessed".
- A threshold of `0` never fails.
- Config `assertCategories` merges with the flags; a flag wins for the same category.

### `--debug-audit <id|fails>`

```bash
agent-lighthouse https://example.com --debug-audit structured-data/faqpage-schema
agent-lighthouse https://example.com --debug-audit sitemap   # title contains "sitemap"
agent-lighthouse https://example.com --debug-audit fails     # every fail or warn
```

Prints page URL, found and expected values, explanation, impact, fix and a code sample. The value matches an exact id or a title substring. `fails` also selects audits whose advisory population fails or warns. Not-applicable checks are searched too, which shows why an audit reported nothing.

### `--trace [path]`

Writes one NDJSON record per registered audit, including audits that never ran. The default path is `./agent-lighthouse-trace.ndjson`. The file is truncated at the start and appended during the scan, so a crash keeps what ran.

| Field                                    | Meaning                                                                      |
| :--------------------------------------- | :--------------------------------------------------------------------------- |
| `id`, `category`                         | Which audit                                                                  |
| `outcome`                                | `ran`, `skipped` (page type), `gated` (no evidence), `budget` or `error`     |
| `status`, `score`, `weight`              | The verdict and what it contributed                                          |
| `tier`, `evidenceGrade`                  | Whether it could count                                                       |
| `durationMs`                             | Time inside the audit; `0` if it never ran                                   |
| `displayValue`, `explanation`, `pageUrl` | The verdict in words, and where                                              |
| `details`, `coverage`, `advisoryResults` | The evidence behind the verdict, the pages it covered, and advisory findings |

```bash
# compare two runs
diff <(jq -c '{id,outcome,status,score}' before.ndjson) <(jq -c '{id,outcome,status,score}' after.ndjson)

# audits that did not run, and why
jq -r 'select(.outcome != "ran") | "\(.outcome)\t\(.id)\t\(.explanation)"' agent-lighthouse-trace.ndjson
```

### `--log-level <level>`

Levels: `silent`, `error`, `warn`, `info`, `debug`, `trace`. The flag overrides `LOG_LEVEL`. Without either, the CLI shows `warn` and `error`. An unknown level exits 1. `--progress-json` forces `silent`.

| Level   | Adds                                                           |
| :------ | :------------------------------------------------------------- |
| `error` | Scanner faults, such as an audit that threw, with its stack    |
| `warn`  | What changes a result: a budget that ran out, failed requests  |
| `info`  | One line per scan: score, pages, duration                      |
| `debug` | Decisions and phases: bot walls, hosts dropped, time per phase |
| `trace` | One line per request and per audit                             |

A text line shows the time, level, site, the first 8 characters of the scan id, and the component:

```
07:12:03.456 WARN  [example.com a1b2c3d4] orchestrator: Some requests got no answer phase=audits failed=3 requests=212 failures={"UND_ERR_CONNECT_TIMEOUT":3} caller=orchestrator.ts:837
```

Set `LOG_FORMAT=json` for one JSON object per line. Every line carries these context fields when they apply:

| Field       | Meaning                                                                 |
| :---------- | :---------------------------------------------------------------------- |
| `site`      | The scanned host                                                        |
| `scan`      | The scan id, equal to the report's `scanId`                             |
| `component` | The module that wrote it, such as `fetcher`, `orchestrator` or `audit`  |
| `phase`     | `fetch-root`, `fetch-pages`, `analyze`, `audits` or `report`            |
| `audit`     | The audit whose work wrote it, also for its requests and gatherer reads |
| `gatherer`  | The shared gatherer whose work wrote it, such as `sitemap`              |
| `caller`    | On `warn` and `error` lines only: the source `file:line`                |

Other fields follow OpenTelemetry names: `http.request.method`, `url.full`, `http.response.status_code`, `user_agent.original`. Durations are `durationMs`. Errors are `err`, with `type`, `message`, `stack` and `code`. The logger removes URL credentials and the values of secret-named keys (`authorization`, `cookie`, `token` and similar) before writing.

### `--log-file <path>`

Appends every line, down to `trace`, as JSON, whatever the terminal level. It records each request's start and finish, time per phase, bot walls, requests the scan chose not to send, and requests still open when audits finished.

```bash
agent-lighthouse https://example.com --silent --log-file ./scan-log.jsonl

# slowest requests
jq -r 'select(.msg == "Request finished") | [.durationMs, ."url.full"] | @tsv' scan-log.jsonl | sort -rn | head
# requests per audit
jq -r 'select(.msg == "Request finished") | .audit // "(scan)"' scan-log.jsonl | sort | uniq -c | sort -rn
# time per phase
jq -r 'select(.msg == "Phase done") | "\(.phase)\t\(.durationMs)ms"' scan-log.jsonl
```

To send logs to your own logger from code, see `logger` in [programmatic options](./config.md#programmatic-options).

### `--progress-json`

```bash
agent-lighthouse https://example.com --output json --progress-json 2> progress.ndjson
```

Writes one `ScanEvent` per line to stderr and turns off the interactive display. Scanner logs are silenced to keep the stream parseable; audit errors still appear in the report.

## What a scan reads

The scan reads the target URL plus any pages declared in a [config file](./config.md). It probes a fixed set of root files (`/robots.txt`, `/llms.txt`, `/sitemap.xml`, `/.well-known/…` and others). Some audits also sample sitemap pages; those samples do not decide whether the scan is scored. None of this is configurable.

When the target has no readable text and a same-origin `<meta http-equiv="refresh">` or `<link rel="canonical">` names another page, the scan reads that page once, as a second page. The gateway keeps its own findings. Other origins are not followed, and never more than one hop.

## Exit codes

| Code | Meaning                                                                                                                                                                   |
| :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`  | The scan completed and every assertion passed, or help was printed.                                                                                                       |
| `1`  | No URL; invalid URL; unknown category, page type or log level; invalid `--timeout` or threshold; an assertion failed; or a fatal error such as a missing `--config` file. |

An assertion failure and a crash both exit 1. To tell them apart, check for `reports/agent-lighthouse-report.json`: it exists after an assertion failure, not after a crash.

## In CI

```yaml
- name: Audit agent readiness
  run: |
    npx @forkpoint/agent-lighthouse https://staging.example.com \
      --output terminal,html,json,md --min-score 80 \
      --assert-category structured-data:90

- name: Upload report
  if: always() # keep the report when an assertion fails
  uses: actions/upload-artifact@v4
  with:
    name: agent-lighthouse-report
    path: ./reports/
```

The ready-made action is in [github-action.md](./github-action.md). [badge.md](./badge.md) turns a score into a README badge.
