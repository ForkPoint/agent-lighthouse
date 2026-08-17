import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from '../../check-context';

const REQUIRED_LANDMARKS = [
  {
    name: 'banner/header',
    check: ($: PageContext['$']) => $('[role="banner"]').length > 0 || $('header').length > 0,
  },
  {
    name: 'main',
    check: ($: PageContext['$']) => $('[role="main"]').length > 0 || $('main').length > 0,
  },
  {
    name: 'navigation',
    check: ($: PageContext['$']) => $('[role="navigation"]').length > 0 || $('nav').length > 0,
  },
  {
    name: 'contentinfo/footer',
    check: ($: PageContext['$']) => $('[role="contentinfo"]').length > 0 || $('footer').length > 0,
  },
];

export class AriaLandmarksAudit extends Audit {
  static override meta: AuditMeta = {
    id: '7.2',
    category: 'accessibility',
    title: 'ARIA landmarks complete',
    failureTitle: 'ARIA landmarks complete',
    description:
      'Claude computer use and browser agents rely on ARIA landmarks to identify page regions (navigation, main content, footer). Missing landmarks force agents to guess page structure from raw HTML, leading to misclicked elements and incorrect content extraction.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'Claude computer use and browser agents rely on ARIA landmarks to identify page regions (navigation, main content, footer). Missing landmarks force agents to guess page structure from raw HTML, leading to misclicked elements and incorrect content extraction.',
      fix: 'Ensure your page has all four required landmarks: <header> (banner), <main>, <nav> (navigation), and <footer> (contentinfo). Use semantic HTML elements or ARIA roles.',
      code: '<header role="banner">...</header>\n<nav role="navigation">...</nav>\n<main role="main">...</main>\n<footer role="contentinfo">...</footer>',
      effort: 'easy',
      docsUrl: 'https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/',
      tags: ['a11y', 'aria', 'landmarks', 'accessibility'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (!ctx.pages || ctx.pages.length === 0) {
      return this.warn(
        'No pages scanned to check ARIA landmarks.',
        'Page has banner/header, main, navigation, and contentinfo/footer landmarks',
        'No pages scanned',
      );
    }

    const $ = ctx.pages[0].$;
    const present: string[] = [];
    const missing: string[] = [];

    for (const landmark of REQUIRED_LANDMARKS) {
      if (landmark.check($)) {
        present.push(landmark.name);
      } else {
        missing.push(landmark.name);
      }
    }

    if (missing.length === 0) {
      return this.pass(
        'All required ARIA landmarks are present.',
        'Page has banner/header, main, navigation, and contentinfo/footer landmarks',
        `Present: ${present.join(', ')}`,
        ctx.pages[0].url,
      );
    }

    if (missing.length <= 1) {
      return this.warn(
        `Missing ARIA landmarks: ${missing.join(', ')}. Landmarks help assistive technologies and AI agents understand page structure.`,
        'Page has banner/header, main, navigation, and contentinfo/footer landmarks',
        `Present: ${present.join(', ')}; Missing: ${missing.join(', ')}`,
        {
          priority: 'high',
          description: `Claude computer use and browser agents rely on ARIA landmarks to identify page regions (navigation, main content, footer). Missing landmarks (${missing.join(', ')}) force agents to guess page structure from raw HTML, leading to misclicked elements and incorrect content extraction.`,
          code: missing
            .map((m) => {
              if (m === 'banner/header') return '<header role="banner">...</header>';
              if (m === 'main') return '<main role="main">...</main>';
              if (m === 'navigation') return '<nav role="navigation">...</nav>';
              return '<footer role="contentinfo">...</footer>';
            })
            .join('\n'),
        },
        ctx.pages[0].url,
      );
    }

    return this.fail(
      `Missing ARIA landmarks: ${missing.join(', ')}. Landmarks help assistive technologies and AI agents understand page structure.`,
      'Page has banner/header, main, navigation, and contentinfo/footer landmarks',
      `Present: ${present.join(', ')}; Missing: ${missing.join(', ')}`,
      {
        priority: 'high',
        description: `Claude computer use and browser agents rely on ARIA landmarks to identify page regions (navigation, main content, footer). Missing landmarks (${missing.join(', ')}) force agents to guess page structure from raw HTML, leading to misclicked elements and incorrect content extraction.`,
        code: missing
          .map((m) => {
            if (m === 'banner/header') return '<header role="banner">...</header>';
            if (m === 'main') return '<main role="main">...</main>';
            if (m === 'navigation') return '<nav role="navigation">...</nav>';
            return '<footer role="contentinfo">...</footer>';
          })
          .join('\n'),
      },
      ctx.pages[0].url,
    );
  }
}
