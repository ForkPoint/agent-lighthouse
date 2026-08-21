import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

const OG_CORE = ['og:title', 'og:description', 'og:image', 'og:url'] as const;

export class CoreOpenGraphAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/core-open-graph',
    category: 'answer-readiness',
    title: 'Core Open Graph tags',
    failureTitle: 'Core Open Graph tags',
    description:
      'AI agents and social platforms use Open Graph tags to generate rich previews and understand page content at a glance. Missing tags mean agents cannot display proper titles, descriptions, or images when referencing your page in AI-generated responses.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/answer-readiness/core-open-graph.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'AI agents and social platforms use Open Graph tags to generate rich previews and understand page content at a glance. Missing tags mean agents cannot display proper titles, descriptions, or images when referencing your page.',
      fix: 'Add all four core OG tags to every page: og:title, og:description, og:image (with an absolute URL), and og:url.',
      code: '<meta property="og:title" content="Page Title">\n<meta property="og:description" content="Page description">\n<meta property="og:image" content="https://yoursite.com/image.png">\n<meta property="og:url" content="https://yoursite.com/page">',
      effort: 'easy',
      docsUrl: 'https://ogp.me/',
      tags: ['meta-tags', 'open-graph', 'social'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const present: string[] = [];
    const missing: string[] = [];

    for (const tag of OG_CORE) {
      const val = page?.meta?.[tag] ?? '';
      if (val.trim()) {
        present.push(tag);
      } else {
        missing.push(tag);
      }
    }

    if (missing.length === 0) {
      return this.pass(
        'All core OG tags are present and non-empty.',
        'og:title, og:description, og:image, og:url all present and non-empty',
        present.join(', '),
        page.url,
      );
    }

    if (missing.length < OG_CORE.length) {
      return this.warn(
        `Missing OG tags: ${missing.join(', ')}.`,
        'og:title, og:description, og:image, og:url all present and non-empty',
        /* v8 ignore next */
        present.length > 0 ? `Present: ${present.join(', ')}` : 'None found',
        {
          priority: 'high',
          description: `AI agents and social platforms use Open Graph tags to generate rich previews and understand page content at a glance. Missing tags (${missing.join(', ')}) mean agents cannot display proper titles, descriptions, or images when referencing your page in AI-generated responses.`,
          code: missing.map((t) => `<meta property="${t}" content="...">`).join('\n'),
        },
        page?.url,
      );
    }

    return this.fail(
      `Missing OG tags: ${missing.join(', ')}.`,
      'og:title, og:description, og:image, og:url all present and non-empty',
      /* v8 ignore next */
      present.length > 0 ? `Present: ${present.join(', ')}` : 'None found',
      {
        priority: 'high',
        description: `AI agents and social platforms use Open Graph tags to generate rich previews and understand page content at a glance. Missing tags (${missing.join(', ')}) mean agents cannot display proper titles, descriptions, or images when referencing your page in AI-generated responses.`,
        code: missing.map((t) => `<meta property="${t}" content="...">`).join('\n'),
      },
      page?.url,
    );
  }
}
