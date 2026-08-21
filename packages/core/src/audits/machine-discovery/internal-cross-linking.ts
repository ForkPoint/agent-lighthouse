// TODO(merge): folds into machine-discovery/in-content-links in Plan 4 (approved 2026-08-21).

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { extractInternalLinks } from '../../parser';

export class InternalCrossLinkingAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/internal-cross-linking',
    category: 'machine-discovery',
    title: 'Internal cross-linking',
    failureTitle: 'Internal cross-linking',
    description:
      'AI engines use internal link structure to understand topic relationships and site authority. Pages without internal links are treated as isolated content.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/machine-discovery/internal-cross-linking.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'AI engines use internal link structure to build topic clusters and assess site authority. Pages without internal cross-links are treated as isolated, orphaned content with no topical context, reducing their authority in AI-generated recommendations.',
      fix: "Add at least 2 contextual internal links per page pointing to related content on your site. Use descriptive anchor text that indicates the linked page's topic.",
      code: '<p>Related resources:\n  <a href="/getting-started">Getting Started Guide</a> |\n  <a href="/api-reference">API Reference</a> |\n  <a href="/examples">Code Examples</a>\n</p>',
      effort: 'easy',
      tags: ['site-structure', 'linking', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'Content pages link to >=2 other internal pages',
        'No pages scanned',
        {
          priority: 'high',
          description:
            'AI engines use internal link structure to understand topic relationships and site authority. Pages without internal links are treated as isolated content.',
          code: '<p>Learn more about <a href="/related-topic">related topic</a> and <a href="/another-page">another resource</a>.</p>',
        },
      );
    }

    let wellLinkedPages = 0;
    let totalInternalLinks = 0;

    for (const p of ctx.pages) {
      const links = extractInternalLinks(p.$, ctx.domain);
      // Exclude self-links
      const otherLinks = links.filter((l) => {
        try {
          const linkUrl = new URL(l);
          const pageUrl = new URL(p.url);
          return linkUrl.pathname !== pageUrl.pathname;
        } catch {
          /* v8 ignore next */
          return true;
        }
      });
      totalInternalLinks += otherLinks.length;
      if (otherLinks.length >= 2) {
        wellLinkedPages++;
      }
    }

    if (wellLinkedPages === ctx.pages.length && ctx.pages.length > 0) {
      return this.pass(
        `All ${ctx.pages.length} page(s) have 2+ internal cross-links (${totalInternalLinks} total).`,
        'Content pages link to >=2 other internal pages',
        `${totalInternalLinks} internal links across ${ctx.pages.length} page(s)`,
        page.url,
      );
    }

    if (wellLinkedPages > 0) {
      return this.warn(
        `${wellLinkedPages} of ${ctx.pages.length} page(s) have 2+ internal cross-links.`,
        'Content pages link to >=2 other internal pages',
        `${wellLinkedPages}/${ctx.pages.length} pages well-linked`,
        {
          priority: 'medium',
          description:
            'AI engines build topic clusters from internal link structure. Pages with fewer than 2 internal links appear as isolated content with weak topical authority. Add contextual links to related pages so agents can map your content hierarchy and surface related answers.',
          code: '<p>See also: <a href="/related-guide">our guide to related topic</a> and <a href="/case-study">this case study</a>.</p>',
        },
        page.url,
      );
    }

    return this.fail(
      `No scanned page has 2+ internal cross-links to other pages.`,
      'Content pages link to >=2 other internal pages',
      `${totalInternalLinks} total internal links`,
      {
        priority: 'high',
        description:
          'AI engines use internal link structure to build topic clusters and assess site authority. Pages without internal cross-links are treated as isolated, orphaned content with no topical context. Add at least 2 contextual links per page to related content on your site.',
        code: '<p>Related resources:\n  <a href="/getting-started">Getting Started Guide</a> |\n  <a href="/api-reference">API Reference</a> |\n  <a href="/examples">Code Examples</a>\n</p>',
      },
      page.url,
    );
  }
}
