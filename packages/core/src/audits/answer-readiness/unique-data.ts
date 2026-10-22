import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { CheckContext } from "#core/check-context";
import { readerText } from "#core/dom-visibility";
import { inReaderContent } from "#core/page-chrome";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

// Conservative English research context. Numeric matches alone, especially
// prices and discounts, do not prove statistics or originality.
const CONTEXT =
  /\b(?:surveys?|stud(?:y|ies)|research(?:ers)?|benchmarks?|respondents|participants|sampled|measured)\b/i;
// Marketing claims reuse the percent sign: "100% satisfaction guaranteed",
// "30% off", "100% cotton". A figure followed by one of these words is a
// claim about the offer, not a measurement.
const CLAIM_AFTER =
  /^\s*(?:satisfaction|guarantee[ds]?|money[- ]back|off|discount|cotton|wool|linen|natural|organic|recycled|pure|free)\b/i;
const FIGURE =
  /\b\d+(?:[.,]\d+)?\s?%|\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:[.,]\d+)?\s+(?:respondents|participants|users|requests)\b/gi;

export class UniqueDataAudit extends Audit {
  static override meta: AuditMeta = {
    id: "answer-readiness/unique-data",
    category: "answer-readiness",
    title: "Statistics in research context",
    failureTitle: "Statistics in research context",
    description:
      "Reports numerical figures in paragraphs with explicit research or measurement context. This does not establish originality, accuracy or citation value.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/answer-readiness/unique-data.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Studies of adding relevant statistics do not validate counting arbitrary numbers or prices. This observation carries no score weight and does not prove original research.",
      fix: "Report measured results when relevant. Include the source, population and method. Do not invent statistics or add numbers to meet a quota.",
      code: "<p>Results from our 2024 survey of 1,200 developers show that 73% prefer structured APIs, with an average integration time of 2.5 hours.</p>",
      effort: FixEffort.Easy,
      tags: ["content-quality", "data", "generative-engine"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const figures = new Set<string>();
    let relevant = 0;
    for (const page of ctx.pages) {
      const $ = page.$;
      let observed = false;
      $("p").each((_, el) => {
        // The raw text is tested first so only paragraphs with a research
        // word pay for the ancestor walks.
        if (!CONTEXT.test($(el).text())) return;
        if (!inReaderContent($, el)) return;
        const text = readerText($, el).replace(/\s+/g, " ").trim();
        if (!CONTEXT.test(text)) return;
        const withoutPrices = text.replace(
          /[$€£]\s?\d[\d.,\u00a0\u202f]*|\d[\d.,\u00a0\u202f]*\s?[$€£]/g,
          "",
        );
        const matches = [...withoutPrices.matchAll(FIGURE)]
          .filter(
            (m) =>
              !CLAIM_AFTER.test(withoutPrices.slice(m.index + m[0].length)),
          )
          .map((m) => m[0]);
        if (!matches.length) return;
        observed = true;
        for (const match of matches) figures.add(match);
      });
      if (observed) relevant++;
    }
    const expected =
      "Relevant measured statistics with context; no numeric quota or originality inference";
    if (!relevant)
      return this.notApplicable(
        "No contextual research figures detected; no statistics obligation is established.",
        expected,
        "No contextual research figures",
      );
    return this.pass(
      `Observed numerical figures in research context on ${relevant} page(s). Originality and accuracy are not verified.`,
      expected,
      `Examples: ${[...figures].sort().slice(0, 5).join(", ")}`,
    );
  }
}
