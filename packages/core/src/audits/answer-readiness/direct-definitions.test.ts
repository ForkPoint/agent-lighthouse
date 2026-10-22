import { describe, it, expect } from "vitest";
import { DirectDefinitionsAudit } from "./direct-definitions";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { runAudits } from "#core/audit-runner";
import { buildScanEvidence } from "#core/scan-evidence";
import type { PageContext } from "#core/check-context";
import type { ScanConfig } from "#core/audit-config";
import { CheckResultSchema } from "#core/schemas";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import {
  AuditTier,
  CheckStatus,
  EvidenceGrade,
  PageType,
  PageTypeSource,
  CoverageProvenance,
  ScoreDisplayMode,
} from "#core/types";

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
      expect(result.status).toBe(CheckStatus.NotApplicable);
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
      expect(result.status).not.toBe(CheckStatus.NotApplicable);
    });

    it("reads intent from a glossary heading", () => {
      const result = audit.audit(
        mockCheckContext([
          page("<h1>Glossary</h1><p>Terms we use across the docs.</p>"),
        ]),
      );
      expect(result.status).not.toBe(CheckStatus.NotApplicable);
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
      expect(result.status).toBe(CheckStatus.Pass);
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
        expect(result.status, `${lang} intent`).not.toBe(
          CheckStatus.NotApplicable,
        );
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
      expect(result.status).toBe(CheckStatus.Pass);
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
      expect(result.status).toBe(CheckStatus.Warn);
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
      expect(result.status).toBe(CheckStatus.Pass);
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
      expect(result.status).toBe(CheckStatus.Pass);
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
      expect(result.status).toBe(CheckStatus.Warn);
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
      expect(result.status).not.toBe(CheckStatus.Pass);
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
      expect(result.status).toBe(CheckStatus.Warn);
      expect(result.message).toContain("prose");
    });

    it("never returns fail", () => {
      const inputs = [
        "<h1>Glossary</h1><p>Nothing but words here, with no definition pattern at all.</p>",
        "<h1>What is X?</h1><p>Short.</p>",
      ];
      for (const html of inputs) {
        expect(audit.audit(mockCheckContext([page(html)])).status).not.toBe(
          CheckStatus.Fail,
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
      expect(result.status).toBe(CheckStatus.Warn);
      expect(result.found).toContain("1 of 2");
    });
  });

  describe("meta contract", () => {
    const meta = DirectDefinitionsAudit.meta;

    it("is grade C, informative, weight 0", () => {
      expect(meta.id).toBe("answer-readiness/direct-definitions");
      expect(meta.evidenceGrade).toBe(EvidenceGrade.C);
      expect(meta.tier).toBe(AuditTier.Informative);
      expect(meta.weight).toBe(0);
      expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
    });
  });
});

const definition =
  "<h1>Glossary</h1><dl><dt>RAG</dt><dd>Retrieval-augmented generation grounds generated answers in retrieved sources.</dd></dl>";
const specification =
  "<h1>Chair specifications</h1><dl><dt>Material</dt><dd>Solid oak with a durable hand-applied natural finish.</dd><dt>Weight</dt><dd>200g</dd></dl>";
const runnerConfig: ScanConfig = {
  categories: [{ id: "answer-readiness", name: "Answer", weight: 1 }],
  audits: {
    "answer-readiness": [
      {
        meta: DirectDefinitionsAudit.meta,
        create: () => new DirectDefinitionsAudit(),
      },
    ],
  },
};
const scopedPage = (
  body: string,
  type: PageType,
  source: PageTypeSource,
  name = "page",
) => {
  const p = page(
    body + "<p>" + "Readable page content. ".repeat(60) + "</p>",
    "en",
    `https://example.com/${name}`,
  );
  p.pageType = type;
  p.pageTypeSource = source;
  return p;
};
const run = async (pages: PageContext[]) => {
  const ctx = mockCheckContext(pages);
  ctx.evidence = buildScanEvidence({
    requestedUrl: pages[0]!.url,
    homepageResult: pages[0]!.fetchResult,
    pages,
    rootFiles: {},
    wafProtection: null,
  });
  return runAudits(ctx, runnerConfig);
};

describe("definition feature scope", () => {
  it.each(Object.values(PageType))(
    "ignores product-style name-value lists on %s",
    (type) => {
      const p = scopedPage(specification, type, PageTypeSource.Declared);
      expect(
        new DirectDefinitionsAudit().audit(mockCheckContext([p])).status,
      ).toBe(CheckStatus.NotApplicable);
    },
  );

  it("does not infer definitions from a bare short description list", () => {
    expect(
      new DirectDefinitionsAudit().audit(
        mockCheckContext([page("<dl><dt>Weight</dt><dd>200g</dd></dl>")]),
      ).status,
    ).toBe(CheckStatus.NotApplicable);
  });

  for (const source of Object.values(PageTypeSource)) {
    describe(source, () => {
      it.each(Object.values(PageType))(
        "assesses definitions on %s without adding score weight",
        async (type) => {
          const result = await run([scopedPage(definition, type, source)]);
          const check = CheckResultSchema.parse(result.checks[0]);
          expect(check.status).toBe(CheckStatus.Pass);
          expect(check.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
          expect(check.weight).toBe(0);
          expect(check.coverage?.provenance).toBe(CoverageProvenance.All);
          expect(result.categories[0]!.assessedMass).toBe(0);
        },
      );
      it.each(Object.values(PageType))(
        "leaves %s pages without definitions not applicable",
        async (type) => {
          const result = await run([
            scopedPage("<h1>Contact us</h1>", type, source),
          ]);
          expect(result.checks[0]!.status).toBe(CheckStatus.NotApplicable);
          expect(result.checks[0]!.tags).not.toContain("skipped:page-type");
          expect(result.checks[0]!.coverage?.provenance).toBe(
            CoverageProvenance.All,
          );
        },
      );
    });
  }

  it("counts only relevant readable pages across mixed types and provenance", async () => {
    const marked = scopedPage(
      definition,
      PageType.Product,
      PageTypeSource.Declared,
      "marked",
    );
    const prose = scopedPage(
      "<h1>What is chunking?</h1><p>Chunking is the process of splitting text into retrievable passages.</p>",
      PageType.Homepage,
      PageTypeSource.Detected,
      "prose",
    );
    const irrelevant = scopedPage(
      specification,
      PageType.Category,
      PageTypeSource.Detected,
      "specs",
    );
    const unread = scopedPage(
      "",
      PageType.Article,
      PageTypeSource.Declared,
      "unread",
    );
    unread.$ = page("").$;
    unread.fetchResult = { ...unread.fetchResult, body: "", status: 503 };
    const result = await run([marked, irrelevant, unread, prose]);
    const check = CheckResultSchema.parse(result.checks[0]);
    expect(check.status).toBe(CheckStatus.Warn);
    expect(check.displayValue).toContain("1 of 2");
    expect(check.coverage?.unreadUrls).toEqual([unread.url]);
    expect(check.coverage?.inputUrls).not.toContain(unread.url);
    expect(check.advisoryResults).toBeUndefined();
    expect(check.weight).toBe(0);
  });
});

describe("DirectDefinitionsAudit intent noise", () => {
  const audit = new DirectDefinitionsAudit();
  it("ignores a glossary heading in the page footer", () => {
    const result = audit.audit(
      mockCheckContext([
        mockPageContext(
          "https://example.com/about",
          '<html lang="en"><body><main><h1>About us</h1><p>We sell furniture.</p></main><footer><h3>Glossary</h3><a href="/glossary">Terms</a></footer></body></html>',
        ),
      ]),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("ignores a hidden definitional heading", () => {
    const result = audit.audit(
      mockCheckContext([page("<h2 hidden>What is X?</h2><p>Body.</p>")]),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it.each([
    ["en", "55-inch High Definition Smart TV"],
    ["en", "Standard-definition webcam"],
    ["es", "Televisor de alta definición"],
    ["fr", "Téléviseur haute définition"],
  ])("treats %s picture-quality wording as no intent", (lang, title) => {
    const result = audit.audit(
      mockCheckContext([
        page(
          `<h1>${title}</h1><dl><dt>Resolution</dt><dd>1920 by 1080 pixels with wide colour gamut support</dd></dl>`,
          lang,
          "https://example.com/products/tv",
        ),
      ]),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("still reads a definitions heading", () => {
    const result = audit.audit(
      mockCheckContext([
        page(
          "<h1>Definitions</h1><p>A widget is a small component that does one job.</p>",
        ),
      ]),
    );
    expect(result.status).not.toBe(CheckStatus.NotApplicable);
  });
});

describe("DirectDefinitionsAudit visibility and scope", () => {
  const audit = new DirectDefinitionsAudit();
  it("ignores a footer <dfn> on a contact page", () => {
    const result = audit.audit(
      mockCheckContext([
        mockPageContext(
          "https://example.com/contact",
          '<html lang="en"><body><main><h1>Contact</h1><p>Call us.</p></main><footer><dfn>ACME</dfn> is a trading name.</footer></body></html>',
        ),
      ]),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("does not count a hidden <dl> on a visible glossary", () => {
    const result = audit.audit(
      mockCheckContext([
        page(
          "<h1>Glossary</h1><dl hidden><dt>Widget</dt><dd>A small component that does exactly one job well.</dd></dl>",
        ),
      ]),
    );
    expect(result.status).toBe(CheckStatus.Warn);
  });

  it("ignores hidden text inside a visible heading", () => {
    const result = audit.audit(
      mockCheckContext([
        page("<h1>About <span hidden>Glossary</span></h1><p>Body.</p>"),
      ]),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });
});

it("ignores display quality: definici\u00f3n est\u00e1ndar", () => {
  const p = mockPageContext(
    "https://example.com/page",
    "<html lang=es><body><h1>definici\u00f3n est\u00e1ndar</h1></body></html>",
  );
  expect(new DirectDefinitionsAudit().audit(mockCheckContext([p])).status).toBe(
    CheckStatus.NotApplicable,
  );
});

it("ignores display quality: d\u00e9finition standard", () => {
  const p = mockPageContext(
    "https://example.com/page",
    "<html lang=fr><body><h1>d\u00e9finition standard</h1></body></html>",
  );
  expect(new DirectDefinitionsAudit().audit(mockCheckContext([p])).status).toBe(
    CheckStatus.NotApplicable,
  );
});

it("ignores display quality: defini\u00e7\u00e3o padr\u00e3o", () => {
  const p = mockPageContext(
    "https://example.com/page",
    "<html lang=pt><body><h1>defini\u00e7\u00e3o padr\u00e3o</h1></body></html>",
  );
  expect(new DirectDefinitionsAudit().audit(mockCheckContext([p])).status).toBe(
    CheckStatus.NotApplicable,
  );
});

it("ignores display quality: definizione standard", () => {
  const p = mockPageContext(
    "https://example.com/page",
    "<html lang=it><body><h1>definizione standard</h1></body></html>",
  );
  expect(new DirectDefinitionsAudit().audit(mockCheckContext([p])).status).toBe(
    CheckStatus.NotApplicable,
  );
});

it("ignores display quality: Hi-Definition television", () => {
  const p = mockPageContext(
    "https://example.com/page",
    "<html lang=en><body><h1>Hi-Definition television</h1></body></html>",
  );
  expect(new DirectDefinitionsAudit().audit(mockCheckContext([p])).status).toBe(
    CheckStatus.NotApplicable,
  );
});

describe("DirectDefinitionsAudit video-format wording", () => {
  const audit = new DirectDefinitionsAudit();
  it.each(["4K Ultra HD definition", "Definition HD 1080p"])(
    "treats %j as no intent",
    (title) => {
      const result = audit.audit(
        mockCheckContext([
          page(
            `<h1>${title}</h1><p>A bright panel.</p>`,
            "en",
            "https://example.com/products/tv",
          ),
        ]),
      );
      expect(result.status).toBe(CheckStatus.NotApplicable);
    },
  );
});
