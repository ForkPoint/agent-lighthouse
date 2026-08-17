# @forkpoint/agent-lighthouse-mcp

Model Context Protocol server for Agent Lighthouse.

Use this package to let Claude Desktop, Cursor, and other MCP-compatible agentic IDEs audit live websites for AI-agent readiness.

## Claude Desktop / Cursor

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

## What It Exposes

The MCP server wraps Agent Lighthouse scans so an assistant can check `llms.txt`, robots.txt AI crawler access, Schema.org, WebMCP, OpenAPI discovery, accessibility, semantic HTML, AEO/GEO signals, and technical readiness from inside the IDE.

## Links

- Documentation: https://forkpoint.github.io/agent-lighthouse/
- Repository: https://github.com/ForkPoint/agent-lighthouse
- CLI package: https://www.npmjs.com/package/@forkpoint/agent-lighthouse

## License

GPL-3.0-only
