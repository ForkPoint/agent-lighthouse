import type { PageType } from "./types";
import type { PageContext } from "./check-context";
import { extractProductFieldVerification } from "./product-fields";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal PageContext. `extractProductFieldVerification` only reads
 * `pageType`, `structuredData`, `jsonLd` and `url`, so the rest is irrelevant.
 */
function makePage(
  pageType: PageType,
  structuredData: object[] | undefined,
  jsonLd: object[] = [],
  url = "https://shop.test/p/1",
): PageContext {
  return { url, pageType, structuredData, jsonLd } as unknown as PageContext;
}

const ALL_MISSING = {
  sku: "missing",
  gtin: "missing",
  brand: "missing",
  category: "missing",
  availability: "missing",
  priceCurrency: "missing",
  stockLevel: "missing",
  reviewCount: "missing",
};

// ---------------------------------------------------------------------------
// No usable product
// ---------------------------------------------------------------------------

describe("extractProductFieldVerification — no product", () => {
  it("returns all-missing (no sourceUrl) when there are no product pages", () => {
    const result = extractProductFieldVerification([
      makePage("content", [{ "@type": "WebPage" }]),
      makePage("homepage", [{ "@type": "Organization" }]),
    ]);
    expect(result).toEqual(ALL_MISSING);
    expect(result.sourceUrl).toBeUndefined();
  });

  it("returns all-missing when a product page has no Product-typed schema", () => {
    const result = extractProductFieldVerification([
      makePage("product", [
        { "@type": "WebPage" },
        { "@type": 123 },
        { noType: true },
      ]),
    ]);
    expect(result).toEqual(ALL_MISSING);
  });

  it("returns all-missing when the product offers value contains no object", () => {
    // first() must return undefined when the value has no object member.
    const result = extractProductFieldVerification([
      makePage("product", [{ "@type": "Product", offers: "not-an-object" }]),
    ]);
    expect(result.priceCurrency).toBe("missing");
    expect(result.stockLevel).toBe("missing");
    expect(result.sku).toBe("missing");
  });
});

// ---------------------------------------------------------------------------
// Fully populated product
// ---------------------------------------------------------------------------

describe("extractProductFieldVerification — fully populated", () => {
  it("marks every field found from a complete Product (offers array)", () => {
    const result = extractProductFieldVerification([
      makePage(
        "product",
        [
          {
            "@type": "Product",
            sku: "SKU-1",
            gtin13: "1234567890123",
            brand: { "@type": "Brand", name: "Acme" },
            category: "Widgets",
            offers: [
              {
                "@type": "Offer",
                price: "9.99",
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
                inventoryLevel: 5,
              },
            ],
            aggregateRating: { "@type": "AggregateRating", reviewCount: 10 },
          },
        ],
        [],
        "https://shop.test/product/acme",
      ),
    ]);
    expect(result).toEqual({
      sku: "found",
      gtin: "found",
      brand: "found",
      category: "found",
      availability: "found",
      priceCurrency: "found",
      stockLevel: "found",
      reviewCount: "found",
      sourceUrl: "https://shop.test/product/acme",
    });
  });
});

// ---------------------------------------------------------------------------
// priceCurrency / stockLevel partial logic
// ---------------------------------------------------------------------------

describe("extractProductFieldVerification — price/stock derivation", () => {
  it("reads price/availability from product level when there is no offer (partial)", () => {
    const result = extractProductFieldVerification([
      makePage("product", [
        { "@type": "Product", price: "5.00", availability: "InStock" },
      ]),
    ]);
    // price true, currency false -> partial; availability true, no inventory -> partial.
    expect(result.priceCurrency).toBe("partial");
    expect(result.availability).toBe("found");
    expect(result.stockLevel).toBe("partial");
    expect(result.sku).toBe("missing");
    expect(result.gtin).toBe("missing");
  });

  it("treats currency-only (no price) as partial", () => {
    const result = extractProductFieldVerification([
      makePage("product", [
        {
          "@type": "Product",
          offers: { "@type": "Offer", priceCurrency: "EUR" },
        },
      ]),
    ]);
    expect(result.priceCurrency).toBe("partial");
    expect(result.stockLevel).toBe("missing");
  });

  it("treats no price and no currency as missing", () => {
    const result = extractProductFieldVerification([
      makePage("product", [{ "@type": "Product", sku: "X" }]),
    ]);
    expect(result.priceCurrency).toBe("missing");
    expect(result.stockLevel).toBe("missing");
  });

  it("marks stockLevel found from explicit inventoryLevel even without availability", () => {
    const result = extractProductFieldVerification([
      makePage("product", [
        { "@type": "Product", offers: { "@type": "Offer", inventoryLevel: 3 } },
      ]),
    ]);
    expect(result.stockLevel).toBe("found");
    expect(result.availability).toBe("missing");
  });
});

// ---------------------------------------------------------------------------
// sku / gtin / reviewCount alternate sources
// ---------------------------------------------------------------------------

describe("extractProductFieldVerification — alternate field sources", () => {
  it("derives sku from productID and reviewCount from ratingCount (array @type)", () => {
    const result = extractProductFieldVerification([
      makePage("product", [
        {
          "@type": ["Thing", "Product"],
          productID: "PID-9",
          aggregateRating: { "@type": "AggregateRating", ratingCount: 3 },
        },
      ]),
    ]);
    expect(result.sku).toBe("found");
    expect(result.gtin).toBe("missing");
    expect(result.reviewCount).toBe("found");
  });

  it("derives sku from productSKU, reviewCount from product.reviewCount, offer (singular)", () => {
    const result = extractProductFieldVerification([
      makePage("product", [
        {
          "@type": "Product",
          productSKU: "SK-2",
          reviewCount: 7,
          offer: { "@type": "Offer", price: "1.00", priceCurrency: "USD" },
        },
      ]),
    ]);
    expect(result.sku).toBe("found");
    expect(result.reviewCount).toBe("found");
    expect(result.priceCurrency).toBe("found");
  });

  it("derives sku purely from a GTIN (gtin12) and marks gtin found", () => {
    const result = extractProductFieldVerification([
      makePage("product", [{ "@type": "Product", gtin12: "123456789012" }]),
    ]);
    expect(result.sku).toBe("found");
    expect(result.gtin).toBe("found");
  });

  it("derives sku from mpn and gtin from bare gtin", () => {
    const result = extractProductFieldVerification([
      makePage("product", [
        { "@type": "Product", mpn: "MPN-1", gtin: "0001112223334" },
      ]),
    ]);
    expect(result.sku).toBe("found");
    expect(result.gtin).toBe("found");
  });

  it("derives reviewCount from aggregateRating.reviewCount", () => {
    const result = extractProductFieldVerification([
      makePage("product", [
        {
          "@type": "Product",
          aggregateRating: { "@type": "AggregateRating", reviewCount: 2 },
        },
      ]),
    ]);
    expect(result.reviewCount).toBe("found");
  });
});

// ---------------------------------------------------------------------------
// has() value semantics
// ---------------------------------------------------------------------------

describe("extractProductFieldVerification — has() value semantics", () => {
  it('treats blank / "null" / "n/a" string values as missing', () => {
    const result = extractProductFieldVerification([
      makePage("product", [
        {
          "@type": "Product",
          sku: "real",
          brand: "null",
          category: "n/a",
          mpn: "   ",
        },
      ]),
    ]);
    expect(result.brand).toBe("missing");
    expect(result.category).toBe("missing");
  });

  it("treats an empty object / empty array as missing but a populated one as found", () => {
    const missing = extractProductFieldVerification([
      makePage("product", [
        { "@type": "Product", sku: "a", brand: {}, category: [""] },
      ]),
    ]);
    expect(missing.brand).toBe("missing");
    expect(missing.category).toBe("missing");

    const found = extractProductFieldVerification([
      makePage("product", [
        {
          "@type": "Product",
          sku: "a",
          brand: [{ "@type": "Brand", name: "B" }],
          category: ["Shoes"],
        },
      ]),
    ]);
    expect(found.brand).toBe("found");
    expect(found.category).toBe("found");
  });
});

// ---------------------------------------------------------------------------
// flatten() @graph + jsonLd fallback + multi-page selection
// ---------------------------------------------------------------------------

describe("extractProductFieldVerification — flatten & sources", () => {
  it("flattens @graph wrappers and skips non-object graph members", () => {
    const result = extractProductFieldVerification([
      makePage("product", [
        {
          "@graph": [
            { "@type": "WebSite" },
            "a-primitive-string",
            { "@type": "Product", sku: "G-1" },
          ],
        },
      ]),
    ]);
    expect(result.sku).toBe("found");
  });

  it("falls back to jsonLd when structuredData is absent", () => {
    const result = extractProductFieldVerification([
      makePage("product", undefined, [{ "@type": "Product", sku: "J-1" }]),
    ]);
    expect(result.sku).toBe("found");
  });

  it("uses the first product page that actually contains a Product", () => {
    const result = extractProductFieldVerification([
      makePage("product", [{ "@type": "WebPage" }], [], "https://shop.test/a"),
      makePage(
        "product",
        [{ "@type": "Product", sku: "B-1" }],
        [],
        "https://shop.test/b",
      ),
    ]);
    expect(result.sku).toBe("found");
    expect(result.sourceUrl).toBe("https://shop.test/b");
  });
});
