import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { flattenJsonLd } from '../../parser';

const ORG_TYPES = [
  'Organization',
  'Corporation',
  'LocalBusiness',
  'Store',
  'OnlineStore',
  'OnlineBusiness',
  'EducationalOrganization',
  'GovernmentOrganization',
  'NGO',
  'NewsMediaOrganization',
  'MedicalOrganization',
  'SportsOrganization',
];

function matchesOrgType(schema: Record<string, unknown>): boolean {
  const t = schema['@type'];
  if (typeof t === 'string') return ORG_TYPES.includes(t) || t.endsWith('Organization') || t.endsWith('Store') || t.endsWith('Business');
  if (Array.isArray(t)) return t.some((item) => typeof item === 'string' && (ORG_TYPES.includes(item) || item.endsWith('Organization') || item.endsWith('Store') || item.endsWith('Business')));
  return false;
}

function allSchemas(ctx: CheckContext): object[] {
  return ctx.pages.flatMap((p) => flattenJsonLd(p.structuredData ?? p.jsonLd));
}

function hasProps(obj: Record<string, unknown>, keys: string[]): string[] {
  return keys.filter((k) => !obj[k]);
}

export class OrganizationSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'structured-data/organization-schema',
    category: 'structured-data',
    title: 'Organization schema',
    failureTitle: 'Organization schema',
    description:
      'AI agents use Organization schema to identify your brand, logo, and contact info. Without it, agents cannot confidently attribute content to your organization or display your branding in AI-generated answers. Add this JSON-LD to your homepage <head>.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/structured-data/organization-schema.md',
    applicablePageTypes: ['homepage'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'Without Organization schema, AI agents cannot confidently attribute content to your brand or display your logo in AI-generated answers. Your organization becomes anonymous in AI recommendations, losing brand visibility and trust signals.',
      fix: 'Add Organization JSON-LD to your homepage <head>. Include name, url, and logo at minimum. Optionally add sameAs links to social profiles and contactPoint for customer service.',
      code: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company",
  "url": "https://yoursite.com",
  "logo": "https://yoursite.com/logo.png",
  "sameAs": [
    "https://twitter.com/yourcompany",
    "https://linkedin.com/company/yourcompany"
  ]
}`,
      effort: 'trivial',
      docsUrl: 'https://schema.org/Organization',
      tags: ['json-ld', 'schema', 'organization', 'brand'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const schemas = allSchemas(ctx);
    const orgSchemas = schemas.filter((s) =>
      matchesOrgType(s as Record<string, unknown>),
    );

    if (orgSchemas.length === 0) {
      return this.fail(
        'No Organization schema found.',
        'Organization schema with name, url, and logo.',
        'None',
        {
          priority: 'high',
          description:
            'AI agents use Organization schema to identify your brand, logo, and contact info. Without it, agents cannot confidently attribute content to your organization or display your branding in AI-generated answers. Add this JSON-LD to your homepage <head>.',
          code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company",
  "url": "https://yoursite.com",
  "logo": "https://yoursite.com/logo.png"
}
</script>`,
        },
      );
    }

    const requiredProps = ['name', 'url', 'logo'];
    const org = orgSchemas[0] as Record<string, unknown>;
    const missing = hasProps(org, requiredProps);
    const valid = missing.length === 0;

    if (valid) {
      return this.pass(
        'Organization schema found with name, url, and logo.',
        'Organization schema with name, url, and logo.',
        'Complete Organization schema',
      );
    }

    return this.warn(
      `Organization schema found but missing: ${missing.join(', ')}.`,
      'Organization schema with name, url, and logo.',
      `Organization schema missing ${missing.join(', ')}`,
      {
        priority: 'high',
        description: `AI agents use Organization schema properties to identify your brand, display your logo, and link to your site. Missing properties (${missing.join(', ')}) reduce your organization's visibility in AI-generated answers. Add them to your existing Organization schema.`,
        code: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company",
  "url": "https://yoursite.com",
  "logo": "https://yoursite.com/logo.png"
}`,
      },
    );
  }
}
