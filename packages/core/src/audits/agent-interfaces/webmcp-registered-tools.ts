// TODO(redeem): this audit survives only if rewritten (pending triage approval). Target tier: experimental.
// Evidence dossier: docs/evidence/audits/agent-interfaces/webmcp-registered-tools.md
// Required rework:
//   Evidence reshape: the .well-known manifest file is invented (grade D) — but runtime-registered
//   WebMCP tools are grade B: Google Lighthouse 13.3+ ships 'Registered WebMCP tools' audits in its
//   new Agentic Browsing category. Replace manifest-file audit with registered-tools detection,
//   experimental tier.

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

export class WebmcpManifestAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/webmcp-registered-tools',
    category: 'agent-interfaces',
    title: 'WebMCP discovery manifest',
    failureTitle: 'WebMCP discovery manifest',
    description:
      "WebMCP is a proposed W3C standard (Chrome 146+) that lets websites expose structured tools to AI agents. A /.well-known/webmcp manifest is an emerging convention (not yet in the formal spec) that enables agentic crawlers to discover your site's capabilities before visiting, similar to how robots.txt works for search engines.",
    scoreDisplayMode: 'informative',
    weight: weightForGrade('A', 'experimental'),
    evidenceGrade: 'A',
    // Tier deviates from the grade→tier rule on the map's instruction: the
    // dossier's grade A covers WebMCP itself, but the `.well-known` manifest
    // this audit currently looks for is invented, so it scores nothing until
    // the Plan 4 rewrite replaces it with runtime registered-tools detection.
    tier: 'experimental',
    dossier: 'docs/evidence/audits/agent-interfaces/webmcp-registered-tools.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'Without a WebMCP manifest, AI agents cannot pre-discover what actions your site supports. Agents must fall back to scraping or vision-based interaction, which is slower, less reliable, and may miss key capabilities like product search or checkout.',
      fix: "Create a /.well-known/webmcp manifest file describing your site's available tools, their parameters, and capabilities.",
      code: `// /.well-known/webmcp
{
  "name": "Your Store",
  "description": "E-commerce store with product search and checkout",
  "tools": [
    {
      "name": "searchProducts",
      "description": "Search the product catalog by keyword, category, or filters",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Search keywords" },
          "category": { "type": "string", "description": "Product category" }
        },
        "required": ["query"]
      }
    }
  ]
}`,
      effort: 'moderate',
      docsUrl: 'https://webmcp.link/',
      tags: ['webmcp', 'discovery', 'agent-protocol', 'chrome-146'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/.well-known/webmcp'];
    if (!result || result.status !== 200 || !result.body) {
      return this.fail(
        '/.well-known/webmcp manifest not found.',
        '/.well-known/webmcp returns 200 with valid JSON describing available tools',
        result ? `HTTP ${result.status}` : 'Not fetched',
        'high',
      );
    }

    const parsed = tryParseJson(result.body);
    if (!isObject(parsed)) {
      return this.fail(
        '/.well-known/webmcp is not valid JSON.',
        'Valid JSON object with tools array',
        'Invalid JSON',
        'high',
      );
    }

    if (!Array.isArray(parsed['tools'])) {
      return this.fail(
        '/.well-known/webmcp does not contain a tools array.',
        'JSON object with "tools" array',
        'No tools array found',
        'high',
      );
    }

    const rawTools = parsed['tools'] as unknown[];
    const tools = rawTools.filter(
      (t): t is Record<string, unknown> => isObject(t) && typeof t['name'] === 'string',
    );

    if (tools.length === 0) {
      return this.fail(
        rawTools.length === 0
          ? '/.well-known/webmcp has an empty tools array.'
          : `/.well-known/webmcp has ${rawTools.length} entries but none are valid tool objects with a name.`,
        'At least one tool with a name defined in the manifest',
        `${tools.length} valid tool(s) out of ${rawTools.length} entries`,
        'high',
      );
    }

    return this.pass(
      `WebMCP manifest found with ${tools.length} valid tool(s).`,
      '/.well-known/webmcp returns 200 with valid JSON containing tools array',
      `Valid JSON with ${tools.length} tool(s)`,
    );
  }
}
