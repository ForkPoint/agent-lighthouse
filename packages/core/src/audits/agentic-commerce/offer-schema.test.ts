import { describe, it, expect } from "vitest";
import { OfferSchemaAudit } from "./offer-schema";
import { mockPageContext, mockCheckContext } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
// /products/* URLs are classified as product pages by detectPageType.
const productPage = (
  head: string,
  url = "https://example.com/products/widget",
) => mockPageContext(url, `<html><head>${head}</head><body></body></html>`, 1);

const productWithOffer = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Widget",
  offers: { "@type": "Offer", price: "99.00", priceCurrency: "USD" },
};

// Google's variant layout: shared properties on the ProductGroup, the
// varying ones and each variant's own Offer under hasVariant.
const productGroup = (offers: Record<string, unknown> = {}) => ({
  "@context": "https://schema.org",
  "@type": "ProductGroup",
  productGroupID: "SHIRT",
  name: "Shirt",
  brand: { "@type": "Brand", name: "Acme" },
  category: "Shirts",
  ...offers,
  hasVariant: ["S", "M"].map((size) => ({
    "@type": "Product",
    sku: `SHIRT-${size}`,
    size,
    offers: {
      "@type": "Offer",
      price: 45,
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
  })),
});

describe("OfferSchemaAudit", () => {
  const audit = new OfferSchemaAudit();

  it("is not applicable when there are no product pages", () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("No product pages");
  });

  it("passes when a product page has an offers prop with price + priceCurrency", () => {
    const ctx = mockCheckContext([productPage(ld(productWithOffer))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("detects an array-wrapped Product with offers", () => {
    const ctx = mockCheckContext([productPage(ld([productWithOffer]))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("fails when a product page has no Offer schema", () => {
    const ctx = mockCheckContext([
      productPage(
        ld({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Widget",
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("No Offer schema found");
  });

  it("warns when only some product pages have Offer schema", () => {
    const ctx = mockCheckContext([
      productPage(ld(productWithOffer), "https://example.com/products/a"),
      productPage(
        ld({ "@context": "https://schema.org", "@type": "Product", name: "B" }),
        "https://example.com/products/b",
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toBe("1/2 product pages with Offer schema");
  });

  it("detects a standalone Offer schema with array @type (Array.isArray branch)", () => {
    // @type as an array triggers the Array.isArray branch in matchesAnyType
    const ctx = mockCheckContext([
      productPage(
        ld({
          "@context": "https://schema.org",
          "@type": ["Offer", "AggregateOffer"],
          price: "49.00",
          priceCurrency: "USD",
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("handles a typeless schema alongside an Offer (return false branch)", () => {
    // A schema without @type forces matchesAnyType to reach `return false`.
    // The valid Offer still drives the product page to pass.
    const ctx = mockCheckContext([
      productPage(
        ld([
          { name: "Untyped object" },
          {
            "@context": "https://schema.org",
            "@type": "Offer",
            price: "29.00",
            priceCurrency: "EUR",
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("detects an Offer when offers property is an array (Array.isArray offers branch)", () => {
    // `offers` as an array triggers Array.isArray(offer) true branch in hasOfferProp
    const ctx = mockCheckContext([
      productPage(
        ld({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Multi-variant Widget",
          offers: [
            { "@type": "Offer", price: "49.00", priceCurrency: "USD" },
            { "@type": "Offer", price: "79.00", priceCurrency: "USD" },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("passes a ProductGroup whose variants carry priced offers", () => {
    const ctx = mockCheckContext([productPage(ld(productGroup()))]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
  });

  it("judges the product's offers, not the first Offer node in the page", () => {
    // The group's AggregateOffer comes first and has no `price`; the
    // variants' offers are priced.
    const ctx = mockCheckContext([
      productPage(
        ld(
          productGroup({
            offers: {
              "@type": "AggregateOffer",
              offerCount: 2,
              priceCurrency: "EUR",
            },
          }),
        ),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
  });

  it("accepts an AggregateOffer price range", () => {
    const ctx = mockCheckContext([
      productPage(
        ld({
          "@type": "Product",
          name: "Shirt",
          offers: {
            "@type": "AggregateOffer",
            lowPrice: 40,
            highPrice: 50,
            priceCurrency: "EUR",
          },
        }),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
  });

  it("accepts an Offer that points at its product through itemOffered", () => {
    const ctx = mockCheckContext([
      productPage(
        ld({
          "@type": "Offer",
          price: 10,
          priceCurrency: "USD",
          itemOffered: { "@type": "Product", name: "Widget" },
        }),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
  });

  it("does not pass a product on a stray Offer that belongs to nothing", () => {
    const ctx = mockCheckContext([
      productPage(
        ld([
          { "@type": "Product", name: "Widget" },
          { "@type": "Offer", price: 10, priceCurrency: "USD" },
        ]),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Fail);
  });

  it("follows an offers @id reference to its Offer node", () => {
    const ctx = mockCheckContext([
      productPage(
        ld({
          "@graph": [
            { "@type": "Product", name: "W", offers: { "@id": "#offer" } },
            {
              "@type": "Offer",
              "@id": "#offer",
              price: 10,
              priceCurrency: "USD",
            },
          ],
        }),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
  });

  it.each([{ "@id": "#p" }, "#p"])(
    "accepts an Offer whose itemOffered names the product by @id: %j",
    (itemOffered) => {
      const ctx = mockCheckContext([
        productPage(
          ld({
            "@graph": [
              { "@type": "Product", "@id": "#p", name: "Widget" },
              {
                "@type": "Offer",
                price: 10,
                priceCurrency: "USD",
                itemOffered,
              },
            ],
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
    },
  );
});
