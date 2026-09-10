# Share your scan result

Give your team the findings behind the score. A report helps them see what needs attention and why.

## Choose what to share

| File            | Best use                                                          |
| --------------- | ----------------------------------------------------------------- |
| HTML report     | Open it in a browser or send it to a teammate.                    |
| JSON report     | Read the result in your own tools or the website's report viewer. |
| Markdown report | Add a text summary to a pull request or project notes.            |

The default scan saves HTML and JSON reports. To include Markdown:

```bash
npx @forkpoint/agent-lighthouse https://example.com --output html,json,md
```

Look in the `reports` folder where you ran the command. Check a report for private URLs or site details before posting it publicly.

## Add context to the number

Include the scanned address, scan date, tool version, and any scan options you changed. Link or attach the report so readers can inspect the findings.

When you compare two scans, explain what changed. Keep their options consistent. A score alone does not show whether the scan reached the same pages.

## Share a public example

Use the [site score form](https://github.com/ForkPoint/agent-lighthouse/issues/new?template=site-score.yml) to share a result with the project. GitHub issues are public.

For a compact score image, follow the [score badge guide](./badge.md). A badge is a summary, not a certificate or a replacement for the report.
