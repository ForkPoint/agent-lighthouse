import { describe, it, expect } from "vitest";
import { ProductTransactionCertaintyAudit } from "./product-transaction-certainty";
import { mockPageContext, mockCheckContext } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

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

describe("ProductTransactionCertaintyAudit", () => {
  const audit = new ProductTransactionCertaintyAudit();

  it("is not applicable when no Product schema exists", () => {
    const html = `<html><head>${ld({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Acme",
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("fails when Product relies on name and price alone", () => {
    const html = `<html><head>${ld({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Shoe",
      offers: {
        "@type": "Offer",
        price: "49.99",
        priceCurrency: "USD",
      },
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/products/shoe", html, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("1/4");
    expect(result.message).toContain("offers.availability");
  });

  it("fails when Product has no Offer block at all", () => {
    const html = `<html><head>${ld({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Shoe",
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/products/shoe", html, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("no Offer block");
  });

  it("warns when 2-3 certainty signals are present", () => {
    const html = `<html><head>${ld({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Shoe",
      offers: {
        "@type": "Offer",
        price: "49.99",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/products/shoe", html, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("2/4");
    expect(result.found).toContain("priceValidUntil");
  });

  it("passes when all 4 signals are present on the Offer", () => {
    const html = `<html><head>${ld({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Shoe",
      offers: {
        "@type": "Offer",
        price: "49.99",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        priceValidUntil: "2026-12-31",
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          applicableCountry: "US",
          merchantReturnDays: 30,
        },
      },
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/products/shoe", html, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("4/4");
  });

  it("passes when hasMerchantReturnPolicy lives on the Product, and finds Product inside @graph", () => {
    const html = `<html><head>${ld({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Product",
          name: "Shoe",
          hasMerchantReturnPolicy: {
            "@type": "MerchantReturnPolicy",
            applicableCountry: "US",
          },
          offers: {
            "@type": "Offer",
            price: "49.99",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            priceValidUntil: "2026-12-31",
          },
        },
      ],
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/products/shoe", html, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("reads the offers of a ProductGroup's variants", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/products/shirt",
        `<html><head>${ld(productGroup())}</head><body></body></html>`,
        1,
      ),
    ]);
    const result = audit.audit(ctx);
    // availability and price + currency; no priceValidUntil, no return policy.
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("2/4");
  });
});
