import { describe, it, expect } from "vitest";
import { DirectDefinitionsAudit } from "./direct-definitions";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";

const page = (
  body: string,
  lang = "en",
  url = "https://example.com/blog/post",
) =>
  mockPageContext(
    url,
    `<html lang="${lang}"><body><main>${body}</main></body></html>`,
  );

describe("DirectDefinitionsAudit", () => {
  const audit = new DirectDefinitionsAudit();

  it("returns na on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  describe("definitional intent gate", () => {
    it("is na when no page has definitional intent", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            "<h1>Our 2026 roadmap</h1><p>We shipped a lot of things this year.</p>",
          ),
        ]),
      );
      expect(result.status).toBe("na");
      expect(result.message).toContain("definitional intent");
    });

    it('reads intent from a "what is" heading', () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            "<h1>What is retrieval-augmented generation?</h1><p>Some prose here.</p>",
          ),
        ]),
      );
      expect(result.status).not.toBe("na");
    });

    it("reads intent from a glossary heading", () => {
      const result = audit.audit(
        mockCheckContext([
          page("<h1>Glossary</h1><p>Terms we use across the docs.</p>"),
        ]),
      );
      expect(result.status).not.toBe("na");
    });

    it("reads intent structurally from definition markup, whatever the language", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            "<h1>Notizen</h1><p><dfn>Kubernetes</dfn> orchestriert Container.</p>",
            "de",
          ),
        ]),
      );
      expect(result.status).toBe("pass");
    });
  });

  describe("language-neutral detection", () => {
    it("detects intent in each supported language", () => {
      const cases: Array<[string, string]> = [
        ["es", "¿Qué es la generación aumentada por recuperación?"],
        ["fr", "Qu'est-ce que la génération augmentée par récupération ?"],
        ["de", "Was ist Retrieval-Augmented Generation?"],
        ["pt", "O que é geração aumentada por recuperação?"],
        ["ja", "RAGとは"],
        ["zh", "什么是检索增强生成"],
        ["ru", "Что такое поисковая дополненная генерация"],
      ];
      for (const [lang, heading] of cases) {
        const result = audit.audit(
          mockCheckContext([
            page(`<h1>${heading}</h1><p>Body copy.</p>`, lang),
          ]),
        );
        expect(result.status, `${lang} intent`).not.toBe("na");
      }
    });

    // The old audit read CJK sentences as one "word" via split(/\s+/), so a
    // legitimate CJK <dd> could never reach its 6-word threshold.
    it("counts a CJK definition as substantive", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            "<h1>用語集</h1><dl><dt>検索拡張生成</dt><dd>外部の知識を検索して回答を生成する手法のことです。</dd></dl>",
            "ja",
          ),
        ]),
      );
      expect(result.status).toBe("pass");
    });

    it("detects a prose definition in a non-English language", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            "<h1>Was ist Kubernetes?</h1><p>Kubernetes ist ein System für die Orchestrierung von Containern.</p>",
            "de",
          ),
        ]),
      );
      expect(result.status).toBe("warn");
      expect(result.found).toContain("prose");
    });
  });

  describe("explicit definition markup", () => {
    it("passes on <dfn>", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            "<h1>What is unified content preparation?</h1><p><dfn>Unified content preparation</dfn> is the practice of structuring content for agents.</p>",
          ),
        ]),
      );
      expect(result.status).toBe("pass");
      expect(result.found).toContain("<dfn>");
    });

    it("passes on a <dl> with a substantive <dd>", () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<h1>Glossary</h1><dl>
            <dt>Unified Content Preparation</dt>
            <dd>The process of structuring site content for consumption by both humans and AI agents.</dd>
          </dl>`),
        ]),
      );
      expect(result.status).toBe("pass");
      expect(result.found).toContain("<dl>");
    });

    it("does not count a spec-sheet <dl> with fragment values", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            "<h1>What is the X200?</h1><dl><dt>Weight</dt><dd>200g</dd></dl>",
          ),
        ]),
      );
      expect(result.status).toBe("warn");
    });
  });

  describe("the bold-colon branch is gone", () => {
    // Graded D on its own: no spec, no role mapping, no consumer — and every
    // blog post with "<strong>Note:</strong> …" passed on it.
    it("does not count <strong>Note:</strong> as a definition", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            "<h1>What is our refund policy?</h1><p><strong>Note:</strong> this applies to all plans as of March.</p>",
          ),
        ]),
      );
      expect(result.found).not.toContain("bold-colon");
      expect(result.status).not.toBe("pass");
    });

    it("mentions no bold-colon pattern anywhere in its guidance", () => {
      const copy = JSON.stringify(DirectDefinitionsAudit.meta).toLowerCase();
      expect(copy).not.toContain("bold-colon");
      expect(copy).not.toContain("<strong>term:");
    });
  });

  describe("prose definitions are not punished", () => {
    // The direction inversion the code review found: a well-written prose
    // glossary used to FAIL while a spec sheet with a bold label passed.
    it("warns rather than failing on a prose-only definition", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            "<h1>What is unified content preparation?</h1><p>Unified content preparation is the process of structuring site content so both humans and AI agents can consume it.</p>",
          ),
        ]),
      );
      expect(result.status).toBe("warn");
      expect(result.message).toContain("prose");
    });

    it("never returns fail", () => {
      const inputs = [
        "<h1>Glossary</h1><p>Nothing but words here, with no definition pattern at all.</p>",
        "<h1>What is X?</h1><p>Short.</p>",
      ];
      for (const html of inputs) {
        expect(audit.audit(mockCheckContext([page(html)])).status).not.toBe(
          "fail",
        );
      }
    });

    it("warns when only some definitional pages carry markup", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            "<h1>Glossary</h1><dl><dt>RAG</dt><dd>Retrieval-augmented generation, a way to ground answers in sources.</dd></dl>",
          ),
          page(
            "<h1>What is chunking?</h1><p>Chunking is the practice of splitting a document into retrievable passages.</p>",
            "en",
            "https://example.com/blog/chunking",
          ),
        ]),
      );
      expect(result.status).toBe("warn");
      expect(result.found).toContain("1 of 2");
    });
  });

  describe("meta contract", () => {
    const meta = DirectDefinitionsAudit.meta;

    it("is grade C, informative, weight 0", () => {
      expect(meta.id).toBe("answer-readiness/direct-definitions");
      expect(meta.evidenceGrade).toBe("C");
      expect(meta.tier).toBe("informative");
      expect(meta.weight).toBe(0);
      expect(meta.scoreDisplayMode).toBe("informative");
    });
  });
});
