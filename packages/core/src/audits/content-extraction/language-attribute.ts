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

export class LanguageAttributeAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/language-attribute",
    category: "content-extraction",
    title: "Language attribute",
    failureTitle: "Language attribute",
    description:
      "Checks that every scanned page declares its language with a non-empty lang attribute on <html>. Screen readers use the declared language to select pronunciation rules. This check measures presence, not language-tag validity or agreement with the page text.",
    scoreDisplayMode: ScoreDisplayMode.Binary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/content-extraction/language-attribute.md",
    // Gate exemption: `<html lang>` is served before any body renders.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "Screen readers use the declared page language to select pronunciation rules. A missing declaration leaves the page's language unspecified for these consumers.",
      fix: 'Add a lang attribute to the <html> element with the appropriate BCP 47 language code (e.g., "en", "fr", "de", "ja").',
      code: '<html lang="en">',
      effort: FixEffort.Trivial,
      docsUrl:
        "https://www.w3.org/International/questions/qa-html-language-declarations",
      tags: ["meta-tags", "i18n", "html"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected = 'A non-empty <html lang="..."> on every scanned page';
    const { judged, failures } = judgePages(ctx.pages, (page) => ({
      ok: (page.$("html").attr("lang") ?? "").trim().length > 0,
    }));
    if (judged.length === 0) {
      return this.notApplicable(
        "No pages available to check for a language declaration.",
        expected,
        "No pages scanned",
      );
    }

    const coverage = `${judged.length - failures.length}/${judged.length} pages with a non-empty lang attribute`;
    if (failures.length === 0) {
      const onlyPage = judged.length === 1 ? judged[0]!.page : undefined;
      return this.validate(
        this.pass(
          onlyPage
            ? `<html lang="${onlyPage.$("html").attr("lang")}"> is set.`
            : "Every scanned page declares a non-empty lang attribute.",
          expected,
          coverage,
          onlyPage?.url,
        ),
      );
    }

    const missingUrls = failures.map(({ page }) => page.url).sort();
    return this.validate(
      this.fail(
        judged.length === 1
          ? "No lang attribute with a non-empty value on <html> element."
          : `${failures.length}/${judged.length} scanned pages lack a non-empty lang attribute.`,
        expected,
        `${coverage}. Missing or blank declarations: ${missingUrls.join(", ")}`,
        {
          priority: CheckPriority.High,
          description: LanguageAttributeAudit.meta.guidance!.impact,
          code: '<html lang="en">',
        },
        missingUrls[0],
      ),
    );
  }
}
