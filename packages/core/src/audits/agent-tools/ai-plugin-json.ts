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

export class AiPluginJsonAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.11',
    category: 'agent-tools',
    title: 'ai-plugin.json exists',
    failureTitle: 'ai-plugin.json exists',
    description:
      'ai-plugin.json is the ChatGPT plugin manifest format. Even if you do not build a ChatGPT plugin, having this file helps AI agents understand your site as a tool with human-readable and model-readable names, logos, and API references.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'ai-plugin.json is the standard manifest used by ChatGPT and other AI platforms to register your site as a tool. Without it, your site cannot be installed as a plugin, and agents lose the human-readable and model-readable names needed for reliable interactions.',
      fix: 'Create a /.well-known/ai-plugin.json with at minimum schema_version, name_for_human, name_for_model, description_for_human, description_for_model, auth, and an api reference pointing to your OpenAPI spec.',
      code: `// /.well-known/ai-plugin.json
{
  "schema_version": "v1",
  "name_for_human": "Your Site Name",
  "name_for_model": "your_site",
  "description_for_human": "What your site does for users.",
  "description_for_model": "Use this plugin to search content and submit inquiries.",
  "auth": { "type": "none" },
  "api": {
    "type": "openapi",
    "url": "https://yoursite.com/openapi.json"
  },
  "logo_url": "https://yoursite.com/logo.png",
  "contact_email": "hello@yoursite.com"
}`,
      effort: 'easy',
      docsUrl: 'https://platform.openai.com/docs/plugins/getting-started/plugin-manifest',
      tags: ['ai-plugin', 'chatgpt', 'discovery', 'agent-protocol'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/.well-known/ai-plugin.json'];
    if (!result || result.status !== 200 || !result.body) {
      return this.fail(
        '/.well-known/ai-plugin.json not found or not accessible.',
        '/.well-known/ai-plugin.json returns 200 with valid JSON containing schema_version, name_for_human, name_for_model',
        result ? `HTTP ${result.status}` : 'Not fetched',
        {
          priority: 'medium',
          description: AiPluginJsonAudit.meta.description,
          code: `// /.well-known/ai-plugin.json\n{\n  "schema_version": "v1",\n  "name_for_human": "Your Site Name",\n  "name_for_model": "your_site",\n  "description_for_human": "What your site does for users.",\n  "description_for_model": "Use this plugin to search content, submit inquiries, and get product details from Your Site.",\n  "auth": { "type": "none" },\n  "api": {\n    "type": "openapi",\n    "url": "https://yoursite.com/openapi.json"\n  },\n  "logo_url": "https://yoursite.com/logo.png",\n  "contact_email": "hello@yoursite.com"\n}`,
        },
      );
    }

    const parsed = tryParseJson(result.body);
    if (!isObject(parsed)) {
      return this.fail(
        'ai-plugin.json is not valid JSON.',
        '/.well-known/ai-plugin.json returns 200 with valid JSON containing schema_version, name_for_human, name_for_model',
        'Invalid JSON',
        {
          priority: 'medium',
          description: AiPluginJsonAudit.meta.description,
          code: `// /.well-known/ai-plugin.json\n{\n  "schema_version": "v1",\n  "name_for_human": "Your Site Name",\n  "name_for_model": "your_site",\n  "description_for_human": "What your site does for users.",\n  "description_for_model": "Use this plugin to search content, submit inquiries, and get product details from Your Site.",\n  "auth": { "type": "none" },\n  "api": {\n    "type": "openapi",\n    "url": "https://yoursite.com/openapi.json"\n  },\n  "logo_url": "https://yoursite.com/logo.png",\n  "contact_email": "hello@yoursite.com"\n}`,
        },
      );
    }

    const requiredFields = ['schema_version', 'name_for_human', 'name_for_model'];
    const missing = requiredFields.filter((f) => typeof parsed[f] !== 'string' || !parsed[f]);

    if (missing.length === 0) {
      return this.pass(
        'ai-plugin.json found with all required fields.',
        '/.well-known/ai-plugin.json returns 200 with valid JSON containing schema_version, name_for_human, name_for_model',
        // requiredFields guarantees these three are non-empty strings here.
        `schema_version=${parsed['schema_version'] as string}, name_for_human=${parsed['name_for_human'] as string}, name_for_model=${parsed['name_for_model'] as string}`,
      );
    }

    const recommendation = {
      priority: 'medium' as const,
      description: AiPluginJsonAudit.meta.description,
      code: `// /.well-known/ai-plugin.json\n{\n  "schema_version": "v1",\n  "name_for_human": "Your Site Name",\n  "name_for_model": "your_site",\n  "description_for_human": "What your site does for users.",\n  "description_for_model": "Use this plugin to search content, submit inquiries, and get product details from Your Site.",\n  "auth": { "type": "none" },\n  "api": {\n    "type": "openapi",\n    "url": "https://yoursite.com/openapi.json"\n  },\n  "logo_url": "https://yoursite.com/logo.png",\n  "contact_email": "hello@yoursite.com"\n}`,
    };

    if (missing.length < requiredFields.length) {
      return this.warn(
        `ai-plugin.json is missing fields: ${missing.join(', ')}.`,
        '/.well-known/ai-plugin.json returns 200 with valid JSON containing schema_version, name_for_human, name_for_model',
        `Missing: ${missing.join(', ')}`,
        recommendation,
      );
    }

    return this.fail(
      `ai-plugin.json is missing all required fields: ${missing.join(', ')}.`,
      '/.well-known/ai-plugin.json returns 200 with valid JSON containing schema_version, name_for_human, name_for_model',
      `Missing: ${missing.join(', ')}`,
      recommendation,
    );
  }
}
