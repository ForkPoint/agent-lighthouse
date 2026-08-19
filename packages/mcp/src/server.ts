import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { runScan } from '@forkpoint/agent-lighthouse-core';
import { buildReportView } from '@forkpoint/agent-lighthouse-report';
import { createProgressNotifier } from './progress';

declare const __PACKAGE_VERSION__: string;

const MCP_SERVER_VERSION = typeof __PACKAGE_VERSION__ === 'string' ? __PACKAGE_VERSION__ : 'unknown';

const server = new Server(
  {
    name: 'agent-lighthouse-mcp',
    version: MCP_SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Available Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'audit_website',
        description:
          'Audit a website or storefront for Agentic Readiness (WebMCP, OpenAPI, JSON-LD, robots.txt, and answer engines). Returns overall score, category breakdown, and actionable fix recommendations.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The target website or storefront URL to audit (e.g. https://example.com)',
            },
          },
          required: ['url'],
        },
      },
    ],
  };
});

// Handle Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'audit_website') {
    const url = String(request.params.arguments?.url);
    if (!url) {
      throw new Error('Missing target URL');
    }

    // Forward scan progress as notifications/progress when the client
    // supplied a progressToken; otherwise scan silently as before.
    const onEvent = createProgressNotifier(
      request.params._meta?.progressToken,
      (params) => {
        void server.notification({ method: 'notifications/progress', params });
      },
    );

    const report = await runScan(url, { onEvent });
    const view = buildReportView(report);

    const summary = {
      url: report.url,
      overallScore: view.overallScore,
      scoreTier: view.scoreTier,
      durationSeconds: (view.durationMs / 1000).toFixed(1),
      vitals: view.vitals,
      categories: view.groups.flatMap((g) =>
        g.categories.map((c) => ({
          name: c.name,
          score: c.score,
          passCount: c.counts.pass,
          warnCount: c.counts.warn,
          failCount: c.counts.fail,
        }))
      ),
      topOpportunities: report.topFails.slice(0, 10).map((f) => ({
        id: f.id,
        title: f.title,
        priority: f.priority,
        impact: f.impact,
        fix: f.fix,
      })),
    };

    return {
      content: [
        {
          type: 'text',
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
  console.error('Fatal MCP server error:', err);
  process.exit(1);
});
