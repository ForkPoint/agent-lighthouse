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

export class AiCatalogMetadataAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.8',
    category: 'agent-tools',
    title: 'AI Catalog complete metadata',
    failureTitle: 'AI Catalog complete metadata',
    description:
      'Complete metadata helps AI agents understand who owns the service, when it was last updated, and what it can do. Missing fields reduce agent confidence in your services and may cause them to skip your site in favor of better-documented alternatives.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Incomplete metadata reduces agent confidence in your services. Agents may skip your site when fields like owner, contact, or lastUpdated are missing because they cannot verify freshness or accountability.',
      fix: 'Add all required metadata fields to your ai-catalog.json: version, name, description, capabilities, owner, contact, and lastUpdated.',
      code: `{
  "version": "1.0",
  "name": "Your Site",
  "description": "Brief description of your site and services",
  "capabilities": ["search", "contact", "product-info"],
  "owner": "Your Company Name",
  "contact": "hello@yoursite.com",
  "lastUpdated": "2026-01-01",
  "services": []
}`,
      effort: 'trivial',
      tags: ['ai-catalog', 'metadata', 'agent-protocol'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/.well-known/ai-catalog.json'];
    if (!result || result.status !== 200 || !result.body) {
      return this.fail(
        'ai-catalog.json not found.',
        'Has version, name, description, capabilities, owner, contact, lastUpdated',
        'No ai-catalog.json',
        {
          priority: 'medium',
          description: AiCatalogMetadataAudit.meta.description,
          code: `{\n  "version": "1.0",\n  "name": "Your Site",\n  "description": "Brief description of your site and services",\n  "capabilities": ["search", "contact", "product-info"],\n  "owner": "Your Company Name",\n  "contact": "hello@yoursite.com",\n  "lastUpdated": "2026-01-01",\n  "services": []\n}`,
        },
      );
    }

    const parsed = tryParseJson(result.body);
    if (!isObject(parsed)) {
      return this.fail(
        'ai-catalog.json is not valid JSON.',
        'Has version, name, description, capabilities, owner, contact, lastUpdated',
        'Invalid JSON',
        {
          priority: 'medium',
          description: AiCatalogMetadataAudit.meta.description,
          code: `{\n  "version": "1.0",\n  "name": "Your Site",\n  "description": "Brief description of your site and services",\n  "capabilities": ["search", "contact", "product-info"],\n  "owner": "Your Company Name",\n  "contact": "hello@yoursite.com",\n  "lastUpdated": "2026-01-01",\n  "services": []\n}`,
        },
      );
    }

    const requiredFields = [
      'version',
      'name',
      'description',
      'capabilities',
      'owner',
      'contact',
      'lastUpdated',
    ];
    const present = requiredFields.filter(
      (f) => parsed[f] !== undefined && parsed[f] !== null && parsed[f] !== '',
    );
    const missing = requiredFields.filter((f) => !present.includes(f));

    if (missing.length === 0) {
      return this.pass(
        'AI catalog has all required metadata fields.',
        'Has version, name, description, capabilities, owner, contact, lastUpdated',
        `All ${requiredFields.length} fields present`,
      );
    }

    const recommendation = {
      priority: 'medium' as const,
      description: AiCatalogMetadataAudit.meta.description,
      code: `{\n  "version": "1.0",\n  "name": "Your Site",\n  "description": "Brief description of your site and services",\n  "capabilities": ["search", "contact", "product-info"],\n  "owner": "Your Company Name",\n  "contact": "hello@yoursite.com",\n  "lastUpdated": "2026-01-01",\n  "services": []\n}`,
    };

    if (present.length >= requiredFields.length / 2) {
      return this.warn(
        `AI catalog is missing metadata fields: ${missing.join(', ')}.`,
        'Has version, name, description, capabilities, owner, contact, lastUpdated',
        `${present.length}/${requiredFields.length} fields; missing: ${missing.join(', ')}`,
        recommendation,
      );
    }

    return this.fail(
      `AI catalog is missing most metadata fields: ${missing.join(', ')}.`,
      'Has version, name, description, capabilities, owner, contact, lastUpdated',
      `${present.length}/${requiredFields.length} fields present`,
      recommendation,
    );
  }
}
