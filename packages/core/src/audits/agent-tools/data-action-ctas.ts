import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class DataActionCtasAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.17',
    category: 'agent-tools',
    title: 'data-action attributes on CTAs',
    failureTitle: 'data-action attributes on CTAs',
    description:
      'data-action attributes help AI browser agents (like ChatGPT Browse and Google Mariner) identify clickable CTAs and understand what each button does. Without these hints, agents must guess which elements are interactive based on text alone.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'low',
    guidance: {
      impact:
        'Without data-action attributes, AI browser agents like ChatGPT Browse and Google Mariner must guess which elements are clickable and what they do. This leads to missed conversions when agents cannot reliably identify your "Book a Demo" or "Add to Cart" buttons.',
      fix: 'Add data-action, data-action-type, and data-action-label attributes to your key CTA buttons and links. Use descriptive action names and categorize them (e.g., "conversion", "navigation").',
      code: `<button data-action="book-demo" data-action-type="conversion"
  data-action-label="Book a Demo">
  Book a Demo
</button>

<a href="/pricing" data-action="view-pricing" data-action-type="navigation"
  data-action-label="See Pricing">
  See Pricing
</a>`,
      effort: 'easy',
      tags: ['html', 'cta', 'browser-agent', 'accessibility'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let totalDataAction = 0;
    let totalDataActionType = 0;
    let foundPage = '';

    for (const page of ctx.pages) {
      const withDataAction = page.$('[data-action]');
      const withDataActionType = page.$('[data-action-type]');

      if (withDataAction.length > 0 || withDataActionType.length > 0) {
        totalDataAction += withDataAction.length;
        totalDataActionType += withDataActionType.length;
        if (!foundPage) foundPage = page.url;
      }
    }

    if (totalDataAction > 0 && totalDataActionType > 0) {
      return this.pass(
        `Found ${totalDataAction} element(s) with data-action and ${totalDataActionType} with data-action-type.`,
        'Elements with data-action and data-action-type attributes',
        `${totalDataAction} data-action, ${totalDataActionType} data-action-type`,
        foundPage,
      );
    }

    if (totalDataAction > 0 || totalDataActionType > 0) {
      return this.warn(
        `Partial data-action markup: ${totalDataAction} data-action, ${totalDataActionType} data-action-type.`,
        'Elements with data-action and data-action-type attributes',
        `${totalDataAction} data-action, ${totalDataActionType} data-action-type`,
        {
          priority: 'low',
          description: DataActionCtasAudit.meta.description,
          code: `<button data-action="book-demo" data-action-type="conversion"\n  data-action-label="Book a Demo">\n  Book a Demo\n</button>\n\n<a href="/pricing" data-action="view-pricing" data-action-type="navigation"\n  data-action-label="See Pricing">\n  See Pricing\n</a>`,
        },
        foundPage,
      );
    }

    return this.fail(
      'No elements with data-action or data-action-type attributes found.',
      'Elements with data-action and data-action-type attributes',
      'None',
      {
        priority: 'low',
        description: DataActionCtasAudit.meta.description,
        code: `<button data-action="book-demo" data-action-type="conversion"\n  data-action-label="Book a Demo">\n  Book a Demo\n</button>\n\n<a href="/pricing" data-action="view-pricing" data-action-type="navigation"\n  data-action-label="See Pricing">\n  See Pricing\n</a>`,
      },
    );
  }
}
