import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { runScan } from "@forkpoint/agent-lighthouse-core";
import { buildReportView } from "@forkpoint/agent-lighthouse-report";
import { createProgressNotifier } from "./progress";
import { AUDIT_TOOL, buildAuditSummary, targetUrl } from "./tool";

declare const __PACKAGE_VERSION__: string;

const MCP_SERVER_VERSION =
  typeof __PACKAGE_VERSION__ === "string" ? __PACKAGE_VERSION__ : "unknown";

const server = new Server(
  {
    name: "agent-lighthouse-mcp",
    version: MCP_SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Register Available Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [AUDIT_TOOL] };
});

// Handle Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === AUDIT_TOOL.name) {
    const url = targetUrl(request.params.arguments);

    // Forward scan progress as notifications/progress when the client
    // supplied a progressToken; otherwise scan silently as before.
    const onEvent = createProgressNotifier(
      request.params._meta?.progressToken,
      (params) => {
        // Fire-and-forget, but swallow rejections (e.g. client disconnected
        // mid-scan) so they never surface as unhandled.
        void server
          .notification({ method: "notifications/progress", params })
          .catch(() => {});
      },
    );

    const report = await runScan(url, { onEvent });
    const summary = buildAuditSummary(report, buildReportView(report));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal MCP server error:", err);
  process.exit(1);
});
