# Use the scanner from an AI tool

The MCP server makes a website scan available to a compatible AI application. MCP means Model Context Protocol: a way for an application to call tools.

This integration runs Agent Lighthouse. It does not make the scanned website support MCP or guarantee that another AI system can use it.

## Connect the server

You need Node.js, npm, and a client that supports launching local MCP servers. Add this server entry to your client's MCP configuration:

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

Your client determines where this file lives and when to reload it. Keep any other server entries you already use.

## Ask for a website check

Ask your client to scan a public website address with Agent Lighthouse. Review the findings and suggested fixes. Do not treat the score as proof that every AI system can use that website.

If the tool does not appear, check the client's server logs and confirm it can run `npx`. To check the scanner separately from your client, run the command in the [quickstart](./quickstart.md).

## Prefer to call it from code?

Use the [SDK guide](./sdk.md) for a Node.js or TypeScript application. You do not need an MCP client for that route.
