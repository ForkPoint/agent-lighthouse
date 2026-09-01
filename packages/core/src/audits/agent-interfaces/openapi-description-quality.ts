import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import {
  NO_OPENAPI_SPEC,
  openApiOperations,
  readOpenApiSpec,
  type OpenApiSpec,
} from '../../gatherers/openapi';

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

const MIN_DESCRIPTION_LENGTH = 15;

function hasGoodDescription(val: unknown): boolean {
  return typeof val === 'string' && val.trim().length > MIN_DESCRIPTION_LENGTH;
}

interface CheckableItem {
  /** Human-readable label, e.g. "GET /search (operation)" or "POST /contact param 'email'". */
  label: string;
  described: boolean;
}

function getCheckableItems(spec: OpenApiSpec): CheckableItem[] {
  const items: CheckableItem[] = [];
  for (const { path, method, op } of openApiOperations(spec)) {
    const opLabel = `${method.toUpperCase()} ${path}`;

    items.push({
      label: `${opLabel} (operation)`,
      described: hasGoodDescription(op['description']),
    });

    const parameters = op['parameters'];
    if (Array.isArray(parameters)) {
      for (const param of parameters) {
        if (!isObject(param)) continue;
        const name = typeof param['name'] === 'string' ? param['name'] : '(unnamed)';
        items.push({
          label: `${opLabel} param '${name}'`,
          described: hasGoodDescription(param['description']),
        });
      }
    }
  }
  return items;
}

export class OpenApiDescriptionQualityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/openapi-description-quality',
    category: 'agent-interfaces',
    title: 'OpenAPI description quality for tool-calling',
    failureTitle: 'OpenAPI descriptions too thin for tool-calling',
    description:
      'When an AI agent converts your OpenAPI spec into callable tools, the description fields become the prompt the LLM uses to decide when and how to call each function. A one-word description like "search" tells the model nothing about what the endpoint does, what the parameter means, or what values are valid — so the agent guesses, calls the wrong tool, or fills parameters with hallucinated values. Every operation and every parameter needs a verbose description (more than 15 characters) that explains purpose, expected input, and behavior.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agent-interfaces/openapi-description-quality.md',
    requires: ['origin-reachable'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'LLM tool-calling treats your OpenAPI descriptions as the function-calling prompt. Missing or terse descriptions force the model to guess what each endpoint does and what each parameter accepts, producing wrong tool selection, malformed arguments, and failed API calls that erode user trust in agent-driven workflows on your site.',
      fix: 'Write a verbose description (>15 characters) for every operation and every parameter in your OpenAPI spec. Explain what the operation does, when an agent should use it, and what each parameter means including format and example values.',
      code: `"/search": {
  "get": {
    "operationId": "searchProducts",
    "description": "Search the product catalog by keyword. Returns matching products with name, price, and availability. Use this when the user asks to find or browse products.",
    "parameters": [{
      "name": "q",
      "in": "query",
      "description": "Full-text search query, e.g. 'red running shoes'. Matched against product name and description.",
      "schema": { "type": "string" }
    }],
    "responses": { "200": { "description": "List of matching products" } }
  }
}`,
      effort: 'moderate',
      docsUrl: 'https://swagger.io/specification/#operation-object',
      tags: ['openapi', 'descriptions', 'tool-calling', 'llm', 'api'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const spec = readOpenApiSpec(ctx);
    // Absent artifact, absent verdict — the shared precondition, deliberately
    // not a private sentence. Reading `NO_OPENAPI_SPEC` is what enrols this
    // audit in `tests/absent-artifact-contract.test.ts`, so the audit every
    // dossier cites as proof that a scored audit may decline is itself held to
    // it.
    if (!spec) {
      return this.notApplicable(
        NO_OPENAPI_SPEC.message,
        'OpenAPI spec with verbose descriptions on all operations and parameters',
        NO_OPENAPI_SPEC.found,
      );
    }

    const items = getCheckableItems(spec);
    if (items.length === 0) {
      return this.notApplicable(
        'OpenAPI spec has no operations or parameters to check.',
        'OpenAPI spec with verbose descriptions on all operations and parameters',
        '0 checkable items',
      );
    }

    const described = items.filter((i) => i.described).length;
    const ratio = described / items.length;
    const missing = items.filter((i) => !i.described).map((i) => i.label);
    const truncatedMissing = missing.slice(0, 10);
    const missingSummary =
      truncatedMissing.join('; ') +
      (missing.length > 10 ? `; ... and ${missing.length - 10} more` : '');

    const expected =
      'Every operation and parameter has a description longer than 15 characters';
    const found = `${described}/${items.length} described (${Math.round(ratio * 100)}%)`;

    const details = missing.length > 0 ? { missingDescriptions: truncatedMissing } : undefined;

    if (ratio >= 0.9) {
      return {
        ...this.pass(
          `${described}/${items.length} operation/parameter description(s) are verbose enough for LLM tool-calling.${missing.length > 0 ? ` Still thin: ${missingSummary}` : ''}`,
          expected,
          found,
        ),
        details,
      };
    }

    const recommendation = {
      priority: 'high' as const,
      description: OpenApiDescriptionQualityAudit.meta.description,
      code: OpenApiDescriptionQualityAudit.meta.guidance?.code,
    };

    if (ratio >= 0.5) {
      return {
        ...this.warn(
          `Only ${described}/${items.length} operation/parameter description(s) are verbose enough: ${missingSummary}`,
          expected,
          found,
          recommendation,
        ),
        details,
      };
    }

    return {
      ...this.fail(
        `Only ${described}/${items.length} operation/parameter description(s) are verbose enough: ${missingSummary}`,
        expected,
        found,
        recommendation,
      ),
      details,
    };
  }
}
