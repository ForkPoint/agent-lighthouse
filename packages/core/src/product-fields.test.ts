import type { PageContext } from "./check-context";
import { extractProductFieldVerification } from "./product-fields";
import { FieldStatus, PageType } from "./types";

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
  sku: FieldStatus.Missing,
  gtin: FieldStatus.Missing,
  brand: FieldStatus.Missing,
  category: FieldStatus.Missing,
  availability: FieldStatus.Missing,
  priceCurrency: FieldStatus.Missing,
  stockLevel: FieldStatus.Missing,
  reviewCount: FieldStatus.Missing,
};

// ---------------------------------------------------------------------------
// No usable product
// ---------------------------------------------------------------------------

describe("extractProductFieldVerification — no product", () => {
  it("returns all-missing (no sourceUrl) when there are no product pages", () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Content, [{ "@type": "WebPage" }]),
      makePage(PageType.Homepage, [{ "@type": "Organization" }]),
    ]);
    expect(result).toEqual(ALL_MISSING);
    expect(result.sourceUrl).toBeUndefined();
  });

  it("returns all-missing when a product page has no Product-typed schema", () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Product, [
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
      makePage(PageType.Product, [
        { "@type": "Product", offers: "not-an-object" },
      ]),
    ]);
    expect(result.priceCurrency).toBe(FieldStatus.Missing);
    expect(result.stockLevel).toBe(FieldStatus.Missing);
    expect(result.sku).toBe(FieldStatus.Missing);
  });
});

// ---------------------------------------------------------------------------
// Fully populated product
// ---------------------------------------------------------------------------

describe("extractProductFieldVerification — fully populated", () => {
  it("marks every field found from a complete Product (offers array)", () => {
    const result = extractProductFieldVerification([
      makePage(
        PageType.Product,
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
      sku: FieldStatus.Found,
      gtin: FieldStatus.Found,
      brand: FieldStatus.Found,
      category: FieldStatus.Found,
      availability: FieldStatus.Found,
      priceCurrency: FieldStatus.Found,
      stockLevel: FieldStatus.Found,
      reviewCount: FieldStatus.Found,
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
      makePage(PageType.Product, [
        { "@type": "Product", price: "5.00", availability: "InStock" },
      ]),
    ]);
    // price true, currency false -> partial; availability true, no inventory -> partial.
    expect(result.priceCurrency).toBe(FieldStatus.Partial);
    expect(result.availability).toBe(FieldStatus.Found);
    expect(result.stockLevel).toBe(FieldStatus.Partial);
    expect(result.sku).toBe(FieldStatus.Missing);
    expect(result.gtin).toBe(FieldStatus.Missing);
  });

  it("treats currency-only (no price) as partial", () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Product, [
        {
          "@type": "Product",
          offers: { "@type": "Offer", priceCurrency: "EUR" },
        },
      ]),
    ]);
    expect(result.priceCurrency).toBe(FieldStatus.Partial);
    expect(result.stockLevel).toBe(FieldStatus.Missing);
  });

  it("treats no price and no currency as missing", () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Product, [{ "@type": "Product", sku: "X" }]),
    ]);
    expect(result.priceCurrency).toBe(FieldStatus.Missing);
    expect(result.stockLevel).toBe(FieldStatus.Missing);
  });

  it("marks stockLevel found from explicit inventoryLevel even without availability", () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Product, [
        { "@type": "Product", offers: { "@type": "Offer", inventoryLevel: 3 } },
      ]),
    ]);
    expect(result.stockLevel).toBe(FieldStatus.Found);
    expect(result.availability).toBe(FieldStatus.Missing);
  });
});

// ---------------------------------------------------------------------------
// sku / gtin / reviewCount alternate sources
// ---------------------------------------------------------------------------

describe("extractProductFieldVerification — alternate field sources", () => {
  it("derives sku from productID and reviewCount from ratingCount (array @type)", () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Product, [
        {
          "@type": ["Thing", "Product"],
          productID: "PID-9",
          aggregateRating: { "@type": "AggregateRating", ratingCount: 3 },
        },
      ]),
    ]);
    expect(result.sku).toBe(FieldStatus.Found);
    expect(result.gtin).toBe(FieldStatus.Missing);
    expect(result.reviewCount).toBe(FieldStatus.Found);
  });

  it("derives sku from productSKU, reviewCount from product.reviewCount, offer (singular)", () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Product, [
        {
          "@type": "Product",
          productSKU: "SK-2",
          reviewCount: 7,
          offer: { "@type": "Offer", price: "1.00", priceCurrency: "USD" },
        },
      ]),
    ]);
    expect(result.sku).toBe(FieldStatus.Found);
    expect(result.reviewCount).toBe(FieldStatus.Found);
    expect(result.priceCurrency).toBe(FieldStatus.Found);
  });

  it("derives sku purely from a GTIN (gtin12) and marks gtin found", () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Product, [
        { "@type": "Product", gtin12: "123456789012" },
      ]),
    ]);
    expect(result.sku).toBe(FieldStatus.Found);
    expect(result.gtin).toBe(FieldStatus.Found);
  });

  it("derives sku from mpn and gtin from bare gtin", () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Product, [
        { "@type": "Product", mpn: "MPN-1", gtin: "0001112223334" },
      ]),
    ]);
    expect(result.sku).toBe(FieldStatus.Found);
    expect(result.gtin).toBe(FieldStatus.Found);
  });

  it("derives reviewCount from aggregateRating.reviewCount", () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Product, [
        {
          "@type": "Product",
          aggregateRating: { "@type": "AggregateRating", reviewCount: 2 },
        },
      ]),
    ]);
    expect(result.reviewCount).toBe(FieldStatus.Found);
  });
});

// ---------------------------------------------------------------------------
// has() value semantics
// ---------------------------------------------------------------------------

describe("extractProductFieldVerification — has() value semantics", () => {
  it('treats blank / "null" / "n/a" string values as missing', () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Product, [
        {
          "@type": "Product",
          sku: "real",
          brand: "null",
          category: "n/a",
          mpn: "   ",
        },
      ]),
    ]);
    expect(result.brand).toBe(FieldStatus.Missing);
    expect(result.category).toBe(FieldStatus.Missing);
  });

  it("treats an empty object / empty array as missing but a populated one as found", () => {
    const missing = extractProductFieldVerification([
      makePage(PageType.Product, [
        { "@type": "Product", sku: "a", brand: {}, category: [""] },
      ]),
    ]);
    expect(missing.brand).toBe(FieldStatus.Missing);
    expect(missing.category).toBe(FieldStatus.Missing);

    const found = extractProductFieldVerification([
      makePage(PageType.Product, [
        {
          "@type": "Product",
          sku: "a",
          brand: [{ "@type": "Brand", name: "B" }],
          category: ["Shoes"],
        },
      ]),
    ]);
    expect(found.brand).toBe(FieldStatus.Found);
    expect(found.category).toBe(FieldStatus.Found);
  });
});

// ---------------------------------------------------------------------------
// flatten() @graph + jsonLd fallback + multi-page selection
// ---------------------------------------------------------------------------

describe("extractProductFieldVerification — flatten & sources", () => {
  it("flattens @graph wrappers and skips non-object graph members", () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Product, [
        {
          "@graph": [
            { "@type": "WebSite" },
            "a-primitive-string",
            { "@type": "Product", sku: "G-1" },
          ],
        },
      ]),
    ]);
    expect(result.sku).toBe(FieldStatus.Found);
  });

  it("falls back to jsonLd when structuredData is absent", () => {
    const result = extractProductFieldVerification([
      makePage(PageType.Product, undefined, [
        { "@type": "Product", sku: "J-1" },
      ]),
    ]);
    expect(result.sku).toBe(FieldStatus.Found);
  });

  it("uses the first product page that actually contains a Product", () => {
    const result = extractProductFieldVerification([
      makePage(
        PageType.Product,
        [{ "@type": "WebPage" }],
        [],
        "https://shop.test/a",
      ),
      makePage(
        PageType.Product,
        [{ "@type": "Product", sku: "B-1" }],
        [],
        "https://shop.test/b",
      ),
    ]);
    expect(result.sku).toBe(FieldStatus.Found);
    expect(result.sourceUrl).toBe("https://shop.test/b");
  });
});
