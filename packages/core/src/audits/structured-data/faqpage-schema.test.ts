import { describe, it, expect } from "vitest";
import { FaqPageSchemaAudit } from "./faqpage-schema";
import { weightForGrade } from "#core/scorer";
import { AuditMetaSchema } from "#core/schemas";
import { mockPageContext, mockCheckContext } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import { extractMicrodata } from "#core/parser";
import {
  AuditTier,
  CheckPriority,
  CheckStatus,
  EvidenceGrade,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (body: string, head = "", url = "https://example.com/faq") =>
  mockPageContext(url, `<html><head>${head}</head><body>${body}</body></html>`);

const questions = "<h2>What is your return policy?</h2><p>30 days.</p>";
const faq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is your return policy?",
      acceptedAnswer: { "@type": "Answer", text: "30 days." },
    },
  ],
};

describe("FaqPageSchemaAudit", () => {
  const audit = new FaqPageSchemaAudit();

  it("warns that FAQ rich results are retired when FAQPage markup is published", () => {
    const result = audit.audit(mockCheckContext([page(questions, ld(faq))]));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.priority).toBe(CheckPriority.Low);
    expect(result.message).toContain("FAQ rich results");
    expect(result.message).toContain("2026");
    // Visible Q&A is still useful; only the markup lost its consumer.
    expect(result.message).toContain("visible");
    expect(result.found).toContain("1 page(s)");
    expect(result.pageUrl).toBe("https://example.com/faq");
  });

  it.each([
    ["inside @graph", { "@context": "https://schema.org", "@graph": [faq] }],
    ["in a top-level array", [faq]],
    ["with an array @type", { ...faq, "@type": ["FAQPage", "WebPage"] }],
  ])("finds FAQPage markup %s", (_label, data) => {
    const result = audit.audit(mockCheckContext([page(questions, ld(data))]));
    expect(result.status).toBe(CheckStatus.Warn);
  });

  it("finds FAQPage microdata", () => {
    const micro =
      '<div itemscope itemtype="https://schema.org/FAQPage"><div itemprop="mainEntity" itemscope itemtype="https://schema.org/Question"><span itemprop="name">Q?</span></div></div>';
    // The scanner merges microdata into `structuredData`; the mock does not.
    const p = page(micro);
    const result = audit.audit(
      mockCheckContext([{ ...p, structuredData: extractMicrodata(p.$) }]),
    );
    expect(result.status).toBe(CheckStatus.Warn);
  });

  it("is not applicable for question headings without FAQPage markup", () => {
    expect(audit.audit(mockCheckContext([page(questions)])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  it("is not applicable on a scan that read nothing", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("never fails", () => {
    for (const ctx of [
      mockCheckContext([page(questions)]),
      mockCheckContext([page("<h2>About</h2>")]),
      mockCheckContext([page(questions, ld(faq))]),
    ]) {
      expect(audit.audit(ctx).status).not.toBe(CheckStatus.Fail);
    }
  });

  it("is an obsolete-tier audit whose notice points to visible Q&A", () => {
    const { meta } = FaqPageSchemaAudit;
    expect(meta.tier).toBe(AuditTier.Obsolete);
    expect(meta.evidenceGrade).toBe(EvidenceGrade.D);
    expect(meta.weight).toBe(
      weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    );
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
    expect(meta.deprecated?.kind).toBe(NoticeKind.Obsolete);
    expect(meta.deprecated?.replacement).toContain("faq-sections");
    expect(AuditMetaSchema.safeParse(meta).success).toBe(true);
  });
});
