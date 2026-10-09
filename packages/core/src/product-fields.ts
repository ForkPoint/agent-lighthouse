import type { ProductFieldVerification } from "./types";
import type { PageContext } from "./check-context";
import { FieldStatus, PageType } from "./types";
import { resolveProducts } from "./product-schema";

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
  sku: FieldStatus.Missing,
  gtin: FieldStatus.Missing,
  brand: FieldStatus.Missing,
  category: FieldStatus.Missing,
  availability: FieldStatus.Missing,
  priceCurrency: FieldStatus.Missing,
  stockLevel: FieldStatus.Missing,
  reviewCount: FieldStatus.Missing,
};

/**
 * Read product fields straight from the scanned product page(s)' structured
 * data. Looks only at pages typed `product` (the user-supplied product page in
 * full-report mode), mirroring how a search engine parses that page.
 */
export function extractProductFieldVerification(
  pages: PageContext[],
): ProductFieldVerification {
  const productPages = pages.filter((p) => p.pageType === PageType.Product);

  let product: Record<string, unknown> | undefined;
  let sourceUrl: string | undefined;
  for (const page of productPages) {
    // A ProductGroup's variants carry its shared properties, such as brand.
    const [found] = resolveProducts(page.structuredData ?? page.jsonLd);
    if (found) {
      product = found;
      sourceUrl = page.url;
      break;
    }
  }

  if (!product) return { ...EMPTY };

  const offer = first(product["offers"] ?? product["offer"]);
  const rating = first(product["aggregateRating"]);
  const st = (b: boolean): FieldStatus =>
    b ? FieldStatus.Found : FieldStatus.Missing;

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
      price && currency
        ? FieldStatus.Found
        : price || currency
          ? FieldStatus.Partial
          : FieldStatus.Missing,
    // Explicit inventory count = found; an availability enum alone = partial.
    stockLevel: inventory
      ? FieldStatus.Found
      : availability
        ? FieldStatus.Partial
        : FieldStatus.Missing,
    reviewCount: st(reviewCount),
    sourceUrl,
  };
}
