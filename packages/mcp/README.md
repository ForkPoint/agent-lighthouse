# @forkpoint/agent-lighthouse-mcp

Model Context Protocol server for Agent Lighthouse. It lets Claude Desktop, Cursor and other MCP clients scan a website for AI-agent readiness.

## Setup

```json
{
  "mcpServers": {
    "agent-lighthouse": {
      "command": "npx",
      "args": ["-y", "@forkpoint/agent-lighthouse-mcp"]
    }
  }
}
```

The package's command is `agent-lighthouse-mcp` (`dist/bin.js`). It speaks MCP over stdio. Logs go to stderr; set `LOG_LEVEL` and `LOG_FORMAT` to change them.

## The `audit_website` tool

| Argument    | Required | Meaning                                                                    |
| :---------- | :------- | :------------------------------------------------------------------------- |
| `url`       | yes      | The URL to scan.                                                           |
| `pageType`  | no       | `homepage`, `category`, `product`, `article` or `general`. Omit to detect. |
| `pages`     | no       | More `{ url, pageType }` declarations.                                     |
| `snapshots` | no       | Browser-rendered DOM input.                                                |

It returns JSON: overall score and tier (`null` with `unscoredReason` when the scan was not scored), per-category scores, readiness vitals, page scope, and the top 10 fixes. Progress is sent as `notifications/progress` when the client passes a progress token.

`auditWebsite(url, { pageType, pages, snapshots })`, exported from this package, runs the same scan from code.

## The `registry_summary` tool

Takes no arguments and runs no scan. It returns the installed version's `getRegistrySummary()` as JSON: the core version, the number of audits and categories, the count per tier, the registry mass, and the same per category.

## Links

- Documentation: https://forkpoint.github.io/agent-lighthouse/
- Repository: https://github.com/ForkPoint/agent-lighthouse
- CLI package: https://www.npmjs.com/package/@forkpoint/agent-lighthouse

## License

Apache-2.0
