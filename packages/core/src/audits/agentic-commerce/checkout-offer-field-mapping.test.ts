import { describe, it, expect } from "vitest";
import { CheckoutOfferFieldMappingAudit } from "./checkout-offer-field-mapping";
import { mockPageContext, mockCheckContext } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const PRODUCT_URL = "https://example.com/products/widget";

const FULL = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Alpine Resole Kit",
  description:
    "A complete resoling kit for welted boots, with outsole, midsole and adhesive.",
  sku: "ARK-001",
  gtin13: "1234567890128",
  brand: { "@type": "Brand", name: "Alpine" },
  image: "https://example.com/img/ark-001.jpg",
  url: PRODUCT_URL,
  offers: {
    "@type": "Offer",
    price: 29.99,
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
};

function run(
  overrides: Record<string, unknown> = {},
  offerOverrides: Record<string, unknown> = {},
) {
  const audit = new CheckoutOfferFieldMappingAudit();
  const product = {
    ...FULL,
    ...overrides,
    offers: { ...FULL.offers, ...offerOverrides },
  };
  if (overrides["offers"])
    product.offers = overrides["offers"] as typeof FULL.offers;
  const page = mockPageContext(
    PRODUCT_URL,
    `<html><head>${ld(product)}</head><body><main><p>Widget</p></main></body></html>`,
    1,
  );
  return audit.audit(mockCheckContext([page]));
}

describe("CheckoutOfferFieldMappingAudit", () => {
  const audit = new CheckoutOfferFieldMappingAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when no product page was scanned", () => {
    const home = mockPageContext(
      "https://example.com/",
      "<html><head></head><body><p>Home</p></body></html>",
      0,
    );
    expect(audit.audit(mockCheckContext([home])).status).toBe("na");
  });

  it("passes a complete offer and shows the synthesised feed row", () => {
    const result = run();
    expect(result.status).toBe("pass");
    expect(result.found).toContain("item_id=ARK-001");
    expect(result.found).toContain("availability=in_stock");
  });

  it("fails an item_id over 100 characters", () => {
    const result = run({ sku: "A".repeat(101) });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("item_id");
  });

  it("fails a name over 150 characters", () => {
    const result = run({ name: "N".repeat(151) });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("150");
  });

  it("fails a brand name over 70 characters", () => {
    const result = run({ brand: { "@type": "Brand", name: "B".repeat(71) } });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("70");
  });

  it("fails an AggregateOffer, which carries no single resolvable price", () => {
    const result = run({
      offers: {
        "@type": "AggregateOffer",
        lowPrice: 19.99,
        highPrice: 39.99,
        priceCurrency: "USD",
      },
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("single resolvable number");
  });

  it("fails a price written as a string with a currency symbol", () => {
    const result = run({}, { price: "$29.99" });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("price");
  });

  it("fails a priceCurrency that is not an ISO 4217 code", () => {
    const result = run({}, { priceCurrency: "US" });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("4217");
  });

  it("warns on an availability value that maps to no feed enum", () => {
    const result = run(
      {},
      { availability: "https://schema.org/LimitedAvailability" },
    );
    expect(result.status).toBe("warn");
    expect(result.message).toContain("LimitedAvailability");
  });

  it("accepts a GTIN-13 whose check digit is correct", () => {
    expect(run({ gtin13: "1234567890128" }).status).toBe("pass");
  });

  it("fails a GTIN-13 whose check digit is wrong and names the digit", () => {
    const result = run({ gtin13: "1234567890123" });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("check digit");
  });

  it("fails a pre-order offer with no availabilityStarts date", () => {
    const result = run({}, { availability: "https://schema.org/PreOrder" });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("availabilityStarts");
  });

  it("passes a pre-order offer that carries availabilityStarts", () => {
    const result = run(
      {},
      {
        availability: "https://schema.org/PreOrder",
        availabilityStarts: "2026-11-01",
      },
    );
    expect(result.status).toBe("pass");
  });

  it("fails when the sale price is higher than the list price", () => {
    const result = run(
      {},
      {
        price: 49.99,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          priceType: "https://schema.org/ListPrice",
          price: 29.99,
          priceCurrency: "USD",
        },
      },
    );
    expect(result.status).toBe("fail");
    expect(result.message).toContain("list price");
  });

  it("reports the product page the offer is on", () => {
    expect(run().pageUrl).toBe(PRODUCT_URL);
  });
});
