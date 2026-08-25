import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
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
    id: 'agent-interfaces/mcp-discovery',
    category: 'agent-interfaces',
    title: 'MCP server discovery file',
    failureTitle: 'MCP discovery file is published but unreadable',
    description:
      'Reports whether the site publishes an MCP discovery document at `/.well-known/mcp/servers.json` or `/.well-known/ucp`, and whether what it publishes can be parsed. Neither path is registered or specified, and no shipping MCP client is documented as fetching either, so this is reported rather than scored: a site with a working MCP server discovered by any other route is not less agent-ready for having no such file.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/agent-interfaces/mcp-discovery.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'No shipping MCP client is documented as fetching `/.well-known/mcp/servers.json` or `/.well-known/ucp`, so publishing one is not known to make a site reachable to any agent. What does matter is that a document published at a well-known path can be read: a 200 carrying HTML or unparseable JSON tells a conforming client the resource exists and then gives it nothing to parse.',
      fix: 'If you publish an MCP discovery document, serve it as parseable JSON with a populated `servers` array. To make an MCP server actually reachable, publish and operate the endpoint itself — that is what `agent-interfaces/mcp-modern-era-reachability` and `mcp-oauth-discovery-chain` check.',
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
    const expected =
      'If an MCP discovery document is published, it parses and lists at least one server';

    // 1. /.well-known/mcp/servers.json
    const result = ctx.rootFiles['/.well-known/mcp/servers.json'];
    if (result && result.status === 200 && result.body.trim()) {
      const parsed = tryParseJson(result.body);
      if (!isObject(parsed)) {
        return this.fail(
          'A document is published at /.well-known/mcp/servers.json, but it is not valid JSON.',
          expected,
          'Published, but the body does not parse as a JSON object',
          { priority: 'medium', code: McpDiscoveryAudit.meta.guidance?.code },
        );
      }

      const servers = parsed['servers'];
      if (!Array.isArray(servers)) {
        return this.fail(
          'mcp/servers.json parses but carries no servers array.',
          expected,
          'No servers array',
          { priority: 'medium', code: McpDiscoveryAudit.meta.guidance?.code },
        );
      }

      // An empty array is the shape of a discovery file without the discovery.
      if (servers.length === 0) {
        return this.fail(
          'mcp/servers.json lists no servers, so it advertises nothing.',
          expected,
          'servers array is empty',
          { priority: 'medium', code: McpDiscoveryAudit.meta.guidance?.code },
        );
      }

      return this.pass(
        `MCP servers.json found with ${servers.length} server(s).`,
        expected,
        `Valid JSON with ${servers.length} server(s)`,
      );
    }

    // 2. Universal Commerce Protocol (/.well-known/ucp)
    const ucpResult = ctx.rootFiles['/.well-known/ucp'];
    if (ucpResult && ucpResult.status === 200 && ucpResult.body.trim()) {
      const ucpParsed = tryParseJson(ucpResult.body);
      if (isObject(ucpParsed)) {
        const ucpObj = (ucpParsed['ucp'] ?? ucpParsed) as Record<string, unknown>;
        const services = (ucpParsed['services'] ?? ucpObj['services']) as
          | Record<string, unknown>
          | undefined;
        const capabilities = (ucpParsed['capabilities'] ?? ucpObj['capabilities']) as
          | Record<string, unknown>
          | undefined;
        const svcCount = services ? Object.keys(services).length : 0;
        const capCount = capabilities ? Object.keys(capabilities).length : 0;

        // `{}` parses. It is not a discovery profile, and it used to report a
        // confident pass reading "0 services and 0 capabilities".
        if (svcCount === 0 && capCount === 0) {
          return this.fail(
            'A document is published at /.well-known/ucp, but it declares no services and no capabilities.',
            expected,
            'UCP document carries neither services nor capabilities',
            { priority: 'medium', code: McpDiscoveryAudit.meta.guidance?.code },
          );
        }

        return this.pass(
          `Universal Commerce Protocol discovery profile found with ${svcCount} service(s) and ${capCount} capabilit(ies).`,
          expected,
          `UCP profile (v${ucpObj['version'] ?? 'stable'}, ${capCount} capabilit(ies))`,
        );
      }

      return this.fail(
        'A document is published at /.well-known/ucp, but it is not valid JSON.',
        expected,
        'Published, but the body does not parse as a JSON object',
        { priority: 'medium', code: McpDiscoveryAudit.meta.guidance?.code },
      );
    }

    // Absence is not a defect. Neither path is registered or specified, and no
    // shipping MCP client is documented as fetching either, so a site that
    // publishes nothing here has withheld nothing an agent is known to want.
    return this.notApplicable(
      'This site publishes no MCP discovery document, which no documented MCP client fetches.',
      expected,
      result ? `/.well-known/mcp/servers.json returned HTTP ${result.status}` : 'No MCP discovery document published',
    );
  }
}
