import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { flattenJsonLd } from '../../parser';

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

function hasProps(obj: Record<string, unknown>, keys: string[]): string[] {
  return keys.filter((k) => !obj[k]);
}

export class ServiceProductSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: '3.8',
    category: 'structured-data',
    title: 'Service/Product schema',
    failureTitle: 'Service/Product schema',
    description:
      'AI agents use Service/Product schema to understand what you offer, who provides it, and how to describe it to users. Without it, agents must infer your offerings from unstructured text, which leads to inaccurate or incomplete descriptions in AI-generated recommendations.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    applicablePageTypes: ['product'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without Service or Product schema, AI agents must infer your offerings from unstructured text. This leads to inaccurate or incomplete descriptions in AI-generated recommendations, and your services may be entirely overlooked when agents compare options for users.',
      fix: 'Add Service or Product JSON-LD to pages describing your offerings. Include name, description, and provider (nested Organization) at minimum.',
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
      tags: ['json-ld', 'schema', 'service', 'product', 'ecommerce'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const schemas = allSchemas(ctx);
    const serviceProducts = schemas.filter((s) =>
      matchesAnyType(s as Record<string, unknown>, ['Service', 'Product']),
    );

    if (serviceProducts.length === 0) {
      return this.fail(
        'No Service or Product schema found.',
        'Service or Product schema with name, description, and provider.',
        'None',
        {
          priority: 'medium',
          description:
            'AI agents use Service/Product schema to understand what you offer, who provides it, and how to describe it to users. Without it, agents must infer your offerings from unstructured text, which leads to inaccurate or incomplete descriptions in AI-generated recommendations.',
          code: `{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Service Name",
  "description": "Service description",
  "provider": { "@type": "Organization", "name": "Your Company" }
}`,
        },
      );
    }

    const requiredProps = ['name', 'description', 'provider'];
    const first = serviceProducts[0] as Record<string, unknown>;
    const missing = hasProps(first, requiredProps);
    const valid = missing.length === 0;

    if (valid) {
      return this.pass(
        `Service/Product schema found with name, description, and provider.`,
        'Service or Product schema with name, description, and provider.',
        `Complete Service/Product schema (${serviceProducts.length} total)`,
      );
    }

    return this.warn(
      `Service/Product schema found but missing: ${missing.join(', ')}.`,
      'Service or Product schema with name, description, and provider.',
      `Service/Product schema missing ${missing.join(', ')}`,
      {
        priority: 'medium',
        description: `AI agents use Service/Product schema properties to accurately describe your offerings to users. Missing properties (${missing.join(', ')}) mean agents cannot fully represent your service in AI-generated recommendations. Add them to your existing schema.`,
        code: `{
  "@type": "Service",
  "name": "Service Name",
  "description": "Service description",
  "provider": { "@type": "Organization", "name": "Your Company" }
}`,
      },
    );
  }
}
