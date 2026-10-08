import { describe, it, expect } from "vitest";
import { SpeakableSchemaAudit } from "./speakable-schema";
import { mockPageContext, mockCheckContext } from "../../__tests__/test-utils";
import {
  AuditTier,
  CheckStatus,
  EvidenceGrade,
  PageType,
  ScoreDisplayMode,
} from "../../types";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

/** A homepage (index 0, path `/`) — never a news/article page on its own. */
const homepage = (head: string) =>
  mockPageContext(
    "https://example.com/",
    `<html><head>${head}</head><body></body></html>`,
    0,
  );

/** A non-first page under /news/ classifies as `content`, the news/article page type. */
const newsPage = (head: string, path = "https://example.com/news/story") =>
  mockPageContext(path, `<html><head>${head}</head><body></body></html>`, 1);

const speakableSpec = {
  "@type": "SpeakableSpecification",
  cssSelector: [".headline", ".summary"],
};

const newsArticle = (extra: Record<string, unknown> = {}) => ({
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  headline: "A Story",
  ...extra,
});

describe("SpeakableSchemaAudit", () => {
  const audit = new SpeakableSchemaAudit();

  describe("meta", () => {
    it("is gated to news/article page types", () => {
      expect(SpeakableSchemaAudit.meta.applicablePageTypes).toEqual([
        PageType.Article,
      ]);
    });

    // Re-graded A -> B on 2026-08-24: Google's speakable page is live and still
    // names Google Assistant, but calls the feature "in beta and subject to
    // change" and scopes it to U.S. English Google Home users and
    // English-language news publishers.
    it("carries grade B / tier scored / weight 0.6", () => {
      expect(SpeakableSchemaAudit.meta.evidenceGrade).toBe(EvidenceGrade.B);
      expect(SpeakableSchemaAudit.meta.tier).toBe(AuditTier.Scored);
      expect(SpeakableSchemaAudit.meta.weight).toBe(0.6);
      expect(SpeakableSchemaAudit.meta.scoreDisplayMode).toBe(
        ScoreDisplayMode.Ternary,
      );
    });

    it("never claims Alexa or Siri consume speakable", () => {
      const meta = SpeakableSchemaAudit.meta;
      const copy = [
        meta.description,
        meta.guidance?.impact ?? "",
        meta.guidance?.fix ?? "",
        meta.guidance?.code ?? "",
        (meta.guidance?.tags ?? []).join(" "),
      ].join(" ");
      expect(copy).not.toMatch(/alexa/i);
      expect(copy).not.toMatch(/siri/i);
      expect(copy).toMatch(/Google Assistant/);
    });
  });

  describe("applicability gate", () => {
    it("is not applicable when no news/article page was scanned", () => {
      const ctx = mockCheckContext([]);
      const result = audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.NotApplicable);
      expect(result.message).toContain("No news or article page");
    });

    it("is not applicable for a product page with no article content", () => {
      const ctx = mockCheckContext([]);
      expect(audit.audit(ctx).status).toBe(CheckStatus.NotApplicable);
    });

    it("brings a non-content page into scope when it carries Article markup", () => {
      const ctx = mockCheckContext([
        homepage(ld(newsArticle({ speakable: speakableSpec }))),
      ]);
      expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
    });
  });

  describe("detection", () => {
    it("passes when a news page carries speakable with a cssSelector array", () => {
      const ctx = mockCheckContext([
        newsPage(ld(newsArticle({ speakable: speakableSpec }))),
      ]);
      const result = audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.Pass);
      expect(result.message).toContain("1 of 1");
    });

    it("accepts a single-string cssSelector (schema.org permits it)", () => {
      const ctx = mockCheckContext([
        newsPage(
          ld(
            newsArticle({
              speakable: {
                "@type": "SpeakableSpecification",
                cssSelector: ".article-body",
              },
            }),
          ),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
    });

    it("accepts xpath as the alternative selector property", () => {
      const ctx = mockCheckContext([
        newsPage(
          ld(
            newsArticle({
              speakable: {
                "@type": "SpeakableSpecification",
                xpath: ["/html/head/title"],
              },
            }),
          ),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
    });

    it("accepts an array of SpeakableSpecification nodes", () => {
      const ctx = mockCheckContext([
        newsPage(
          ld(
            newsArticle({
              speakable: [
                { "@type": "SpeakableSpecification" },
                {
                  "@type": "SpeakableSpecification",
                  cssSelector: [".headline"],
                },
              ],
            }),
          ),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
    });

    it("detects speakable on a node nested inside @graph", () => {
      const ctx = mockCheckContext([
        newsPage(
          ld({
            "@context": "https://schema.org",
            "@graph": [
              { "@type": "Organization", name: "Acme" },
              { "@type": "Article", headline: "X", speakable: speakableSpec },
            ],
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
    });

    it("accepts speakable on a WebPage node", () => {
      const ctx = mockCheckContext([
        newsPage(
          ld({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Story",
            speakable: speakableSpec,
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
    });

    it("accepts an array @type that includes an eligible host type", () => {
      const ctx = mockCheckContext([
        newsPage(
          ld({
            "@context": "https://schema.org",
            "@type": ["CreativeWork", "NewsArticle"],
            headline: "X",
            speakable: speakableSpec,
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
    });
  });

  describe("rejection", () => {
    it("fails when an article page carries no speakable at all", () => {
      const ctx = mockCheckContext([newsPage(ld(newsArticle()))]);
      const result = audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.Fail);
      expect(result.message).toContain("No speakable");
    });

    it("fails when speakable sits on a host type that does not define it", () => {
      const ctx = mockCheckContext([
        newsPage(
          ld({
            "@context": "https://schema.org",
            "@graph": [
              { "@type": "NewsArticle", headline: "X" },
              {
                "@type": "Organization",
                name: "Acme",
                speakable: speakableSpec,
              },
            ],
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe(CheckStatus.Fail);
    });

    it("fails when SpeakableSpecification carries no selector at all", () => {
      const ctx = mockCheckContext([
        newsPage(
          ld(newsArticle({ speakable: { "@type": "SpeakableSpecification" } })),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe(CheckStatus.Fail);
    });

    it("fails when the selector is an empty string", () => {
      const ctx = mockCheckContext([
        newsPage(
          ld(
            newsArticle({
              speakable: {
                "@type": "SpeakableSpecification",
                cssSelector: "  ",
              },
            }),
          ),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe(CheckStatus.Fail);
    });
  });

  describe("coverage", () => {
    it("warns when only some article pages carry speakable", () => {
      const ctx = mockCheckContext([
        newsPage(
          ld(newsArticle({ speakable: speakableSpec })),
          "https://example.com/news/one",
        ),
        newsPage(ld(newsArticle()), "https://example.com/news/two"),
      ]);
      const result = audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.Warn);
      expect(result.message).toContain("1 of 2");
    });

    it("passes when every article page carries speakable", () => {
      const ctx = mockCheckContext([
        newsPage(
          ld(newsArticle({ speakable: speakableSpec })),
          "https://example.com/news/one",
        ),
        newsPage(
          ld(newsArticle({ speakable: speakableSpec })),
          "https://example.com/news/two",
        ),
      ]);
      const result = audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.Pass);
      expect(result.message).toContain("2 of 2");
    });
  });
});
