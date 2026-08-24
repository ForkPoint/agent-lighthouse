// Graduated from proposal 2026-08-22 (Plan 5, Task 22).
// Evidence dossier: docs/evidence/audits/machine-discovery/agent-commerce-feed-parity.md
//
// Deliberately overlaps agentic-commerce/checkout-offer-field-mapping: that
// audit judges the offer graph of one scanned product page, this one samples up
// to 6 product pages out of the sitemap and reports a per-field pass rate plus
// a separate agent-commerce gap for the fields Google's rich-result validator
// never asks for. Both dossiers state the split.
import type { CheerioAPI } from 'cheerio';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { isSafeUrl } from '../../fetcher';
import { fetchSampledPage } from '../../gatherers/sampled-pages';
import { parseHtml, extractJsonLd, extractMetaTags, flattenJsonLd } from '../../parser';
import { siteSitemapTree, sampleEntries } from '../../gatherers/sitemap';
import { gtinCheckDigit } from '../agentic-commerce/checkout-offer-field-mapping';
import { ISO_4217 } from '../../gatherers/currency';

/** How many sitemap URLs to open looking for product pages. */
const MAX_SAMPLE = 6;
/** How many product images to HEAD; the rest are judged by extension alone. */
const MAX_IMAGE_CHECKS = 2;

const CAPS = { item_id: 100, brand: 70, description: 5_000 } as const;

const PRODUCT_TYPES = ['Product', 'ProductGroup', 'IndividualProduct', 'ProductModel'];

/** schema.org availability values that map onto the feed enum. */
const AVAILABILITY_MAP: Record<string, string> = {
  InStock: 'in_stock',
  OutOfStock: 'out_of_stock',
  PreOrder: 'pre_order',
  BackOrder: 'backorder',
};

/** The only three condition values Google maps to a feed condition. */
const CONDITIONS = new Set([
  'https://schema.org/NewCondition',
  'https://schema.org/RefurbishedCondition',
  'https://schema.org/UsedCondition',
]);

/** Image media types the OpenAI product feed spec lists. */
const FEED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);


/** Currency-formatted numerals in the page copy. */
const PRICE_PATTERN =
  /(?:[$€£¥₹]|\b(?:USD|EUR|GBP|JPY|CAD|AUD|CHF|SEK|PLN|BGN)\b)\s*(\d[\d.,]*)|(\d[\d.,]*)\s*(?:[$€£¥₹]|\b(?:USD|EUR|GBP|JPY|CAD|AUD|CHF|SEK|PLN|BGN)\b)/g;

/** Selects that expose sibling variants of the same product. */
const VARIANT_SELECT = /variant|option|size|colou?r|style|length|width/i;

type Field =
  | 'item_id'
  | 'brand'
  | 'description'
  | 'image'
  | 'price'
  | 'currency'
  | 'availability'
  | 'condition'
  | 'seller'
  | 'target_country'
  | 'item_group_id'
  | 'price_parity'
  | 'offer_url';

/** The fields OpenAI's feed requires that Google's rich-result test never asks for. */
const AGENT_COMMERCE_ONLY: Field[] = ['brand', 'seller', 'target_country', 'description', 'image'];

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

function unescapeHtml(value: string): string {
  return value
    .replace(/&(?:amp|#38);/gi, '&')
    .replace(/&(?:lt|#60);/gi, '<')
    .replace(/&(?:gt|#62);/gi, '>')
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'");
}

/** A number out of a formatted price, handling both decimal conventions. */
function toNumber(raw: string): number | undefined {
  let value = raw.replace(/\s/g, '');
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma > lastDot) {
    value = value.replace(/\./g, '').replace(',', '.');
  } else {
    value = value.replace(/,/g, '');
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Every currency-formatted number in the page copy, scripts excluded. */
function renderedPrices($: CheerioAPI): number[] {
  const body = $('body');
  body.find('script, style, template, noscript').remove();
  const copy = body.text();
  const out: number[] = [];
  for (const match of copy.matchAll(PRICE_PATTERN)) {
    const parsed = toNumber(match[1] ?? match[2] ?? '');
    if (parsed !== undefined) out.push(parsed);
  }
  return out;
}

/** An ISO 3166-1 alpha-2 code out of any of the shapes a country signal takes. */
function alpha2(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim().toUpperCase();
    return /^[A-Z]{2}$/.test(trimmed) ? trimmed : undefined;
  }
  const node = first(value);
  if (!node) return undefined;
  return (
    alpha2(node['addressCountry']) ??
    alpha2(node['identifier']) ??
    alpha2(node['name']) ??
    alpha2(first(node['address'])?.['addressCountry']) ??
    alpha2(first(node['shippingDestination'])?.['addressCountry'])
  );
}

function countrySignal(product: Record<string, unknown>, offer: Record<string, unknown> | undefined): string | undefined {
  const candidates = [
    offer?.['eligibleRegion'],
    offer?.['areaServed'],
    offer?.['availableAtOrFrom'],
    offer?.['shippingDetails'],
    product['areaServed'],
  ];
  for (const candidate of candidates) {
    const code = alpha2(candidate);
    if (code) return code;
  }
  return undefined;
}

/** Does the page expose more than one variant of the same product? */
function hasSiblingVariants($: CheerioAPI, product: Record<string, unknown>): boolean {
  const variants = product['hasVariant'];
  if (Array.isArray(variants) && variants.length > 1) return true;
  return $('select')
    .toArray()
    .some((el) => {
      const $el = $(el);
      const label = `${$el.attr('name') ?? ''} ${$el.attr('id') ?? ''}`;
      return VARIANT_SELECT.test(label) && $el.find('option').length > 1;
    });
}

function productNode(jsonLd: object[], meta: Record<string, string>): Record<string, unknown> | undefined {
  for (const node of flattenJsonLd(jsonLd)) {
    if (isObject(node) && typesOf(node).some((type) => PRODUCT_TYPES.includes(type))) return node;
  }
  // og:type=product with no Product node is still a PDP, and its missing
  // structured data is exactly what this audit reports.
  return meta['og:type']?.trim().toLowerCase() === 'product' ? {} : undefined;
}

interface Candidate {
  url: string;
  $: CheerioAPI;
  product: Record<string, unknown>;
}

interface Assessment {
  defects: string[];
  risks: string[];
  fields: Map<Field, boolean>;
}

const EXPECTED =
  'every sampled product page carries the union of the Google Merchant Center and OpenAI product feed fields — identity, brand, plain-text description, JPEG or PNG image, price matching the page, ISO 4217 currency, availability and condition as schema.org URLs, seller, and a target country';

const SAMPLE = `{
  "@type": "Product",
  "sku": "ARK-001",
  "brand": { "@type": "Brand", "name": "Alpine" },
  "description": "Plain text only — no markup, under 5000 characters.",
  "image": "https://example.com/img/ark-001.jpg",
  "itemCondition": "https://schema.org/NewCondition",
  "inProductGroupWithID": "ARK",
  "offers": {
    "@type": "Offer",
    "price": 29.99,
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "seller": { "@type": "Organization", "name": "Alpine Store" },
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "US" }
    },
    "url": "https://example.com/products/alpine-resole-kit"
  }
}`;

export class AgentCommerceFeedParityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/agent-commerce-feed-parity',
    category: 'machine-discovery',
    title: 'Product pages carry the fields an agent-commerce feed needs',
    failureTitle: 'Product pages cannot supply the fields an agent-commerce feed needs',
    description:
      "Samples product pages from the sitemap and audits each against the union of OpenAI's Product Feed Spec and Google Merchant Center's required attributes, using the PDP's structured data as the auditable proxy for feed eligibility. Reports a per-field pass rate plus a separate agent-commerce gap for the fields Google's rich-result validator never asks for, and cross-checks the JSON-LD price against the price the page renders.",
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/machine-discovery/agent-commerce-feed-parity.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        "Google's automatic item updates repair feed/page discrepancies \"using the structured data markup the crawlers find on your website\", and state that where extractors cannot determine price, availability and condition, \"your products will be subject to item-level disapprovals\". Merchant Center separately requires that feed availability match the landing page and that price match the landing page and checkout. OpenAI's Product Feed Spec requires a strictly larger per-item set than Google's rich-result minimum: a stable item_id (<=100 chars), brand (<=70), seller_name, target_countries as ISO 3166-1 alpha-2, a plain-text description under 5000 characters, availability from a fixed enum, and price with an ISO 4217 currency. Falsifiable claim: a PDP missing brand, seller, itemCondition-as-URL, a stable SKU or a country signal passes every Google rich-result test yet cannot be reconciled by automatic item updates, so feed rejections are silent and unattributable. Second claim, sharper: where the JSON-LD price disagrees with the price the page renders, automatic item updates overwrite the feed with one value while an agent reading the page quotes the other.",
      fix: 'Publish the feed row on the page. Add brand.name, offers.seller.name, an itemCondition from the three schema.org condition URLs, and a country signal (offers.shippingDetails.shippingDestination.addressCountry is the most portable) — none of these are required for a Google rich result, and all of them are required for an agent-commerce feed. Write availability as the full https://schema.org/InStock URL, not the bare token. Keep the description plain text. Serve the primary image as JPEG or PNG. Where a page exposes sibling variants, add inProductGroupWithID or isVariantOf so the feed can group them. Above all, render the same number the JSON-LD publishes: one price, one currency, one page.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/machine-discovery/agent-commerce-feed-parity/',
      tags: ['commerce', 'product-feed', 'structured-data', 'sitemap'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const candidates = await this.collect(ctx);

    if (candidates.length === 0) {
      return this.notApplicable(
        'No product page in the sitemap sample: nothing here maps onto a product feed row.',
        EXPECTED,
        'No Product structured data on the sampled sitemap URLs',
      );
    }

    let imageChecks = 0;
    const defects: string[] = [];
    const risks: string[] = [];
    const tally = new Map<Field, { pass: number; total: number }>();
    const brokenPages = new Set<string>();

    for (const candidate of candidates) {
      const assessment = this.assess(candidate);

      // The media type is the authority; the extension is only a hint.
      const image = text(candidate.product['image']);
      if (image && /^https:\/\//i.test(image) && imageChecks < MAX_IMAGE_CHECKS) {
        imageChecks += 1;
        if (await isSafeUrl(image)) {
          const head = await ctx.fetch({ url: image, method: 'HEAD' });
          const type = (head.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
          if (head.status === 200 && type && !FEED_IMAGE_TYPES.has(type)) {
            assessment.risks.push(
              `${image} serves ${type}, which the OpenAI product feed spec does not list — it accepts JPEG and PNG`,
            );
            assessment.fields.set('image', false);
          }
        }
      }

      for (const [field, ok] of assessment.fields) {
        const entry = tally.get(field) ?? { pass: 0, total: 0 };
        entry.total += 1;
        if (ok) entry.pass += 1;
        tally.set(field, entry);
      }
      for (const defect of assessment.defects) defects.push(`${candidate.url}: ${defect}`);
      for (const risk of assessment.risks) risks.push(`${candidate.url}: ${risk}`);
      if (assessment.defects.length > 0) brokenPages.add(candidate.url);
    }

    const rate = (fields: Field[]) => {
      let pass = 0;
      let total = 0;
      for (const field of fields) {
        const entry = tally.get(field);
        if (!entry) continue;
        pass += entry.pass;
        total += entry.total;
      }
      return { pass, total, share: total === 0 ? 1 : pass / total };
    };

    const overall = rate([...tally.keys()]);
    const gap = rate(AGENT_COMMERCE_ONLY);
    const found = `${candidates.length} product page(s) sampled; field pass rate ${overall.pass}/${overall.total} (${Math.round(overall.share * 100)}%); agent-commerce gap ${gap.pass}/${gap.total} (${Math.round(gap.share * 100)}%); ${defects.length} defect(s), ${risks.length} feed risk(s)`;

    if (defects.length > 0) {
      const shown = defects.slice(0, 5).join('; ');
      const more = defects.length > 5 ? ` (${defects.length - 5} more)` : '';
      return this.fail(
        `${brokenPages.size} of ${candidates.length} sampled product page(s) cannot supply a valid feed row: ${shown}${more}.`,
        EXPECTED,
        found,
        'high',
      );
    }

    if (risks.length > 0) {
      return this.warn(`${risks.slice(0, 3).join('; ')}.`, EXPECTED, found, 'low');
    }

    return this.pass(
      `All ${candidates.length} sampled product page(s) carry every field the Google and OpenAI product feeds require, and the JSON-LD price matches the price the page renders.`,
      EXPECTED,
      found,
    );
  }

  /** Up to 20 sitemap URLs, opened, keeping the ones that are product pages. */
  private async collect(ctx: CheckContext): Promise<Candidate[]> {
    const tree = await siteSitemapTree(ctx);
    const scanned = new Map<string, PageContext>();
    for (const page of ctx.pages) scanned.set(page.url, page);

    const out: Candidate[] = [];
    for (const entry of sampleEntries(tree.entries, MAX_SAMPLE)) {
      const page = scanned.get(entry.loc);
      if (page) {
        const product = productNode(page.structuredData ?? page.jsonLd, page.meta);
        if (product) out.push({ url: page.url, $: page.$, product });
        continue;
      }
      const result = await fetchSampledPage(ctx, entry.loc);
      if (!result) continue;
      const $ = parseHtml(result.body);
      const product = productNode(extractJsonLd($), extractMetaTags($));
      if (product) out.push({ url: entry.loc, $, product });
    }
    return out;
  }

  private assess({ url, $, product }: Candidate): Assessment {
    const defects: string[] = [];
    const risks: string[] = [];
    const fields = new Map<Field, boolean>();
    const mark = (field: Field, ok: boolean, defect?: string) => {
      fields.set(field, ok);
      if (!ok && defect) defects.push(defect);
    };

    // ── identity ────────────────────────────────────────────────
    const itemId = text(product['sku']) ?? text(product['mpn']) ?? text(product['productID']);
    mark(
      'item_id',
      Boolean(itemId) && itemId!.length <= CAPS.item_id,
      itemId
        ? `item_id source is ${itemId.length} characters, over the ${CAPS.item_id}-character cap`
        : 'no sku, mpn or productID to use as a stable item_id',
    );

    const gtinKey = ['gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14'].find((key) => text(product[key]));
    if (gtinKey) {
      const gtin = text(product[gtinKey])!.replace(/[\s-]/g, '');
      if (!/^\d{8}$|^\d{12,14}$/.test(gtin)) {
        defects.push(`${gtinKey} "${gtin}" is not 8, 12, 13 or 14 digits with no separators`);
      } else if (Number(gtin[gtin.length - 1]) !== gtinCheckDigit(gtin)) {
        defects.push(`${gtinKey} "${gtin}" has the wrong check digit`);
      }
    }

    // ── copy ────────────────────────────────────────────────────
    const brand = text(product['brand']);
    mark(
      'brand',
      Boolean(brand) && brand!.length <= CAPS.brand,
      brand ? `brand is over the ${CAPS.brand}-character cap` : 'no brand name, which the OpenAI feed requires',
    );

    const description = text(product['description']);
    const plain = description ? unescapeHtml(description) : '';
    const markup = /<\/?[a-z][^>]*>/i.test(plain);
    mark(
      'description',
      Boolean(description) && !markup && plain.length <= CAPS.description,
      !description
        ? 'no description'
        : markup
          ? 'the description carries HTML tags after unescaping; the OpenAI feed takes plain text only'
          : `the description is ${plain.length} characters, over the ${CAPS.description}-character cap`,
    );

    // ── image ───────────────────────────────────────────────────
    const image = text(product['image']);
    mark(
      'image',
      Boolean(image) && /^https:\/\//i.test(image!),
      image ? `image ${image} is not an absolute HTTPS URL` : 'no image',
    );

    // ── offer ───────────────────────────────────────────────────
    const offer = first(product['offers'] ?? product['offer']);
    if (!offer) {
      defects.push('no Offer on the Product, so there is no price, availability or seller to send');
      mark('price', false);
      mark('availability', false);
    } else {
      const rawPrice = offer['price'];
      const price =
        typeof rawPrice === 'number'
          ? rawPrice
          : typeof rawPrice === 'string' && /^\d+(\.\d+)?$/.test(rawPrice.trim())
            ? Number(rawPrice)
            : undefined;
      mark(
        'price',
        price !== undefined && price > 0,
        `price ${JSON.stringify(rawPrice)} is not a positive decimal`,
      );

      const currency = text(offer['priceCurrency'])?.toUpperCase() ?? '';
      mark(
        'currency',
        ISO_4217.has(currency),
        `priceCurrency "${currency}" is not an active ISO 4217 code`,
      );

      const availability = text(offer['availability']);
      const enumName = availability?.split('/').pop() ?? '';
      const mapped = AVAILABILITY_MAP[enumName];
      const availabilityOk = Boolean(availability) && /^https?:\/\/schema\.org\//i.test(availability!) && Boolean(mapped);
      mark(
        'availability',
        availabilityOk,
        !availability
          ? 'the Offer carries no availability'
          : !/^https?:\/\/schema\.org\//i.test(availability)
            ? `availability "${availability}" is a bare token, not the https://schema.org/${enumName || 'InStock'} URL that extractors read`
            : `availability "${availability}" maps to no feed enum value`,
      );

      const seller = text(first(offer['seller'])?.['name'] ?? offer['seller']);
      mark('seller', Boolean(seller), 'no offers.seller.name to send as seller_name');

      const country = countrySignal(product, offer);
      mark(
        'target_country',
        Boolean(country),
        'no target country signal: none of offers.eligibleRegion, areaServed, availableAtOrFrom.address.addressCountry or shippingDetails.shippingDestination.addressCountry resolves to an ISO 3166-1 alpha-2 code',
      );

      // ── price parity ──────────────────────────────────────────
      const rendered = renderedPrices($);
      if (price !== undefined && rendered.length > 0) {
        const match = rendered.some((value) => Math.abs(value - price) < 0.005);
        mark(
          'price_parity',
          match,
          `the JSON-LD price ${price} does not appear among the prices the page renders (${rendered.slice(0, 3).join(', ')}); automatic item updates will overwrite the feed with one value while an agent quotes the other`,
        );
      }

      // ── offer url vs canonical ────────────────────────────────
      const offerUrl = text(offer['url']) ?? text(product['url']);
      const canonicalHref = $('link[rel="canonical"]').attr('href');
      if (offerUrl && canonicalHref) {
        let same = false;
        try {
          same = new URL(canonicalHref, url).toString() === new URL(offerUrl, url).toString();
        } catch {
          same = false;
        }
        mark(
          'offer_url',
          same,
          `the offer url ${offerUrl} is not the page canonical ${canonicalHref}, so the feed row and the indexed page are two different URLs`,
        );
      }
    }

    // ── condition ───────────────────────────────────────────────
    const condition = text(product['itemCondition']) ?? text(first(product['offers'])?.['itemCondition']);
    mark(
      'condition',
      Boolean(condition) && CONDITIONS.has(condition!.replace(/^http:/, 'https:')),
      condition
        ? `itemCondition "${condition}" is not one of the three schema.org condition URLs Google maps to a feed condition`
        : 'no itemCondition, so the feed condition cannot be determined',
    );

    // ── variants ────────────────────────────────────────────────
    if (hasSiblingVariants($, product)) {
      const group = text(product['inProductGroupWithID']) ?? text(product['isVariantOf']);
      mark(
        'item_group_id',
        Boolean(group),
        'the page exposes sibling variants but carries neither inProductGroupWithID nor isVariantOf, so the feed has no item_group_id',
      );
    }

    return { defects, risks, fields };
  }
}
