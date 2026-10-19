import { describe, it, expect } from "vitest";
import { HowToSchemaAudit } from "./howto-schema";
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
  PageType,
  ScoreDisplayMode,
} from "#core/types";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (body: string, head = "", url = "https://example.com/guide") =>
  mockPageContext(
    url,
    `<html><head>${head}</head><body>${body}</body></html>`,
    1,
  );

const steps = "<h2>1. First step</h2><h2>2. Second step</h2>";
const howto = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to do X",
  step: [
    { "@type": "HowToStep", name: "First", text: "Do first." },
    { "@type": "HowToStep", name: "Second", text: "Do second." },
  ],
};

describe("HowToSchemaAudit", () => {
  const audit = new HowToSchemaAudit();

  it("warns that How-to rich results are retired when HowTo markup is published", () => {
    const result = audit.audit(mockCheckContext([page(steps, ld(howto))]));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.priority).toBe(CheckPriority.Low);
    expect(result.message).toContain("How-to rich results");
    expect(result.message).toContain("2023");
    expect(result.found).toContain("1 page(s)");
    expect(result.pageUrl).toBe("https://example.com/guide");
  });

  it.each([
    ["inside @graph", { "@context": "https://schema.org", "@graph": [howto] }],
    ["in a top-level array", [howto]],
    ["with an array @type", { ...howto, "@type": ["HowTo", "CreativeWork"] }],
  ])("finds HowTo markup %s", (_label, data) => {
    const result = audit.audit(mockCheckContext([page(steps, ld(data))]));
    expect(result.status).toBe(CheckStatus.Warn);
  });

  it("finds HowTo microdata", () => {
    const micro =
      '<div itemscope itemtype="https://schema.org/HowTo"><span itemprop="name">How to do X</span></div>';
    // The scanner merges microdata into `structuredData`; the mock does not.
    const p = page(micro);
    const result = audit.audit(
      mockCheckContext([{ ...p, structuredData: extractMicrodata(p.$) }]),
    );
    expect(result.status).toBe(CheckStatus.Warn);
  });

  // HowTo markup can sit on any page type, so the audit reads them all.
  it("runs on every page type", () => {
    expect(HowToSchemaAudit.meta.applicablePageTypes).toBeUndefined();
    const product = {
      ...page(steps, ld(howto), "https://example.com/p/1"),
      pageType: PageType.Product,
    };
    expect(audit.audit(mockCheckContext([product])).status).toBe(
      CheckStatus.Warn,
    );
  });

  it("finds HowTo markup on a page without numbered headings", () => {
    const result = audit.audit(mockCheckContext([page("<p>x</p>", ld(howto))]));
    expect(result.status).toBe(CheckStatus.Warn);
  });

  it("counts every page that carries HowTo markup", () => {
    const result = audit.audit(
      mockCheckContext([
        page(steps, ld(howto), "https://example.com/a"),
        page(steps, ld(howto), "https://example.com/b"),
        page(steps, "", "https://example.com/c"),
      ]),
    );
    expect(result.found).toContain("2 page(s)");
  });

  // Numbered steps without markup used to fail: the audit asked owners to add
  // markup for a rich result Google no longer shows. That is now no finding.
  it("is not applicable for numbered steps without HowTo markup", () => {
    expect(audit.audit(mockCheckContext([page(steps)])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  it("is not applicable on a scan that read nothing", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("never fails", () => {
    for (const ctx of [
      mockCheckContext([page(steps)]),
      mockCheckContext([page("<h2>Intro</h2>")]),
      mockCheckContext([page(steps, ld(howto))]),
    ]) {
      expect(audit.audit(ctx).status).not.toBe(CheckStatus.Fail);
    }
  });

  it("is an obsolete-tier audit with an obsolete notice", () => {
    const { meta } = HowToSchemaAudit;
    expect(meta.tier).toBe(AuditTier.Obsolete);
    expect(meta.evidenceGrade).toBe(EvidenceGrade.D);
    expect(meta.weight).toBe(
      weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    );
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
    expect(meta.deprecated?.kind).toBe(NoticeKind.Obsolete);
    expect(AuditMetaSchema.safeParse(meta).success).toBe(true);
  });
});
