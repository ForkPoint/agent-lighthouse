import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { flattenJsonLd } from '../../parser';

function matchesType(schema: Record<string, unknown>, type: string): boolean {
  const t = schema['@type'];
  if (typeof t === 'string') return t === type;
  if (Array.isArray(t)) return t.includes(type);
  return false;
}

function urlDepth(url: string): number {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}

export class BreadcrumbSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'structured-data/breadcrumb-schema',
    category: 'structured-data',
    title: 'BreadcrumbList schema',
    failureTitle: 'BreadcrumbList schema',
    description:
      'AI agents use BreadcrumbList to understand your site hierarchy and navigate between parent/child pages. Without breadcrumbs, agents cannot infer where a page sits in your content tree, making it harder to provide contextual answers that reference related pages.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/structured-data/breadcrumb-schema.md',
    applicablePageTypes: ['category', 'product', 'content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without BreadcrumbList schema, AI agents cannot infer where a page sits in your site hierarchy. This prevents agents from navigating between parent and child pages and from providing contextual answers that reference related pages in your content tree.',
      fix: 'Add BreadcrumbList JSON-LD to every page with URL depth greater than 1. Each ListItem should include position, name, and item (the URL).',
      code: `{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://yoursite.com/" },
    { "@type": "ListItem", "position": 2, "name": "Category", "item": "https://yoursite.com/category/" },
    { "@type": "ListItem", "position": 3, "name": "Current Page", "item": "https://yoursite.com/category/page/" }
  ]
}`,
      effort: 'easy',
      docsUrl: 'https://schema.org/BreadcrumbList',
      tags: ['json-ld', 'schema', 'navigation', 'site-structure'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const deepPages = ctx.pages.filter((p) => urlDepth(p.url) > 1);

    if (deepPages.length === 0) {
      return this.warn(
        'No pages with URL depth > 1 found to evaluate breadcrumbs.',
        'BreadcrumbList schema on pages with URL depth > 1.',
        'No deep pages detected.',
        {
          priority: 'low',
          description:
            'AI agents use BreadcrumbList to understand site hierarchy and navigate between related pages. If your site has pages nested beyond the root level, add BreadcrumbList JSON-LD to help agents map your content structure.',
          code: `{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://yoursite.com/" },
    { "@type": "ListItem", "position": 2, "name": "Category", "item": "https://yoursite.com/category/" }
  ]
}`,
        },
      );
    }

    const pagesWithBreadcrumb = deepPages.filter((p) => {
      const schemas = flattenJsonLd(p.structuredData ?? p.jsonLd);
      return schemas.some((s) => matchesType(s as Record<string, unknown>, 'BreadcrumbList'));
    });

    const allHave = pagesWithBreadcrumb.length === deepPages.length;
    const someHave = pagesWithBreadcrumb.length > 0;

    if (allHave) {
      return this.pass(
        `BreadcrumbList schema present on all ${deepPages.length} deep page(s).`,
        'BreadcrumbList schema on pages with URL depth > 1.',
        `${pagesWithBreadcrumb.length}/${deepPages.length} deep pages have BreadcrumbList`,
      );
    }

    if (someHave) {
      return this.warn(
        `BreadcrumbList schema found on ${pagesWithBreadcrumb.length} of ${deepPages.length} deep page(s).`,
        'BreadcrumbList schema on pages with URL depth > 1.',
        `${pagesWithBreadcrumb.length}/${deepPages.length} deep pages have BreadcrumbList`,
        {
          priority: 'medium',
          description:
            'AI agents use BreadcrumbList to understand your site hierarchy and navigate between parent/child pages. Without breadcrumbs, agents cannot infer where a page sits in your content tree, making it harder to provide contextual answers that reference related pages.',
          code: `{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://yoursite.com/" },
    { "@type": "ListItem", "position": 2, "name": "Category", "item": "https://yoursite.com/category/" }
  ]
}`,
        },
      );
    }

    return this.fail(
      `No BreadcrumbList schema found on ${deepPages.length} deep page(s).`,
      'BreadcrumbList schema on pages with URL depth > 1.',
      `${pagesWithBreadcrumb.length}/${deepPages.length} deep pages have BreadcrumbList`,
      {
        priority: 'medium',
        description:
          'AI agents use BreadcrumbList to understand your site hierarchy and navigate between parent/child pages. Without breadcrumbs, agents cannot infer where a page sits in your content tree, making it harder to provide contextual answers that reference related pages.',
        code: `{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://yoursite.com/" },
    { "@type": "ListItem", "position": 2, "name": "Category", "item": "https://yoursite.com/category/" }
  ]
}`,
      },
    );
  }
}
