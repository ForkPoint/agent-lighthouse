import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { flattenJsonLd } from '../../parser';

function matchesType(schema: Record<string, unknown>, type: string): boolean {
  const t = schema['@type'];
  if (typeof t === 'string') return t === type;
  if (Array.isArray(t)) return t.includes(type);
  return false;
}

function matchesAnyType(schema: Record<string, unknown>, types: string[]): boolean {
  return types.some((t) => matchesType(schema, t));
}

function allSchemas(ctx: CheckContext): object[] {
  return ctx.pages.flatMap((p) => flattenJsonLd(p.structuredData ?? p.jsonLd));
}

function hasProps(obj: Record<string, unknown>, keys: string[]): string[] {
  return keys.filter((k) => !obj[k]);
}

export class AuthorSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: '3.15',
    category: 'structured-data',
    title: 'Author schema with credentials',
    failureTitle: 'Author schema with credentials',
    description:
      'AI systems assign higher confidence to content from named experts with verifiable credentials. Person schema with jobTitle, sameAs, and affiliation lets AI agents cross-reference author identity across platforms, boosting your content in RAG trust scoring.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI systems assign higher trust to content from named experts with verifiable credentials. Without Person schema containing jobTitle, sameAs, and affiliation, AI agents cannot cross-reference your author identity across platforms, lowering your content ranking in RAG trust scoring and reducing citation likelihood.',
      fix: 'Add or enhance Person schema on author pages and within Article author properties. Include name, jobTitle, sameAs (linking to LinkedIn, Twitter, etc.), and affiliation with a nested Organization.',
      code: `{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Jane Smith",
  "jobTitle": "Senior Product Engineer",
  "sameAs": [
    "https://linkedin.com/in/janesmith",
    "https://twitter.com/janesmith"
  ],
  "affiliation": {
    "@type": "Organization",
    "name": "Your Company"
  }
}`,
      effort: 'easy',
      docsUrl: 'https://schema.org/Person',
      tags: ['json-ld', 'schema', 'author', 'trust', 'E-E-A-T'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const schemas = allSchemas(ctx);
    const personSchemas = schemas.filter((s) =>
      matchesType(s as Record<string, unknown>, 'Person'),
    );

    // Also check author properties on Article schemas (support single objects and arrays)
    const authorFromArticles: Record<string, unknown>[] = [];
    for (const s of schemas) {
      if (matchesAnyType(s as Record<string, unknown>, ['Article', 'NewsArticle', 'BlogPosting'])) {
        const author = (s as Record<string, unknown>)['author'];
        if (Array.isArray(author)) {
          for (const a of author) {
            if (a && typeof a === 'object' && !Array.isArray(a)) {
              authorFromArticles.push(a as Record<string, unknown>);
            }
          }
        } else if (author && typeof author === 'object') {
          authorFromArticles.push(author as Record<string, unknown>);
        }
      }
    }

    const allPersons = [
      ...personSchemas.map((s) => s as Record<string, unknown>),
      ...authorFromArticles,
    ];

    if (allPersons.length === 0) {
      return this.fail(
        'No Person (author) schema found.',
        'Person schema with name, jobTitle, sameAs, and affiliation.',
        'None',
        {
          priority: 'medium',
          description:
            'AI systems assign higher confidence to content from named experts with verifiable credentials. Person schema with jobTitle, sameAs, and affiliation lets AI agents cross-reference author identity across platforms, boosting your content in RAG trust scoring.',
          code: `{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Author Name",
  "jobTitle": "Senior Engineer",
  "sameAs": ["https://linkedin.com/in/author", "https://twitter.com/author"],
  "affiliation": { "@type": "Organization", "name": "Company" }
}`,
        },
      );
    }

    const requiredProps = ['name', 'jobTitle', 'sameAs', 'affiliation'];
    const bestPerson = allPersons.reduce((best, p) => {
      const bestMissing = hasProps(best, requiredProps).length;
      const currentMissing = hasProps(p, requiredProps).length;
      return currentMissing < bestMissing ? p : best;
    }, allPersons[0]);

    const missing = hasProps(bestPerson, requiredProps);
    const complete = missing.length === 0;

    if (complete) {
      return this.pass(
        'Person schema found with name, jobTitle, sameAs, and affiliation.',
        'Person schema with name, jobTitle, sameAs, and affiliation.',
        `Complete Person schema (${allPersons.length} total)`,
      );
    }

    return this.warn(
      `Person schema found but missing: ${missing.join(', ')}.`,
      'Person schema with name, jobTitle, sameAs, and affiliation.',
      `Person schema missing ${missing.join(', ')}`,
      {
        priority: 'medium',
        description: `AI systems cross-reference author identity across platforms for trust scoring. Missing properties (${missing.join(', ')}) prevent agents from verifying author credentials, reducing confidence in your content. Add them to your Person schema.`,
        code: `{
  "@type": "Person",
  "name": "Author Name",
  "jobTitle": "Senior Engineer",
  "sameAs": ["https://linkedin.com/in/author"],
  "affiliation": { "@type": "Organization", "name": "Company" }
}`,
      },
    );
  }
}
