// TODO(merge): folds into operability-safety/landmark-unique in Plan 4 (approved 2026-08-21).

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class NavAriaLabelAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/nav-aria-label',
    category: 'operability-safety',
    title: '<nav> has aria-label',
    failureTitle: '<nav> has aria-label',
    description:
      'AI browser agents use aria-label on <nav> elements to understand navigation purpose before interacting with it. Unlabeled navs force agents to inspect child links to guess whether it is main navigation, breadcrumbs, or a footer menu, slowing down agentic workflows.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/nav-aria-label.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI browser agents use aria-label on <nav> elements to understand navigation purpose before interacting with it. Unlabeled navs force agents to inspect child links to guess the navigation type, slowing down agentic workflows.',
      fix: 'Add an aria-label attribute to every <nav> element describing its purpose (e.g., "Main navigation", "Breadcrumb", "Footer navigation").',
      code: '<nav aria-label="Main navigation">...</nav>',
      effort: 'trivial',
      docsUrl: 'https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/',
      tags: ['a11y', 'aria', 'navigation', 'accessibility'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (!ctx.pages || ctx.pages.length === 0) {
      return this.warn(
        'No pages scanned to check <nav> aria-labels.',
        'All <nav> elements have aria-label attribute',
        'No pages scanned',
      );
    }

    const $ = ctx.pages[0].$;
    const navs = $('nav');

    if (navs.length === 0) {
      return this.warn(
        'No <nav> elements found on page. Navigation should use semantic <nav> elements.',
        'All <nav> elements have aria-label attribute',
        'No <nav> elements on page',
        {
          priority: 'medium',
          description:
            'AI browser agents rely on <nav> landmarks to locate and understand site navigation. Without <nav> elements, agents must scan the full DOM to find navigation links, which is slower and less reliable. Wrap your navigation in <nav> with an aria-label.',
          code: '<nav aria-label="Main navigation">...</nav>',
        },
        ctx.pages[0].url,
      );
    }

    let labeled = 0;
    let unlabeled = 0;

    navs.each((_, el) => {
      const ariaLabel = $(el).attr('aria-label');
      const ariaLabelledby = $(el).attr('aria-labelledby');
      if ((ariaLabel && ariaLabel.trim()) || (ariaLabelledby && ariaLabelledby.trim())) {
        labeled++;
      } else {
        unlabeled++;
      }
    });

    if (unlabeled === 0) {
      return this.pass(
        `All ${labeled} <nav> element(s) have aria-label or aria-labelledby.`,
        'All <nav> elements have aria-label attribute',
        `${labeled} <nav> element(s), all labeled`,
        ctx.pages[0].url,
      );
    }

    const recommendation = {
      priority: 'medium' as const,
      description:
        'AI browser agents use aria-label on <nav> elements to understand navigation purpose before interacting with it. Unlabeled navs force agents to inspect child links to guess whether it is main navigation, breadcrumbs, or a footer menu, slowing down agentic workflows.',
      code: '<nav aria-label="Main navigation">...</nav>',
    };

    if (labeled / navs.length >= 0.5) {
      return this.warn(
        `${unlabeled} of ${navs.length} <nav> element(s) lack aria-label. Navigation elements need labels for screen readers and AI agents.`,
        'All <nav> elements have aria-label attribute',
        `${unlabeled} of ${navs.length} <nav> element(s) missing aria-label`,
        recommendation,
        ctx.pages[0].url,
      );
    }

    return this.fail(
      `${unlabeled} of ${navs.length} <nav> element(s) lack aria-label. Navigation elements need labels for screen readers and AI agents.`,
      'All <nav> elements have aria-label attribute',
      `${unlabeled} of ${navs.length} <nav> element(s) missing aria-label`,
      recommendation,
      ctx.pages[0].url,
    );
  }
}
