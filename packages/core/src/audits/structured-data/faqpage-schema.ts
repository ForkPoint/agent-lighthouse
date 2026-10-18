import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext, PageContext } from "#core/check-context";
import { weightForGrade } from "#core/scorer";
import { flattenJsonLd } from "#core/parser";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

function matchesType(schema: Record<string, unknown>, type: string): boolean {
  const t = schema["@type"];
  if (typeof t === "string") return t === type;
  if (Array.isArray(t)) return t.includes(type);
  return false;
}

/** True when the page's structured data carries an FAQPage node. */
function hasFaqPage(page: PageContext): boolean {
  return flattenJsonLd(page.structuredData ?? page.jsonLd).some((node) =>
    matchesType(node as Record<string, unknown>, "FAQPage"),
  );
}

const SOURCE_URL = "https://developers.google.com/search/updates";

export class FaqPageSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: "structured-data/faqpage-schema",
    category: "structured-data",
    // An obsolete audit speaks only when the owner still publishes the
    // markup, so both titles describe the markup.
    title: "FAQPage schema (retired rich result)",
    failureTitle: "FAQPage markup for a retired rich result is published",
    description:
      "Reports FAQPage structured data still published on sampled pages. Google restricted FAQ rich results to government and health sites in 2023 and stopped showing them on 2026-05-07, and no AI vendor documents reading FAQPage markup. The visible questions and answers still help readers and agents; `answer-readiness/faq-sections` checks those.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    evidenceGrade: EvidenceGrade.D,
    tier: AuditTier.Obsolete,
    deprecated: {
      kind: NoticeKind.Obsolete,
      notice:
        "Google stopped showing FAQ rich results on 2026-05-07, and no AI vendor documents reading FAQPage markup. The markup does no harm.",
      link: SOURCE_URL,
      replacement:
        "Keep the questions and answers visible on the page (answer-readiness/faq-sections). The markup itself is optional.",
    },
    dossier: "docs/evidence/audits/structured-data/faqpage-schema.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "None for search or AI visibility. Google no longer shows FAQ rich results and no AI vendor documents reading FAQPage markup. The visible Q&A content is what still counts.",
      fix: "Nothing is required. Removing the FAQPage markup is optional; Google says unused structured data causes no problems. Keep the questions and answers visible in the page text.",
      effort: FixEffort.Trivial,
      docsUrl: SOURCE_URL,
      tags: ["json-ld", "schema", "faq", "obsolete"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected =
      "No FAQPage markup is needed: Google retired the FAQ rich result in 2026";
    const pages = ctx.pages.filter(hasFaqPage);

    // Absent artifact, absent verdict. The obsolete tier speaks only about
    // markup the owner still publishes; question headings without markup are
    // no longer a finding.
    if (pages.length === 0) {
      return this.notApplicable(
        "No sampled page publishes FAQPage markup, so there is nothing to retire.",
        expected,
        "No FAQPage markup found",
      );
    }

    return this.warn(
      "FAQPage markup is published. Google stopped showing FAQ rich results on 2026-05-07, and no AI vendor documents reading FAQPage markup. It does no harm; removal is optional. Keep the questions and answers visible on the page, which is what still helps readers and agents.",
      expected,
      `FAQPage markup on ${pages.length} page(s)`,
      CheckPriority.Low,
      pages[0]!.url,
    );
  }
}
