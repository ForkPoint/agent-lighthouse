# Check your website

Agent Lighthouse is a free, open-source tool for website AI readiness. Run it from your terminal to find out what helps or blocks AI systems on your site.

## Run a scan from your terminal

You need Node.js and npm, which provides the `npx` command. Open a terminal and replace the example address with your website:

```bash
npx @forkpoint/agent-lighthouse https://yourstore.com --view
```

The command downloads Agent Lighthouse if needed. It prints a summary and saves HTML and JSON reports in `./reports`. The `--view` flag opens the HTML report in your browser.

## Choose your next fixes

1. Review the scan coverage. Missing access can limit the result.
2. Read the failed checks and their guidance. Start with issues that fit your site and have high priority.
3. Follow a check's proof link for its rule, sources and limits.
4. Run another scan after your changes.

Only eligible scored checks affect the score. Advisory and experimental findings provide context. A check that does not apply to your site is not a failure. A scan cannot promise an AI mention, citation or completed action.

See [how scoring works](../../../../docs/scoring.md) for the full rules.

## Save and share your results

Share the HTML report with your team. Use the JSON file with the homepage's report viewer for a score summary. The viewer reads the file in your browser without uploading it.

Repeat scans overwrite reports in the same folder. To keep a separate result:

```bash
npx @forkpoint/agent-lighthouse https://yourstore.com --output-dir ./reports/after-changes --view
```

The [command-line reference](../../../../docs/cli.md) covers scan options and report formats.

## Prefer to scan online?

[Agentic Storefront](https://audit.agenticstorefront.com) lets you check your website in your browser. Use it if you prefer an online scan without terminal setup.

It is an optional alternative to running the open-source Agent Lighthouse tool yourself.
