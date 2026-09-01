import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";

export class MainElementAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/main-element",
    category: "content-extraction",
    title: "<main> element present",
    failureTitle: "<main> element present",
    description:
      "AI scrapers use <main> to identify primary content and discard nav/footer chrome, reducing hallucination risk from boilerplate text. Without <main>, agents must guess which content is primary versus navigational, often ingesting menus and footers into their context window.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/content-extraction/main-element.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "high",
    guidance: {
      impact:
        "Without a <main> element, AI scrapers cannot distinguish primary content from navigation, sidebars, and footer boilerplate. This causes agents to ingest menus, disclaimers, and repeated chrome into their context window, increasing hallucination risk and reducing answer relevance.",
      fix: "Add a single <main> element to every page wrapping only the primary content area. Do not include site navigation, sidebars, or footers inside <main>. There should be exactly one <main> per page.",
      code: "<body>\n  <header><!-- Navigation --></header>\n  <main>\n    <!-- Primary page content only -->\n  </main>\n  <footer><!-- Footer --></footer>\n</body>",
      effort: "easy",
      docsUrl: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/main",
      tags: ["landmarks", "main", "structure", "semantic", "html"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let pagesWithMain = 0;

    for (const page of ctx.pages) {
      if (page.$("main").length > 0) pagesWithMain++;
    }

    const allPass = pagesWithMain === ctx.pages.length;
    const homepagePass = ctx.pages[0] && ctx.pages[0].$("main").length > 0;

    if (allPass) {
      return this.pass(
        "All pages have a <main> element.",
        "<main> element present on all pages",
        `${pagesWithMain}/${ctx.pages.length} pages with <main>`,
      );
    }

    if (homepagePass) {
      return this.warn(
        `${pagesWithMain}/${ctx.pages.length} page(s) have a <main> element.`,
        "<main> element present on all pages",
        `${pagesWithMain}/${ctx.pages.length} pages with <main>`,
      );
    }

    return this.fail(
      `${pagesWithMain}/${ctx.pages.length} page(s) have a <main> element.`,
      "<main> element present on all pages",
      `${pagesWithMain}/${ctx.pages.length} pages with <main>`,
      {
        priority: "high",
        description:
          "AI scrapers use <main> to identify primary content and discard nav/footer chrome, reducing hallucination risk from boilerplate text. Without <main>, agents must guess which content is primary versus navigational, often ingesting menus and footers into their context window.",
        code: "<main>\n  <!-- Primary page content here -->\n</main>",
      },
    );
  }
}
