import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { allJsonLdNodes } from '../parser';
import type { PageContext } from '../check-context';

/**
 * The commerce reading the agentic-commerce audits share.
 *
 * Three audits ask the same page the same questions — where is the product
 * region, what prices does the raw HTML actually show, what does the JSON-LD
 * claim, and what platform is this. Written once so a price found by one audit
 * is the same price another audit compares against.
 */

/** Symbols that stand for a currency in rendered text. */
/** Symbols each ISO 4217 code is rendered with. Shared: the offer-truth audit
 * reads it to tell a rendered symbol that cannot be the declared currency. */
export const CURRENCY_SYMBOLS: Record<string, string[]> = {
  USD: ['$', 'US$'],
  EUR: ['€'],
  GBP: ['£'],
  JPY: ['¥'],
  CNY: ['¥', 'CN¥'],
  CHF: ['CHF'],
  CAD: ['$', 'CA$', 'C$'],
  AUD: ['$', 'A$'],
  SEK: ['kr'],
  NOK: ['kr'],
  DKK: ['kr'],
  PLN: ['zł'],
  BGN: ['лв'],
  INR: ['₹'],
  BRL: ['R$'],
  MXN: ['$', 'MX$'],
};

/** Elements whose text is a former price rather than the price being charged. */
const STRUCK_SELECTOR = 'del, s, strike, .was-price, .compare-at, [class*="strikethrough"], [class*="compare-at"]';

/** Phrases that say a product cannot be bought right now. */
export const OUT_OF_STOCK_PHRASES =
  /(sold\s*out|out of stock|notify me when|back in stock|currently unavailable|no longer available)/i;

/** Phrases that say it can. */
export const IN_STOCK_PHRASES = /(in stock|add to (cart|bag|basket)|buy now|available now)/i;

export interface PriceCandidate {
  /** The parsed amount. */
  value: number;
  /** The text the amount was read from, trimmed. */
  text: string;
  /** True when the amount sits inside a strikethrough or compare-at element. */
  struck: boolean;
}

export interface OfferInfo {
  price?: number;
  priceCurrency?: string;
  availability?: string;
  priceValidUntil?: string;
  sku?: string;
  gtin?: string;
  url?: string;
  id?: string;
  /** `AggregateOffer` carrying only a range rather than a price. */
  aggregateRange?: { low?: number; high?: number };
}

export type CommercePlatform = 'shopify' | 'woocommerce' | 'bigcommerce' | 'magento';

/** Collapse whitespace, including the non-breaking space a price often carries. */
function flatten(text: string): string {
  return text.replace(/[  \s]+/g, ' ').trim();
}

/**
 * Parse a rendered amount into a number.
 *
 * Handles both separator conventions: when a string carries both `.` and `,`,
 * whichever comes last is the decimal separator. When it carries only one, a
 * group of exactly three digits after it means it is a thousands separator.
 */
export function parseAmount(raw: string): number | undefined {
  const text = raw.replace(/[  \s]/g, '');
  const digits = /[\d.,]+/.exec(text);
  if (!digits) return undefined;
  let body = digits[0];

  const lastDot = body.lastIndexOf('.');
  const lastComma = body.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    body = body.split(thousands).join('');
    if (decimal === ',') body = body.replace(',', '.');
  } else if (lastComma !== -1) {
    body = /,\d{3}(\D|$)/.test(`${body} `) ? body.split(',').join('') : body.replace(',', '.');
  } else if (lastDot !== -1) {
    const after = body.length - lastDot - 1;
    if (after === 3 && body.split('.').length > 2) body = body.split('.').join('');
  }

  const value = Number.parseFloat(body);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * The region of the page that is about the product being sold.
 *
 * The nearest ancestor holding both the `<h1>` and the first price-bearing
 * node, so a related-products carousel further down the page cannot supply a
 * price the audit then compares against. Falls back to `<main>`, then `<body>`.
 */
export function productRegion($: CheerioAPI): Cheerio<Element> {
  const heading = $('h1').first();
  const priced = $('[itemprop="price"], [data-price], [class*="price" i]').first();

  if (heading.length > 0 && priced.length > 0) {
    const ancestors = new Set(heading.parents().toArray());
    for (const node of [priced[0]!, ...priced.parents().toArray()]) {
      if (ancestors.has(node)) return $(node) as Cheerio<Element>;
    }
  }

  const main = $('main').first();
  if (main.length > 0) return main as Cheerio<Element>;
  return $('body') as Cheerio<Element>;
}

/**
 * Every amount in `region` that reads as a price in `currency`.
 *
 * Anchored on the currency: a bare number is a quantity, a weight or a review
 * count far more often than it is a price, and matching those would make the
 * comparison meaningless.
 */
export function priceCandidates(
  $: CheerioAPI,
  region: Cheerio<Element>,
  currency: string,
): PriceCandidate[] {
  const code = currency.toUpperCase();
  const symbols = [...(CURRENCY_SYMBOLS[code] ?? []), code];
  const escaped = symbols.map((symbol) => symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // Either side: "$49.00" and "49,00 €" are both prices.
  const pattern = new RegExp(
    `(?:${escaped.join('|')})\\s*\\d[\\d.,\\u00a0\\u202f ]*|\\d[\\d.,\\u00a0\\u202f ]*\\s*(?:${escaped.join('|')})`,
    'g',
  );

  const struck = new Set($(STRUCK_SELECTOR, region).toArray().flatMap((el) => [el, ...$(el).find('*').toArray()]));
  const out: PriceCandidate[] = [];

  const visit = (el: Element, inStruck: boolean): void => {
    const nowStruck = inStruck || struck.has(el);
    for (const child of el.children) {
      if (child.type === 'tag') {
        visit(child as Element, nowStruck);
      } else if (child.type === 'text') {
        const text = flatten(child.data ?? '');
        for (const match of text.matchAll(pattern)) {
          const value = parseAmount(match[0]);
          if (value !== undefined) out.push({ value, text: match[0].trim(), struck: nowStruck });
        }
      }
    }
  };

  for (const el of region.toArray()) visit(el, false);
  return out;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return parseAmount(value);
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Every Offer or AggregateOffer the page's JSON-LD declares. */
export function offerNodes(jsonLd: object[]): OfferInfo[] {
  const out: OfferInfo[] = [];

  for (const node of allJsonLdNodes(jsonLd)) {
    if (typeof node !== 'object' || node === null) continue;
    const record = node as Record<string, unknown>;
    const type = record['@type'];
    const types = (Array.isArray(type) ? type : [type]).filter((t): t is string => typeof t === 'string');
    if (!types.some((t) => t === 'Offer' || t === 'AggregateOffer')) continue;

    const info: OfferInfo = {};
    const price = asNumber(record['price']);
    if (price !== undefined) info.price = price;
    const currency = asString(record['priceCurrency']);
    if (currency !== undefined) info.priceCurrency = currency;
    const availability = asString(record['availability']);
    if (availability !== undefined) info.availability = availability;
    const until = asString(record['priceValidUntil']);
    if (until !== undefined) info.priceValidUntil = until;
    const sku = asString(record['sku']);
    if (sku !== undefined) info.sku = sku;
    const gtin =
      asString(record['gtin']) ??
      asString(record['gtin13']) ??
      asString(record['gtin12']) ??
      asString(record['gtin8']) ??
      asString(record['gtin14']);
    if (gtin !== undefined) info.gtin = gtin;
    const url = asString(record['url']);
    if (url !== undefined) info.url = url;
    const id = asString(record['@id']);
    if (id !== undefined) info.id = id;

    if (types.includes('AggregateOffer')) {
      const low = asNumber(record['lowPrice']);
      const high = asNumber(record['highPrice']);
      if (low !== undefined || high !== undefined) {
        info.aggregateRange = {
          ...(low !== undefined ? { low } : {}),
          ...(high !== undefined ? { high } : {}),
        };
      }
    }

    out.push(info);
  }

  return out;
}

/** Which storefront platform served this page, judged by headers and markup? */
export function platformFingerprint(page: PageContext): CommercePlatform | undefined {
  const headers = page.fetchResult.headers;
  if (headers['x-shopid'] !== undefined || headers['x-shopify-stage'] !== undefined) return 'shopify';

  const html = page.fetchResult.body;
  if (/cdn\.shopify\.com|Shopify\.theme|window\.ShopifyAnalytics/.test(html)) return 'shopify';
  if (/wp-content\/plugins\/woocommerce|woocommerce-page|variations_form/.test(html)) return 'woocommerce';
  if (/cdn11\.bigcommerce\.com|bigcommerce\.com\/s-/.test(html)) return 'bigcommerce';
  if (/\/static\/version\d+|Magento_|mage\/cookies/.test(html)) return 'magento';
  return undefined;
}
