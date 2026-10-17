# GitHub Action

The repository root `action.yml` is a composite action. It runs the CLI with `--output=terminal,html,json,md` and can comment the Markdown summary on a pull request.

```yaml
name: Agent Lighthouse

on:
  pull_request:
    branches: [main]

jobs:
  agent-lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ForkPoint/agent-lighthouse@main
        with:
          url: https://staging.example.com
          min-score: "85"
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input             | Default     | Effect                                                  |
| :---------------- | :---------- | :------------------------------------------------------ |
| `url`             | required    | The URL to scan.                                        |
| `min-score`       | `"0"` (off) | Fail the step below this overall score.                 |
| `assert-category` | none        | One `id:min` threshold, such as `structured-data:85`.   |
| `output-dir`      | `./reports` | Where the reports go.                                   |
| `comment-on-pr`   | `"true"`    | Post `agent-lighthouse-report.md` as a PR comment.      |
| `github-token`    | none        | Token for the comment. Without it no comment is posted. |

- The comment is posted only on `pull_request` events, and only when the scan step succeeded. A failed assertion skips it.
- The action runs `npx -y @forkpoint/agent-lighthouse`, so it always uses the latest published CLI, whatever ref of the action you pin.
- The repository publishes no `v*` tags. To pin the action's own steps, use a commit SHA: `ForkPoint/agent-lighthouse@<sha>`.
- For other flags, or to keep the reports as an artifact, run the CLI directly; see [In CI](./cli.md#in-ci).

## Marketplace listing

- Name: `Agent Lighthouse Audit`
- Description: `Audit websites for AI-agent readiness, LLM crawler access, MCP discovery, WebMCP, and Schema.org signals in CI`
- Categories: Code Quality, Testing, Utilities
