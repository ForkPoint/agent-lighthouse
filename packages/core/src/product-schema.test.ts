import { describe, expect, it } from "vitest";
import { resolveProducts } from "#core/product-schema";

const variant = (sku: string, extra: Record<string, unknown> = {}) => ({
  "@type": "Product",
  sku,
  size: sku,
  offers: { "@type": "Offer", price: 45, priceCurrency: "EUR" },
  ...extra,
});

describe("resolveProducts", () => {
  it("gives each hasVariant entry the group's shared properties", () => {
    const products = resolveProducts([
      {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "ItemPage", name: "Shirt page" },
          {
            "@type": "ProductGroup",
            "@id": "https://shop.test/shirt",
            url: "https://shop.test/shirt",
            productGroupID: "SHIRT",
            variesBy: "https://schema.org/size",
            name: "Shirt",
            brand: { "@type": "Brand", name: "Acme" },
            hasVariant: [variant("S"), variant("M", { name: "Shirt, M" })],
          },
        ],
      },
    ]);
    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      "@type": "Product",
      sku: "S",
      name: "Shirt",
      brand: { name: "Acme" },
    });
    expect(products[1]).toMatchObject({ sku: "M", name: "Shirt, M" });
    // Group identity stays on the group.
    for (const product of products) {
      expect(product).not.toHaveProperty("hasVariant");
      expect(product).not.toHaveProperty("productGroupID");
      expect(product).not.toHaveProperty("@id");
    }
  });

  it("keeps a variant's own offer over the group's", () => {
    const [product] = resolveProducts([
      {
        "@type": "ProductGroup",
        offers: { "@type": "AggregateOffer", lowPrice: 40, highPrice: 50 },
        hasVariant: [variant("S")],
      },
    ]);
    expect(product?.["offers"]).toMatchObject({ "@type": "Offer", price: 45 });
  });

  it("joins variants declared outside the group", () => {
    const products = resolveProducts([
      {
        "@type": "ProductGroup",
        "@id": "#group",
        productGroupID: "G1",
        brand: "Acme",
      },
      variant("S", { inProductGroupWithID: "G1" }),
      variant("M", { isVariantOf: { "@id": "#group" } }),
    ]);
    expect(products.map((p) => [p["sku"], p["brand"]])).toEqual([
      ["S", "Acme"],
      ["M", "Acme"],
    ]);
  });

  it("returns a ProductGroup without variants as the product", () => {
    const group = { "@type": "ProductGroup", name: "Shirt", sku: "SHIRT" };
    expect(resolveProducts([group])).toEqual([group]);
  });

  it("returns products outside any group unchanged and in order", () => {
    const a = { "@type": "Product", name: "A" };
    const b = { "@type": "https://schema.org/IndividualProduct", name: "B" };
    expect(resolveProducts([a, { "@type": "WebPage" }, b])).toEqual([a, b]);
  });

  it("does not modify the parsed structured data", () => {
    const group = {
      "@type": "ProductGroup",
      brand: "Acme",
      hasVariant: [variant("S")],
    };
    const before = JSON.stringify(group);
    resolveProducts([group]);
    expect(JSON.stringify(group)).toBe(before);
  });

  it("follows hasVariant entries given as @id references", () => {
    const products = resolveProducts([
      {
        "@graph": [
          {
            "@type": "ProductGroup",
            "@id": "#group",
            brand: "Acme",
            hasVariant: [{ "@id": "#s" }],
          },
          { "@type": "Product", "@id": "#s", sku: "S" },
        ],
      },
    ]);
    expect(products).toEqual([
      { brand: "Acme", "@type": "Product", "@id": "#s", sku: "S" },
    ]);
  });

  it("replaces offers given as @id references with the Offer they name", () => {
    const offer = {
      "@type": "Offer",
      "@id": "#offer",
      price: 10,
      priceCurrency: "USD",
    };
    const [product] = resolveProducts([
      {
        "@graph": [
          { "@type": "Product", name: "W", offers: { "@id": "#offer" } },
          offer,
        ],
      },
    ]);
    expect(product?.["offers"]).toEqual(offer);
  });
});
