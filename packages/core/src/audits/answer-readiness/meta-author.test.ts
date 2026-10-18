import { describe, it, expect } from "vitest";
import { MetaAuthorAudit } from "./meta-author";
import { weightForGrade } from "#core/scorer";
import { AuditMetaSchema } from "#core/schemas";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import {
  AuditTier,
  CheckPriority,
  CheckStatus,
  EvidenceGrade,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

const doc = (head: string) =>
  `<html lang="en"><head>${head}</head><body></body></html>`;

describe("MetaAuthorAudit", () => {
  const audit = new MetaAuthorAudit();

  it("warns that Google ignores the tag when author meta is set", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/post",
        doc('<meta name="author" content="Jane Smith">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.priority).toBe(CheckPriority.Low);
    expect(result.message).toContain("Google ignores");
    expect(result.message).toContain("schema.org");
    expect(result.found).toContain("Jane Smith");
    expect(result.pageUrl).toBe("https://example.com/post");
  });

  it("reports the tag on any sampled page, not only the first", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/a", doc("")),
      mockPageContext(
        "https://example.com/b",
        doc('<meta name="author" content="Jane Smith">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("1 page(s)");
  });

  // A missing tag used to fail at medium priority. Nothing reads the tag, so
  // its absence is no finding.
  it("is not applicable when no page sets author meta", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", doc("")),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.NotApplicable);
  });

  it("is not applicable on a scan that read nothing", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is an obsolete-tier audit with an obsolete notice", () => {
    const { meta } = MetaAuthorAudit;
    expect(meta.tier).toBe(AuditTier.Obsolete);
    expect(meta.evidenceGrade).toBe(EvidenceGrade.D);
    expect(meta.weight).toBe(
      weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    );
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
    expect(meta.deprecated?.kind).toBe(NoticeKind.Obsolete);
    expect(meta.deprecated?.link).toBe(
      "https://developers.google.com/search/docs/crawling-indexing/special-tags",
    );
    expect(AuditMetaSchema.safeParse(meta).success).toBe(true);
  });
});
