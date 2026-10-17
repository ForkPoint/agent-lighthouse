# Agent Lighthouse Badge

Show a current score in a README, docs page or client report.

## Static Markdown Badge

```markdown
[![Agent Lighthouse](https://img.shields.io/badge/Agent%20Lighthouse-87%2F100-4f46e5)](https://github.com/ForkPoint/agent-lighthouse)
```

## Score Colors

|  Score | Color    | Meaning     |
| -----: | :------- | :---------- |
| 90-100 | `22c55e` | Agent-ready |
|  70-89 | `4f46e5` | Good        |
|  50-69 | `f59e0b` | Needs work  |
|   0-49 | `ef4444` | Blocked     |

The bands match the [score tiers](./scoring.md#score-tiers).

## From a scan

```bash
npx @forkpoint/agent-lighthouse https://example.com --output json --output-dir ./reports
```

Read `overallScore` from `reports/agent-lighthouse-report.json`, pick the color from the table, and update the badge. A `null` score means the scan was not scored; do not publish a badge for it.

The docs site has an interactive badge generator ([screenshot](assets/badge-generator-screenshot.png)).
