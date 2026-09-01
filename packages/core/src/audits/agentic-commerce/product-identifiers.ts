import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { flattenJsonLd } from "../../parser";
import { weightForGrade } from "../../scorer";

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

export class ProductIdentifiersAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agentic-commerce/product-identifiers",
    category: "agentic-commerce",
    title: "Product identifiers (GTIN/UPC/MPN)",
    failureTitle: "Product identifiers (GTIN/UPC/MPN)",
    description:
      "AI agents use unique identifiers like GTIN, UPC, or MPN to de-duplicate products across different sources and confirm they are looking at the exact item the user wants. Without them, agents may confuse similar products or fail to find specific pricing.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/agentic-commerce/product-identifiers.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    applicablePageTypes: ["product"],
    defaultPriority: "high",
    guidance: {
      impact:
        "Without unique identifiers (GTIN, UPC, MPN, or SKU), AI agents cannot de-duplicate your products across different sources or confirm they are looking at the exact item the user wants. This leads to product confusion, missed price-comparison opportunities, and lower visibility in AI shopping assistants.",
      fix: "Add at least one unique product identifier to your Product JSON-LD. Use sku for internal IDs, gtin13 for barcodes, or mpn for manufacturer part numbers.",
      code: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "sku": "SKU-123456",
  "gtin13": "1234567890123",
  "mpn": "MPN-7890"
}`,
      effort: "easy",
      docsUrl: "https://schema.org/Product",
      tags: ["json-ld", "schema", "product", "ecommerce", "identifiers"],
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
        "No Product schema found to check for identifiers.",
        "Product schema with GTIN/UPC/MPN or SKU.",
        "None",
        {
          priority: "high",
          description:
            "AI agents require unique product identifiers to reliably identify and compare products.",
          code: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "sku": "SKU-123456",
  "gtin13": "1234567890123"
}`,
        },
      );
    }

    const first = products[0] as Record<string, unknown>;
    // schema.org product identifiers, including productID (valid unique
    // identifier, common in Microdata markup) alongside GTIN/MPN/SKU.
    const identifiers = [
      "gtin",
      "gtin8",
      "gtin12",
      "gtin13",
      "gtin14",
      "mpn",
      "sku",
      "productID",
    ];
    const found = identifiers.filter((id) => first[id]);

    if (first["offers"]) {
      const offers = Array.isArray(first["offers"])
        ? first["offers"]
        : [first["offers"]];
      for (const offer of offers) {
        if (offer && typeof offer === "object") {
          const offerObj = offer as Record<string, unknown>;
          for (const id of identifiers) {
            if (offerObj[id] && !found.includes(id)) {
              found.push(id);
            }
          }
        }
      }
    }

    if (found.length > 0) {
      return this.pass(
        `Found product identifiers: ${found.join(", ")}.`,
        "Product schema with GTIN/UPC/MPN or SKU.",
        found.join(", "),
      );
    }

    return this.fail(
      "No unique product identifiers (GTIN, SKU, MPN) found in Product schema.",
      "Product schema with GTIN/UPC/MPN or SKU.",
      "None",
      {
        priority: "high",
        description:
          'Unique identifiers are critical for AI agents to precisely match products in global catalogs. Add "sku", "gtin13", or "mpn" to your Product schema.',
        code: `{
  "@type": "Product",
  "sku": "REQUIRED-ID",
  "gtin13": "13-DIGIT-GTIN"
}`,
      },
    );
  }
}
