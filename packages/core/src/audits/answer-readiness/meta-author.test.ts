import { describe, it, expect } from "vitest";
import { MetaAuthorAudit } from "./meta-author";
import { weightForGrade } from "#core/scorer";
import { AuditMetaSchema } from "#core/schemas";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import {
  AuditTier,
  CheckStatus,
  EvidenceGrade,
  NoticeKind,
  PageType,
  ScoreDisplayMode,
} from "#core/types";

const doc = (head: string) =>
  `<html lang="en"><head>${head}</head><body></body></html>`;

describe("MetaAuthorAudit", () => {
  const audit = new MetaAuthorAudit();

  // `author` is a live HTML metadata name that Google never supported, so
  // nothing was withdrawn: the tag is reported with an unconsumed notice and
  // never costs anything.
  it("passes and says no AI vendor reads the tag when author meta is set", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/post",
        doc('<meta name="author" content="Jane Smith">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
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
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("1 page(s)");
  });

  // The tag is usually site-wide, so a homepage-only tag must be seen.
  it("runs on every page type", () => {
    expect(MetaAuthorAudit.meta.applicablePageTypes).toBeUndefined();
    const page = mockPageContext(
      "https://example.com/",
      doc('<meta name="author" content="Jane Smith">'),
    );
    const result = audit.audit(
      mockCheckContext([{ ...page, pageType: PageType.Homepage }]),
    );
    expect(result.status).toBe(CheckStatus.Pass);
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

  it("is an informative grade-C audit with an unconsumed notice", () => {
    const { meta } = MetaAuthorAudit;
    expect(meta.tier).toBe(AuditTier.Informative);
    expect(meta.evidenceGrade).toBe(EvidenceGrade.C);
    expect(meta.weight).toBe(
      weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    );
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
    expect(meta.deprecated?.kind).toBe(NoticeKind.Unconsumed);
    expect(meta.deprecated?.link).toBe(
      "https://developers.google.com/search/docs/crawling-indexing/special-tags",
    );
    expect(AuditMetaSchema.safeParse(meta).success).toBe(true);
  });
});
