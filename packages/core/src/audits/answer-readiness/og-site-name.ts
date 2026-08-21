// TODO(merge): folds into answer-readiness/core-open-graph in Plan 4 (approved 2026-08-21).

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class OgSiteNameAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/og-site-name',
    category: 'answer-readiness',
    title: 'og:site_name present',
    failureTitle: 'og:site_name present',
    description:
      'AI agents use og:site_name to associate individual pages with your brand entity. Without it, agents may not connect pages from your site as belonging to the same organization, fragmenting your brand identity across AI-generated responses.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/answer-readiness/og-site-name.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents use og:site_name to associate individual pages with your brand entity. Without it, agents may not connect pages from your site as belonging to the same organization, fragmenting your brand identity in AI responses.',
      fix: 'Add og:site_name to every page with your consistent brand or site name.',
      code: '<meta property="og:site_name" content="Your Site Name">',
      effort: 'trivial',
      docsUrl: 'https://ogp.me/',
      tags: ['meta-tags', 'open-graph', 'brand'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const siteName = (page?.meta?.['og:site_name'] ?? '').trim();

    if (siteName) {
      return this.pass(
        `og:site_name is "${siteName}".`,
        'og:site_name present and non-empty',
        siteName,
        page.url,
      );
    }

    return this.fail(
      'og:site_name is missing.',
      'og:site_name present and non-empty',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI agents use og:site_name to associate individual pages with your brand entity. Without it, agents may not connect pages from your site as belonging to the same organization, fragmenting your brand identity across AI-generated responses.',
        code: '<meta property="og:site_name" content="Your Site Name">',
      },
      page?.url,
    );
  }
}
