import { describe, expect, it } from "vitest";
import { ScanConditionsSchema } from "#core/schemas";
import {
  classifyPage,
  declaredPageClassification,
  detectPageType,
  extractJsonLd,
  extractMetaTags,
  extractMicrodata,
  extractRdfa,
  parseHtml,
} from "#core/parser";
import { planAudits, scopeAudit } from "#core/audit-runner";
import { ArticleSchemaAudit } from "#core/audits/structured-data/article-schema";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import {
  ClassificationConfidence,
  PageType,
  PageTypeSource,
} from "#core/types";

const prose =
  "This guide explains how to maintain a reusable widget and check each part before use. ".repeat(
    12,
  );
const classify = (url: string, html: string, first = true) => {
  const $ = parseHtml(html);
  return detectPageType(url, $, extractJsonLd($), extractMetaTags($), first);
};

describe("page purpose", () => {
  it.each([
    "privacy",
    "contact",
    "account",
    "docs/setup",
    "blog",
    "articles/example",
  ])("does not assume /%s is an article", (path) => {
    expect(
      classify(
        `https://example.com/${path}`,
        `<main><h1>Information</h1><p>${prose}</p></main>`,
      ),
    ).toBe("unknown");
  });

  it("recognizes an article without Article schema", () => {
    expect(
      classify(
        "https://example.com/guide",
        `<meta property="og:type" content="article"><main><h1>Guide</h1><p>${prose}</p></main>`,
      ),
    ).toBe("article");
  });

  it("recognizes a primary article without dates or author metadata", () => {
    expect(
      classify(
        "https://example.com/guide",
        `<main><article><h1>Guide</h1><p>${prose}</p><p>${prose}</p></article></main>`,
      ),
    ).toBe("article");
  });

  it("does not mistake article cards for the primary article", () => {
    expect(
      classify(
        "https://example.com/news",
        `<main><h1>News</h1><article><h2>One</h2><p>Preview</p></article><article><h2>Two</h2><p>Preview</p></article></main>`,
      ),
    ).toBe("unknown");
  });

  it("does not mistake related Article schema for the page purpose", () => {
    expect(
      classify(
        "https://example.com/privacy",
        `<script type="application/ld+json">{"@type":"WebPage","subjectOf":{"@type":"Article"}}</script><main><h1>Privacy</h1><p>${prose}</p></main>`,
      ),
    ).toBe("unknown");
  });

  it("keeps conflicting primary article and product signals uncertain", () => {
    expect(
      classify(
        "https://example.com/guide",
        `<meta property="og:type" content="article"><button data-action="add-to-cart">Buy</button><span data-price="10">10</span><main><h1>Guide</h1><p>${prose}</p></main>`,
      ),
    ).toBe("unknown");
  });

  it.each(["https://example.com/", "https://example.com/docs/"])(
    "keeps homepage identity independent of scan order: %s",
    (url) => {
      const html = `<header><a href="${url}">Home</a></header><main><h1>Home</h1></main>`;
      expect([classify(url, html, true), classify(url, html, false)]).toEqual([
        "homepage",
        "homepage",
      ]);
    },
  );

  it("does not enable Article schema from a generic content override", () => {
    const page = mockPageContext(
      "https://example.com/privacy",
      "<h1>Privacy</h1>",
    );
    page.pageType = PageType.Content;
    page.pageTypeSource = PageTypeSource.Declared;
    expect(
      scopeAudit(mockCheckContext([page]), ArticleSchemaAudit.meta),
    ).toBeNull();
  });
});

describe("audit type aliases", () => {
  const ctx = mockCheckContext([
    mockPageContext("https://example.com/", "<h1>Page</h1>"),
  ]);
  it.each([
    { pageTypes: [], applicablePageTypes: [PageType.Product] },
    { pageTypes: [PageType.Content], applicablePageTypes: [PageType.Product] },
  ])("rejects conflicting aliases: %j", (aliases) => {
    expect(() =>
      scopeAudit(ctx, {
        ...ArticleSchemaAudit.meta,
        ...aliases,
      } as typeof ArticleSchemaAudit.meta),
    ).toThrow(/Conflicting page types/);
  });
});

describe("classification evidence", () => {
  const evidence = (path: string, html: string) => {
    const $ = parseHtml(html);
    return classifyPage(
      `https://example.com${path}`,
      $,
      extractJsonLd($),
      extractMetaTags($),
    );
  };
  it("records URL-only matches as hints", () => {
    expect(evidence("/products/widget", "<h1>Widget</h1>")).toEqual({
      type: "product",
      source: PageTypeSource.Detected,
      confidence: ClassificationConfidence.Hint,
      signals: ["product-url-hint"],
    });
  });
  it("finds a product without Product schema", () => {
    expect(
      evidence(
        "/widget",
        '<button class="add-to-cart">Buy</button><span class="price">10</span>',
      ),
    ).toEqual({
      type: "product",
      source: PageTypeSource.Detected,
      confidence: ClassificationConfidence.Strong,
      signals: ["purchase-controls"],
    });
  });
  it("keeps a product grid with buy controls a listing", () => {
    const card =
      '<div class="product-card"><button class="add-to-cart">Buy</button><span class="price">10</span></div>';
    expect(evidence("/listing", card.repeat(3))).toMatchObject({
      type: "category",
      signals: ["product-grid"],
    });
  });
  const tile = (name: string) =>
    `<div class="product-tile"><a class="product-tile-image" href="/${name}">${name}</a><div class="product-tile-price price">10</div><button class="add-to-cart">Buy</button></div>`;
  it("keeps a product page with a recommendation rail a product", () => {
    const html = `<meta property="og:type" content="product">
      <main><h1>Shirt</h1><span class="price">20</span><button class="add-to-cart-btn">Add</button>
      <div class="filter-size"></div>
      <section class="recentlyViewed"><div class="productcarousel">${["a", "b", "c", "d"].map(tile).join("")}</div>
      <div class="swiper-pagination"></div></section></main>`;
    expect(evidence("/shirt.html", html)).toEqual({
      type: "product",
      source: PageTypeSource.Detected,
      confidence: ClassificationConfidence.Strong,
      signals: ["product-open-graph", "purchase-controls"],
    });
  });
  it("lets the page's own product evidence outrank a grid", () => {
    expect(
      evidence(
        "/shirt",
        `<meta property="og:type" content="product"><main>${["a", "b", "c"].map(tile).join("")}</main>`,
      ),
    ).toMatchObject({ type: "product", signals: ["product-open-graph"] });
  });
  it("counts a card once, not once per part that repeats its class", () => {
    // Two tiles match the card selector six times: still two cards, no grid.
    expect(
      evidence("/shirt", `<main>${tile("a")}${tile("b")}</main>`),
    ).toMatchObject({
      type: "unknown",
      signals: [],
    });
  });
  it("reads one top-level ProductGroup as the page's product", () => {
    expect(
      evidence(
        "/shirt",
        '<script type="application/ld+json">{"@graph":[{"@type":"ItemPage"},{"@type":"ProductGroup","hasVariant":[{"@type":"Product"},{"@type":"Product"}]}]}</script>',
      ),
    ).toEqual({
      type: "product",
      source: PageTypeSource.Detected,
      confidence: ClassificationConfidence.Strong,
      signals: ["product-schema-hint", "product-schema-primary"],
    });
  });
  it("reads a microdata Product as the page's product", () => {
    // Some stores mark up the product with itemscope attributes, not JSON-LD.
    const $ = parseHtml(
      '<meta property="og:type" content="website"><main itemscope itemtype="http://schema.org/Product"><h1 itemprop="name">Drill attachment</h1><div itemprop="offers" itemscope itemtype="http://schema.org/Offer"><span itemprop="price">10</span></div></main>',
    );
    expect(
      classifyPage(
        "https://example.com/drill-attachment/2025463.html",
        $,
        [...extractJsonLd($), ...extractMicrodata($), ...extractRdfa($)],
        extractMetaTags($),
      ),
    ).toEqual({
      type: "product",
      source: PageTypeSource.Detected,
      confidence: ClassificationConfidence.Strong,
      signals: ["product-schema-hint", "product-schema-primary"],
    });
  });
  it("keeps several top-level products with a grid a listing", () => {
    const products = JSON.stringify([
      { "@type": "Product" },
      { "@type": "Product" },
    ]);
    expect(
      evidence(
        "/shirts",
        `<script type="application/ld+json">${products}</script><main>${["a", "b", "c"].map(tile).join("")}</main>`,
      ),
    ).toMatchObject({
      type: "category",
      signals: ["product-grid"],
    });
  });
  it("does not read a single product beside listing schema as primary", () => {
    expect(
      evidence(
        "/shirts",
        '<script type="application/ld+json">[{"@type":"CollectionPage"},{"@type":"Product"}]</script>',
      ),
    ).toMatchObject({
      type: "product",
      confidence: ClassificationConfidence.Hint,
      signals: ["product-schema-hint"],
    });
  });
  it("keeps the buy controls of a lone main product section", () => {
    // A PDP may mark its own product section with data-product-id; only
    // cards that sit in a listing hide their controls.
    expect(
      evidence(
        "/shirt",
        '<main><section class="pdp" data-product-id="42"><h1>Shirt</h1><span class="price">20</span><button class="add-to-cart">Add</button></section></main>',
      ),
    ).toMatchObject({ type: "product", signals: ["purchase-controls"] });
  });
  it("keeps a main product section a product beside a recommendation rail", () => {
    expect(
      evidence(
        "/shirt",
        `<main><section data-product-id="42"><span class="price">20</span><button class="add-to-cart">Add</button></section><div class="recommendations">${["a", "b", "c"].map(tile).join("")}</div></main>`,
      ),
    ).toMatchObject({ type: "product", signals: ["purchase-controls"] });
  });
  it.each([1, 4, 6])(
    "keeps a grid a listing however deeply each card is wrapped: %i levels",
    (depth) => {
      const wrap = (inner: string) =>
        "<div>".repeat(depth) + inner + "</div>".repeat(depth);
      const card =
        '<div class="product-card"><span class="price">10</span><button class="add-to-cart">Add</button></div>';
      expect(
        evidence(
          "/collections/shirts",
          `<main><h1>Shirts</h1><div class="grid">${wrap(card).repeat(3)}</div></main>`,
        ),
      ).toMatchObject({ type: "category" });
    },
  );
  it("keeps the controls of a card that holds the page title", () => {
    const related =
      '<div class="product-card"><span class="price">5</span><button class="add-to-cart">Add</button></div>';
    expect(
      evidence(
        "/shirt",
        `<main><section data-product-id="42"><h1>Shirt</h1><span class="price">20</span><button class="add-to-cart">Add</button></section>${related.repeat(2)}</main>`,
      ),
    ).toMatchObject({ type: "product", confidence: "strong" });
  });
  it("does not read carousel dots as result pagination", () => {
    expect(
      evidence(
        "/shirt",
        '<div class="filter"></div><div class="swiper-pagination"></div>',
      ),
    ).toMatchObject({ type: "unknown", signals: [] });
    expect(
      evidence(
        "/shirts",
        '<div class="filter"></div><nav class="pagination"></nav>',
      ),
    ).toMatchObject({
      type: "category",
      signals: ["pagination-filter-hint"],
    });
  });
  it("keeps homepage identity when the page has article and product features", () => {
    expect(
      evidence(
        "/",
        '<meta property="og:type" content="article"><button class="add-to-cart">Buy</button><span class="price">10</span>',
      ),
    ).toEqual({
      type: "homepage",
      source: PageTypeSource.Detected,
      confidence: ClassificationConfidence.Strong,
      signals: ["root-path"],
    });
  });
  it.each([
    "{broken",
    "null",
    "42",
    '"Article"',
    '[null,42,{"@type":"WebPage"}]',
  ])("ignores malformed or irrelevant structured data: %s", (json) => {
    expect(
      evidence(
        "/privacy",
        `<script type="application/ld+json">${json}</script>`,
      ),
    ).toMatchObject({
      type: "unknown",
      confidence: ClassificationConfidence.Unknown,
    });
  });
  it("records top-level Article schema as a hint, including array wrappers", () => {
    expect(
      evidence(
        "/story",
        '<script type="application/ld+json">[null,{"@graph":[{"@type":"https://schema.org/Article"}]}]</script>',
      ),
    ).toEqual({
      type: "article",
      source: PageTypeSource.Detected,
      confidence: ClassificationConfidence.Hint,
      signals: ["article-schema-hint"],
    });
  });
  it.each(["hidden", 'aria-hidden="true"', 'style="display:none"'])(
    "ignores a hidden article: %s",
    (attr) => {
      expect(
        evidence(
          "/contact",
          `<main><article ${attr}><h1>Story</h1><p>${prose}</p><p>${prose}</p></article></main>`,
        ).type,
      ).toBe("unknown");
    },
  );
  it("does not use hidden paragraphs to establish primary article prose", () => {
    expect(
      evidence(
        "/contact",
        `<main><article><h1>Title</h1><p>One.</p><p>Two.</p><p hidden>${prose}</p></article></main>`,
      ).type,
    ).toBe("unknown");
  });
  it("keeps legacy declarations general, with provenance", () => {
    expect(declaredPageClassification(PageType.Content)).toEqual({
      type: "unknown",
      source: PageTypeSource.Declared,
      confidence: ClassificationConfidence.Unknown,
      signals: ["declared:content"],
    });
    expect(declaredPageClassification(PageType.Article)).toEqual({
      type: "article",
      source: PageTypeSource.Declared,
      confidence: ClassificationConfidence.Strong,
      signals: ["declared:article"],
    });
  });
});

describe("canonical metadata at the runner boundary", () => {
  const page = mockPageContext(
    "https://example.com/story",
    "<main><h1>Story</h1><p>Readable words</p></main>",
  );
  page.pageType = PageType.Article;
  page.pageTypeSource = PageTypeSource.Declared;
  const ctx = mockCheckContext([page]);
  const configFor = (aliases: Partial<typeof ArticleSchemaAudit.meta>) => ({
    categories: [{ id: "structured-data", name: "Structured data", weight: 1 }],
    audits: {
      "structured-data": [
        {
          meta: {
            ...ArticleSchemaAudit.meta,
            applicablePageTypes: undefined,
            ...aliases,
          },
          create: () => new ArticleSchemaAudit(),
        },
      ],
    },
  });
  it.each([
    { pageTypes: [PageType.Article] },
    { applicablePageTypes: [PageType.Article] },
    {
      pageTypes: [PageType.Product, PageType.Article, PageType.Article],
      applicablePageTypes: [PageType.Article, PageType.Product],
    },
  ] as Partial<typeof ArticleSchemaAudit.meta>[])(
    "accepts either spelling and equal sets without mutating config: %j",
    (aliases) => {
      const config = configFor(aliases);
      const before = JSON.stringify(config);
      const plan = planAudits(ctx, config);
      expect(plan.runnable).toHaveLength(1);
      expect(plan.runnable[0].reg.meta.pageTypes).toBeUndefined();
      expect(plan.runnable[0].reg.meta.applicablePageTypes).toContain(
        PageType.Article,
      );
      expect(JSON.stringify(config)).toBe(before);
    },
  );
  it("treats equal empty aliases as universal", () => {
    expect(
      planAudits(ctx, configFor({ pageTypes: [], applicablePageTypes: [] }))
        .runnable,
    ).toHaveLength(1);
  });
  it("rejects conflict even when the scan is unread, without aborting the plan", () => {
    const unread = mockCheckContext([]);
    const plan = planAudits(
      unread,
      configFor({ pageTypes: [], applicablePageTypes: [PageType.Article] }),
    );
    expect(plan.runnable).toHaveLength(0);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0]?.tags).toEqual(["scan-error"]);
    expect(plan.skipped[0]?.explanation).toMatch(/Conflicting page types/);
  });
});

describe("saved page-type conditions", () => {
  it("reads old conditions without inventing classification evidence", () => {
    const schema = ScanConditionsSchema.shape.pageType;
    expect(
      schema.parse({ type: "content", source: PageTypeSource.Detected }),
    ).toEqual({
      type: "content",
      source: PageTypeSource.Detected,
    });
    const current = {
      type: "article",
      source: PageTypeSource.Detected,
      confidence: ClassificationConfidence.Strong,
      signals: ["primary-article-prose"],
    };
    expect(schema.parse(current)).toEqual(current);
    expect(
      schema.safeParse({ ...current, confidence: "certain" }).success,
    ).toBe(false);
  });
});
