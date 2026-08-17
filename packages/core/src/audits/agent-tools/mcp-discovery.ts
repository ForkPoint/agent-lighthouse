import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export class McpDiscoveryAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.12',
    category: 'agent-tools',
    title: 'MCP server discovery file',
    failureTitle: 'MCP server discovery file',
    description:
      'MCP (Model Context Protocol) lets AI assistants like Claude and ChatGPT directly integrate your site as a tool. Publishing an MCP discovery file means users can add your site as a tool in their AI assistant with a single URL, enabling rich interactions beyond simple browsing.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'MCP (Model Context Protocol) is how AI assistants like Claude and ChatGPT register your site as an interactive tool. Without a discovery file, users cannot add your site as an MCP server in their AI assistant, missing out on rich tool-based interactions.',
      fix: 'Create a /.well-known/mcp/servers.json file listing your MCP server(s) with name, description, URL, transport type, and capabilities.',
      code: `// /.well-known/mcp/servers.json
{
  "servers": [
    {
      "name": "Your Site MCP",
      "description": "Search content and submit inquiries",
      "url": "https://yoursite.com/mcp",
      "transport": "streamable-http",
      "capabilities": {
        "tools": true,
        "resources": true
      }
    }
  ]
}`,
      effort: 'easy',
      docsUrl: 'https://modelcontextprotocol.io/specification/2025-03-26/basic/transports',
      tags: ['mcp', 'discovery', 'agent-protocol'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // 1. Standard MCP Discovery (/.well-known/mcp/servers.json)
    const result = ctx.rootFiles['/.well-known/mcp/servers.json'];
    if (result && result.status === 200 && result.body) {
      const parsed = tryParseJson(result.body);
      if (!isObject(parsed)) {
        return this.fail(
          'mcp/servers.json is not valid JSON.',
          '/.well-known/mcp/servers.json returns 200 with valid JSON containing servers array',
          'Invalid JSON',
          {
            priority: 'medium',
            description: McpDiscoveryAudit.meta.description,
            code: McpDiscoveryAudit.meta.guidance?.code,
          },
        );
      }

      if (!Array.isArray(parsed['servers'])) {
        return this.fail(
          'mcp/servers.json does not contain a servers array.',
          '/.well-known/mcp/servers.json returns 200 with valid JSON containing servers array',
          'No servers array',
          {
            priority: 'medium',
            description: McpDiscoveryAudit.meta.description,
            code: McpDiscoveryAudit.meta.guidance?.code,
          },
        );
      }

      const count = (parsed['servers'] as unknown[]).length;
      return this.pass(
        `MCP servers.json found with ${count} server(s).`,
        '/.well-known/mcp/servers.json returns 200 with valid JSON containing servers array',
        `Valid JSON with ${count} server(s)`,
      );
    }

    // 2. Universal Commerce Protocol (UCP / MCP) Discovery (/.well-known/ucp)
    const ucpResult = ctx.rootFiles['/.well-known/ucp'];
    if (ucpResult && ucpResult.status === 200 && ucpResult.body) {
      const ucpParsed = tryParseJson(ucpResult.body);
      if (isObject(ucpParsed)) {
        const ucpObj = (ucpParsed['ucp'] ?? ucpParsed) as Record<string, unknown>;
        const services = (ucpParsed['services'] || ucpObj['services']) as Record<string, unknown> | undefined;
        const capabilities = (ucpParsed['capabilities'] || ucpObj['capabilities']) as Record<string, unknown> | undefined;
        const svcCount = services ? Object.keys(services).length : 0;
        const capCount = capabilities ? Object.keys(capabilities).length : 0;
        return this.pass(
          `Universal Commerce Protocol (UCP/MCP) discovery profile found with ${svcCount} services and ${capCount} capabilities.`,
          '/.well-known/mcp/servers.json or /.well-known/ucp returns 200 with valid agent protocol JSON',
          `UCP/MCP Profile (v${ucpObj['version'] ?? 'stable'}, ${capCount} capabilities)`,
        );
      }
    }

    return this.fail(
      '/.well-known/mcp/servers.json not found or not accessible.',
      '/.well-known/mcp/servers.json returns 200 with valid JSON containing servers array',
      result ? `HTTP ${result.status}` : 'Not fetched',
      {
        priority: 'medium',
        description: McpDiscoveryAudit.meta.description,
        code: McpDiscoveryAudit.meta.guidance?.code,
      },
    );
  }
}
