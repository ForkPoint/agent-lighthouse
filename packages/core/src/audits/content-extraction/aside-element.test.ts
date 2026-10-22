import { describe, it, expect } from "vitest";
import { AsideElementAudit } from "./aside-element";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import {
  CheckStatus,
  PageType,
  PageTypeSource,
  CoverageProvenance,
} from "#core/types";
import { runAudits } from "#core/audit-runner";
import { buildScanEvidence } from "#core/scan-evidence";
import type { PageContext } from "#core/check-context";
import type { ScanConfig } from "#core/audit-config";
import { CheckResultSchema } from "#core/schemas";

/** A readable sampled page; runner fixtures set purpose explicitly. */
function contentPage(body: string, slug = "post") {
  return mockPageContext(
    `https://example.com/blog/${slug}`,
    `<html><body>${body}</body></html>`,
    1,
  );
}

describe("AsideElementAudit", () => {
  const audit = new AsideElementAudit();

  it("is notApplicable when no page carries supplementary content at all", () => {
    const page = contentPage("<main><h1>Title</h1><p>Body only.</p></main>");
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("passes when every supplementary block is wrapped in <aside>", () => {
    const page = contentPage(
      '<main><p>Body.</p></main><aside class="sidebar"><h3>Related</h3></aside>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it('counts role="complementary" as marked supplementary content', () => {
    const page = contentPage(
      '<main><p>Body.</p></main><div role="complementary">Related</div>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("fails when a div-based sidebar exists and nothing is marked", () => {
    const page = contentPage(
      '<main><p>Body.</p></main><div class="sidebar"><h3>Related posts</h3></div>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("sidebar");
  });

  it("warns when some supplementary blocks are marked and others are not", () => {
    const marked = contentPage(
      "<main><p>A.</p></main><aside>Related</aside>",
      "a",
    );
    const unmarked = mockPageContext(
      "https://example.com/blog/b",
      '<html><body><main><p>B.</p></main><div class="promo-box">Buy now</div></body></html>',
      2,
    );
    const result = audit.audit(mockCheckContext([marked, unmarked]));
    expect(result.status).toBe(CheckStatus.Warn);
  });

  it("does not count a div-based sidebar that lives inside an <aside>", () => {
    const page = contentPage(
      '<main><p>Body.</p></main><aside><div class="related-links">More</div></aside>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("returns notApplicable on an empty sample", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("states the extraction consequence of <aside> in its guidance", () => {
    const guidance = AsideElementAudit.meta.guidance;
    expect(guidance?.impact).toMatch(/Readability/);
    expect(guidance?.impact).toMatch(/trafilatura/);
    expect(guidance?.fix).toMatch(/never|do not/i);
  });
});

describe("supplementary block evidence", () => {
  const audit = new AsideElementAudit();
  it.each([
    '<nav class="sidebar">Menu</nav>',
    '<div role="navigation"><div class="sidebar">Menu</div></div>',
    '<footer><div class="newsletter">Subscribe</div></footer>',
    '<div role="contentinfo"><div class="related">Links</div></div>',
    '<header><div class="promo">Brand</div></header>',
    '<div hidden class="sidebar">Hidden</div>',
    '<div style="display:none"><aside>Hidden</aside></div>',
    '<div class="widget">Product specifications</div>',
    '<div class="secondary">Purchase options</div>',
    '<div class="callout">Key fact</div>',
    '<div class="pullquote">Citable quote</div>',
    '<div role="main" class="sidebar">Primary content</div>',
  ])("does not require aside for %s", (html) => {
    expect(audit.audit(mockCheckContext([contentPage(html)])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});

const runnerConfig: ScanConfig = {
  categories: [{ id: "content-extraction", name: "Extraction", weight: 1 }],
  audits: {
    "content-extraction": [
      {
        meta: AsideElementAudit.meta,
        create: () => new AsideElementAudit(),
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
  const p = contentPage(
    body + "<p>" + "Readable page content. ".repeat(60) + "</p>",
    name,
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

describe("nested supplementary evidence", () => {
  it("keeps a related block inside a primary container with a sidebar class", () => {
    const result = new AsideElementAudit().audit(
      mockCheckContext([
        contentPage(
          '<div role="main" class="sidebar"><p>Product details</p><div class="related-products">Other products</div></div>',
        ),
      ]),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("1 unmarked");
    expect(result.found).toContain("related-products");
  });
  it("does not let a hidden marked block soften a visible unmarked finding", () => {
    const result = new AsideElementAudit().audit(
      mockCheckContext([
        contentPage(
          '<aside hidden>Hidden</aside><div class="related-products">Other products</div>',
        ),
      ]),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("0 marked, 1 unmarked");
  });
});

describe("supplementary feature scope", () => {
  for (const source of Object.values(PageTypeSource)) {
    describe(source, () => {
      it.each(Object.values(PageType))(
        "assesses supplementary content on %s",
        async (type) => {
          for (const [html, status] of [
            ["<aside>Related products</aside>", CheckStatus.Pass],
            [
              '<section class="related-products"><h2>Related products</h2><a href="/other">Other product</a></section>',
              CheckStatus.Fail,
            ],
            [
              "<main>Product specifications and purchase options</main>",
              CheckStatus.NotApplicable,
            ],
          ] as const) {
            const result = await run([scopedPage(html, type, source)]);
            const check = CheckResultSchema.parse(result.checks[0]);
            expect(check.status).toBe(status);
            expect(check.weight).toBe(0.6);
            expect(check.coverage?.provenance).toBe(CoverageProvenance.All);
            expect(check.tags).not.toContain("skipped:page-type");
            expect(check.advisoryResults).toBeUndefined();
          }
        },
      );
    });
  }
  it("counts only visible relevant blocks in a mixed readable sample", async () => {
    const marked = scopedPage(
      "<aside>Related products</aside>",
      PageType.Product,
      PageTypeSource.Declared,
      "marked",
    );
    const gap = scopedPage(
      '<div class="related">Related links</div>',
      PageType.Homepage,
      PageTypeSource.Detected,
      "gap",
    );
    const irrelevant = scopedPage(
      '<nav class="sidebar">Menu</nav><div hidden class="promo">Hidden</div>',
      PageType.Category,
      PageTypeSource.Detected,
      "irrelevant",
    );
    const unread = scopedPage(
      "<aside>Unavailable</aside>",
      PageType.Article,
      PageTypeSource.Declared,
      "unread",
    );
    unread.$ = contentPage("").$;
    unread.fetchResult = { ...unread.fetchResult, body: "", status: 503 };
    const result = await run([marked, irrelevant, unread, gap]);
    const check = CheckResultSchema.parse(result.checks[0]);
    expect(check.status).toBe(CheckStatus.Warn);
    expect(check.displayValue).toContain("1 marked, 1 unmarked");
    expect(check.coverage?.unreadUrls).toEqual([unread.url]);
    expect(check.coverage?.inputUrls).not.toContain(unread.url);
    expect(check.advisoryResults).toBeUndefined();
  });
});

describe("AsideElementAudit purchase controls", () => {
  const audit = new AsideElementAudit();
  it.each([
    ["an add-to-cart button", "<button>Add to cart</button>"],
    ["a cart form", '<form action="/cart/add"><input name="id"></form>'],
    [
      "an offer",
      '<div itemprop="offers"><span itemprop="price">20</span></div>',
    ],
  ])("skips a sidebar that holds %s", (_, controls) => {
    const page = contentPage(
      `<main><h1>Chair</h1><div class="product-sidebar">${controls}</div></main>`,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  it("still reports a newsletter box with a subscribe form", () => {
    const page = contentPage(
      '<main><p>Body.</p></main><div class="newsletter"><form action="/subscribe"><button>Subscribe</button></form></div>',
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Fail);
  });
});

describe("AsideElementAudit buy box edges", () => {
  const audit = new AsideElementAudit();
  it("skips a sidebar that is itself the price element", () => {
    const page = contentPage(
      '<main><h1>Chair</h1><div class="sidebar" itemprop="price">20</div></main>',
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  it("reports a newsletter nested inside a buy box", () => {
    const page = contentPage(
      '<main><h1>Chair</h1><div class="sidebar"><button>Add to cart</button><div class="newsletter">Sign up</div></div></main>',
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Fail);
  });
});

describe("review regressions", () => {
  it("reports repeated quick-add cards", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><section class="related-products"><div class="product-card"><form action="/cart"><button>Add to cart</button></form></div><div class="product-card"><form action="/cart"><button>Add to cart</button></form></div></section></body></html>',
    );
    expect(new AsideElementAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.Fail,
    );
  });
  it("reports repeated prices", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><section class="related-products"><div itemprop="price">10</div><div itemprop="price">20</div></section></body></html>',
    );
    expect(new AsideElementAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.Fail,
    );
  });
  it("keeps a single complete buy box", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><div class="sidebar" itemprop="offers"><span itemprop="price">20</span><form action="/cart"><input name="quantity"><button>Add to cart</button></form></div></body></html>',
    );
    expect(new AsideElementAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("does not treat checkout prose as a purchase", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><div class="newsletter"><button>Checkout our latest posts</button></div></body></html>',
    );
    expect(new AsideElementAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.Fail,
    );
  });
  it("keeps exact checkout controls", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><div class="sidebar"><button>Checkout</button></div></body></html>',
    );
    expect(new AsideElementAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("keeps proceed to checkout controls", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><div class="sidebar"><button>Proceed to checkout</button></div></body></html>',
    );
    expect(new AsideElementAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("reports article footer newsletter", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><article><footer><div class="newsletter"><button>Subscribe</button></div></footer></article></body></html>',
    );
    expect(new AsideElementAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.Fail,
    );
  });
});

describe("AsideElementAudit product page shapes", () => {
  const audit = new AsideElementAudit();
  const status = (body: string) =>
    audit.audit(mockCheckContext([contentPage(body)])).status;

  it("skips a buy box with add-to-cart and buy-it-now buttons", () => {
    expect(
      status(
        '<main><h1>Chair</h1><div class="product-sidebar"><form action="/cart/add"><button>Add to cart</button><button>Buy it now</button></form></div></main>',
      ),
    ).toBe(CheckStatus.NotApplicable);
  });

  it("skips a buy box with a sale price and an original price", () => {
    expect(
      status(
        '<main><h1>Chair</h1><div class="product-sidebar"><span itemprop="price">10</span><s itemprop="price">20</s><button>Add to cart</button></div></main>',
      ),
    ).toBe(CheckStatus.NotApplicable);
  });

  it("skips a promo badge in a product header", () => {
    expect(
      status(
        '<main><article><header><h1>Chair</h1><div class="promo-tag">Sale</div></header><p>Body.</p></article></main>',
      ),
    ).toBe(CheckStatus.NotApplicable);
  });

  it("still reports a rail with two add-to-cart buttons", () => {
    expect(
      status(
        '<main><p>Body.</p><div class="related-products"><button>Add to cart</button><button>Add to cart</button></div></main>',
      ),
    ).toBe(CheckStatus.Fail);
  });
});

describe("AsideElementAudit buy box and card shapes", () => {
  const audit = new AsideElementAudit();
  const status = (body: string) =>
    audit.audit(mockCheckContext([contentPage(body)])).status;

  it.each([
    [
      "a sticky copy of the add-to-cart button",
      '<div class="product-sidebar"><span itemprop="price">10</span><form action="/cart/add"><input name="quantity"><button type="submit">Add to cart</button></form><div class="sticky-atc"><button type="button">Add to cart</button></div></div>',
    ],
    [
      "an installment form beside the product form",
      '<div class="product-sidebar"><form id="product-form-installment" action="/cart/add"><input type="hidden" name="id"></form><span itemprop="price">10</span><form action="/cart/add"><button>Add to cart</button></form></div>',
    ],
    [
      "mobile and desktop quantity fields",
      '<div class="product-sidebar"><input name="quantity"><input name="quantity"><button>Add to cart</button></div>',
    ],
  ])("keeps a buy box with %s exempt", (_, box) => {
    expect(status(`<main><h1>Chair</h1>${box}</main>`)).toBe(
      CheckStatus.NotApplicable,
    );
  });

  it("does not flag a sale badge inside a product card", () => {
    expect(
      status(
        '<main><div class="product-card"><a href="/p">Sofa</a><div class="promo-tag">Save $1,400</div></div><div class="product-card"><a href="/q">Bed</a><div class="promo-badge">Save $200</div></div></main>',
      ),
    ).toBe(CheckStatus.NotApplicable);
  });

  it("reports a related rail with a single quick-add card", () => {
    expect(
      status(
        '<main><p>Body.</p><div class="related-products"><div class="product-card"><a href="/p1">P1</a><span itemprop="price">5</span><button>Add to cart</button></div></div></main>',
      ),
    ).toBe(CheckStatus.Fail);
  });

  it("reports a sidebar that holds a rail of two product cards", () => {
    expect(
      status(
        '<main><p>Body.</p><div class="sidebar"><div class="product-card"><button>Add to cart</button></div><div class="product-card"><button>Add to cart</button></div></div></main>',
      ),
    ).toBe(CheckStatus.Fail);
  });
});
