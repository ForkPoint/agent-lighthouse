import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { scanReadTheSite, unreadSiteReason } from '../../scan-evidence';

export class HeaderFooterAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/header-footer',
    category: 'content-extraction',
    title: '<header> and <footer> landmarks',
    failureTitle: '<header> and <footer> landmarks',
    description:
      'AI agents use <header> and <footer> landmarks to identify and exclude boilerplate content (navigation, copyright, links) from primary content extraction. Without these landmarks, agents may include footer disclaimers or nav menus in their content summaries.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/header-footer.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents use <header> and <footer> landmarks to identify and exclude boilerplate content (navigation menus, copyright notices, legal links) from primary content extraction. Without these landmarks, agents may include footer disclaimers or nav menus in their content summaries, reducing answer accuracy.',
      fix: 'Wrap your site navigation and branding area in a <header> element, and your copyright, legal links, and secondary navigation in a <footer> element. These should be present on every page for consistent content extraction.',
      code: '<header>\n  <nav><!-- Site navigation --></nav>\n</header>\n<main><!-- Primary content --></main>\n<footer>\n  <p>&copy; 2025 Your Company. All rights reserved.</p>\n</footer>',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/header',
      tags: ['landmarks', 'header', 'footer', 'structure', 'semantic', 'html'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Nothing here can be attributed to this site; see `scanReadTheSite`.
    if (!scanReadTheSite(ctx.evidence)) {
      return this.notApplicable(
        'No page here can be attributed to this site, so its landmarks were not judged.',
        'Both <header> and <footer> present on all pages',
        unreadSiteReason(ctx.evidence),
      );
    }

    let pagesWithBoth = 0;
    let pagesWithHeader = 0;
    let pagesWithFooter = 0;

    for (const page of ctx.pages) {
      const hasHeader = page.$('header').length > 0;
      const hasFooter = page.$('footer').length > 0;
      if (hasHeader) pagesWithHeader++;
      if (hasFooter) pagesWithFooter++;
      if (hasHeader && hasFooter) pagesWithBoth++;
    }

    const allPass = pagesWithBoth === ctx.pages.length;
    const homepagePass =
      ctx.pages[0] && ctx.pages[0].$('header').length > 0 && ctx.pages[0].$('footer').length > 0;

    if (allPass) {
      return this.pass(
        'All pages have both <header> and <footer> landmarks.',
        'Both <header> and <footer> present on all pages',
        `${pagesWithBoth}/${ctx.pages.length} pages with both landmarks`,
      );
    }

    if (homepagePass) {
      return this.warn(
        `Header found on ${pagesWithHeader}/${ctx.pages.length} pages, footer on ${pagesWithFooter}/${ctx.pages.length} pages.`,
        'Both <header> and <footer> present on all pages',
        `${pagesWithBoth}/${ctx.pages.length} pages with both landmarks`,
      );
    }

    return this.fail(
      `Header found on ${pagesWithHeader}/${ctx.pages.length} pages, footer on ${pagesWithFooter}/${ctx.pages.length} pages.`,
      'Both <header> and <footer> present on all pages',
      `${pagesWithBoth}/${ctx.pages.length} pages with both landmarks`,
      {
        priority: 'medium',
        description:
          'AI agents use <header> and <footer> landmarks to identify and exclude boilerplate content (navigation, copyright, links) from primary content extraction. Without these landmarks, agents may include footer disclaimers or nav menus in their content summaries.',
        code: '<header><!-- Site navigation --></header>\n<main><!-- Content --></main>\n<footer><!-- Copyright, links --></footer>',
      },
    );
  }
}
