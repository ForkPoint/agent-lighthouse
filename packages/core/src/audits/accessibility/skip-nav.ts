import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class SkipNavAudit extends Audit {
  static override meta: AuditMeta = {
    id: '7.1',
    category: 'accessibility',
    title: 'Skip navigation link',
    failureTitle: 'Skip navigation link',
    description:
      'Headless browser agents (Claude computer use, GPTBot with browser) parse the accessibility tree to navigate pages efficiently. A skip navigation link lets these agents jump directly to primary content without processing every nav element, reducing latency and improving content extraction accuracy.',
    scoreDisplayMode: 'informative',
    weight: 0,
    defaultPriority: 'medium',
    deprecated: {
      notice: 'Agents that read the accessibility tree receive the whole tree at once; nothing consumes a skip link, and the main landmark already marks the content boundary.',
      link: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md#accessibilityskip-nav',
    },
    guidance: {
      impact:
        'Headless browser agents (Claude computer use, GPTBot) parse the accessibility tree to navigate pages. A skip navigation link lets agents jump directly to primary content without processing every nav element, reducing latency and improving content extraction accuracy.',
      fix: 'Add a "Skip to main content" link as the first focusable element in <body>, pointing to an anchor on your <main> element.',
      code: '<a href="#main-content" class="skip-link">Skip to main content</a>\n<!-- ... navigation ... -->\n<main id="main-content">...</main>',
      effort: 'trivial',
      docsUrl: 'https://www.w3.org/WAI/WCAG21/Techniques/general/G1',
      tags: ['a11y', 'navigation', 'accessibility'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (!ctx.pages || ctx.pages.length === 0) {
      return this.warn(
        'No pages scanned to check for skip navigation link.',
        'A skip-to-content link among the first links in <body>',
        'No pages scanned',
      );
    }

    for (const page of ctx.pages) {
      const $ = page.$;
      // Check the first few <a> elements in <body>
      const bodyLinks = $('body a').slice(0, 5);
      let found = false;

      bodyLinks.each((_, el) => {
        const text = $(el).text().toLowerCase().trim();
        const href = ($(el).attr('href') ?? '').toLowerCase();
        if (
          (text.includes('skip') || text.includes('jump to') || text.includes('go to main')) &&
          (href.includes('#main') || href.includes('#content') || href.includes('#skip'))
        ) {
          found = true;
        }
      });

      if (found) {
        return this.pass(
          'Skip navigation link found among the first links in <body>.',
          'A skip-to-content link among the first links in <body>',
          'Skip navigation link detected',
          page.url,
        );
      }
    }

    return this.fail(
      'No skip navigation link found. Screen reader and keyboard users rely on skip links to bypass repeated navigation.',
      'A skip-to-content link among the first links in <body>',
      'No skip navigation link detected in the first few <body> links',
      {
        priority: 'medium',
        description:
          'Headless browser agents (Claude computer use, GPTBot with browser) parse the accessibility tree to navigate pages efficiently. A skip navigation link lets these agents jump directly to primary content without processing every nav element, reducing latency and improving content extraction accuracy.',
        code: '<a href="#main-content" class="skip-link">Skip to main content</a>\n<!-- Then on your main content: -->\n<main id="main-content">...</main>',
      },
    );
  }
}
