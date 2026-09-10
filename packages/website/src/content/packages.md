# Choose the right package

Most people need only the command-line tool. Use the other packages when you want to connect scans to your own application or tools.

| What you want to do                        | Package                              |
| ------------------------------------------ | ------------------------------------ |
| Run a scan from a terminal                 | `@forkpoint/agent-lighthouse`        |
| Start a scan from JavaScript or TypeScript | `@forkpoint/agent-lighthouse-core`   |
| Turn scan results into report views        | `@forkpoint/agent-lighthouse-report` |
| Make scanning available to an MCP client   | `@forkpoint/agent-lighthouse-mcp`    |

MCP means Model Context Protocol. It lets compatible applications call tools such as a website scan.

## Start with a terminal scan

```bash
npx @forkpoint/agent-lighthouse https://example.com --view
```

Follow the [quickstart](./quickstart.md) for the report and next steps.

## Build an integration

The core package runs the scan. The report package formats its results. The command-line tool and MCP server provide different ways to use the scanner.

Use the SDK guide for application code, the MCP guide for a compatible client, or the GitHub Actions guide for checks in a development workflow.

## For contributors

The repository keeps these packages together so they can share scan types and release changes together. See the [contributor guide](https://github.com/ForkPoint/agent-lighthouse/blob/main/AGENTS.md) for the folder layout, tests, and rules for changing checks.
