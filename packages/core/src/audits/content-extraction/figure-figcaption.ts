import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { extractImages } from "../../parser";
import { weightForGrade } from "../../scorer";
import { scanReadPageText, unreadPageTextReason } from "../../scan-evidence";

export class FigureFigcaptionAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/figure-figcaption",
    category: "content-extraction",
    title: "<figure> + <figcaption> usage",
    failureTitle: "<figure> + <figcaption> usage",
    description:
      "AI agents use <figcaption> to understand the purpose and context of figures beyond what alt text provides. Without captions, agents treat figures as opaque image containers with no semantic meaning, missing opportunities to cite your visual data in AI-generated answers.",
    scoreDisplayMode: "informative",
    weight: weightForGrade("C", "informative"),
    evidenceGrade: "C",
    tier: "informative",
    dossier: "docs/evidence/audits/content-extraction/figure-figcaption.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "medium",
    guidance: {
      impact:
        "AI agents use <figcaption> to understand the purpose and context of visual content beyond what alt text provides. Without captions, figures are treated as opaque image containers, and your charts, diagrams, and illustrations cannot be meaningfully cited in AI-generated answers.",
      fix: "Wrap images, charts, diagrams, and code examples in <figure> elements. Add a descriptive <figcaption> that explains the significance of the visual content -- not just what it shows, but why it matters in context.",
      code: '<figure>\n  <img src="sales-chart.png" alt="Bar chart showing quarterly sales">\n  <figcaption>Figure 1: Sales increased 40% year-over-year in Q4 2024, driven by the new product launch.</figcaption>\n</figure>',
      effort: "easy",
      docsUrl:
        "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/figure",
      tags: ["images", "figures", "captions", "semantic", "html"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let totalFigures = 0;
    let figuresWithCaption = 0;

    for (const page of ctx.pages) {
      const $ = page.$;
      $("figure").each((_, el) => {
        totalFigures++;
        if ($(el).find("figcaption").length > 0) {
          figuresWithCaption++;
        }
      });
    }

    if (totalFigures === 0) {
      // Check if there are images that could benefit from figure/figcaption
      let totalImages = 0;
      for (const page of ctx.pages) {
        totalImages += extractImages(page.$).length;
      }

      if (totalImages > 0) {
        return this.warn(
          `No <figure> elements found, but ${totalImages} image(s) exist that could benefit from <figure>/<figcaption>.`,
          "Images with context wrapped in <figure> with <figcaption>",
          "No <figure> elements",
          {
            priority: "low",
            description:
              "AI agents use <figcaption> to understand the context and purpose of images beyond what alt text provides. Wrapping images in <figure> with <figcaption> gives agents a richer description that can be cited in AI-generated explanations.",
            code: '<figure>\n  <img src="chart.png" alt="Sales growth chart">\n  <figcaption>Figure 1: Sales grew 40% year-over-year in Q4 2024.</figcaption>\n</figure>',
          },
        );
      }

      // No images and no figures on a page that served no text means the
      // markup never arrived, not that the site publishes uncaptioned nothing.
      if (!scanReadPageText(ctx.evidence)) {
        return this.notApplicable(
          "The scanned page served no readable text, so it held no images or figures to judge.",
          "Images with context wrapped in <figure> with <figcaption>",
          unreadPageTextReason(ctx.evidence),
        );
      }

      return this.pass(
        "No images or <figure> elements found — check not applicable.",
        "Images with context wrapped in <figure> with <figcaption>",
        "No <figure> elements",
      );
    }

    const allHaveCaptions = figuresWithCaption === totalFigures;
    const majorityHaveCaptions = figuresWithCaption > totalFigures / 2;

    if (allHaveCaptions) {
      return this.pass(
        `All ${totalFigures} <figure> element(s) have <figcaption>.`,
        "All <figure> elements have a <figcaption>",
        `${figuresWithCaption}/${totalFigures} figures with captions`,
      );
    }

    if (majorityHaveCaptions) {
      return this.warn(
        `${figuresWithCaption}/${totalFigures} <figure> element(s) have <figcaption>.`,
        "All <figure> elements have a <figcaption>",
        `${figuresWithCaption}/${totalFigures} figures with captions`,
        {
          priority: "medium",
          description:
            "AI agents use <figcaption> to understand the purpose and context of figures beyond what alt text provides. Without captions, agents treat figures as opaque image containers with no semantic meaning, missing opportunities to cite your visual data in AI-generated answers.",
          code: '<figure>\n  <img src="diagram.png" alt="Architecture diagram">\n  <figcaption>System architecture showing the three main components.</figcaption>\n</figure>',
        },
      );
    }

    return this.fail(
      `${figuresWithCaption}/${totalFigures} <figure> element(s) have <figcaption>.`,
      "All <figure> elements have a <figcaption>",
      `${figuresWithCaption}/${totalFigures} figures with captions`,
      {
        priority: "medium",
        description:
          "AI agents use <figcaption> to understand the purpose and context of figures beyond what alt text provides. Without captions, agents treat figures as opaque image containers with no semantic meaning, missing opportunities to cite your visual data in AI-generated answers.",
        code: '<figure>\n  <img src="diagram.png" alt="Architecture diagram">\n  <figcaption>System architecture showing the three main components.</figcaption>\n</figure>',
      },
    );
  }
}
