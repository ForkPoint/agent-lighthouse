import { describe, it, expect } from "vitest";
import {
  BuyableVariantResolutionAudit,
  detectVariants,
} from "./buyable-variant-resolution";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { AuditResult } from "../../types";
import type { PageContext } from "../../check-context";

const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];

/** A size selector a shopper can see, with two real options. */
const SIZE_SELECT = `
  <select name="size">
    <option value="">Choose a size</option>
    <option value="m">M</option>
    <option value="l">L</option>
  </select>`;

/** JSON-LD block, wrapped the way a page carries it. */
const ld = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

/** A product page at a /product/ URL, so detectPageType calls it one. */
function product(body: string): PageContext {
  return mockPageContext(
    "https://example.com/products/merino-crew",
    `<html><head><title>Merino Crew</title></head><body>${body}</body></html>`,
    1,
  );
}

function run(body: string) {
  return new BuyableVariantResolutionAudit().audit(
    mockCheckContext([product(body)]),
  );
}

const variant = (sku: string, price: string) => ({
  "@type": "Product",
  sku,
  offers: {
    "@type": "Offer",
    price,
    priceCurrency: "GBP",
    availability: "https://schema.org/InStock",
  },
});

const GROUP = (variants: unknown[]) => ({
  "@context": "https://schema.org",
  "@type": "ProductGroup",
  name: "Merino Crew",
  productGroupID: "MC-100",
  variesBy: ["https://schema.org/size"],
  hasVariant: variants,
});

describe("BuyableVariantResolutionAudit", () => {
  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(new BuyableVariantResolutionAudit());
  });

  it("is notApplicable when no scanned page is a product page", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", "<html></html>"),
    ]);
    expect(new BuyableVariantResolutionAudit().audit(ctx).status).toBe("na");
  });

  it("is notApplicable when the product page offers no variant choice", () => {
    const r = run(
      ld({
        "@type": "Product",
        sku: "MC-100",
        offers: { "@type": "Offer", price: "79" },
      }),
    );
    expect(r.status).toBe("na");
  });

  it("passes a ProductGroup that resolves every variant it shows", () => {
    const r = run(
      SIZE_SELECT +
        ld(GROUP([variant("MC-100-M", "79.00"), variant("MC-100-L", "79.00")])),
    );
    expect(r.status).toBe("pass");
    expect(strings(r, "resolved")[0]).toContain("2 variant(s) resolved");
  });

  it("passes two Product nodes each carrying a unique identifier and a complete Offer", () => {
    const r = run(
      SIZE_SELECT +
        ld([variant("MC-100-M", "79.00"), variant("MC-100-L", "89.00")]),
    );
    expect(r.status).toBe("pass");
    expect(strings(r, "resolved")[0]).toContain("per-variant Product nodes");
  });

  it("fails a variant page whose only Offer is an AggregateOffer range", () => {
    const r = run(
      SIZE_SELECT +
        ld({
          "@type": "Product",
          name: "Merino Crew",
          offers: {
            "@type": "AggregateOffer",
            lowPrice: "49",
            highPrice: "79",
            priceCurrency: "GBP",
          },
        }),
    );
    expect(r.status).toBe("fail");
    expect(strings(r, "failures")[0]).toContain("AggregateOffer");
    expect(strings(r, "failures")[0]).toContain("49–79");
  });

  it("fails a variant page that publishes exactly one Offer", () => {
    const r = run(SIZE_SELECT + ld(variant("MC-100", "79.00")));
    expect(r.status).toBe("fail");
    expect(strings(r, "failures")[0]).toContain("exactly one Offer");
  });

  it("names the exact missing per-variant field", () => {
    const incomplete = {
      "@type": "Product",
      sku: "MC-100-M",
      offers: { "@type": "Offer", price: "79.00" },
    };
    const r = run(
      SIZE_SELECT +
        ld(GROUP([incomplete, { "@type": "Product", color: "Blue" }])),
    );
    expect(r.status).toBe("fail");
    const message = strings(r, "failures")[0] ?? "";
    expect(message).toContain("offers.priceCurrency");
    expect(message).toContain("sku or gtin");
  });

  it("warns when the markup resolves fewer variants than the page shows", () => {
    const three = `
      <select name="size">
        <option value="s">S</option>
        <option value="m">M</option>
        <option value="l">L</option>
      </select>`;
    const r = run(
      three +
        ld(GROUP([variant("MC-100-M", "79.00"), variant("MC-100-L", "79.00")])),
    );
    expect(r.status).toBe("warn");
    expect(strings(r, "warnings")[0]).toContain("partially generated");
  });

  it("reads variants off a select, ignoring the placeholder option", () => {
    const evidence = detectVariants(product(SIZE_SELECT));
    expect(evidence?.count).toBe(2);
    expect(evidence?.source).toBe("select");
  });

  it("ignores a select whose name has nothing to do with variants", () => {
    const quantity = `<select name="quantity"><option value="1">1</option><option value="2">2</option></select>`;
    expect(detectVariants(product(quantity))).toBeUndefined();
  });

  it("reads variants off repeated data attributes", () => {
    const swatches = `<div data-variant-id="1">Blue</div><div data-variant-id="2">Red</div>`;
    const evidence = detectVariants(product(swatches));
    expect(evidence?.count).toBe(2);
    expect(evidence?.source).toBe("data-attribute");
  });

  it("reads variants off the Shopify variant JSON", () => {
    const shopify = `<script src="https://cdn.shopify.com/x.js"></script>
      <script>window.ShopifyAnalytics.meta.product = {"variants":[{"id":1,"title":"M"},{"id":2,"title":"L"}]};</script>`;
    const evidence = detectVariants(product(shopify));
    expect(evidence?.count).toBe(2);
    expect(evidence?.source).toBe("platform-json");
  });

  it("reads variants off the WooCommerce variations form", () => {
    const woo = `<link href="/wp-content/plugins/woocommerce/x.css">
      <form class="variations_form" data-product_variations='[{"variation_id":11},{"variation_id":12}]'></form>`;
    const evidence = detectVariants(product(woo));
    expect(evidence?.count).toBe(2);
  });
});
