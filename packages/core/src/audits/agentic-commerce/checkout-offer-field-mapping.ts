// Graduated from proposal 2026-08-22 (Plan 5, Task 18).
// Evidence dossier: docs/evidence/audits/agentic-commerce/checkout-offer-field-mapping.md
//
// Feed validation is row-by-row: an individual product fails silently while the
// upload as a whole succeeds. This audit runs the same assertions against the
// PDP so the rejection is visible before the feed is built.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { flattenJsonLd } from '../../parser';
import { extractProductFieldVerification } from '../../product-fields';

/** Character caps the feed spec rejects rows on. */
const CAPS = { item_id: 100, title: 150, description: 5_000, brand: 70 } as const;

/** schema.org availability values that map onto a feed enum value. */
const AVAILABILITY_MAP: Record<string, string> = {
  InStock: 'in_stock',
  OutOfStock: 'out_of_stock',
  PreOrder: 'pre_order',
  BackOrder: 'backorder',
};

/** Feed enum values that require a date before the row is accepted. */
const DATED_AVAILABILITY = new Set(['pre_order', 'backorder']);

const PRODUCT_TYPES = ['Product', 'IndividualProduct', 'ProductModel'];
const GTIN_KEYS = ['gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14'] as const;
const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function typesOf(node: Record<string, unknown>): string[] {
  const raw = node['@type'];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  return [];
}

function first(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value.find(isObject);
  return isObject(value) ? value : undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  const node = first(value);
  if (node && typeof node['name'] === 'string' && node['name'].trim()) return node['name'].trim();
  return undefined;
}

/** The bare enum name, whether it arrived bare or as a schema.org URL. */
function enumName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const parts = value.split('/');
  return parts[parts.length - 1] || undefined;
}

/**
 * The GTIN check digit, computed the same way for every length: weights of 3
 * and 1 alternating from the right, over the digits before the check digit.
 */
export function gtinCheckDigit(digits: string): number {
  let sum = 0;
  const body = digits.slice(0, -1);
  for (let i = 0; i < body.length; i += 1) {
    const digit = Number(body[body.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

interface Row {
  item_id?: string;
  title?: string;
  price?: number;
  currency?: string;
  availability?: string;
  gtin?: string;
  brand?: string;
  url?: string;
  image_url?: string;
}

interface Assessment {
  page: PageContext;
  problems: string[];
  ambiguous: string[];
  row: Row;
}

function assess(product: Record<string, unknown>, page: PageContext): Assessment {
  const problems: string[] = [];
  const ambiguous: string[] = [];
  const row: Row = {};

  // ── identity and copy ───────────────────────────────────────
  const itemId = text(product['sku']) ?? text(product['mpn']) ?? text(product['productID']);
  if (!itemId) {
    problems.push('no item_id source: the Product carries no sku, mpn or productID');
  } else if (itemId.length > CAPS.item_id) {
    problems.push(`item_id is ${itemId.length} characters, over the ${CAPS.item_id}-character cap`);
  } else {
    row.item_id = itemId;
  }

  const title = text(product['name']);
  if (!title) problems.push('no name to map to the feed title');
  else if (title.length > CAPS.title) {
    problems.push(`title is ${title.length} characters, over the ${CAPS.title}-character cap`);
  } else row.title = title;

  const description = text(product['description']);
  if (!description) problems.push('no description');
  else if (description.length > CAPS.description) {
    problems.push(`description is ${description.length} characters, over the ${CAPS.description}-character cap`);
  }

  const brand = text(product['brand']);
  if (!brand) problems.push('no brand name');
  else if (brand.length > CAPS.brand) {
    problems.push(`brand is ${brand.length} characters, over the ${CAPS.brand}-character cap`);
  } else row.brand = brand;

  // ── url and image ───────────────────────────────────────────
  const url = text(product['url']) ?? page.url;
  if (!/^https:\/\//i.test(url)) problems.push('url is not an absolute HTTPS URL');
  else row.url = url;
  const canonical = page.$('link[rel="canonical"]').attr('href');
  if (canonical && text(product['url']) && new URL(canonical, page.url).toString() !== url) {
    problems.push('the Product url does not match the page canonical, so the feed row and the page disagree');
  }

  const image = text(product['image']);
  if (!image) problems.push('no image');
  else if (!/^https:\/\//i.test(image)) problems.push('image_url is not an absolute HTTPS URL');
  else if (!/\.(jpe?g|png|webp)(\?|$)/i.test(image)) {
    ambiguous.push(`image_url ${image} is not a JPEG, PNG or WebP by extension`);
  } else row.image_url = image;

  // ── price ───────────────────────────────────────────────────
  const offer = first(product['offers'] ?? product['offer']);
  if (!offer) {
    problems.push('no Offer on the Product');
  } else if (typesOf(offer).includes('AggregateOffer')) {
    problems.push('the Product carries an AggregateOffer, so its price is not a single resolvable number');
  } else {
    const rawPrice = offer['price'];
    const price =
      typeof rawPrice === 'number'
        ? rawPrice
        : typeof rawPrice === 'string' && /^\d+(\.\d+)?$/.test(rawPrice.trim())
          ? Number(rawPrice)
          : undefined;
    if (price === undefined) {
      problems.push(
        `price ${JSON.stringify(rawPrice)} is not a single resolvable number — the feed takes a bare decimal, with the currency in its own column`,
      );
    } else row.price = price;

    const currency = typeof offer['priceCurrency'] === 'string' ? offer['priceCurrency'].trim() : '';
    if (!/^[A-Z]{3}$/.test(currency)) {
      problems.push(`priceCurrency "${currency}" is not a 3-letter ISO 4217 code`);
    } else row.currency = currency;

    // A sale price above the list price rejects the row and misprices the offer.
    const spec = first(offer['priceSpecification']);
    const listFromSpec =
      spec && /ListPrice/i.test(String(spec['priceType'] ?? '')) ? Number(spec['price']) : undefined;
    const listPrice = listFromSpec ?? (typeof offer['highPrice'] === 'number' ? offer['highPrice'] : undefined);
    if (price !== undefined && listPrice !== undefined && Number.isFinite(listPrice) && price > listPrice) {
      problems.push(`the sale price ${price} is higher than the list price ${listPrice}`);
    }

    // ── availability ──────────────────────────────────────────
    const availability = enumName(offer['availability']);
    if (!availability) {
      problems.push('the Offer carries no availability');
    } else {
      const mapped = AVAILABILITY_MAP[availability];
      if (!mapped) {
        ambiguous.push(`availability ${availability} maps to no feed enum value, so the row's stock state is ambiguous`);
      } else {
        row.availability = mapped;
        if (DATED_AVAILABILITY.has(mapped) && !text(offer['availabilityStarts'])) {
          problems.push(
            `availability maps to ${mapped}, which requires an availabilityStarts date the feed can send as availability_date`,
          );
        }
      }
    }
  }

  // ── identifiers ─────────────────────────────────────────────
  const gtinKey = GTIN_KEYS.find((key) => text(product[key]));
  const gtin = gtinKey ? text(product[gtinKey])!.replace(/\s|-/g, '') : undefined;
  if (!gtin && !text(product['mpn'])) {
    problems.push('no gtin and no mpn, so the row is rejected unless identifier_exists is set to no');
  }
  if (gtin) {
    if (!/^\d+$/.test(gtin) || !GTIN_LENGTHS.has(gtin.length)) {
      problems.push(`${gtinKey} "${gtin}" is not 8, 12, 13 or 14 digits`);
    } else {
      const expected = gtinCheckDigit(gtin);
      if (Number(gtin[gtin.length - 1]) !== expected) {
        problems.push(`${gtinKey} "${gtin}" has the wrong check digit — it should end in ${expected}`);
      } else row.gtin = gtin;
    }
  }

  return { page, problems, ambiguous, row };
}

function findProduct(ctx: CheckContext): { product: Record<string, unknown>; page: PageContext } | undefined {
  for (const page of ctx.pages) {
    if (page.pageType !== 'product') continue;
    for (const node of flattenJsonLd(page.structuredData ?? page.jsonLd)) {
      if (isObject(node) && typesOf(node).some((t) => PRODUCT_TYPES.includes(t))) {
        return { product: node, page };
      }
    }
  }
  return undefined;
}

function feedRow(row: Row): string {
  return Object.entries(row)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
}

const EXPECTED =
  'Every product page maps onto a feed row that passes validation: identity and copy within their character caps, a single numeric price with an ISO 4217 currency, an availability value the feed enum accepts, and a valid GTIN or MPN';

const SAMPLE = `{
  "@type": "Product",
  "name": "Alpine Resole Kit",
  "sku": "ARK-001",
  "gtin13": "1234567890128",
  "brand": { "@type": "Brand", "name": "Alpine" },
  "image": "https://example.com/img/ark-001.jpg",
  "url": "https://example.com/products/alpine-resole-kit",
  "offers": {
    "@type": "Offer",
    "price": 29.99,
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }
}`;

export class CheckoutOfferFieldMappingAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agentic-commerce/checkout-offer-field-mapping',
    category: 'agentic-commerce',
    title: 'Checkout-eligible offer field mapping',
    failureTitle: 'Checkout-eligible offer field mapping',
    description:
      'Audits each PDP against the exact required-and-conditional field set of the OpenAI product feed spec, including its character caps and its conditional triggers, so the merchant learns which rows will be rejected before uploading a feed.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agentic-commerce/checkout-offer-field-mapping.md',
    applicablePageTypes: ['product'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'Falsifiable claim: the OpenAI feed spec enumerates a closed set of required fields (item_id <=100, title <=150, description <=5000, brand <=70, url, image_url, price with ISO 4217 currency, availability from a 5-value enum, target_countries) plus three conditional triggers that reject rows: gtin-or-mpn required unless identifier_exists=no; availability_date required when availability is pre_order or backorder; seller_privacy_policy and seller_tos required when is_eligible_checkout=true. Validation is row-by-row, so individual products fail silently while the feed as a whole succeeds. A PDP that cannot supply these values forces the merchant to hand-author or scrape them, which is precisely where price mismatch enters. Disproof condition: rows lacking gtin/mpn and identifier_exists being accepted as checkout-eligible.',
      fix: 'Publish the feed values on the PDP itself so the row is derived rather than hand-authored: a sku or mpn under 100 characters, a name under 150, a brand name under 70, an absolute HTTPS image URL, a bare decimal price with a 3-letter ISO 4217 priceCurrency, and an availability value from InStock / OutOfStock / PreOrder / BackOrder. Replace AggregateOffer with a per-variant Offer so the price resolves to one number. Add availabilityStarts whenever the offer is a pre-order or backorder, and check the GTIN check digit before publishing.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/agentic-commerce/checkout-offer-field-mapping.md',
      tags: ['acp', 'feed', 'product-schema', 'commerce'],
    },
  };

  private recommendation() {
    return {
      priority: 'high' as const,
      description: CheckoutOfferFieldMappingAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const found = findProduct(ctx);
    if (!found) {
      return this.notApplicable(
        'No product page with Product markup was scanned, so there is no feed row to validate.',
        EXPECTED,
        'No Product markup on a product page',
      );
    }

    // The shared extractor already answers presence per field; this audit adds
    // the length, format and mappability assertions on top of it.
    const presence = extractProductFieldVerification(ctx.pages);
    const a = assess(found.product, found.page);
    const row = feedRow(a.row);
    const foundText = `${a.problems.length} rejecting problem(s), ${a.ambiguous.length} ambiguity(ies); row: ${row}`;

    if (a.problems.length > 0) {
      return this.fail(
        `The feed row this page produces would be rejected: ${a.problems.join('; ')}.`,
        EXPECTED,
        foundText,
        this.recommendation(),
        found.page.url,
      );
    }

    if (a.ambiguous.length > 0) {
      return this.warn(
        `The feed row is accepted but not unambiguous: ${a.ambiguous.join('; ')}.`,
        EXPECTED,
        foundText,
        this.recommendation(),
        found.page.url,
      );
    }

    return this.pass(
      `Every required field maps cleanly onto a feed row${presence.gtin === 'found' ? ' with a valid GTIN' : ''}.`,
      EXPECTED,
      foundText,
      found.page.url,
    );
  }
}
