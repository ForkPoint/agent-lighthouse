import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { allJsonLdNodes } from "#core/parser";
import { PRODUCT_TYPES, resolveProducts, typesOf } from "#core/product-schema";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  PageType,
  ScoreDisplayMode,
} from "#core/types";

function isNode(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function has(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

/**
 * An offer states a price an agent can quote: an `Offer` with `price`, or an
 * `AggregateOffer` with `lowPrice` (schema.org's form for a variant price
 * range, which Google's product snippets accept), each with `priceCurrency`.
 */
function isPricedOffer(offer: unknown): boolean {
  if (!isNode(offer) || !has(offer["priceCurrency"])) return false;
  if (has(offer["price"])) return true;
  return typesOf(offer).includes("AggregateOffer") && has(offer["lowPrice"]);
}

function offersOf(node: Record<string, unknown>): unknown[] {
  const offers = node["offers"] ?? node["offer"];
  return Array.isArray(offers) ? offers : [offers];
}

/**
 * Whether any offer reachable from the page's products is priced. A
 * ProductGroup's variants are read with the group's shared offer beneath
 * their own, so a priced variant or a priced group both count. An offer may
 * also point at its product through `itemOffered`. A page with no Product
 * markup, such as a SaaS pricing page, is judged on its standalone Offer
 * nodes instead.
 */
function pageHasPricedOffer(blocks: object[]): boolean {
  const products = resolveProducts(blocks);
  if (products.some((product) => offersOf(product).some(isPricedOffer)))
    return true;
  const offers = allJsonLdNodes(blocks).filter(
    (node): node is Record<string, unknown> =>
      isNode(node) &&
      typesOf(node).some((t) => t === "Offer" || t === "AggregateOffer"),
  );
  if (products.length === 0) return offers.some(isPricedOffer);
  // `itemOffered` may nest the product or name it by `@id`.
  const productIds = new Set(
    allJsonLdNodes(blocks)
      .filter(isNode)
      .filter((node) => isProductLike(node) && node["@id"] !== undefined)
      .map((node) => node["@id"]),
  );
  const offersProduct = (item: unknown) =>
    (typeof item === "string" && productIds.has(item)) ||
    (isNode(item) && (isProductLike(item) || productIds.has(item["@id"])));
  return offers.some(
    (offer) => offersProduct(offer["itemOffered"]) && isPricedOffer(offer),
  );
}

function isProductLike(node: Record<string, unknown>): boolean {
  return typesOf(node).some(
    (t) => PRODUCT_TYPES.includes(t) || t === "ProductGroup",
  );
}

export class OfferSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agentic-commerce/offer-schema",
    category: "agentic-commerce",
    title: "Offer schema on pricing pages",
    failureTitle: "Offer schema on pricing pages",
    description:
      "AI agents use Offer schema to answer pricing queries with exact numbers. Without price and priceCurrency in structured data, agents must scrape and guess pricing from page text, which often produces inaccurate or outdated results in AI-generated comparisons.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/agentic-commerce/offer-schema.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    applicablePageTypes: [PageType.Product],
    defaultPriority: CheckPriority.Medium,
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
      effort: FixEffort.Easy,
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

    const pagesWithOffer = productPages.filter((p) =>
      pageHasPricedOffer(p.structuredData ?? p.jsonLd),
    );

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
          priority: CheckPriority.Medium,
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
        priority: CheckPriority.Medium,
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
