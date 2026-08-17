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

export class McpCapabilitiesAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.14',
    category: 'agent-tools',
    title: 'MCP server advertises capabilities',
    failureTitle: 'MCP server advertises capabilities',
    description:
      'Without declared capabilities, AI agents do not know whether your MCP server offers tools, resources, or prompts. Declaring capabilities upfront lets agents decide if your server is relevant before connecting, saving time and reducing unnecessary requests.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without declared capabilities, AI agents cannot determine whether your MCP server offers tools, resources, or prompts. They must attempt connections and probe blindly, wasting time and often skipping your server entirely.',
      fix: 'Add a capabilities object to each server entry in your servers.json, declaring which capability types (tools, resources, prompts) your server supports.',
      code: `{
  "servers": [
    {
      "name": "Your Site MCP",
      "url": "https://yoursite.com/mcp",
      "capabilities": {
        "tools": true,
        "resources": true,
        "prompts": false
      }
    }
  ]
}`,
      effort: 'trivial',
      docsUrl:
        'https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle#capabilities',
      tags: ['mcp', 'capabilities', 'agent-protocol'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/.well-known/mcp/servers.json'];
    if (!result || result.status !== 200 || !result.body) {
      return this.fail(
        'No MCP servers.json found.',
        'servers.json or MCP response declares tools, resources, or prompts',
        'No servers.json',
        {
          priority: 'medium',
          description: McpCapabilitiesAudit.meta.description,
          code: `{\n  "servers": [\n    {\n      "name": "Your Site MCP",\n      "url": "https://yoursite.com/mcp",\n      "capabilities": {\n        "tools": true,\n        "resources": true,\n        "prompts": false\n      }\n    }\n  ]\n}`,
        },
      );
    }

    const parsed = tryParseJson(result.body);
    if (!isObject(parsed) || !Array.isArray(parsed['servers'])) {
      return this.fail(
        'servers.json has no servers array.',
        'servers.json or MCP response declares tools, resources, or prompts',
        'No servers array',
        {
          priority: 'medium',
          description: McpCapabilitiesAudit.meta.description,
          code: `{\n  "servers": [\n    {\n      "name": "Your Site MCP",\n      "url": "https://yoursite.com/mcp",\n      "capabilities": {\n        "tools": true,\n        "resources": true,\n        "prompts": false\n      }\n    }\n  ]\n}`,
        },
      );
    }

    const servers = parsed['servers'] as unknown[];
    const capabilityKeys = ['tools', 'resources', 'prompts'];
    const foundCapabilities: string[] = [];

    for (const server of servers) {
      if (!isObject(server)) continue;
      for (const key of capabilityKeys) {
        if (server[key] !== undefined && server[key] !== false) {
          foundCapabilities.push(key);
        }
      }
      // Also check nested capabilities object
      const caps = server['capabilities'];
      if (isObject(caps)) {
        for (const key of capabilityKeys) {
          if (caps[key] !== undefined && caps[key] !== false && !foundCapabilities.includes(key)) {
            foundCapabilities.push(key);
          }
        }
      }
    }

    const unique = [...new Set(foundCapabilities)];

    if (unique.length > 0) {
      return this.pass(
        `MCP server(s) advertise capabilities: ${unique.join(', ')}.`,
        'servers.json or MCP response declares tools, resources, or prompts',
        unique.join(', '),
      );
    }

    return this.fail(
      'No MCP capabilities (tools, resources, prompts) declared in servers.json.',
      'servers.json or MCP response declares tools, resources, or prompts',
      'No capabilities declared',
      {
        priority: 'medium',
        description: McpCapabilitiesAudit.meta.description,
        code: `{\n  "servers": [\n    {\n      "name": "Your Site MCP",\n      "url": "https://yoursite.com/mcp",\n      "capabilities": {\n        "tools": true,\n        "resources": true,\n        "prompts": false\n      }\n    }\n  ]\n}`,
      },
    );
  }
}
