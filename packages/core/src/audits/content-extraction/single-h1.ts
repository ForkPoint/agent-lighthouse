import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { judgePages } from "../../gatherers/pages";

export class SingleH1Audit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/single-h1",
    category: "content-extraction",
    title: "Single h1 per page",
    failureTitle: "Single h1 per page",
    description:
      "AI agents use the single <h1> as the authoritative title of the page for content indexing and answer generation. Ensure exactly one <h1> per page.",
    scoreDisplayMode: "binary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/content-extraction/single-h1.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "high",
    guidance: {
      impact:
        "AI agents use the single <h1> as the authoritative page title for content indexing and answer generation. Multiple <h1> elements create ambiguity about the page's primary topic, causing agents to misidentify or conflate subjects when generating answers.",
      fix: "Ensure every page has exactly one <h1> element that clearly describes the page's primary topic. Use h2-h6 for all other headings. If your CMS or template generates multiple <h1> elements, change the extras to the appropriate lower heading level.",
      code: "<h1>Your Primary Page Title</h1>\n<h2>First Section</h2>\n<h2>Second Section</h2>",
      effort: "trivial",
      docsUrl:
        "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements",
      tags: ["headings", "h1", "structure", "semantic"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected = "Exactly one <h1> on each scanned page";
    const { judged, failures } = judgePages(ctx.pages, (page) => {
      const count = page.$("h1").length;
      return { ok: count === 1, detail: `${count} <h1> element(s)` };
    });
    if (judged.length === 0) {
      return this.notApplicable(
        "No pages available to check.",
        expected,
        "No pages scanned",
      );
    }

    const coverage = `${judged.length - failures.length}/${judged.length} pages with exactly one <h1>`;
    if (failures.length === 0) {
      return this.pass(
        "Every scanned page has exactly one <h1> element.",
        expected,
        coverage,
        judged.length === 1 ? judged[0]!.page.url : undefined,
      );
    }

    // Sort a new judgment list, never the caller's page array.
    failures.sort((a, b) =>
      a.page.url < b.page.url ? -1 : a.page.url > b.page.url ? 1 : 0,
    );
    const found = `${coverage}. Affected pages: ${failures
      .map(({ page, detail }) => `${page.url}: ${detail}`)
      .join("; ")}`;
    const message =
      judged.length === 1
        ? `Page has ${failures[0]!.detail}; expected exactly 1.`
        : `${failures.length}/${judged.length} scanned pages do not have exactly one <h1> element.`;
    return this.validate(
      this.fail(
        message,
        expected,
        found,
        {
          priority: "high",
          description:
            "AI agents use the single <h1> as the authoritative title of the page. Multiple <h1> elements create ambiguity about the page's primary topic, causing agents to misidentify or conflate subjects when generating answers. Ensure exactly one <h1> per page.",
          code: "<h1>Primary Page Topic</h1>",
        },
        failures[0]!.page.url,
      ),
    );
  }
}
