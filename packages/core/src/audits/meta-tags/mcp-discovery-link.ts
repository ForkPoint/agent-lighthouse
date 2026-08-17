import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class McpDiscoveryLinkAudit extends Audit {
  static override meta: AuditMeta = {
    id: '4.17',
    category: 'meta-tags',
    title: 'MCP discovery link in head',
    failureTitle: 'MCP discovery link in head',
    description:
      "The MCP (Model Context Protocol) discovery link in <head> enables AI agents like Claude and ChatGPT to find and connect to your site's tool endpoints. This is how agents discover that your site offers programmatic actions (search, booking, data queries) beyond static content. Without it, agents cannot discover your MCP server.",
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'low',
    guidance: {
      impact:
        "Without an MCP discovery link, AI agents like Claude and ChatGPT cannot find your site's tool endpoints. This means agents cannot discover that your site offers programmatic actions (search, booking, data queries) beyond static content.",
      fix: 'If your site offers API endpoints or tools, create an MCP server configuration and add a <link rel="alternate"> tag in <head> pointing to it.',
      code: '<link rel="alternate" type="application/json" href="/mcp.json" title="MCP Server">',
      effort: 'complex',
      docsUrl: 'https://modelcontextprotocol.io/',
      tags: ['meta-tags', 'mcp', 'agentic-commerce', 'ai-discovery'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    /* v8 ignore start */
    const link = page?.headLinks?.find(
      (l) =>
        l.rel === 'alternate' &&
        l.type === 'application/json' &&
        (l.title ?? '').toLowerCase().includes('mcp'),
    );
    /* v8 ignore stop */

    if (link) {
      return this.pass(
        `MCP discovery link found: "${link.href}".`,
        '<link rel="alternate" type="application/json" title="...MCP...">',
        `href="${link.href}" title="${link.title}"`,
        page.url,
      );
    }

    return this.fail(
      'No MCP discovery link found in <head>.',
      '<link rel="alternate" type="application/json" title="...MCP...">',
      'Not found',
      {
        priority: 'low',
        description:
          "The MCP (Model Context Protocol) discovery link in <head> enables AI agents like Claude and ChatGPT to find and connect to your site's tool endpoints. This is how agents discover that your site offers programmatic actions (search, booking, data queries) beyond static content. Without it, agents cannot discover your MCP server.",
        code: '<link rel="alternate" type="application/json" href="/mcp.json" title="MCP Server">',
      },
      page?.url,
    );
  }
}
