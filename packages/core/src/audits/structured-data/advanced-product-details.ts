// Absorbs the Product half of v1 3.8 (service-product-schema) as of the
// 2026-08-22 split (Plan 4, Task 9): the `name` requirement is ported here,
// where the wider Product type list already lives. 3.8's `description`
// requirement and its "offers/provider counts as a brand" fallback are
// deliberately not ported — see the dossier's "Ported from 3.8" section.
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { flattenJsonLd } from "../../parser";

function matchesAnyType(
  schema: Record<string, unknown>,
  types: string[],
): boolean {
  return types.some((t) => {
    const st = schema["@type"];
    if (typeof st === "string") return st === t;
    if (Array.isArray(st)) return st.includes(t);
    return false;
  });
}

export class ProductDetailsAudit extends Audit {
  static override meta: AuditMeta = {
    id: "structured-data/advanced-product-details",
    category: "structured-data",
    title: "Advanced product details",
    failureTitle: "Advanced product details",
    description:
      "AI agents use a product's name, brand, category, and availability status to filter search results and answer availability queries. A Product without a name cannot be matched to a catalog entry at all; missing brand, category or availability makes it less likely to surface in filtered AI recommendations.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/structured-data/advanced-product-details.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    applicablePageTypes: ["product"],
    defaultPriority: "medium",
    guidance: {
      impact:
        'Missing brand, category, or availability in your Product schema means AI agents cannot filter or surface your products in response to specific shopping queries. Your products are less likely to appear in AI-generated comparisons and "best of" recommendations.',
      fix: "Give every Product JSON-LD node a name, then add brand (as a nested Organization or Brand), category, and availability. If availability lives on your Offer, ensure it uses a schema.org ItemAvailability value.",
      code: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "brand": {
    "@type": "Brand",
    "name": "Your Brand"
  },
  "category": "Electronics > Smartphones",
  "offers": {
    "@type": "Offer",
    "availability": "https://schema.org/InStock"
  }
}`,
      effort: "easy",
      docsUrl: "https://schema.org/Product",
      tags: ["json-ld", "schema", "product", "ecommerce"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const schemas = ctx.pages.flatMap((p) =>
      flattenJsonLd(p.structuredData ?? p.jsonLd),
    );
    const products = schemas.filter((s) =>
      matchesAnyType(s as Record<string, unknown>, [
        "Product",
        "IndividualProduct",
        "ProductModel",
      ]),
    );

    if (products.length === 0) {
      return this.fail(
        "No Product schema found.",
        "Product schema with name, brand, category, and availability.",
        "None",
      );
    }

    const first = products[0] as Record<string, unknown>;
    const missing: string[] = [];

    // 0. Name — ported from 3.8. Unlike brand/category/availability, which
    // Google lists as *recommended*, `name` is one of the four properties its
    // merchant-listing table marks required, so a nameless Product is not
    // eligible at all and fails regardless of the rest.
    const hasName = !!first["name"];

    // 1. Brand or Manufacturer
    const hasBrand = !!first["brand"] || !!first["manufacturer"];
    if (!hasBrand) missing.push("brand");

    // 2. Category
    if (!first["category"]) missing.push("category");

    // 3. Availability (could be in Product or linked Offer)
    let hasAvailability = !!first["availability"];
    if (!hasAvailability && first["offers"]) {
      const offers = Array.isArray(first["offers"])
        ? first["offers"]
        : [first["offers"]];
      hasAvailability = offers.some(
        (o: Record<string, unknown>) => o && o.availability,
      );
    }
    if (!hasAvailability) missing.push("availability");

    if (!hasName) {
      const alsoMissing =
        missing.length > 0 ? ` (also missing: ${missing.join(", ")})` : "";
      return this.fail(
        `Product schema is missing the required name property${alsoMissing}.`,
        "Product schema with name, brand, category, and availability.",
        `Missing ${["name", ...missing].join(", ")}`,
        {
          priority: "medium",
          description:
            "name is a required Product property in Google's merchant-listing extraction: without it the product cannot be matched to a catalog entry at all, so brand, category and availability have nothing to attach to.",
        },
      );
    }

    if (missing.length === 0) {
      return this.pass(
        "Found brand, category, and availability in Product schema.",
        "Product schema with name, brand, category, and availability.",
        "All present",
      );
    }

    if (missing.length < 3) {
      return this.warn(
        `Missing some product details: ${missing.join(", ")}.`,
        "Product schema with name, brand, category, and availability.",
        `Missing ${missing.join(", ")}`,
        {
          priority: "medium",
          description: `AI agents use ${missing.join(", ")} to accurately categorize and recommend your products.`,
        },
      );
    }

    return this.fail(
      "Missing critical product details (brand, category, availability).",
      "Product schema with name, brand, category, and availability.",
      "None",
      {
        priority: "medium",
        description:
          "AI agents require brand and availability information to provide accurate shopping advice.",
      },
    );
  }
}
