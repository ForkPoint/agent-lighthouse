import type { FieldStatus, ProductFieldVerification } from "./types";
import type { PageContext } from "./check-context";

const PRODUCT_TYPES = ["Product", "IndividualProduct", "ProductModel"];

/** Flatten @graph wrappers so nested schema objects are inspectable. */
function flatten(blocks: object[]): Record<string, unknown>[] {
  const flat: Record<string, unknown>[] = [];
  for (const block of blocks) {
    const b = block as Record<string, unknown>;
    if (Array.isArray(b["@graph"])) {
      for (const item of b["@graph"]) {
        if (item && typeof item === "object")
          flat.push(item as Record<string, unknown>);
      }
    } else {
      flat.push(b);
    }
  }
  return flat;
}

function isType(s: Record<string, unknown>, types: string[]): boolean {
  const t = s["@type"];
  if (typeof t === "string") return types.includes(t);
  if (Array.isArray(t)) return t.some((x) => types.includes(x as string));
  return false;
}

/** A field is present only if it carries a real value (not '', null, "null"). */
function has(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.some(has);
  if (typeof v === "object") return Object.keys(v).length > 0;
  const s = String(v as string | number | boolean)
    .trim()
    .toLowerCase();
  return s !== "" && s !== "null" && s !== "undefined" && s !== "n/a";
}

function first(v: unknown): Record<string, unknown> | undefined {
  const arr = Array.isArray(v) ? v : [v];
  return arr.find((x) => x && typeof x === "object") as
    Record<string, unknown> | undefined;
}

const EMPTY: ProductFieldVerification = {
  sku: "missing",
  gtin: "missing",
  brand: "missing",
  category: "missing",
  availability: "missing",
  priceCurrency: "missing",
  stockLevel: "missing",
  reviewCount: "missing",
};

/**
 * Read product fields straight from the scanned product page(s)' structured
 * data. Looks only at pages typed `product` (the user-supplied product page in
 * full-report mode), mirroring how a search engine parses that page.
 */
export function extractProductFieldVerification(
  pages: PageContext[],
): ProductFieldVerification {
  const productPages = pages.filter((p) => p.pageType === "product");

  let product: Record<string, unknown> | undefined;
  let sourceUrl: string | undefined;
  for (const page of productPages) {
    const found = flatten(page.structuredData ?? page.jsonLd).find((s) =>
      isType(s, PRODUCT_TYPES),
    );
    if (found) {
      product = found;
      sourceUrl = page.url;
      break;
    }
  }

  if (!product) return { ...EMPTY };

  const offer = first(product["offers"] ?? product["offer"]);
  const rating = first(product["aggregateRating"]);
  const st = (b: boolean): FieldStatus => (b ? "found" : "missing");

  const hasGtin = ["gtin", "gtin8", "gtin12", "gtin13", "gtin14"].some((k) =>
    has(product![k]),
  );
  const sku =
    has(product["sku"]) ||
    has(product["productSKU"]) ||
    has(product["productID"]) ||
    has(product["mpn"]) ||
    hasGtin;

  const price = has(offer?.["price"]) || has(product["price"]);
  const currency =
    has(offer?.["priceCurrency"]) || has(product["priceCurrency"]);
  const availability =
    has(offer?.["availability"]) || has(product["availability"]);
  const inventory =
    has(offer?.["inventoryLevel"]) || has(product["inventoryLevel"]);
  const reviewCount =
    has(rating?.["reviewCount"]) ||
    has(product["reviewCount"]) ||
    has(rating?.["ratingCount"]);

  return {
    sku: st(sku),
    gtin: st(hasGtin),
    brand: st(has(product["brand"])),
    category: st(has(product["category"])),
    availability: st(availability),
    // Price and currency are both required for a clean "found"; price-only
    // (e.g. a malformed priceCurrency) reads partial rather than missing.
    priceCurrency:
      price && currency ? "found" : price || currency ? "partial" : "missing",
    // Explicit inventory count = found; an availability enum alone = partial.
    stockLevel: inventory ? "found" : availability ? "partial" : "missing",
    reviewCount: st(reviewCount),
    sourceUrl,
  };
}
