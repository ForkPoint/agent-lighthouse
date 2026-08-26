import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
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

/** A structured PostalAddress block (JSON-LD, microdata, or RDFa). */
function hasPostalAddressBlock(page: PageContext): boolean {
  const schemas = flattenJsonLd(page.structuredData ?? page.jsonLd);
  if (schemas.some((s) => matchesAnyType(s as Record<string, unknown>, ['PostalAddress']))) {
    return true;
  }
  return page.$('[itemtype*="PostalAddress"]').length > 0;
}

/** A link/CTA that points to a store locator or physical store locations. */
function hasStoreLocatorLink(page: PageContext): boolean {
  let found = false;
  page.$('a[href]').each((_, el) => {
    if (found) return;
    /* v8 ignore next */
    const href = (page.$(el).attr('href') ?? '').toLowerCase();
    const text = page.$(el).text().toLowerCase();
    if (
      /store-?locator|store-?finder|find-a-?store|find-a-?location|where-to-buy|\/stores?(\/|$|\?)|\/locations?(\/|$|\?)/i.test(
        href,
      ) ||
      /\bstore locator\b|\bfind a store\b|\bstore finder\b|\bour locations\b|\bfind a location\b|\bwhere to buy\b/i.test(
        text,
      )
    ) {
      found = true;
    }
  });
  return found;
}

/**
 * Real physical-location signal: a structured PostalAddress AND a
 * store-locator/locations link co-occurring on the same page. The previous
 * heuristic flagged any page containing a 5-digit number (e.g. an order total
 * or a zip in a footer newsletter form), over-triggering this audit on
 * online-only DTC stores that have no storefront.
 */
function hasPhysicalLocationSignals(page: PageContext): boolean {
  return hasPostalAddressBlock(page) && hasStoreLocatorLink(page);
}

export class LocalBusinessSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'structured-data/local-business-schema',
    category: 'structured-data',
    title: 'LocalBusiness/ProfessionalService schema',
    failureTitle: 'LocalBusiness/ProfessionalService schema',
    description:
      'AI agents use LocalBusiness schema to answer location-based queries like "find a [service] near me." Without it, your business is invisible to location-aware AI systems. Add address, telephone, and openingHours to help agents provide accurate local recommendations.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/structured-data/local-business-schema.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    applicablePageTypes: ['homepage'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without LocalBusiness schema, your business is invisible to location-aware AI systems. AI agents cannot answer "find a [service] near me" queries with your business, and your address, phone number, and hours will not appear in AI-generated local recommendations.',
      fix: 'Add LocalBusiness or ProfessionalService JSON-LD to your homepage. Include name, address (PostalAddress), telephone, and openingHours.',
      code: `{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Your Business",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "City",
    "addressRegion": "ST",
    "postalCode": "12345"
  },
  "telephone": "+1-555-555-5555",
  "openingHours": "Mo-Fr 09:00-17:00"
}`,
      effort: 'easy',
      docsUrl: 'https://schema.org/LocalBusiness',
      tags: ['json-ld', 'schema', 'local-business', 'location'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const pagesWithLocation = ctx.pages.filter((p) => hasPhysicalLocationSignals(p));

    if (pagesWithLocation.length === 0) {
      return this.notApplicable(
        'No physical store signals detected (no PostalAddress block paired with a store-locator link).',
        'LocalBusiness or ProfessionalService schema if site has physical location indicators.',
        'No physical location indicators found.',
      );
    }

    const schemas = allSchemas(ctx);
    const localSchemas = schemas.filter((s) =>
      matchesAnyType(s as Record<string, unknown>, ['LocalBusiness', 'ProfessionalService']),
    );

    const found = localSchemas.length > 0;

    if (found) {
      return this.pass(
        `LocalBusiness/ProfessionalService schema found (${localSchemas.length} instance(s)).`,
        'LocalBusiness or ProfessionalService schema if site has physical location indicators.',
        `${localSchemas.length} LocalBusiness/ProfessionalService schema(s)`,
      );
    }

    return this.fail(
      'Physical location indicators detected but no LocalBusiness or ProfessionalService schema found.',
      'LocalBusiness or ProfessionalService schema if site has physical location indicators.',
      'None',
      {
        priority: 'medium',
        description:
          'AI agents use LocalBusiness schema to answer location-based queries like "find a [service] near me." Without it, your business is invisible to location-aware AI systems. Add address, telephone, and openingHours to help agents provide accurate local recommendations.',
        code: `{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Business Name",
  "address": { "@type": "PostalAddress", "streetAddress": "123 Main St", "addressLocality": "City", "addressRegion": "ST", "postalCode": "12345" },
  "telephone": "+1-555-555-5555"
}`,
      },
    );
  }
}
