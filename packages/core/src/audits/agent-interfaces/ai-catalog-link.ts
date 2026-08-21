// TODO(merge): folds into agent-interfaces/ai-catalog-exists in Plan 4 (approved 2026-08-21).
// TODO(redeem): this audit survives only if rewritten (approved 2026-08-21).
// Evidence dossier: docs/evidence/deletions/meta-tags/ai-catalog-link.md
// Required rework:
//   Grade B: the mechanism is written into two draft specs (ARD §6.1 and the LF Agent Card WG
//   consuming guide) and is genuinely deployed in production with the exact rel token, verified by
//   live fetch of neon.com and specification.website. That clears the bar for keeping the check.
//   But it must be rewritten before it is worth anything: match `rel="ai-catalog"` (any type,
//   ideally application/ai-catalog+json) in <head> AND accept an HTTP `Link: </...>;
//   rel="ai-catalog"` header, and downgrade it to a nice-to-have relative to the well-known file,
//   since the one known consumer resolves only the well-known path.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class AiCatalogLinkAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/ai-catalog-link',
    category: 'agent-interfaces',
    title: 'AI Catalog link in head',
    failureTitle: 'AI Catalog link in head',
    description:
      'The AI Catalog provides a structured manifest of all AI-consumable resources on your site (APIs, datasets, tools). An AI Catalog link in <head> lets agents discover your full range of machine-readable content in a single request instead of crawling your entire site.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agent-interfaces/ai-catalog-link.md',
    defaultPriority: 'low',
    guidance: {
      impact:
        'Without an AI Catalog link, agents must crawl your entire site to discover AI-consumable resources (APIs, datasets, tools). The catalog lets them find everything in a single request, dramatically improving discovery efficiency.',
      fix: 'Create an AI Catalog JSON file listing your AI-consumable resources and add a <link rel="alternate"> tag in <head> pointing to it.',
      code: '<link rel="alternate" type="application/json" href="/ai-catalog.json" title="AI Catalog">',
      effort: 'moderate',
      tags: ['meta-tags', 'ai-catalog', 'ai-discovery'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    /* v8 ignore start */
    const link = page?.headLinks?.find(
      (l) =>
        l.rel === 'alternate' &&
        l.type === 'application/json' &&
        (l.title ?? '').toLowerCase().includes('ai catalog'),
    );
    /* v8 ignore stop */

    if (link) {
      return this.pass(
        `AI Catalog link found: "${link.href}".`,
        '<link rel="alternate" type="application/json" title="...AI Catalog...">',
        `href="${link.href}" title="${link.title}"`,
        page.url,
      );
    }

    return this.fail(
      'No AI Catalog link found in <head>.',
      '<link rel="alternate" type="application/json" title="...AI Catalog...">',
      'Not found',
      {
        priority: 'low',
        description:
          'The AI Catalog provides a structured manifest of all AI-consumable resources on your site (APIs, datasets, tools). An AI Catalog link in <head> lets agents discover your full range of machine-readable content in a single request instead of crawling your entire site.',
        code: '<link rel="alternate" type="application/json" href="/ai-catalog.json" title="AI Catalog">',
      },
      page?.url,
    );
  }
}
