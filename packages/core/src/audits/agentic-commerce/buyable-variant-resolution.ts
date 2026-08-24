import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { allJsonLdNodes } from '../../parser';
import { platformFingerprint } from '../../gatherers/commerce';

/** Select elements whose name says they choose between variants. */
const VARIANT_NAME = /(size|colour|color|variant|option|style|width|length)/i;
/** Option text that stands for "nothing chosen yet". */
const PLACEHOLDER = /^(choose|select|pick|please|--|—|\s*$)/i;
/** Attributes a storefront puts on each selectable variant. */
const VARIANT_ATTRIBUTES = ['data-variant-id', 'data-option-value', 'data-product-variant'];
/** How many product pages are examined. */
const MAX_PAGES = 3;
/** How many missing-field findings a message names. */
const MAX_SHOWN = 5;

/** How the variants on a page were established, and how many there are. */
export interface VariantEvidence {
  count: number;
  source: 'select' | 'data-attribute' | 'platform-json';
  detail: string;
}

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function typesOf(node: Record<string, unknown>): string[] {
  const raw = node['@type'];
  return (Array.isArray(raw) ? raw : [raw]).filter((t): t is string => typeof t === 'string');
}

function str(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (typeof value === 'number') return String(value);
  return undefined;
}

/** The variant identifier schema.org accepts: sku, or any gtin flavour. */
function identifierOf(node: Record<string, unknown>): string | undefined {
  return (
    str(node['sku']) ??
    str(node['gtin']) ??
    str(node['gtin13']) ??
    str(node['gtin12']) ??
    str(node['gtin8']) ??
    str(node['gtin14']) ??
    str(node['mpn'])
  );
}

/** The Offer nodes hanging directly off one product node. */
function offersOf(node: Record<string, unknown>): Record<string, unknown>[] {
  const raw = node['offers'];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter(isObj);
}

/** Which of price, priceCurrency and availability this offer set is missing. */
function missingOfferFields(offers: Record<string, unknown>[]): string[] {
  if (offers.length === 0) return ['offers'];
  const plain = offers.find((offer) => !typesOf(offer).includes('AggregateOffer')) ?? offers[0]!;
  const missing: string[] = [];
  if (str(plain['price']) === undefined) missing.push('offers.price');
  if (str(plain['priceCurrency']) === undefined) missing.push('offers.priceCurrency');
  if (str(plain['availability']) === undefined) missing.push('offers.availability');
  return missing;
}

/**
 * Establish that this page presents variants at all, from the raw HTML.
 *
 * Three independent sources, strongest count wins: a variant `<select>` with at
 * least two real options, repeated variant data attributes, or the storefront's
 * own variant JSON. Markup is never the source — the whole point is to compare
 * what a human is shown against what the markup resolves.
 */
export function detectVariants(page: PageContext): VariantEvidence | undefined {
  const $ = page.$;
  const found: VariantEvidence[] = [];

  $('select').each((_i, element) => {
    const el = $(element);
    const name = `${el.attr('name') ?? ''} ${el.attr('id') ?? ''} ${el.attr('class') ?? ''}`;
    if (!VARIANT_NAME.test(name)) return;
    const options = el
      .find('option')
      .toArray()
      .filter((option) => {
        const value = $(option).attr('value') ?? '';
        const text = $(option).text().trim();
        return value !== '' && !PLACEHOLDER.test(text);
      });
    if (options.length >= 2) {
      found.push({ count: options.length, source: 'select', detail: `<select ${name.trim()}>` });
    }
  });

  for (const attribute of VARIANT_ATTRIBUTES) {
    const count = $(`[${attribute}]`).length;
    if (count >= 2) found.push({ count, source: 'data-attribute', detail: attribute });
  }

  const platform = platformFingerprint(page);
  const html = page.fetchResult.body;
  if (platform === 'shopify') {
    const match = /"variants"\s*:\s*\[(.*?)\]/s.exec(html);
    // Counting `"id"` occurrences rather than parsing: the block is a fragment
    // of a larger script, so it is not JSON on its own.
    const ids = match ? (match[1]!.match(/"id"\s*:/g) ?? []).length : 0;
    if (ids >= 2) found.push({ count: ids, source: 'platform-json', detail: 'Shopify variants[]' });
  }
  if (platform === 'woocommerce') {
    const match = /data-product_variations=("|')(.*?)\1/s.exec(html);
    const ids = match ? (match[2]!.match(/variation_id/g) ?? []).length : 0;
    if (ids >= 2) {
      found.push({ count: ids, source: 'platform-json', detail: 'WooCommerce variations_form' });
    }
  }

  if (found.length === 0) return undefined;
  return found.reduce((best, candidate) => (candidate.count > best.count ? candidate : best));
}

const EXPECTED =
  'Each variant a shopper can choose is addressable in the markup: a ProductGroup with productGroupID, variesBy and a hasVariant entry per variant carrying sku-or-gtin and its own price, currency and availability — or one Product node per variant with the same';

export class BuyableVariantResolutionAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agentic-commerce/buyable-variant-resolution',
    category: 'agentic-commerce',
    title: 'Buyable Variant Resolution',
    failureTitle: 'Buyable Variant Resolution',
    description:
      'Finds product pages that offer a shopper a size or colour choice but publish no per-variant purchasable identifier with its own price and availability, so an agent cannot turn "the blue one in medium" into a line item. Variants are established from the rendered HTML, then the structured data is required to resolve them.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'high',
    dossier: 'docs/evidence/audits/agentic-commerce/buyable-variant-resolution.md',
    applicablePageTypes: ['product'],
    guidance: {
      impact:
        'The agentic-commerce feed models a catalogue variant-first: every sellable thing is a variant with its own id, price and availability. A page that shows five sizes and three colours but publishes one Offer — or an AggregateOffer with only lowPrice and highPrice — gives an agent no purchasable unit to name and no single price to quote. The row is dropped at feed validation, or the checkout session comes back with `invalid` on the line item.',
      fix: 'Publish a ProductGroup carrying productGroupID and variesBy, with one hasVariant entry per buyable variant. Give every entry its own sku or gtin, its own offers.price, offers.priceCurrency and offers.availability, and the colour/size values named in variesBy. One Product node per variant, each with a unique identifier and a complete Offer, works equally well.',
      code: `{
  "@context": "https://schema.org",
  "@type": "ProductGroup",
  "name": "Merino Crew",
  "productGroupID": "MC-100",
  "variesBy": ["https://schema.org/color", "https://schema.org/size"],
  "hasVariant": [
    {
      "@type": "Product",
      "sku": "MC-100-BLU-M",
      "color": "Blue",
      "size": "M",
      "offers": {
        "@type": "Offer",
        "price": "79.00",
        "priceCurrency": "GBP",
        "availability": "https://schema.org/InStock"
      }
    }
  ]
}`,
      effort: 'complex',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/agentic-commerce/buyable-variant-resolution/',
      tags: ['product', 'variants', 'json-ld', 'acp', 'ecommerce'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const productPages = ctx.pages.filter((page) => page.pageType === 'product').slice(0, MAX_PAGES);
    if (productPages.length === 0) {
      return this.notApplicable(
        'This scan reached no product page, so there is no variant surface to resolve.',
        EXPECTED,
        'No product page scanned',
      );
    }

    const failures: string[] = [];
    const warnings: string[] = [];
    const resolved: string[] = [];
    let pagesWithVariants = 0;

    for (const page of productPages) {
      const evidence = detectVariants(page);
      if (!evidence) continue;
      pagesWithVariants += 1;

      const nodes = allJsonLdNodes(page.structuredData ?? page.jsonLd).filter(isObj);
      const groups = nodes.filter((node) => typesOf(node).includes('ProductGroup'));
      const products = nodes.filter((node) => typesOf(node).includes('Product'));
      const label = page.url;

      // Arm (a): a ProductGroup that resolves every variant it declares.
      let markupCount = 0;
      let groupOk = false;
      const groupProblems: string[] = [];

      for (const group of groups) {
        const variants = Array.isArray(group['hasVariant'])
          ? (group['hasVariant'] as unknown[]).filter(isObj)
          : [];
        markupCount = Math.max(markupCount, variants.length);
        const problems: string[] = [];
        if (str(group['productGroupID']) === undefined) problems.push('productGroupID');
        if (group['variesBy'] === undefined) problems.push('variesBy');
        if (variants.length === 0) problems.push('hasVariant');

        variants.forEach((variant, index) => {
          const name = identifierOf(variant) ?? `hasVariant[${index}]`;
          if (identifierOf(variant) === undefined) problems.push(`${name}: sku or gtin`);
          for (const missing of missingOfferFields(offersOf(variant))) {
            problems.push(`${name}: ${missing}`);
          }
        });

        if (problems.length === 0) groupOk = true;
        else groupProblems.push(...problems);
      }

      // Arm (b): one complete Product node per variant, uniquely identified.
      const identified = new Map<string, Record<string, unknown>>();
      for (const product of products) {
        const id = identifierOf(product);
        if (id === undefined) continue;
        if (missingOfferFields(offersOf(product)).length > 0) continue;
        identified.set(id, product);
      }
      const productsOk = identified.size >= 2;
      markupCount = Math.max(markupCount, identified.size);

      if (groupOk || productsOk) {
        resolved.push(
          `${label}: ${markupCount} variant(s) resolved (${groupOk ? 'ProductGroup' : 'per-variant Product nodes'})`,
        );
        if (markupCount !== evidence.count) {
          warnings.push(
            `${label} shows ${evidence.count} variant(s) (${evidence.detail}) but the markup resolves ${markupCount}, which is a partially generated ProductGroup`,
          );
        }
        continue;
      }

      // Nothing resolved. Say which of the two failures this page is.
      const allOffers = nodes.filter((node) =>
        typesOf(node).some((t) => t === 'Offer' || t === 'AggregateOffer'),
      );
      const aggregateOnly = allOffers.every((offer) => typesOf(offer).includes('AggregateOffer'));

      // A ProductGroup that exists but does not resolve gets the field-level
      // message: it is the actionable one, and it outranks the offer-shape arms
      // below, which describe a page carrying no variant markup at all.
      if (groupProblems.length > 0) {
        const shown = [...new Set(groupProblems)].slice(0, MAX_SHOWN);
        failures.push(
          `${label} shows ${evidence.count} variant(s) but its ProductGroup resolves none of them; missing ${shown.join(', ')}${new Set(groupProblems).size > shown.length ? ` (${new Set(groupProblems).size - shown.length} more)` : ''}`,
        );
      } else if (allOffers.length === 0) {
        failures.push(`${label} shows ${evidence.count} variant(s) and publishes no Offer at all`);
      } else if (aggregateOnly && allOffers.length > 0) {
        const range = allOffers[0]!;
        failures.push(
          `${label} shows ${evidence.count} variant(s) (${evidence.detail}) but publishes only an AggregateOffer (${str(range['lowPrice']) ?? '?'}–${str(range['highPrice']) ?? '?'}), so no single price can be quoted for any of them`,
        );
      } else if (allOffers.length === 1) {
        failures.push(
          `${label} shows ${evidence.count} variant(s) (${evidence.detail}) but publishes exactly one Offer, so no variant is addressable`,
        );
      } else {
        failures.push(
          `${label} shows ${evidence.count} variant(s) and publishes ${allOffers.length} Offer(s), but only ${identified.size} node(s) carry both a unique identifier and a complete Offer`,
        );
      }
    }

    if (pagesWithVariants === 0) {
      return this.notApplicable(
        'No product page scanned presents a variant choice, so there is nothing to resolve. A single-variant product needs no ProductGroup.',
        EXPECTED,
        `${productPages.length} product page(s), none with a variant selector`,
      );
    }

    const details = {
      productPages: productPages.length,
      pagesWithVariants,
      pagesResolved: resolved.length,
      failures: failures.slice(0, MAX_SHOWN),
      warnings: warnings.slice(0, MAX_SHOWN),
      resolved: resolved.slice(0, MAX_SHOWN),
    };
    const found = `${pagesWithVariants} product page(s) with a variant choice; ${resolved.length} resolved, ${failures.length} unresolved.`;
    const displayValue = `${resolved.length}/${pagesWithVariants} variant surfaces resolved`;

    if (failures.length > 0) {
      return {
        ...this.fail(
          failures[0]!,
          EXPECTED,
          found,
          'Publish one addressable variant per choice, each with its own identifier, price, currency and availability.',
        ),
        displayValue,
        details,
      };
    }

    if (warnings.length > 0) {
      return {
        ...this.warn(
          warnings[0]!,
          EXPECTED,
          found,
          'Generate a hasVariant entry for every variant the page offers, not only for the ones in stock.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `Every variant choice on the product page(s) resolves to an addressable, priced unit.`,
        EXPECTED,
        found,
      ),
      displayValue,
      details,
    };
  }
}
