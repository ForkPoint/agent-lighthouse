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

export class AgentsJsonAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.10',
    category: 'agent-tools',
    title: 'agents.json exists',
    failureTitle: 'agents.json exists',
    description:
      'agents.json declares what AI agents can do on your site, including authentication methods, rate limits, and supported protocols. It helps agents self-configure before interacting with your services.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Without agents.json, AI agents have no way to discover your site's capabilities, authentication requirements, or rate limits. They must probe endpoints blindly, leading to errors and skipped interactions.",
      fix: 'Create a /.well-known/agents.json file that declares your site name, supported protocols, authentication method, rate limits, and available endpoints.',
      code: `// /.well-known/agents.json
{
  "name": "Your Site",
  "description": "Your site description for AI agents",
  "protocols": ["rest", "mcp"],
  "authentication": { "type": "none" },
  "rate_limits": { "requests_per_minute": 60 },
  "endpoints": [
    {
      "url": "/api/search",
      "method": "GET",
      "description": "Search content"
    }
  ]
}`,
      effort: 'easy',
      docsUrl: 'https://agentsjson.org/',
      tags: ['agents-json', 'discovery', 'agent-protocol'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/.well-known/agents.json'];
    if (!result || result.status !== 200 || !result.body) {
      return this.fail(
        '/.well-known/agents.json not found or not accessible.',
        '/.well-known/agents.json returns 200 with valid JSON',
        result ? `HTTP ${result.status}` : 'Not fetched',
        {
          priority: 'medium',
          description: AgentsJsonAudit.meta.description,
          code: `// /.well-known/agents.json\n{\n  "name": "Your Site",\n  "description": "Your site description for AI agents",\n  "protocols": ["rest", "mcp"],\n  "authentication": {\n    "type": "none"\n  },\n  "rate_limits": {\n    "requests_per_minute": 60\n  },\n  "endpoints": [\n    {\n      "url": "/api/search",\n      "method": "GET",\n      "description": "Search content"\n    }\n  ]\n}`,
        },
      );
    }

    const parsed = tryParseJson(result.body);
    if (!isObject(parsed) && !Array.isArray(parsed)) {
      return this.fail(
        'agents.json is not valid JSON.',
        '/.well-known/agents.json returns 200 with valid JSON',
        'Invalid JSON',
        {
          priority: 'medium',
          description: AgentsJsonAudit.meta.description,
          code: `// /.well-known/agents.json\n{\n  "name": "Your Site",\n  "description": "Your site description for AI agents",\n  "protocols": ["rest", "mcp"],\n  "authentication": {\n    "type": "none"\n  },\n  "rate_limits": {\n    "requests_per_minute": 60\n  },\n  "endpoints": [\n    {\n      "url": "/api/search",\n      "method": "GET",\n      "description": "Search content"\n    }\n  ]\n}`,
        },
      );
    }

    return this.pass(
      'agents.json found with valid JSON content.',
      '/.well-known/agents.json returns 200 with valid JSON',
      'Valid JSON at /.well-known/agents.json',
    );
  }
}
