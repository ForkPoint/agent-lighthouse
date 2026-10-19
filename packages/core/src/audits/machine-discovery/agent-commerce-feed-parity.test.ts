import { describe, it, expect, vi } from "vitest";
import { AgentCommerceFeedParityAudit } from "./agent-commerce-feed-parity";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import { CheckStatus, HttpMethod } from "#core/types";

vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== "http:" && protocol !== "https:") return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

const URL_0 = "https://example.com/products/p-0";

/** A product whose every audited field is correct. */
function product(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Alpine Resole Kit",
    sku: "ARK-001",
    description:
      "A plain-text description of the resole kit, with no markup at all.",
    brand: { "@type": "Brand", name: "Alpine" },
    image: "https://example.com/img/ark-001.jpg",
    url: URL_0,
    itemCondition: "https://schema.org/NewCondition",
    offers: {
      "@type": "Offer",
      price: 29.99,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Alpine Store" },
      eligibleRegion: "US",
      url: URL_0,
    },
  };
}

interface PageOptions {
  /** Price rendered in the page copy. Defaults to the JSON-LD price. */
  visiblePrice?: string;
  /** Extra body markup, e.g. a variant selector. */
  body?: string;
  /** Canonical href. Defaults to the page URL. */
  canonical?: string;
}

function pageHtml(
  node: Record<string, unknown>,
  opts: PageOptions = {},
): string {
  const price = opts.visiblePrice ?? "$29.99";
  return `<html><head>
    <link rel="canonical" href="${opts.canonical ?? URL_0}">
    <script type="application/ld+json">${JSON.stringify(node)}</script>
  </head><body><main>
    <h1>Alpine Resole Kit</h1><p class="price">${price}</p>${opts.body ?? ""}
  </main></body></html>`;
}

function run(html: string | undefined, imageType = "image/jpeg") {
  const audit = new AgentCommerceFeedParityAudit();
  const ctx = mockCheckContext([
    mockPageContext(
      "https://example.com/",
      "<html><body><main><p>Home.</p></main></body></html>",
    ),
  ]);
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${URL_0}</loc></url></urlset>`;

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    const path = new URL(o.url).pathname;
    if (path === "/sitemap.xml")
      return mockFetchResult(xml, 200, "application/xml");
    if (o.method === HttpMethod.Head)
      return mockFetchResult("", 200, imageType);
    if (o.url === URL_0 && html) return mockFetchResult(html, 200, "text/html");
    return mockFetchResult("", 404);
  };
  return audit.audit(ctx);
}

/**
 * Several sitemap URLs at once. `scanned` pages are already in the scan, so the
 * audit must read them from context; the rest are served over GET.
 */
async function runSite(
  served: Record<string, string>,
  opts: { scanned?: Record<string, string>; imageType?: string } = {},
) {
  const audit = new AgentCommerceFeedParityAudit();
  const pages = [
    mockPageContext(
      "https://example.com/",
      "<html><body><main><p>Home.</p></main></body></html>",
    ),
    ...Object.entries(opts.scanned ?? {}).map(([url, html]) =>
      mockPageContext(url, html),
    ),
  ];
  const ctx = mockCheckContext(pages);
  const locs = [...Object.keys(opts.scanned ?? {}), ...Object.keys(served)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs.map((loc) => `<url><loc>${loc}</loc></url>`).join("")}</urlset>`;
  const gets: string[] = [];
  const heads: string[] = [];
  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    const path = new URL(o.url).pathname;
    if (path === "/sitemap.xml")
      return mockFetchResult(xml, 200, "application/xml");
    if (o.method === HttpMethod.Head) {
      heads.push(o.url);
      return mockFetchResult("", 200, opts.imageType ?? "image/jpeg");
    }
    gets.push(o.url);
    const html = served[o.url];
    return html
      ? mockFetchResult(html, 200, "text/html")
      : mockFetchResult("", 404);
  };
  const result = await audit.audit(ctx);
  return { result, gets, heads };
}

describe("AgentCommerceFeedParityAudit", () => {
  const audit = new AgentCommerceFeedParityAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when the sitemap sample holds no product page", async () => {
    const result = await run(
      "<html><head></head><body><main><p>An article.</p></main></body></html>",
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("passes a product page that satisfies both feed specs", async () => {
    const result = await run(pageHtml(product()));
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // The single most common defect in the wild: the enum name without its URL.
  it("fails on a bare availability token instead of the schema.org URL", async () => {
    const node = product();
    (node["offers"] as Record<string, unknown>)["availability"] = "InStock";
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("availability");
  });

  it("fails on a description that still carries HTML tags", async () => {
    const node = product();
    node["description"] =
      "A resole kit with <strong>every</strong> tool included.";
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("description");
  });

  it("fails on an itemCondition outside the three schema.org condition URLs", async () => {
    const node = product();
    node["itemCondition"] = "https://schema.org/DamagedCondition";
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("itemCondition");
  });

  it("fails when no field carries a target-country signal", async () => {
    const node = product();
    delete (node["offers"] as Record<string, unknown>)["eligibleRegion"];
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("country");
  });

  it("accepts shippingDetails.shippingDestination.addressCountry as the country signal", async () => {
    const node = product();
    const offers = node["offers"] as Record<string, unknown>;
    delete offers["eligibleRegion"];
    offers["shippingDetails"] = {
      "@type": "OfferShippingDetails",
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
    };
    expect((await run(pageHtml(node))).status).toBe(CheckStatus.Pass);
  });

  it("fails when the page exposes sibling variants but no item_group_id source", async () => {
    const body =
      '<select name="variant"><option value="s">Small</option><option value="m">Medium</option></select>';
    const result = await run(pageHtml(product(), { body }));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("item_group_id");
  });

  it("accepts inProductGroupWithID as the item_group_id source", async () => {
    const node = product();
    node["inProductGroupWithID"] = "ARK";
    const body =
      '<select name="variant"><option value="s">Small</option><option value="m">Medium</option></select>';
    expect((await run(pageHtml(node, { body }))).status).toBe(CheckStatus.Pass);
  });

  // Automatic item updates overwrite the feed from the page, so the two prices
  // must be the same number.
  it("fails when the JSON-LD price is absent from the prices rendered on the page", async () => {
    const result = await run(pageHtml(product(), { visiblePrice: "$39.99" }));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("29.99");
    expect(result.message).toContain("39.99");
  });

  it("fails when offers.url disagrees with rel=canonical", async () => {
    const result = await run(
      pageHtml(product(), {
        canonical: "https://example.com/products/p-0-canonical",
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("canonical");
  });

  // WebP is valid on the page and a risk in the feed, which is a warning, not a
  // rejection.
  it("warns on a WebP-only image", async () => {
    const node = product();
    node["image"] = "https://example.com/img/ark-001.webp";
    const result = await run(pageHtml(node), "image/webp");
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("image/webp");
  });

  it("reports the agent-commerce gap as its own sub-score", async () => {
    const result = await run(pageHtml(product()));
    expect(result.found).toContain("agent-commerce gap");
  });

  // ── JSON-LD shapes schema.org allows (feed parity read only one of each) ──

  const STORE_ID = "https://example.com/#store";

  /** A ProductGroup whose price lives on its variants, as storefronts emit it. */
  function productGroup(): Record<string, unknown> {
    const variant = (sku: string) => ({
      "@type": "Product",
      sku,
      inProductGroupWithID: "ARK",
      offers: {
        "@type": "Offer",
        price: 29.99,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    });
    const group = product();
    group["@type"] = "ProductGroup";
    group["productGroupID"] = "ARK";
    group["offers"] = {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      offerCount: 2,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Alpine Store" },
      eligibleRegion: "US",
      url: URL_0,
    };
    group["hasVariant"] = [variant("ARK-001-S"), variant("ARK-001-M")];
    return group;
  }

  it("reads the first URL of an image array", async () => {
    const node = product();
    node["image"] = [
      "https://example.com/img/ark-001.jpg",
      "https://example.com/img/ark-001-back.jpg",
    ];
    expect((await run(pageHtml(node))).status).toBe(CheckStatus.Pass);
  });

  it("reads an ImageObject's url", async () => {
    const node = product();
    node["image"] = {
      "@type": "ImageObject",
      url: "https://example.com/img/ark-001.jpg",
    };
    expect((await run(pageHtml(node))).status).toBe(CheckStatus.Pass);
  });

  it("takes the price from an AggregateOffer's lowPrice", async () => {
    const node = product();
    const offers = node["offers"] as Record<string, unknown>;
    offers["@type"] = "AggregateOffer";
    delete offers["price"];
    offers["lowPrice"] = 29.99;
    offers["highPrice"] = 29.99;
    expect((await run(pageHtml(node))).status).toBe(CheckStatus.Pass);
  });

  it("takes the price from a variant Offer and the group id from productGroupID", async () => {
    const result = await run(pageHtml(productGroup()));
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("resolves offers.seller by @id against a node the page defines", async () => {
    const group = productGroup();
    (group["offers"] as Record<string, unknown>)["seller"] = {
      "@id": STORE_ID,
    };
    const graph = {
      "@context": "https://schema.org",
      "@graph": [
        group,
        { "@type": "OnlineStore", "@id": STORE_ID, name: "Alpine Store" },
      ],
    };
    expect((await run(pageHtml(graph))).status).toBe(CheckStatus.Pass);
  });

  // True positive: a reference to a node nobody defines carries no name.
  it("still fails an offers.seller @id that no node on the page defines", async () => {
    const group = productGroup();
    (group["offers"] as Record<string, unknown>)["seller"] = {
      "@id": STORE_ID,
    };
    const result = await run(pageHtml(group));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain(STORE_ID);
    expect(result.message).toContain("no node on the page defines");
  });

  // True positive: the array is read, and what it holds is still judged.
  it("still fails an image array whose first URL is not HTTPS", async () => {
    const node = product();
    node["image"] = ["http://example.com/img/ark-001.jpg"];
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("is not an absolute HTTPS URL");
  });

  it("reads a contentUrl ImageObject, a typed @type array and an offers array", async () => {
    const node = product();
    node["@type"] = ["Product", "Thing"];
    node["image"] = [
      { "@type": "ImageObject", name: "Front view" },
      {
        "@type": "ImageObject",
        contentUrl: "https://example.com/img/ark-001.jpg",
      },
    ];
    node["offers"] = [node["offers"]];
    expect((await run(pageHtml(node))).status).toBe(CheckStatus.Pass);
  });

  it("reads a numeric sku, a brand array and a plain decimal price string", async () => {
    const node = product();
    node["sku"] = 1001;
    node["brand"] = ["", { "@type": "Brand", name: "Alpine" }];
    (node["offers"] as Record<string, unknown>)["price"] = "29.99";
    expect((await run(pageHtml(node))).status).toBe(CheckStatus.Pass);
  });

  // ── identity ──

  it("passes a GTIN with a correct check digit", async () => {
    const node = product();
    node["gtin13"] = "4006381333931";
    expect((await run(pageHtml(node))).status).toBe(CheckStatus.Pass);
  });

  it("fails a GTIN with the wrong check digit", async () => {
    const node = product();
    node["gtin13"] = "4006381333932";
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("gtin13");
    expect(result.message).toContain("wrong check digit");
  });

  it("fails a GTIN that is not 8, 12, 13 or 14 digits", async () => {
    const node = product();
    node["gtin"] = "ABC-12345";
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("not 8, 12, 13 or 14 digits");
  });

  it("fails an item_id over the 100-character cap", async () => {
    const node = product();
    node["sku"] = "S".repeat(101);
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("over the 100-character cap");
  });

  it("fails a brand over the 70-character cap", async () => {
    const node = product();
    node["brand"] = { "@type": "Brand", name: "B".repeat(71) };
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("brand is over the 70-character cap");
  });

  it("fails a description over the 5000-character cap", async () => {
    const node = product();
    node["description"] = "d".repeat(5001);
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("over the 5000-character cap");
  });

  it("fails a product with no image", async () => {
    const node = product();
    delete node["image"];
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("no image");
  });

  // ── offer ──

  it("fails a Product with no Offer", async () => {
    const node = product();
    delete node["offers"];
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("no Offer on the Product");
  });

  it("fails an Offer whose price is not a positive decimal", async () => {
    const node = product();
    (node["offers"] as Record<string, unknown>)["price"] = "29,99 USD";
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("is not a positive decimal");
    const zero = product();
    (zero["offers"] as Record<string, unknown>)["price"] = 0;
    expect((await run(pageHtml(zero))).status).toBe(CheckStatus.Fail);
  });

  it("fails when neither the Offer nor any variant carries a price", async () => {
    const node = product();
    delete (node["offers"] as Record<string, unknown>)["price"];
    node["hasVariant"] = ["not a node", { "@type": "Product", offers: {} }];
    node["inProductGroupWithID"] = "ARK";
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain(
      "carries no price, no lowPrice and no variant Offer price",
    );
    const single = product();
    delete (single["offers"] as Record<string, unknown>)["price"];
    const plain = await run(pageHtml(single));
    expect(plain.status).toBe(CheckStatus.Fail);
    expect(plain.message).toContain("carries no price");
  });

  it("fails a priceCurrency that is not an active ISO 4217 code", async () => {
    const node = product();
    (node["offers"] as Record<string, unknown>)["priceCurrency"] = "XYZ";
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain('priceCurrency "XYZ"');
  });

  it("fails a schema.org availability URL that maps to no feed enum value", async () => {
    const node = product();
    (node["offers"] as Record<string, unknown>)["availability"] =
      "https://schema.org/Discontinued";
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("maps to no feed enum value");
  });

  it("fails an Offer with no availability and no seller", async () => {
    const node = product();
    const offers = node["offers"] as Record<string, unknown>;
    delete offers["availability"];
    delete offers["seller"];
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("carries no availability");
    expect(result.message).toContain("no offers.seller.name");
  });

  it("accepts a seller given as a plain name", async () => {
    const node = product();
    (node["offers"] as Record<string, unknown>)["seller"] = "Alpine Store";
    expect((await run(pageHtml(node))).status).toBe(CheckStatus.Pass);
  });

  it("accepts availableAtOrFrom.address.addressCountry as the country signal", async () => {
    const node = product();
    const offers = node["offers"] as Record<string, unknown>;
    delete offers["eligibleRegion"];
    offers["availableAtOrFrom"] = {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressCountry: "de" },
    };
    expect((await run(pageHtml(node))).status).toBe(CheckStatus.Pass);
  });

  // The dossier defers name mapping: only alpha-2 shapes resolve.
  it("does not read a country name as a country signal", async () => {
    const node = product();
    (node["offers"] as Record<string, unknown>)["eligibleRegion"] =
      "United States";
    const result = await run(pageHtml(node));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("no target country signal");
  });

  it("reads a comma-decimal rendered price", async () => {
    const node = product();
    (node["offers"] as Record<string, unknown>)["priceCurrency"] = "EUR";
    expect(
      (await run(pageHtml(node, { visiblePrice: "29,99 EUR" }))).status,
    ).toBe(CheckStatus.Pass);
  });

  it("fails an offer url against a canonical that cannot be parsed", async () => {
    const result = await run(pageHtml(product(), { canonical: "http://[" }));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("is not the page canonical");
  });

  it("raises no image risk when the HEAD answer is not 200", async () => {
    const node = product();
    node["image"] = "https://example.com/img/ark-001.webp";
    const audit = new AgentCommerceFeedParityAudit();
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", "<html></html>"),
    ]);
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${URL_0}</loc></url></urlset>`;
    ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
      if (new URL(o.url).pathname === "/sitemap.xml")
        return mockFetchResult(xml, 200, "application/xml");
      if (o.method === HttpMethod.Head)
        return mockFetchResult("", 403, "image/webp");
      if (o.url === URL_0)
        return mockFetchResult(pageHtml(node), 200, "text/html");
      return mockFetchResult("", 404);
    };
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.Pass);
  });

  // ── sampling ──

  it("treats og:type=product with no Product node as a PDP missing its data", async () => {
    const html = `<html><head><meta property="og:type" content="product"></head>
      <body><main><h1>Kit</h1></main></body></html>`;
    const result = await run(html);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("no sku, mpn or productID");
    expect(result.message).toContain("no Offer on the Product");
    // Six defects, five shown.
    expect(result.message).toContain("(1 more)");
  });

  it("is notApplicable when the sampled URL cannot be fetched", async () => {
    expect((await run(undefined)).status).toBe(CheckStatus.NotApplicable);
  });

  it("reads a sitemap URL already in the scan from context, not the network", async () => {
    const { result, gets } = await runSite(
      {},
      { scanned: { [URL_0]: pageHtml(product()) } },
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(gets).not.toContain(URL_0);
  });

  it("skips a scanned sitemap page that is not a product page", async () => {
    const { result } = await runSite(
      {},
      { scanned: { [URL_0]: "<html><body><p>Article.</p></body></html>" } },
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("HEADs at most two product images per scan", async () => {
    const served: Record<string, string> = {};
    for (let i = 0; i < 3; i += 1) {
      const url = `https://example.com/products/q-${i}`;
      const node = product();
      node["url"] = url;
      node["image"] = `https://example.com/img/q-${i}.jpg`;
      (node["offers"] as Record<string, unknown>)["url"] = url;
      served[url] = pageHtml(node, { canonical: url });
    }
    const { result, heads } = await runSite(served);
    expect(heads).toHaveLength(2);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("3 product page(s) sampled");
  });
});
