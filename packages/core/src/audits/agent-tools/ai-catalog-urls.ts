// TODO(redeem): this audit survives only if rewritten (approved 2026-08-21).
// Evidence dossier: docs/evidence/deletions/agent-tools/ai-catalog-urls.md
// Required rework:
//   Grade B: the checked property (liveness of manifest-listed endpoints) is a real field in a real
//   draft spec that a named Hugging Face client dereferences and that independent
//   crawlers/validators probe. This is the most mechanically defensible of the four — a broken url
//   genuinely breaks agent traversal. Keep it, but re-point it at `entries[].url` (skipping entries
//   that use embedded `data`), and treat non-200-but-reachable auth-gated MCP endpoints carefully
//   to avoid false failures.

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

export class AiCatalogUrlsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.9',
    category: 'agent-tools',
    title: 'AI Catalog service URLs valid',
    failureTitle: 'AI Catalog service URLs valid',
    description:
      'Broken service URLs in your AI catalog cause agents to fail when trying to use your services, creating a poor user experience. Verify all URLs are correct, deployed, and returning HTTP 200.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Broken service URLs in your AI catalog cause agents to fail mid-task. Users who asked the agent to interact with your site get errors instead of results, creating a poor experience and lost business.',
      fix: 'Verify every service URL in your ai-catalog.json is deployed, returns HTTP 200, and matches your current production endpoints. Remove or update any stale entries.',
      code: `"services": [
  {
    "name": "Search",
    "description": "Search site content",
    "url": "https://yoursite.com/api/search",
    "type": "rest"
  }
]`,
      effort: 'trivial',
      tags: ['ai-catalog', 'validation', 'agent-protocol'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const result = ctx.rootFiles['/.well-known/ai-catalog.json'];
    if (!result || result.status !== 200 || !result.body) {
      return this.fail(
        'ai-catalog.json not found.',
        'Each service URL returns HTTP 200',
        'No ai-catalog.json',
        {
          priority: 'medium',
          description: AiCatalogUrlsAudit.meta.description,
          code: `"services": [\n  {\n    "name": "Search",\n    "description": "Search site content",\n    "url": "https://yoursite.com/api/search",\n    "type": "rest"\n  }\n]`,
        },
      );
    }

    const parsed = tryParseJson(result.body);
    if (!isObject(parsed) || !Array.isArray(parsed['services'])) {
      return this.fail(
        'ai-catalog.json has no services array.',
        'Each service URL returns HTTP 200',
        'No services',
        {
          priority: 'medium',
          description: AiCatalogUrlsAudit.meta.description,
          code: `"services": [\n  {\n    "name": "Search",\n    "description": "Search site content",\n    "url": "https://yoursite.com/api/search",\n    "type": "rest"\n  }\n]`,
        },
      );
    }

    const services = parsed['services'] as unknown[];
    const urls: string[] = [];
    for (const svc of services) {
      if (isObject(svc) && typeof svc['url'] === 'string' && svc['url']) {
        urls.push(svc['url'] as string);
      }
    }

    if (urls.length === 0) {
      return this.warn(
        'No service URLs found in ai-catalog.json.',
        'Each service URL returns HTTP 200',
        '0 service URLs',
        {
          priority: 'medium',
          description: AiCatalogUrlsAudit.meta.description,
          code: `"services": [\n  {\n    "name": "Search",\n    "description": "Search site content",\n    "url": "https://yoursite.com/api/search",\n    "type": "rest"\n  }\n]`,
        },
      );
    }

    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const r = await ctx.fetch({ url });
          return { url, status: r.status };
        } catch {
          return { url, status: 0 };
        }
      }),
    );

    const reachable = results.filter((r) => r.status === 200).length;

    if (reachable === urls.length) {
      return this.pass(
        `All ${urls.length} service URL(s) returned HTTP 200.`,
        'Each service URL returns HTTP 200',
        `${reachable}/${urls.length} reachable`,
      );
    }

    const recommendation = {
      priority: 'medium' as const,
      description: AiCatalogUrlsAudit.meta.description,
      code: `"services": [\n  {\n    "name": "Search",\n    "description": "Search site content",\n    "url": "https://yoursite.com/api/search",\n    "type": "rest"\n  }\n]`,
    };

    if (reachable > 0) {
      const failed = results.filter((r) => r.status !== 200).map((r) => `${r.url} (${r.status})`);
      return this.warn(
        `${reachable}/${urls.length} service URLs reachable. Failed: ${failed.join(', ')}.`,
        'Each service URL returns HTTP 200',
        `${reachable}/${urls.length} reachable`,
        recommendation,
      );
    }

    return this.fail(
      `None of the ${urls.length} service URL(s) returned HTTP 200.`,
      'Each service URL returns HTTP 200',
      `0/${urls.length} reachable`,
      recommendation,
    );
  }
}
