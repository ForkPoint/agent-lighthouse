import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";

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
    const homepage = ctx.pages[0];
    if (!homepage) {
      return this.fail(
        "No pages available to check.",
        "Exactly one <h1> on the homepage",
        "No pages scanned",
        {
          priority: "high",
          description:
            "AI agents use the single <h1> as the authoritative title of the page for content indexing and answer generation. Ensure exactly one <h1> per page.",
          code: "<h1>Primary Page Topic</h1>",
        },
      );
    }

    const $ = homepage.$;
    const h1Count = $("h1").length;
    const pass = h1Count === 1;

    if (pass) {
      return this.pass(
        "Homepage has exactly one <h1> element.",
        "Exactly one <h1> on the homepage",
        `${h1Count} <h1> element(s)`,
        homepage.url,
      );
    }

    return this.fail(
      `Homepage has ${h1Count} <h1> element(s); expected exactly 1.`,
      "Exactly one <h1> on the homepage",
      `${h1Count} <h1> element(s)`,
      {
        priority: "high",
        description:
          "AI agents use the single <h1> as the authoritative title of the page. Multiple <h1> elements create ambiguity about the page's primary topic, causing agents to misidentify or conflate subjects when generating answers. Ensure exactly one <h1> per page.",
        code: "<h1>Primary Page Topic</h1>",
      },
      homepage.url,
    );
  }
}
