# CLI reference

`@forkpoint/agent-lighthouse` audits a live URL for agent readiness and writes a terminal, HTML, JSON and/or Markdown report. This page is the complete reference for the command and its flags.

For what the resulting numbers mean, see [scoring.md](./scoring.md). For the config file, environment variables and the programmatic API, see [config.md](./config.md).

## Install

No installation is needed for a one-off scan:

```bash
npx @forkpoint/agent-lighthouse https://yourstore.com
```

To install it permanently:

```bash
# globally, for ad-hoc use on any project
npm i -g @forkpoint/agent-lighthouse

# or as a project dev dependency, for CI and repeatable runs
pnpm add -D @forkpoint/agent-lighthouse
```

Once installed the binary is called `agent-lighthouse`.

## Invocation

```
agent-lighthouse <url> [options]
agent-lighthouse audit <url> [options]
agent-lighthouse --help
```

The first two forms do the same thing; the `audit` sub-command exists so scripts can read more explicitly. The third is not a flag on a scan: help is recognised only when `-h` or `--help` is the **first** argument, so `agent-lighthouse --help` prints usage while `agent-lighthouse https://example.com --help` ignores it and scans the URL. The URL must be absolute and include its scheme (`https://example.com`, not `example.com`) — anything the `URL` constructor rejects exits with code 1.

The URL may also come from a [config file](./config.md#the-config-file) instead of the command line, but only from an invocation that gets as far as reading one. Two forms do: `agent-lighthouse audit` — the sub-command with no URL after it — and anything whose first argument is a flag, such as `agent-lighthouse --silent`. A bare `agent-lighthouse` with no arguments does **not**: it prints usage and exits 1 before the config file is opened. If a form that does read the file finds no URL there either, the CLI prints its usage and exits 1.

```bash
# scan a staging site and open the HTML report when it is done
agent-lighthouse https://staging.yourstore.com --view

# scan the URL declared in agent-lighthouse.config.json:
# the audit sub-command with no URL after it ...
agent-lighthouse audit

# ... or any invocation whose first argument is a flag
agent-lighthouse --config ./ci/agent-lighthouse.staging.json
```

### How flag values are read

Flags that take a value accept either form:

```bash
agent-lighthouse https://example.com --min-score 85
agent-lighthouse https://example.com --min-score=85
```

Short and long spellings are interchangeable (`-o json` and `--output json` are the same flag). In the space-separated form the value must not begin with `-`, or it is treated as the next flag rather than as a value.

The one exception is `--assert-category`, which is read by a separate pass that only understands the space-separated form. Use `--assert-category structured-data:90`, not `--assert-category=structured-data:90`.

## Flags

| Flag                         | Value               | Default              | What it does                                                           |
| :--------------------------- | :------------------ | :------------------- | :--------------------------------------------------------------------- |
| `-h`, `--help`               | —                   | —                    | Print usage and exit. Recognised only as the first argument.           |
| `-p`, `--preset <name>`      | preset name         | `full`               | Names the audit profile shown in the report header.                    |
| `-c`, `--config <path>`      | file path           | auto-discovered      | Load configuration from an explicit file.                              |
| `--categories <list>`        | comma-separated ids | all eight            | Restrict the scan to these categories.                                 |
| `--experimental`             | —                   | off                  | Also run experimental-tier audits (reported, never scored).            |
| `-o`, `--output <formats>`   | comma-separated     | `terminal,html,json` | Which report formats to produce.                                       |
| `-d`, `--output-dir <path>`  | directory path      | `./reports`          | Where report files are written.                                        |
| `-v`, `--view`               | —                   | off                  | Open the generated HTML report in the default browser.                 |
| `--timeout <seconds>`        | seconds             | `180`                | Wall-clock budget for the scan; `0` disables it.                       |
| `--min-score <number>`       | 0–100               | `0` (no assertion)   | Fail the run if the overall score is below this.                       |
| `--assert-category <id:min>` | `id:number`         | none                 | Fail the run if a category scores below its threshold. Repeatable.     |
| `--debug-audit <id\|fails>`  | audit id or `fails` | none                 | Print a deep diagnostic breakdown for matching audits.                 |
| `--trace [path]`             | file path           | off                  | Write one NDJSON record per audit, including skipped and errored ones. |
| `--silent`                   | —                   | off                  | Suppress banner, progress and terminal report.                         |
| `--progress-json`            | —                   | off                  | Stream scan progress as NDJSON on stderr.                              |

### `-h`, `--help`

Prints the usage block and exits.

Unlike every other entry in this table, help is not an option on a scan: it is read only when it is the **first** argument. `agent-lighthouse --help` and `agent-lighthouse -h` print usage; `agent-lighthouse https://example.com --help` runs a full scan of that URL and never prints anything about usage. Running the command with no arguments at all prints the same usage block.

Note also that the exit code is **1**, not 0 — the same code as a missing URL, since both mean "nothing was scanned". Do not use `agent-lighthouse --help` as a health check in a script that treats a non-zero exit as a failure.

### `-p`, `--preset <name>`

Accepted names: `ecommerce`, `saas`, `content`, `quick`, `full`. Default `full`. An unrecognised name silently falls back to `full`.

```bash
agent-lighthouse https://yourstore.com --preset ecommerce
```

The preset name is recorded and printed in the run header. **In the current release it does not change which audits run or how they are scored** — v2 replaced hand-tuned category weights with evidence mass (see [scoring.md](./scoring.md#category-scores-to-the-overall-score)), and the preset's category filter and page limit are not applied. To actually narrow a scan, use `--categories`.

### `-c`, `--config <path>`

```bash
agent-lighthouse --config ./ci/agent-lighthouse.staging.json
```

Without this flag the CLI looks for `agent-lighthouse.config.json`, `.agent-lighthouserc.json` and `.agent-lighthouserc` in the working directory, in that order, and uses the first one that exists. With this flag, the named file must exist — a missing path is a fatal error, not a fallback to auto-discovery. See [config.md](./config.md) for the file's keys.

### `--categories <list>`

A comma-separated list of category ids. Only the named categories are scanned, and only their audits appear in the report and the score.

```bash
agent-lighthouse https://yourstore.com --categories structured-data,agentic-commerce
```

The valid ids are `access-crawl-control`, `content-extraction`, `machine-discovery`, `structured-data`, `answer-readiness`, `agent-interfaces`, `agentic-commerce` and `operability-safety`. An unknown id is rejected before the scan starts, with the valid list printed and exit code 1 — a typo narrows nothing silently. Each id is described in [config.md](./config.md#the-eight-categories).

### `--page-type <type>`

```bash
agent-lighthouse https://yourstore.com/product/widget --page-type product
```

Explicitly declares the page type of the target URL (`homepage`, `product`, `category`, `content`, `author`). Under Phase 3 scoring rules, page type detection provides evidence for `informative` (unscored) results, whereas explicitly declared page types authorize full `scored` audits.

### `--experimental`

```bash
agent-lighthouse https://yourstore.com --experimental
```

Experimental-tier audits are excluded from every scan by default. They carry weight 0 either way, so this flag never changes a score; it only adds their results to the report. Running an unvalidated check is a decision the operator makes rather than a default. See the [evidence policy](./evidence/policy.md) for what puts an audit in that tier.

### `-o`, `--output <formats>`

Comma-separated list drawn from `terminal`, `html`, `json` and `md` (`markdown` is accepted as a synonym for `md`). Default `terminal,html,json`.

```bash
agent-lighthouse https://yourstore.com --output json,md
```

`terminal` prints the score summary to stdout; the other three write files into the output directory. Formats not listed are skipped entirely — `--output json` writes no HTML, so pairing it with `--view` opens nothing.

### `-d`, `--output-dir <path>`

Default `./reports`, resolved against the working directory and created if it does not exist.

```bash
agent-lighthouse https://yourstore.com --output-dir ./artifacts/lighthouse
```

### `-v`, `--view`

Opens the generated HTML report in the default browser once the scan finishes (`open` on macOS, `start` on Windows, `xdg-open` elsewhere). Has no effect if the HTML format was not generated.

### `--timeout <seconds>`

```bash
agent-lighthouse https://slow.example.com --timeout 600
```

A wall-clock budget for the whole scan. The default is 180 seconds, which clears the 95th percentile of the curated corpus with margin. When the budget runs out the scan finishes with what it has: requests in flight are aborted, no further request is sent, and every audit that had not started, or was still running when the budget went, is reported `na` with the tag `skipped:scan-budget`. A running audit is withheld rather than believed: a request the budget refused reads to an audit as a broken link or a missing artifact, which would be a claim about the clock, not the site. The report records it under `conditions.budget`, and the terminal prints one line naming the count. If the budget's cut, together with what the evidence gate removed, leaves more than 35% of the registry's evidence mass unassessed, the scan reports no score rather than a partial one. `0` disables the budget. The config file key is `timeout`.

### `--min-score <number>`

```bash
agent-lighthouse https://staging.yourstore.com --min-score 85
```

If the overall score is below the threshold, the CLI prints the failure and exits 1 — reports are still written first, so the artifact survives the failure. The default of `0` disables the assertion; a threshold of 0 is therefore indistinguishable from no threshold.

### `--assert-category <id:min>`

A per-category budget, in `id:number` form. Repeat the flag for more than one category:

```bash
agent-lighthouse https://yourstore.com \
  --assert-category structured-data:90 \
  --assert-category access-crawl-control:75
```

The id is matched against category ids first, then against category display names case-insensitively, so `--assert-category "structured:90"` also resolves. A threshold naming no category is ignored rather than reported, so check your spelling against the id list. The first category below its threshold exits the process with code 1. Thresholds may also be declared in the config file under `assertCategories`.

### `--debug-audit <id|fails>`

Prints a full diagnostic block — page URL, found value, expected value, explanation, impact, fix and code sample — for the matching audits.

```bash
# one audit by id
agent-lighthouse https://yourstore.com --debug-audit structured-data/faqpage-schema

# fuzzy: every audit whose title contains "sitemap"
agent-lighthouse https://yourstore.com --debug-audit sitemap

# everything that did not pass
agent-lighthouse https://yourstore.com --debug-audit fails
```

The argument is matched against an audit's exact id, or case-insensitively against its title. The literal value `fails` selects every check whose status is `fail` or `warn`. Not-applicable checks are included in the search set, so this is also the way to find out why an audit reported nothing. If nothing matches, the CLI says so and continues.

### `--trace [path]`

Writes one NDJSON record per registered audit to a file — every audit, every
scan, including the ones that were skipped before running and the ones that
errored. Those are the records worth having: a report shows what an audit
concluded, and a trace shows whether it ever got the chance to conclude
anything.

```bash
# default path: ./agent-lighthouse-trace.ndjson
agent-lighthouse https://yourstore.com --trace

# or name the file
agent-lighthouse https://yourstore.com --trace ./run-1.ndjson
```

Each record carries:

| Field                                    | What it tells you                                                    |
| :--------------------------------------- | :------------------------------------------------------------------- |
| `id`, `category`                         | which audit                                                          |
| `outcome`                                | `ran`, `skipped` (no scanned page matched its page types) or `error` |
| `status`, `score`, `weight`              | the verdict and what it contributed                                  |
| `tier`, `evidenceGrade`                  | whether it counted toward the score at all                           |
| `durationMs`                             | wall time inside the audit; `0` for one that never ran               |
| `displayValue`, `explanation`, `pageUrl` | the verdict in words, and where                                      |
| `details`                                | the structured evidence the verdict was drawn from                   |

The file is truncated at the start of a scan and appended to as the scan runs,
so a crash still leaves everything up to the point it stopped.

Two runs of the same site produce two comparable files, which is the point:

```bash
agent-lighthouse https://yourstore.com --trace ./before.ndjson --silent
agent-lighthouse https://yourstore.com --trace ./after.ndjson --silent
diff <(jq -c '{id,outcome,status,score}' before.ndjson) \
     <(jq -c '{id,outcome,status,score}' after.ndjson)
```

Useful queries, once you have a file:

```bash
# every audit that never ran, and why
jq -r 'select(.outcome != "ran") | "\(.outcome)\t\(.id)\t\(.explanation)"' trace.ndjson

# the ten slowest audits
jq -s 'sort_by(-.durationMs) | .[:10] | .[] | "\(.durationMs)ms\t\(.id)"' -r trace.ndjson

# what a single audit actually saw
jq 'select(.id == "structured-data/faqpage-schema")' trace.ndjson
```

For a one-line-per-audit summary on stderr instead of a file, set
`LOG_LEVEL=debug`. The runner logs one line per audit at debug level whether or
not a trace file is open, alongside the rest of the debug output:

```bash
LOG_LEVEL=debug agent-lighthouse https://yourstore.com --silent 2>&1 | grep '\[audit\]'
```

```
[DEBUG] [audit] machine-discovery/llms-txt-exists ran/na score=0 weight=0 17ms — HTTP 404; no discovery <link> in <head>
[DEBUG] [audit] structured-data/product-schema skipped/na score=0 weight=0
```

### `--silent`

Suppresses the banner, the progress display and the terminal report. Report files are still written and assertions still run, so this is the flag for CI jobs that only want the artifacts and the exit code.

### `--progress-json`

Streams scan progress as newline-delimited JSON — one `ScanEvent` object per line — to **stderr**, and turns off the interactive progress display.

```bash
agent-lighthouse https://yourstore.com --output json --progress-json 2> progress.ndjson
```

Stderr is used so the stream can never interleave with the terminal report on stdout. All scanner logging is silenced while it is active, to keep the stream parseable; audit errors still appear in the report itself.

## What a scan writes

Files are written into `--output-dir` (default `./reports`) with fixed names:

| Format | File                           |
| :----- | :----------------------------- |
| `json` | `agent-lighthouse-report.json` |
| `html` | `agent-lighthouse-report.html` |
| `md`   | `agent-lighthouse-report.md`   |

Repeat runs overwrite them. Use `--output-dir` to keep runs apart.

A scan covers the homepage plus up to five internal pages discovered from the sitemap and navigation, and probes a fixed set of root-level files (`/robots.txt`, `/llms.txt`, `/sitemap.xml`, `/.well-known/…` and others). Neither the page budget nor the discovery set is configurable from the CLI.

## Exit codes

| Code | Meaning                                                                                                                                                                             |
| :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`  | The scan completed and every assertion passed.                                                                                                                                      |
| `1`  | Usage printed (`--help`, or no URL given); invalid URL; unknown category id; `--min-score` or `--assert-category` not met; or an unhandled error such as a missing `--config` file. |

Because a failed budget and a crashed scan share exit code 1, CI jobs that need to tell them apart should check for the report file: assertions run after the reports are written, so `reports/agent-lighthouse-report.json` exists on a budget failure and not on a crash.

## In CI

```yaml
name: Agent Lighthouse

on:
  pull_request:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Audit agent readiness
        run: |
          npx @forkpoint/agent-lighthouse https://staging.yourstore.com \
            --output terminal,html,json,md \
            --output-dir ./reports \
            --min-score 80 \
            --assert-category structured-data:90

      # Upload before the job can fail on a budget, so the report survives.
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: agent-lighthouse-report
          path: ./reports/
```

A ready-made GitHub Action wrapper is documented in [github-action.md](./github-action.md), and [badge.md](./badge.md) covers turning a score into a README badge.
