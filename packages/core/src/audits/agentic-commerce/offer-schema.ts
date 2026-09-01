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

export class OfferSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agentic-commerce/offer-schema",
    category: "agentic-commerce",
    title: "Offer schema on pricing pages",
    failureTitle: "Offer schema on pricing pages",
    description:
      "AI agents use Offer schema to answer pricing queries with exact numbers. Without price and priceCurrency in structured data, agents must scrape and guess pricing from page text, which often produces inaccurate or outdated results in AI-generated comparisons.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/agentic-commerce/offer-schema.md",
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
        'Without Offer schema on pricing pages, AI agents cannot answer "how much does X cost?" with exact numbers. Agents must scrape and guess pricing from page text, which frequently produces inaccurate or outdated results in AI-generated price comparisons.',
      fix: "Add Offer or AggregateOffer JSON-LD to your pricing pages. Include price, priceCurrency, and optionally availability and priceValidUntil.",
      code: `{
  "@context": "https://schema.org",
  "@type": "Offer",
  "name": "Pro Plan",
  "price": "99.00",
  "priceCurrency": "USD",
  "availability": "https://schema.org/InStock",
  "priceValidUntil": "2026-12-31"
}`,
      effort: "easy",
      docsUrl: "https://schema.org/Offer",
      tags: ["json-ld", "schema", "pricing", "ecommerce"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Offer schema lives on product/pricing pages. Shopify and most ecommerce
    // platforms serve products under /products/, not /pricing/ or /plans/, so a
    // URL gate produces false "not applicable" verdicts. Gate on the detected
    // product page type instead, which already covers SaaS pricing pages.
    const productPages = ctx.pages;

    if (productPages.length === 0) {
      return this.notApplicable(
        "No product pages scanned to evaluate Offer schema.",
        "Offer schema with price and priceCurrency on product pages.",
        "No product pages detected.",
      );
    }

    const pagesWithOffer = productPages.filter((p) => {
      const schemas = flattenJsonLd(p.structuredData ?? p.jsonLd);

      // Check for standalone Offer schemas
      const hasOfferSchema = schemas.some((s) =>
        matchesAnyType(s as Record<string, unknown>, [
          "Offer",
          "AggregateOffer",
        ]),
      );

      // Check for offer/offers property on other schemas
      const hasOfferProp = schemas.some((s) => {
        const obj = s as Record<string, unknown>;
        const offer = obj["offers"] || obj["offer"];
        if (!offer) return false;
        const offers = Array.isArray(offer) ? offer : [offer];
        return offers.some((o) => {
          const offerObj = o as Record<string, unknown>;
          return offerObj["price"] !== undefined && offerObj["priceCurrency"];
        });
      });

      if (hasOfferSchema) {
        const first = schemas.find((s) =>
          matchesAnyType(s as Record<string, unknown>, [
            "Offer",
            "AggregateOffer",
          ]),
        ) as Record<string, unknown>;
        return (
          first && first["price"] !== undefined && !!first["priceCurrency"]
        );
      }

      return hasOfferProp;
    });

    const allHave = pagesWithOffer.length === productPages.length;
    const someHave = pagesWithOffer.length > 0;

    if (allHave) {
      return this.pass(
        `Offer schema with price and priceCurrency found on all ${productPages.length} product page(s).`,
        "Offer schema with price and priceCurrency on product pages.",
        `${pagesWithOffer.length}/${productPages.length} product pages with Offer schema`,
      );
    }

    if (someHave) {
      return this.warn(
        `Offer schema found on ${pagesWithOffer.length} of ${productPages.length} product page(s).`,
        "Offer schema with price and priceCurrency on product pages.",
        `${pagesWithOffer.length}/${productPages.length} product pages with Offer schema`,
        {
          priority: "medium",
          description:
            "AI agents use Offer schema to answer pricing queries with exact numbers. Without price and priceCurrency in structured data, agents must scrape and guess pricing from page text, which often produces inaccurate or outdated results in AI-generated comparisons.",
          code: `{
  "@context": "https://schema.org",
  "@type": "Offer",
  "price": "99.00",
  "priceCurrency": "USD",
  "name": "Plan Name"
}`,
        },
      );
    }

    return this.fail(
      `No Offer schema found on ${productPages.length} product page(s).`,
      "Offer schema with price and priceCurrency on product pages.",
      `${pagesWithOffer.length}/${productPages.length} product pages with Offer schema`,
      {
        priority: "medium",
        description:
          "AI agents use Offer schema to answer pricing queries with exact numbers. Without price and priceCurrency in structured data, agents must scrape and guess pricing from page text, which often produces inaccurate or outdated results in AI-generated comparisons.",
        code: `{
  "@context": "https://schema.org",
  "@type": "Offer",
  "price": "99.00",
  "priceCurrency": "USD",
  "name": "Plan Name"
}`,
      },
    );
  }
}
