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

export class McpEndpointAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.13',
    category: 'agent-tools',
    title: 'MCP endpoint functional',
    failureTitle: 'MCP endpoint functional',
    description:
      'Your MCP server must respond to JSON-RPC 2.0 initialize requests for AI assistants to connect. If the endpoint is down or misconfigured, agents cannot use your MCP tools. Verify the server is running and accepts POST requests with Content-Type: application/json.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'If your MCP endpoint does not respond to JSON-RPC 2.0 initialize requests, AI assistants cannot connect to your server at all. Users who try to add your site as a tool will see connection failures, and agents will permanently skip your server.',
      fix: 'Ensure your MCP server is running, accepts POST requests with Content-Type: application/json, and correctly handles the JSON-RPC 2.0 "initialize" method by returning a valid response with protocolVersion, serverInfo, and capabilities.',
      code: `// Expected request:
POST /mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "test", "version": "1.0.0" }
  }
}

// Expected response:
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": { "name": "your-server", "version": "1.0.0" },
    "capabilities": { "tools": {} }
  }
}`,
      effort: 'complex',
      docsUrl: 'https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle',
      tags: ['mcp', 'endpoint', 'json-rpc', 'agent-protocol'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const result = ctx.rootFiles['/.well-known/mcp/servers.json'];
    if (!result || result.status !== 200 || !result.body) {
      return this.fail(
        'No MCP servers.json found.',
        'MCP server URL responds to JSON-RPC initialize request',
        'No servers.json',
        {
          priority: 'high',
          description: McpEndpointAudit.meta.description,
          code: `// Expected request:\nPOST /mcp\nContent-Type: application/json\n\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "initialize",\n  "params": {\n    "protocolVersion": "2024-11-05",\n    "capabilities": {},\n    "clientInfo": { "name": "test", "version": "1.0.0" }\n  }\n}\n\n// Expected response:\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "result": {\n    "protocolVersion": "2024-11-05",\n    "serverInfo": { "name": "your-server", "version": "1.0.0" },\n    "capabilities": { "tools": {} }\n  }\n}`,
        },
      );
    }

    const parsed = tryParseJson(result.body);
    if (!isObject(parsed) || !Array.isArray(parsed['servers'])) {
      return this.fail(
        'servers.json has no servers array.',
        'MCP server URL responds to JSON-RPC initialize request',
        'No servers array',
        {
          priority: 'high',
          description: McpEndpointAudit.meta.description,
          code: `// Expected request:\nPOST /mcp\nContent-Type: application/json\n\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "initialize",\n  "params": {\n    "protocolVersion": "2024-11-05",\n    "capabilities": {},\n    "clientInfo": { "name": "test", "version": "1.0.0" }\n  }\n}\n\n// Expected response:\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "result": {\n    "protocolVersion": "2024-11-05",\n    "serverInfo": { "name": "your-server", "version": "1.0.0" },\n    "capabilities": { "tools": {} }\n  }\n}`,
        },
      );
    }

    const servers = parsed['servers'] as unknown[];
    const serverUrl = servers.find((s) => isObject(s) && typeof s['url'] === 'string' && s['url']);
    if (!serverUrl || !isObject(serverUrl)) {
      return this.fail(
        'No server URL found in servers.json.',
        'MCP server URL responds to JSON-RPC initialize request',
        'No server URL',
        {
          priority: 'high',
          description: McpEndpointAudit.meta.description,
          code: `// Expected request:\nPOST /mcp\nContent-Type: application/json\n\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "initialize",\n  "params": {\n    "protocolVersion": "2024-11-05",\n    "capabilities": {},\n    "clientInfo": { "name": "test", "version": "1.0.0" }\n  }\n}\n\n// Expected response:\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "result": {\n    "protocolVersion": "2024-11-05",\n    "serverInfo": { "name": "your-server", "version": "1.0.0" },\n    "capabilities": { "tools": {} }\n  }\n}`,
        },
      );
    }

    const url = (serverUrl as Record<string, unknown>)['url'] as string;

    try {
      const jsonRpcBody = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'ucp-scanner', version: '1.0.0' },
        },
      });

      const response = await ctx.fetch({
        url,
        method: 'POST',
        body: jsonRpcBody,
        contentType: 'application/json',
      });

      if (response.status === 200) {
        const respBody = tryParseJson(response.body);
        if (
          isObject(respBody) &&
          respBody['jsonrpc'] === '2.0' &&
          !('error' in respBody) &&
          isObject(respBody['result']) &&
          typeof (respBody['result'] as Record<string, unknown>)['protocolVersion'] === 'string'
        ) {
          return this.pass(
            `MCP endpoint at ${url} responded with valid JSON-RPC initialize result.`,
            'MCP server URL responds to JSON-RPC initialize request',
            `${url} -> HTTP 200, valid JSON-RPC response`,
          );
        }
        return this.warn(
          `MCP endpoint at ${url} returned HTTP 200 but response is not valid JSON-RPC.`,
          'MCP server URL responds to JSON-RPC initialize request',
          `${url} -> HTTP 200, non-JSON-RPC response`,
          {
            priority: 'high',
            description: McpEndpointAudit.meta.description,
            code: `// Expected request:\nPOST /mcp\nContent-Type: application/json\n\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "initialize",\n  "params": {\n    "protocolVersion": "2024-11-05",\n    "capabilities": {},\n    "clientInfo": { "name": "test", "version": "1.0.0" }\n  }\n}\n\n// Expected response:\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "result": {\n    "protocolVersion": "2024-11-05",\n    "serverInfo": { "name": "your-server", "version": "1.0.0" },\n    "capabilities": { "tools": {} }\n  }\n}`,
          },
        );
      }

      return this.fail(
        `MCP endpoint at ${url} returned HTTP ${response.status}.`,
        'MCP server URL responds to JSON-RPC initialize request',
        `${url} -> HTTP ${response.status}`,
        {
          priority: 'high',
          description: McpEndpointAudit.meta.description,
          code: `// Expected request:\nPOST /mcp\nContent-Type: application/json\n\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "initialize",\n  "params": {\n    "protocolVersion": "2024-11-05",\n    "capabilities": {},\n    "clientInfo": { "name": "test", "version": "1.0.0" }\n  }\n}\n\n// Expected response:\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "result": {\n    "protocolVersion": "2024-11-05",\n    "serverInfo": { "name": "your-server", "version": "1.0.0" },\n    "capabilities": { "tools": {} }\n  }\n}`,
        },
      );
    } catch {
      return this.fail(
        `MCP endpoint at ${url} is not reachable.`,
        'MCP server URL responds to JSON-RPC initialize request',
        `${url} -> unreachable`,
        {
          priority: 'high',
          description: McpEndpointAudit.meta.description,
          code: `// Expected request:\nPOST /mcp\nContent-Type: application/json\n\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "initialize",\n  "params": {\n    "protocolVersion": "2024-11-05",\n    "capabilities": {},\n    "clientInfo": { "name": "test", "version": "1.0.0" }\n  }\n}\n\n// Expected response:\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "result": {\n    "protocolVersion": "2024-11-05",\n    "serverInfo": { "name": "your-server", "version": "1.0.0" },\n    "capabilities": { "tools": {} }\n  }\n}`,
        },
      );
    }
  }
}
