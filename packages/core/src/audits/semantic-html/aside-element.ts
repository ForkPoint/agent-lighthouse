// TODO(redeem): this audit survives only if rewritten (approved 2026-08-21).
// Evidence dossier: docs/evidence/deletions/semantic-html/aside-element.md
// Required rework:
//   Grade B => redeemable, and the audit's stated mechanism is essentially verbatim correct. Which
//   consumer reads the signal, and where documented: (a) Mozilla Readability removes `<aside>` via
//   `this._clean(articleContent, "aside")` in Readability.js — the extractor behind Firefox Reader
//   Mode, Jina Reader's readability path, and a long tail of LLM/agent tools; (b) trafilatura
//   removes `<aside>` via its MANUALLY_CLEANED list in trafilatura/settings.py — a standard
//   extractor in LLM corpus pipelines; (c) Chromium exposes `<aside>` as a `complementary` landmark
//   in the accessibility tree that Anthropic's browser use tool returns from `read_page`, which I
//   verified directly by snapshotting a probe page. Save this audit, but fix the check: it should
//   be conditional (only evaluate pages that plausibly HAVE supplementary content — detect
//   sidebar/promo/related-links containers by class/id/position that are not wrapped in `<aside>`),
//   never penalise a page that legitimately has none, and its guidance should state the extraction
//   consequence explicitly (content inside `<aside>` is discarded by Readability and trafilatura,
//   so never put citable facts there).

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class AsideElementAudit extends Audit {
  static override meta: AuditMeta = {
    id: '6.6',
    category: 'semantic-html',
    title: '<aside> for supplementary content',
    failureTitle: '<aside> for supplementary content',
    description:
      'AI agents use <aside> to distinguish supplementary content (sidebars, callouts, related links) from primary content. Without it, sidebar content may be mixed into the main content extraction, diluting the primary message in AI-generated summaries.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    applicablePageTypes: ['content'],
    defaultPriority: 'low',
    guidance: {
      impact:
        'Without <aside>, AI agents cannot distinguish supplementary content (sidebars, callouts, related links) from primary content. This causes sidebar promotions, ads, and tangential content to be mixed into AI-generated summaries, diluting the accuracy of your main message.',
      fix: 'Wrap sidebar content, callout boxes, pull quotes, and related-links sections in <aside> elements. This signals to AI agents that the content is supplementary and should not be treated as part of the main narrative.',
      code: '<aside>\n  <h3>Related Resources</h3>\n  <ul>\n    <li><a href="/related-topic">Related Topic</a></li>\n  </ul>\n</aside>',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/aside',
      tags: ['aside', 'structure', 'semantic', 'html'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let pagesWithAside = 0;

    for (const page of ctx.pages) {
      if (page.$('aside').length > 0) pagesWithAside++;
    }

    const hasAside = pagesWithAside > 0;

    if (hasAside) {
      return this.pass(
        `${pagesWithAside}/${ctx.pages.length} page(s) use <aside> for supplementary content.`,
        '<aside> used for supplementary/sidebar content where applicable',
        `${pagesWithAside} page(s) with <aside>`,
      );
    }

    return this.warn(
      'No <aside> elements found. If sidebar or supplementary content exists, consider using <aside>.',
      '<aside> used for supplementary/sidebar content where applicable',
      'No <aside> elements found',
      {
        priority: 'low',
        description:
          'AI agents use <aside> to distinguish supplementary content (sidebars, callouts, related links) from primary content. Without it, sidebar content may be mixed into the main content extraction, diluting the primary message in AI-generated summaries.',
        code: '<aside>\n  <h3>Related Resources</h3>\n  <ul><li><a href="/related">Related page</a></li></ul>\n</aside>',
      },
    );
  }
}
