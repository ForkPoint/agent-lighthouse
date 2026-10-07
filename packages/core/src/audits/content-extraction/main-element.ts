import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { judgePages } from "../../gatherers/pages";

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
    const expected = "<main> element present on all scanned pages";
    const { judged, failures } = judgePages(ctx.pages, (page) => ({
      ok: page.$("main").length > 0,
    }));
    if (judged.length === 0) {
      return this.notApplicable(
        "No pages available to check for a <main> element.",
        expected,
        "No pages scanned",
      );
    }

    const pagesWithMain = judged.length - failures.length;
    const coverage = `${pagesWithMain}/${judged.length} pages with <main>`;
    if (failures.length === 0) {
      return this.pass(
        "All scanned pages have a <main> element.",
        expected,
        coverage,
      );
    }

    // Stable evidence and representative URL, independent of the sample order.
    const missingUrls = failures.map(({ page }) => page.url).sort();
    const found = `${coverage}. Missing <main>: ${missingUrls.join(", ")}`;
    const message = `${pagesWithMain}/${judged.length} scanned page(s) have a <main> element.`;
    if (pagesWithMain > 0) {
      return this.validate(
        this.warn(message, expected, found, undefined, missingUrls[0]),
      );
    }

    return this.validate(
      this.fail(
        message,
        expected,
        found,
        {
          priority: "high",
          description:
            "AI scrapers use <main> to identify primary content and discard nav/footer chrome, reducing hallucination risk from boilerplate text. Without <main>, agents must guess which content is primary versus navigational, often ingesting menus and footers into their context window.",
          code: "<main>\n  <!-- Primary page content here -->\n</main>",
        },
        missingUrls[0],
      ),
    );
  }
}
