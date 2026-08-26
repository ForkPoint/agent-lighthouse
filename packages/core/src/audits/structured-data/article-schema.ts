import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { flattenJsonLd } from '../../parser';

const ARTICLE_TYPES = ['Article', 'NewsArticle', 'BlogPosting'];

function matchesAnyType(schema: Record<string, unknown>, types: string[]): boolean {
  return types.some((t) => {
    const st = schema['@type'];
    if (typeof st === 'string') return st === t;
    if (Array.isArray(st)) return st.includes(t);
    return false;
  });
}

/**
 * A page is article content if it was classified as a content page OR it
 * directly carries Article/BlogPosting/NewsArticle schema. The previous
 * `/blog/` (singular) URL gate missed Shopify's `/blogs/news` and `/pages/blog`
 * routes, producing false "no blog content" verdicts on real stores.
 */
function isArticlePage(page: PageContext): boolean {
  if (page.pageType === 'content') return true;
  const schemas = flattenJsonLd(page.structuredData ?? page.jsonLd);
  return schemas.some((s) => matchesAnyType(s as Record<string, unknown>, ARTICLE_TYPES));
}

function hasProps(obj: Record<string, unknown>, keys: string[]): string[] {
  return keys.filter((k) => !obj[k]);
}

export class ArticleSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'structured-data/article-schema',
    category: 'structured-data',
    title: 'Article schema',
    failureTitle: 'Article schema',
    description:
      'AI agents extract Article schema to identify content freshness (datePublished/dateModified), authorship, and topic (headline). Without it, your blog content is treated as generic text with no provenance, reducing its chances of being cited in AI-generated answers.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/structured-data/article-schema.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    applicablePageTypes: ['content'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'Without Article schema, AI answer engines treat your blog content as generic text with no provenance. You lose content freshness signals (datePublished/dateModified), authorship attribution, and headline extraction -- all of which reduce your chances of being cited in AI-generated answers.',
      fix: 'Add Article or BlogPosting JSON-LD to every blog page. Include headline, datePublished, dateModified, and author with a nested Person type.',
      code: `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Article Title",
  "datePublished": "2025-01-15",
  "dateModified": "2025-02-01",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  }
}`,
      effort: 'easy',
      docsUrl: 'https://schema.org/Article',
      tags: ['json-ld', 'schema', 'content', 'article', 'blog'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const blogPages = ctx.pages.filter((p) => isArticlePage(p));

    if (blogPages.length === 0) {
      return this.notApplicable(
        'No blog/content pages scanned to evaluate Article schema.',
        'Article schema with headline, datePublished, dateModified, author on blog pages.',
        'No content pages or Article schema detected.',
      );
    }

    const requiredProps = ['headline', 'datePublished', 'dateModified', 'author'];
    let completeCount = 0;
    let partialCount = 0;

    for (const page of blogPages) {
      const schemas = flattenJsonLd(page.structuredData ?? page.jsonLd);
      const articles = schemas.filter((s) =>
        matchesAnyType(s as Record<string, unknown>, ARTICLE_TYPES),
      );

      if (articles.length > 0) {
        const art = articles[0] as Record<string, unknown>;
        const missing = hasProps(art, requiredProps);
        if (missing.length === 0) {
          completeCount++;
        } else {
          partialCount++;
        }
      }
    }

    const allComplete = completeCount === blogPages.length;
    const someFound = completeCount + partialCount > 0;

    if (allComplete) {
      return this.pass(
        `Article schema with all required properties found on all ${blogPages.length} blog page(s).`,
        'Article schema with headline, datePublished, dateModified, author on blog pages.',
        `${completeCount} complete, ${partialCount} partial, out of ${blogPages.length} blog page(s)`,
      );
    }

    if (someFound) {
      return this.warn(
        `Article schema found on ${completeCount + partialCount} of ${blogPages.length} blog page(s), ${completeCount} complete.`,
        'Article schema with headline, datePublished, dateModified, author on blog pages.',
        `${completeCount} complete, ${partialCount} partial, out of ${blogPages.length} blog page(s)`,
        {
          priority: 'high',
          description:
            'AI agents extract Article schema to identify content freshness (datePublished/dateModified), authorship, and topic (headline). Without it, your blog content is treated as generic text with no provenance, reducing its chances of being cited in AI-generated answers.',
          code: `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "datePublished": "2025-01-01",
  "dateModified": "2025-01-02",
  "author": { "@type": "Person", "name": "Author Name" }
}`,
        },
      );
    }

    return this.fail(
      `No Article schema found on ${blogPages.length} blog page(s).`,
      'Article schema with headline, datePublished, dateModified, author on blog pages.',
      `${completeCount} complete, ${partialCount} partial, out of ${blogPages.length} blog page(s)`,
      {
        priority: 'high',
        description:
          'AI agents extract Article schema to identify content freshness (datePublished/dateModified), authorship, and topic (headline). Without it, your blog content is treated as generic text with no provenance, reducing its chances of being cited in AI-generated answers.',
        code: `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "datePublished": "2025-01-01",
  "dateModified": "2025-01-02",
  "author": { "@type": "Person", "name": "Author Name" }
}`,
      },
    );
  }
}
