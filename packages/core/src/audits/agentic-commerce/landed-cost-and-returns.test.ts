import { describe, it, expect } from "vitest";
import { LandedCostAndReturnsAudit } from "./landed-cost-and-returns";
import { mockPageContext, mockCheckContext } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import { CheckStatus } from "#core/types";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const productPage = (head: string) =>
  mockPageContext(
    "https://example.com/products/widget",
    `<html><head>${head}</head><body><main><p>Widget</p></main></body></html>`,
    1,
  );
const homePage = (head = "") =>
  mockPageContext(
    "https://example.com/",
    `<html><head>${head}</head><body><main><p>Home</p></main></body></html>`,
    0,
  );

const FULL_SHIPPING = {
  "@type": "OfferShippingDetails",
  name: "standard",
  shippingRate: { "@type": "MonetaryAmount", value: 5.99, currency: "USD" },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: {
      "@type": "QuantitativeValue",
      minValue: 0,
      maxValue: 1,
      unitCode: "DAY",
    },
    transitTime: {
      "@type": "QuantitativeValue",
      minValue: 1,
      maxValue: 3,
      unitCode: "DAY",
    },
  },
};

const FULL_RETURNS = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "US",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 30,
};

function product(offerExtras: Record<string, unknown>) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Widget",
    offers: {
      "@type": "Offer",
      price: "29.99",
      priceCurrency: "USD",
      ...offerExtras,
    },
  };
}

function run(offerExtras: Record<string, unknown>) {
  const audit = new LandedCostAndReturnsAudit();
  return audit.audit(
    mockCheckContext([homePage(), productPage(ld(product(offerExtras)))]),
  );
}

describe("LandedCostAndReturnsAudit", () => {
  const audit = new LandedCostAndReturnsAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when no product page was scanned", () => {
    const result = audit.audit(mockCheckContext([homePage()]));
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("passes when both legs are fully machine-readable", () => {
    const result = run({
      shippingDetails: FULL_SHIPPING,
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // The exact strings the merchant pastes into the feed.
  it("synthesises the feed values the legs map to", () => {
    const result = run({
      shippingDetails: FULL_SHIPPING,
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    expect(result.found).toContain("US::standard:5.99:1:3");
    expect(result.found).toContain("return_deadline_in_days=30");
  });

  // handlingTime and transitTime are nested under deliveryTime, not direct
  // properties of OfferShippingDetails.
  it("fails the shipping leg when handlingTime sits directly on OfferShippingDetails", () => {
    const misplaced = {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: 5.99, currency: "USD" },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: 1,
        unitCode: "DAY",
      },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: 1,
          maxValue: 3,
          unitCode: "DAY",
        },
      },
    };
    const result = run({
      shippingDetails: misplaced,
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("deliveryTime");
  });

  it("accepts doesNotShip:true as an explicit shipping answer", () => {
    const result = run({
      shippingDetails: { "@type": "OfferShippingDetails", doesNotShip: true },
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("fails the returns leg when a finite window carries no merchantReturnDays", () => {
    const { merchantReturnDays: _drop, ...noDays } = FULL_RETURNS;
    const result = run({
      shippingDetails: FULL_SHIPPING,
      hasMerchantReturnPolicy: noDays,
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("merchantReturnDays");
  });

  // A URL is not a number an agent can compare.
  it("warns, never passes, on a policy that only carries a merchantReturnLink", () => {
    const result = run({
      shippingDetails: FULL_SHIPPING,
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        merchantReturnLink: "https://example.com/returns",
      },
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("merchantReturnLink");
  });

  it("reads a returns policy declared on the Organization node", () => {
    const audit2 = new LandedCostAndReturnsAudit();
    const org = ld({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Acme",
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    const result = audit2.audit(
      mockCheckContext([
        homePage(org),
        productPage(ld(product({ shippingDetails: FULL_SHIPPING }))),
      ]),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("fails an Offer that carries neither leg", () => {
    const result = run({});
    expect(result.status).toBe(CheckStatus.Fail);
  });

  it("reports the product page the offer is on", () => {
    const result = run({
      shippingDetails: FULL_SHIPPING,
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    expect(result.pageUrl).toBe("https://example.com/products/widget");
  });

  it("reads a product marked up in microdata", () => {
    // The scanner merges JSON-LD, microdata and RDFa into structuredData.
    const page = productPage("");
    page.structuredData = [
      {
        "@type": "Product",
        name: "Widget",
        offers: { "@type": "Offer", price: "16.00", priceCurrency: "GBP" },
      },
    ];
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).not.toBe(CheckStatus.NotApplicable);
    expect(result.message).toMatch(/shipping/i);
  });

  it("reads numeric strings, a bare destination country and an array of details", () => {
    const result = run({
      shippingDetails: [
        {
          "@type": "OfferShippingDetails",
          name: " express ",
          shippingRate: { value: "12.5", currency: "EUR" },
          shippingDestination: "DE",
          deliveryTime: {
            handlingTime: { minValue: "0", maxValue: "2", unitCode: "d" },
            transitTime: { minValue: 1, maxValue: 4 },
          },
        },
      ],
      hasMerchantReturnPolicy: [{ ...FULL_RETURNS, merchantReturnDays: "14" }],
    });
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("shipping=DE::express:12.50:2:4");
    expect(result.found).toContain("return_deadline_in_days=14");
  });

  it("carries the destination region into the feed value", () => {
    const result = run({
      shippingDetails: {
        ...FULL_SHIPPING,
        shippingDestination: { addressCountry: "US", addressRegion: "CA" },
      },
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    expect(result.found).toContain("shipping=US:CA:standard:5.99:1:3");
  });

  it("accepts doesNotShip given as the string true", () => {
    const result = run({
      shippingDetails: { doesNotShip: "true" },
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("shipping=doesNotShip");
  });

  it("fails a shipping rate with no currency and a destination with no country", () => {
    const result = run({
      shippingDetails: {
        ...FULL_SHIPPING,
        shippingRate: { "@type": "MonetaryAmount", value: 5.99 },
        shippingDestination: { "@type": "DefinedRegion", addressRegion: "CA" },
      },
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("shippingRate is not a MonetaryAmount");
    expect(result.message).toContain("carries no addressCountry");
    expect(result.found).not.toContain("shipping=");
  });

  it("fails a delivery time in hours or without a maximum", () => {
    const hours = run({
      shippingDetails: {
        ...FULL_SHIPPING,
        deliveryTime: {
          handlingTime: { minValue: 0, maxValue: 24, unitCode: "HUR" },
          transitTime: { minValue: 1, maxValue: 3, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    expect(hours.status).toBe(CheckStatus.Fail);
    expect(hours.message).toContain(
      "deliveryTime does not carry both handlingTime and transitTime",
    );
    const open = run({
      shippingDetails: {
        ...FULL_SHIPPING,
        deliveryTime: {
          handlingTime: { minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime: { minValue: 1, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    expect(open.status).toBe(CheckStatus.Fail);
    expect(open.message).toContain("deliveryTime does not carry both");
  });

  it("fails a return category outside the enum and a country that is not alpha-2", () => {
    const result = run({
      shippingDetails: FULL_SHIPPING,
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "USA",
        returnPolicyCategory: "https://schema.org/MerchantReturnSometimes",
        merchantReturnLink: "https://example.com/returns",
      },
    });
    // A link beside a broken category is not "link only": the category is judged.
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("outside the three-value enum");
    expect(result.message).toContain("not an ISO 3166-1 alpha-2 code");
  });

  it("passes a no-returns policy, which needs no return window", () => {
    const result = run({
      shippingDetails: FULL_SHIPPING,
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "US",
        returnPolicyCategory: "MerchantReturnNotPermitted",
      },
    });
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).not.toContain("return_deadline_in_days");
  });

  it("fails a finite window whose day count is not a positive integer", () => {
    for (const merchantReturnDays of [0, 2.5, "two weeks"]) {
      const result = run({
        shippingDetails: FULL_SHIPPING,
        hasMerchantReturnPolicy: { ...FULL_RETURNS, merchantReturnDays },
      });
      expect(result.status).toBe(CheckStatus.Fail);
      expect(result.message).toContain("must be a positive integer");
    }
  });

  it("reads a standalone Offer node on a product page", () => {
    const offer = {
      "@context": "https://schema.org",
      "@type": ["Offer", 3],
      price: 10,
      priceCurrency: "USD",
      shippingDetails: FULL_SHIPPING,
      hasMerchantReturnPolicy: FULL_RETURNS,
    };
    const result = audit.audit(mockCheckContext([productPage(ld(offer))]));
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("reads the product's offer before an unrelated Offer node", () => {
    const related = { "@type": "Offer", price: 1, priceCurrency: "USD" };
    const own = {
      "@type": "Product",
      name: "Widget",
      offers: {
        "@type": "Offer",
        price: 10,
        priceCurrency: "USD",
        shippingDetails: FULL_SHIPPING,
      },
    };
    const result = audit.audit(
      mockCheckContext([productPage(ld([related, own]))]),
    );
    expect(result.message).not.toMatch(/no shippingDetails/i);
  });
});
