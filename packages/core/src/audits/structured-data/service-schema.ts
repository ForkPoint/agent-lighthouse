// Split landed 2026-08-22 (Plan 4, Task 9): the Product half of v1 3.8
// (service-product-schema) moved into structured-data/advanced-product-details;
// what is left here is the Service half, narrowed to Service/ProfessionalService.
// Evidence dossier: docs/evidence/audits/structured-data/service-schema.md

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { flattenJsonLd } from '../../parser';

/** The two in-scope service shapes. Product types belong to 3.22 now. */
const SERVICE_TYPES = ['Service', 'ProfessionalService'];

function matchesAnyType(schema: Record<string, unknown>, types: string[]): boolean {
  return types.some((t) => {
    const st = schema['@type'];
    if (typeof st === 'string') return st === t;
    if (Array.isArray(st)) return st.includes(t);
    return false;
  });
}

function allSchemas(ctx: CheckContext): object[] {
  return ctx.pages.flatMap((p) => flattenJsonLd(p.structuredData ?? p.jsonLd));
}

/**
 * The properties a Service node must carry. `description` is deliberately not
 * here: schema.org does not require it and no consumer documents reading it,
 * so 3.8's required fix says to drop it from the required set.
 */
const REQUIRED_PROPS = ['name', 'provider'] as const;

function missingProps(node: Record<string, unknown>): string[] {
  return REQUIRED_PROPS.filter((prop) => !node[prop]);
}

export class ServiceSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'structured-data/service-schema',
    category: 'structured-data',
    title: 'Service schema',
    failureTitle: 'Service schema',
    description:
      'AI agents use Service schema to understand what you offer and who provides it. Without it, agents must infer your offerings from unstructured text, which leads to inaccurate or incomplete descriptions in AI-generated recommendations.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/structured-data/service-schema.md',
    applicablePageTypes: ['product'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without Service schema, AI agents must infer your offerings from unstructured text. This leads to inaccurate or incomplete descriptions in AI-generated recommendations, and your services may be entirely overlooked when agents compare options for users.',
      fix: 'Add Service (or ProfessionalService) JSON-LD to pages describing your offerings. Include name and provider (nested Organization) at minimum.',
      code: `{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Your Service Name",
  "description": "A clear description of what this service provides.",
  "provider": {
    "@type": "Organization",
    "name": "Your Company"
  }
}`,
      effort: 'easy',
      docsUrl: 'https://schema.org/Service',
      tags: ['json-ld', 'schema', 'service'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const services = allSchemas(ctx).filter((s) =>
      matchesAnyType(s as Record<string, unknown>, SERVICE_TYPES),
    );

    if (services.length === 0) {
      return this.fail(
        'No Service schema found.',
        'Service schema with name and provider.',
        'None',
        {
          priority: 'medium',
          description: ServiceSchemaAudit.meta.description,
          code: `{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Service Name",
  "provider": { "@type": "Organization", "name": "Your Company" }
}`,
        },
      );
    }

    // Judge the best-covered node, not `services[0]`. A listing stub hoisted
    // ahead of the real Service node used to decide the verdict for the whole
    // scan; the site is credited for its most complete markup instead.
    const best = services
      .map((s) => missingProps(s as Record<string, unknown>))
      .reduce((a, b) => (b.length < a.length ? b : a));

    if (best.length === 0) {
      return this.pass(
        'Service schema found with name and provider.',
        'Service schema with name and provider.',
        `Complete Service schema (${services.length} total)`,
      );
    }

    return this.warn(
      `Service schema found but missing: ${best.join(', ')}.`,
      'Service schema with name and provider.',
      `Service schema missing ${best.join(', ')} (${services.length} total)`,
      {
        priority: 'medium',
        description: `AI agents use Service schema properties to accurately describe your offerings to users. Missing properties (${best.join(', ')}) mean agents cannot fully represent your service in AI-generated recommendations. Add them to your existing schema.`,
        code: `{
  "@type": "Service",
  "name": "Service Name",
  "provider": { "@type": "Organization", "name": "Your Company" }
}`,
      },
    );
  }
}
