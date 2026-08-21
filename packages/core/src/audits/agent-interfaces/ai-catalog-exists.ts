// TODO(redeem): this audit survives only if rewritten (approved 2026-08-21).
// Evidence dossier: docs/evidence/deletions/agent-tools/ai-catalog-exists.md
// Required rework:
//   Grade A evidence: a named vendor tool (Hugging Face hf-discover) documents and implements
//   fetching exactly https://{domain}/.well-known/ai-catalog.json, the path is normative in the ARD
//   draft spec co-authored by Google/Microsoft/Hugging Face, and there is verifiable production
//   adoption (Neon, Weaviate, Shopware core, specification.website). Keep the audit, but it MUST be
//   rewritten: pass condition should be specVersion + host + entries[] per ARD §4.1, not a
//   `services` array; and guidance/code samples must be replaced with the real schema, otherwise
//   the audit penalizes spec-conformant sites.

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

export class AiCatalogExistsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/ai-catalog-exists',
    category: 'agent-interfaces',
    title: 'AI Catalog exists',
    failureTitle: 'AI Catalog exists',
    description:
      'The AI catalog is the central discovery file that tells AI agents what capabilities your site offers. Think of it as a table of contents for your APIs, tools, and services. Without it, agents must probe multiple endpoints to understand what your site can do.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agent-interfaces/ai-catalog-exists.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without an AI catalog, agents must probe multiple endpoints to discover your services. This wastes time, increases error rates, and often results in agents skipping your site entirely in favor of competitors with clear service listings.',
      fix: "Create a /.well-known/ai-catalog.json file listing your site name, description, capabilities, and a services array with each service's name, description, URL, and type.",
      code: `// /.well-known/ai-catalog.json
{
  "version": "1.0",
  "name": "Your Site",
  "description": "What your site does",
  "capabilities": ["search", "contact", "product-info"],
  "services": [
    {
      "name": "Search",
      "description": "Search our content",
      "url": "https://yoursite.com/api/search",
      "type": "rest"
    }
  ]
}`,
      effort: 'easy',
      tags: ['ai-catalog', 'discovery', 'agent-protocol'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/.well-known/ai-catalog.json'];
    if (!result || result.status !== 200 || !result.body) {
      return this.fail(
        '/.well-known/ai-catalog.json not found or not accessible.',
        '/.well-known/ai-catalog.json returns 200 with valid JSON containing services array',
        result ? `HTTP ${result.status}` : 'Not fetched',
        {
          priority: 'medium',
          description: AiCatalogExistsAudit.meta.description,
          code: `// /.well-known/ai-catalog.json\n{\n  "version": "1.0",\n  "name": "Your Site",\n  "description": "What your site does",\n  "capabilities": ["search", "contact", "product-info"],\n  "owner": "Your Company",\n  "contact": "hello@yoursite.com",\n  "lastUpdated": "2026-01-01",\n  "services": [\n    {\n      "name": "Search",\n      "description": "Search our content",\n      "url": "https://yoursite.com/api/search",\n      "type": "rest"\n    },\n    {\n      "name": "Contact",\n      "description": "Submit inquiries",\n      "url": "https://yoursite.com/api/contact",\n      "type": "rest"\n    }\n  ]\n}`,
        },
      );
    }

    const parsed = tryParseJson(result.body);
    if (!isObject(parsed)) {
      return this.fail(
        'ai-catalog.json is not valid JSON.',
        '/.well-known/ai-catalog.json returns 200 with valid JSON containing services array',
        'Invalid JSON',
        {
          priority: 'medium',
          description: AiCatalogExistsAudit.meta.description,
          code: `// /.well-known/ai-catalog.json\n{\n  "version": "1.0",\n  "name": "Your Site",\n  "description": "What your site does",\n  "capabilities": ["search", "contact", "product-info"],\n  "owner": "Your Company",\n  "contact": "hello@yoursite.com",\n  "lastUpdated": "2026-01-01",\n  "services": [\n    {\n      "name": "Search",\n      "description": "Search our content",\n      "url": "https://yoursite.com/api/search",\n      "type": "rest"\n    },\n    {\n      "name": "Contact",\n      "description": "Submit inquiries",\n      "url": "https://yoursite.com/api/contact",\n      "type": "rest"\n    }\n  ]\n}`,
        },
      );
    }

    if (!Array.isArray(parsed['services'])) {
      return this.fail(
        'ai-catalog.json does not contain a services array.',
        '/.well-known/ai-catalog.json returns 200 with valid JSON containing services array',
        'No services array',
        {
          priority: 'medium',
          description: AiCatalogExistsAudit.meta.description,
          code: `// /.well-known/ai-catalog.json\n{\n  "version": "1.0",\n  "name": "Your Site",\n  "description": "What your site does",\n  "capabilities": ["search", "contact", "product-info"],\n  "owner": "Your Company",\n  "contact": "hello@yoursite.com",\n  "lastUpdated": "2026-01-01",\n  "services": [\n    {\n      "name": "Search",\n      "description": "Search our content",\n      "url": "https://yoursite.com/api/search",\n      "type": "rest"\n    },\n    {\n      "name": "Contact",\n      "description": "Submit inquiries",\n      "url": "https://yoursite.com/api/contact",\n      "type": "rest"\n    }\n  ]\n}`,
        },
      );
    }

    return this.pass(
      `AI catalog found with ${(parsed['services'] as unknown[]).length} service(s).`,
      '/.well-known/ai-catalog.json returns 200 with valid JSON containing services array',
      `Valid JSON with ${(parsed['services'] as unknown[]).length} service(s)`,
    );
  }
}
