# Agent Lighthouse Badge

Use a badge when you want to show a current Agent Lighthouse score in a README, docs page, launch post, or client report.

## Static Markdown Badge

```markdown
[![Agent Lighthouse](https://img.shields.io/badge/Agent%20Lighthouse-87%2F100-22c55e)](https://github.com/ForkPoint/agent-lighthouse)
```

## Score Colors

| Score | Color | Meaning |
| --: | :-- | :-- |
| 90-100 | `22c55e` | Agent-ready |
| 70-89 | `4f46e5` | Good |
| 50-69 | `f59e0b` | Needs work |
| 0-49 | `ef4444` | Blocked |

## CLI Workflow

```bash
npx @forkpoint/agent-lighthouse https://example.com --output json --output-dir ./reports
```

Take the `overallScore` from `reports/agent-lighthouse-report.json`, choose a color from the table, and update the badge.

The docs site also includes an interactive badge generator.

Preview asset: [`docs/assets/badge-generator-screenshot.png`](assets/badge-generator-screenshot.png)
