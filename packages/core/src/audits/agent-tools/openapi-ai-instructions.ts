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

function getOpenApiSpec(ctx: {
  rootFiles: Record<string, { status: number; body: string }>;
}): Record<string, unknown> | undefined {
  const jsonResult = ctx.rootFiles['/openapi.json'];
  if (jsonResult && jsonResult.status === 200 && jsonResult.body) {
    const parsed = tryParseJson(jsonResult.body);
    if (isObject(parsed)) return parsed;
  }
  return undefined;
}

export class OpenApiAiInstructionsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.4',
    category: 'agent-tools',
    title: 'x-ai-instructions in OpenAPI',
    failureTitle: 'x-ai-instructions in OpenAPI',
    description:
      'The x-ai-instructions field lets you give natural-language guidance to AI agents about how to use your API. This is your chance to explain business logic, rate limits, authentication flow, and common use cases in plain English.',
    scoreDisplayMode: 'informative',
    weight: 0,
    defaultPriority: 'medium',
    deprecated: {
      notice: 'x-ai-instructions is not in the OpenAPI extensions registry and no consumer reads it.',
      link: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md#agent-toolsopenapi-ai-instructions',
    },
    guidance: {
      impact:
        "Without x-ai-instructions, AI agents must infer your API's business logic, usage patterns, and constraints from endpoint names alone. This leads to incorrect API usage, violated rate limits, and poor user experiences.",
      fix: 'Add an x-ai-instructions string to the info object of your OpenAPI spec. Describe common workflows, rate limits, authentication requirements, and any sequencing constraints in plain English.',
      code: `"info": {
  "title": "Your Site API",
  "version": "1.0.0",
  "x-ai-instructions": "This API lets you search content, submit contact forms, and retrieve product details. Always call searchContent before submitContact. Rate limit: 10 requests/minute. No authentication required for read endpoints."
}`,
      effort: 'trivial',
      tags: ['openapi', 'ai-instructions', 'api'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const spec = getOpenApiSpec(ctx);
    if (!spec) {
      return this.fail(
        'No parseable OpenAPI JSON spec found.',
        'info object has x-ai-instructions field',
        'No spec',
        {
          priority: 'medium',
          description: OpenApiAiInstructionsAudit.meta.description,
          code: `"info": {\n  "title": "Your Site API",\n  "version": "1.0.0",\n  "x-ai-instructions": "This API lets you search content, submit contact forms, and retrieve product details. Always call searchContent before submitContact. Rate limit: 10 requests/minute. No authentication required for read endpoints."\n}`,
        },
      );
    }

    const info = spec['info'];
    if (
      isObject(info) &&
      typeof info['x-ai-instructions'] === 'string' &&
      info['x-ai-instructions']
    ) {
      return this.pass(
        'OpenAPI info object contains x-ai-instructions.',
        'info object has x-ai-instructions field',
        'x-ai-instructions present',
      );
    }

    return this.fail(
      'OpenAPI info object does not contain x-ai-instructions.',
      'info object has x-ai-instructions field',
      'x-ai-instructions missing',
      {
        priority: 'medium',
        description: OpenApiAiInstructionsAudit.meta.description,
        code: `"info": {\n  "title": "Your Site API",\n  "version": "1.0.0",\n  "x-ai-instructions": "This API lets you search content, submit contact forms, and retrieve product details. Always call searchContent before submitContact. Rate limit: 10 requests/minute. No authentication required for read endpoints."\n}`,
      },
    );
  }
}
