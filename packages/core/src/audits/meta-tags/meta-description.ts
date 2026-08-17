import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class MetaDescriptionAudit extends Audit {
  static override meta: AuditMeta = {
    id: '4.1',
    category: 'meta-tags',
    title: 'Meta description present',
    failureTitle: 'Meta description present',
    description:
      'AI agents use the meta description as the primary summary of your page when generating answers. Without it, agents must extract a summary from body text, which often produces inaccurate or irrelevant snippets. Add a concise 50-300 character description.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'AI agents use the meta description as the primary summary of your page when generating answers. Without it, agents must extract a summary from body text, which often produces inaccurate or irrelevant snippets.',
      fix: 'Add a <meta name="description"> tag with a concise 50-300 character summary that accurately describes the page content and its value to the reader.',
      code: '<meta name="description" content="A concise summary of the page content in 50-300 characters that describes what users will learn.">',
      effort: 'trivial',
      tags: ['meta-tags', 'seo', 'content-discovery'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const desc = page?.meta?.['description'] ?? '';
    const len = desc.length;

    if (desc && len >= 50 && len <= 300) {
      return this.pass(
        `Meta description present (${len} chars).`,
        'meta[description] with 50-300 characters',
        desc,
        page.url,
      );
    }

    if (desc && (len < 50 || len > 300)) {
      return this.warn(
        `Meta description length is ${len} chars; should be 50-300.`,
        'meta[description] with 50-300 characters',
        desc,
        {
          priority: 'high',
          description:
            "AI agents use the meta description as a primary summary candidate when generating answers about your page. Descriptions outside the 50-300 character range are either too terse for meaningful context or get truncated, reducing your content's chances of being accurately cited.",
          code: '<meta name="description" content="A clear, 50-300 character summary of what this page covers and why it matters.">',
        },
        page?.url,
      );
    }

    return this.fail(
      'Meta description is missing.',
      'meta[description] with 50-300 characters',
      'Not found',
      {
        priority: 'high',
        description:
          'AI agents use the meta description as the primary summary of your page when generating answers. Without it, agents must extract a summary from body text, which often produces inaccurate or irrelevant snippets. Add a concise 50-300 character description.',
        code: '<meta name="description" content="A concise summary of the page content in 50-300 characters.">',
      },
      page?.url,
    );
  }
}
