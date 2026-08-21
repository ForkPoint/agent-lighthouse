// TODO(redeem): this audit survives only if rewritten (pending triage approval). Target tier: informative.
// Evidence dossier: docs/evidence/audits/meta-tags/twitter-card.md
// Required rework:
//   Fix factual errors (twitter:* falls back to og:*), fold into social-meta diagnostic with
//   core-open-graph, unscored. Evidence: og:title/og:site_name graded A; twitter:* has no AI
//   consumer evidence.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

const TWITTER_REQUIRED = ['twitter:card', 'twitter:title', 'twitter:description'] as const;

export class TwitterCardAudit extends Audit {
  static override meta: AuditMeta = {
    id: '4.10',
    category: 'meta-tags',
    title: 'Twitter Card tags complete',
    failureTitle: 'Twitter Card tags complete',
    description:
      'AI agents that surface content via social platforms use Twitter Card tags to generate rich previews. Missing tags mean your content appears as a plain URL link with no context, reducing click-through from AI-curated social feeds.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents that surface content via social platforms use Twitter Card tags to generate rich previews. Missing tags mean your content appears as a plain URL link with no context, reducing click-through from AI-curated social feeds.',
      fix: 'Add all three required Twitter Card meta tags: twitter:card (usually "summary_large_image"), twitter:title, and twitter:description.',
      code: '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="Page Title">\n<meta name="twitter:description" content="Page description">',
      effort: 'trivial',
      docsUrl: 'https://developer.x.com/en/docs/x-for-websites/cards/overview/abouts-cards',
      tags: ['meta-tags', 'twitter', 'social'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const present: string[] = [];
    const missing: string[] = [];

    for (const tag of TWITTER_REQUIRED) {
      const val = (page?.meta?.[tag] ?? '').trim();
      if (val) {
        present.push(tag);
      } else {
        missing.push(tag);
      }
    }

    if (missing.length === 0) {
      return this.pass(
        'All required Twitter Card tags are present.',
        'twitter:card, twitter:title, twitter:description all present',
        present.join(', '),
        page.url,
      );
    }

    if (missing.length < TWITTER_REQUIRED.length) {
      return this.warn(
        `Missing Twitter Card tags: ${missing.join(', ')}.`,
        'twitter:card, twitter:title, twitter:description all present',
        /* v8 ignore next */
        present.length > 0 ? `Present: ${present.join(', ')}` : 'None found',
        {
          priority: 'medium',
          description: `AI agents that surface content via social platforms use Twitter Card tags to generate rich previews. Missing tags (${missing.join(', ')}) mean your content appears as a plain URL link with no context, reducing click-through from AI-curated social feeds.`,
          code: missing.map((t) => `<meta name="${t}" content="...">`).join('\n'),
        },
        page?.url,
      );
    }

    return this.fail(
      `Missing Twitter Card tags: ${missing.join(', ')}.`,
      'twitter:card, twitter:title, twitter:description all present',
      /* v8 ignore next */
      present.length > 0 ? `Present: ${present.join(', ')}` : 'None found',
      {
        priority: 'medium',
        description: `AI agents that surface content via social platforms use Twitter Card tags to generate rich previews. Missing tags (${missing.join(', ')}) mean your content appears as a plain URL link with no context, reducing click-through from AI-curated social feeds.`,
        code: missing.map((t) => `<meta name="${t}" content="...">`).join('\n'),
      },
      page?.url,
    );
  }
}
