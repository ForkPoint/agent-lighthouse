import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";

export class LanguageAttributeAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/language-attribute",
    category: "content-extraction",
    title: "Language attribute",
    failureTitle: "Language attribute",
    description:
      "AI agents use the lang attribute to select the correct language model and tokenizer when processing your content. Without it, agents may misinterpret content language, leading to poor translations or incorrect answers in multilingual AI systems.",
    scoreDisplayMode: "binary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/content-extraction/language-attribute.md",
    // Gate exemption: `<html lang>` is served before any body renders.
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "high",
    guidance: {
      impact:
        "AI agents use the lang attribute to select the correct language model and tokenizer when processing your content. Without it, agents may misinterpret content language, leading to poor translations or incorrect answers in multilingual AI systems.",
      fix: 'Add a lang attribute to the <html> element with the appropriate BCP 47 language code (e.g., "en", "fr", "de", "ja").',
      code: '<html lang="en">',
      effort: "trivial",
      docsUrl:
        "https://www.w3.org/International/questions/qa-html-language-declarations",
      tags: ["meta-tags", "i18n", "html"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const $ = page?.$;
    const lang = $?.("html").attr("lang") ?? "";

    if (lang.trim().length > 0) {
      return this.pass(
        `<html lang="${lang}"> is set.`,
        '<html lang="..."> with a non-empty language code',
        lang,
        page.url,
      );
    }

    return this.fail(
      "No lang attribute on <html> element.",
      '<html lang="..."> with a non-empty language code',
      "Not found",
      {
        priority: "high",
        description:
          "AI agents use the lang attribute to select the correct language model and tokenizer when processing your content. Without it, agents may misinterpret content language, leading to poor translations or incorrect answers in multilingual AI systems.",
        code: '<html lang="en">',
      },
      page?.url,
    );
  }
}
