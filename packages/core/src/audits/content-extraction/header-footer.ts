import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { weightForGrade } from "#core/scorer";
import { judgePages } from "#core/gatherers/pages";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

export class HeaderFooterAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/header-footer",
    category: "content-extraction",
    title: "<header> and <footer> landmarks",
    failureTitle: "<header> and <footer> landmarks",
    description:
      "AI agents use <header> and <footer> landmarks to identify and exclude boilerplate content (navigation, copyright, links) from primary content extraction. Without these landmarks, agents may include footer disclaimers or nav menus in their content summaries.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/content-extraction/header-footer.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "AI agents use <header> and <footer> landmarks to identify and exclude boilerplate content (navigation menus, copyright notices, legal links) from primary content extraction. Without these landmarks, agents may include footer disclaimers or nav menus in their content summaries, reducing answer accuracy.",
      fix: "Wrap your site navigation and branding area in a <header> element, and your copyright, legal links, and secondary navigation in a <footer> element. These should be present on every page for consistent content extraction.",
      code: "<header>\n  <nav><!-- Site navigation --></nav>\n</header>\n<main><!-- Primary content --></main>\n<footer>\n  <p>&copy; 2025 Your Company. All rights reserved.</p>\n</footer>",
      effort: FixEffort.Easy,
      docsUrl:
        "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/header",
      tags: ["landmarks", "header", "footer", "structure", "semantic", "html"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected = "Both <header> and <footer> present on all scanned pages";
    let pagesWithHeader = 0;
    let pagesWithFooter = 0;

    const { judged, failures } = judgePages(ctx.pages, (page) => {
      const hasHeader = page.$("header").length > 0;
      const hasFooter = page.$("footer").length > 0;
      if (hasHeader) pagesWithHeader++;
      if (hasFooter) pagesWithFooter++;
      const missing = [
        ...(!hasHeader ? ["<header>"] : []),
        ...(!hasFooter ? ["<footer>"] : []),
      ];
      return { ok: hasHeader && hasFooter, detail: missing.join(" and ") };
    });
    if (judged.length === 0) {
      return this.notApplicable(
        "No pages available to check for header and footer landmarks.",
        expected,
        "No pages scanned",
      );
    }

    const pagesWithBoth = judged.length - failures.length;
    const coverage = `${pagesWithBoth}/${judged.length} pages with both landmarks`;
    if (failures.length === 0) {
      return this.pass(
        "All scanned pages have both <header> and <footer> landmarks.",
        expected,
        coverage,
      );
    }

    failures.sort((a, b) =>
      a.page.url < b.page.url ? -1 : a.page.url > b.page.url ? 1 : 0,
    );
    const found = `${coverage}. Affected pages: ${failures
      .map(({ page, detail }) => `${page.url}: missing ${detail}`)
      .join("; ")}`;
    const message = `Header found on ${pagesWithHeader}/${judged.length} pages, footer on ${pagesWithFooter}/${judged.length} pages.`;
    const pageUrl = failures[0]!.page.url;
    if (pagesWithBoth > 0) {
      return this.validate(
        this.warn(message, expected, found, undefined, pageUrl),
      );
    }

    return this.validate(
      this.fail(
        message,
        expected,
        found,
        {
          priority: CheckPriority.Medium,
          description:
            "AI agents use <header> and <footer> landmarks to identify and exclude boilerplate content (navigation, copyright, links) from primary content extraction. Without these landmarks, agents may include footer disclaimers or nav menus in their content summaries.",
          code: "<header><!-- Site navigation --></header>\n<main><!-- Content --></main>\n<footer><!-- Copyright, links --></footer>",
        },
        pageUrl,
      ),
    );
  }
}
