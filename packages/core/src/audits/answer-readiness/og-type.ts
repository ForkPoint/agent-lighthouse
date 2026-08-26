import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class OgTypeAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/og-type',
    category: 'answer-readiness',
    title: 'og:type set and appropriate',
    failureTitle: 'og:type set and appropriate',
    description:
      'AI agents use og:type to classify page content as either a website, article, product, or other entity type. Without it, agents default to treating the page as generic content, missing opportunities for type-specific handling like article freshness scoring.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/answer-readiness/og-type.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents use og:type to classify page content for type-specific handling. Without it, agents treat every page as generic content, missing opportunities for article freshness scoring or product-specific handling.',
      fix: 'Add og:type with the appropriate value: "article" for blog posts and articles, "website" for homepages and general pages, "product" for product pages.',
      code: '<meta property="og:type" content="article">',
      effort: 'trivial',
      docsUrl: 'https://ogp.me/#types',
      tags: ['meta-tags', 'open-graph'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const ogType = (page?.meta?.['og:type'] ?? '').trim();

    if (!ogType) {
      return this.fail(
        'og:type is missing.',
        'og:type present; "article" on blog pages, "website" on others',
        'Not found',
        {
          priority: 'medium',
          description:
            'AI agents use og:type to classify page content as either a website, article, product, or other entity type. Without it, agents default to treating the page as generic content, missing opportunities for type-specific handling like article freshness scoring.',
          code: '<meta property="og:type" content="website">',
        },
        page?.url,
      );
    }

    /* v8 ignore next */
    const url = (page?.url ?? '').toLowerCase();
    const isBlogPage = url.includes('/blog') || url.includes('/post') || url.includes('/article');

    if (isBlogPage && ogType !== 'article') {
      return this.warn(
        `Blog page has og:type="${ogType}" instead of "article".`,
        '"article" on blog pages, "website" on others',
        ogType,
        {
          priority: 'medium',
          description:
            'AI agents use og:type "article" to apply content-specific handling like freshness scoring and author attribution. Blog pages with og:type "website" are treated as static pages instead of time-sensitive content, reducing their prominence in recency-weighted AI answers.',
          code: '<meta property="og:type" content="article">',
        },
        page.url,
      );
    }

    return this.pass(
      `og:type is "${ogType}".`,
      'og:type present; "article" on blog pages, "website" on others',
      ogType,
      page.url,
    );
  }
}
