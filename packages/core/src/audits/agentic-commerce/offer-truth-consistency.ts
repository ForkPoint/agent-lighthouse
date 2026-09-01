import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { allJsonLdNodes } from '../../parser';
import {
  CURRENCY_SYMBOLS,
  OUT_OF_STOCK_PHRASES,
  offerNodes,
  priceCandidates,
  productRegion,
  type PriceCandidate,
} from '../../gatherers/commerce';

/** How many product pages are examined. */
const MAX_PAGES = 3;
/** How far a rendered price may sit from the declared one. */
const TOLERANCE = 0.01;
/** How many findings a detail list carries. */
const MAX_SHOWN = 8;

/** schema.org availability values that mean "you can buy this now". */
const IN_STOCK = /(^|\/)(InStock|InStoreOnly|OnlineOnly|LimitedAvailability|PreOrder|PreSale)$/i;
/** schema.org availability values that mean "you cannot". */
const NOT_IN_STOCK = /(^|\/)(OutOfStock|SoldOut|Discontinued|BackOrder)$/i;
/** Prose that says the item is buyable. Narrower than the add-to-cart phrasing:
 * a disabled add-to-cart button is still an add-to-cart button. */
const SAYS_IN_STOCK = /(in stock|available now)/i;
/** The control a shopper presses to buy. */
const BUY_CONTROL = /(add to (cart|bag|basket)|buy now|add-to-cart)/i;

/** Currency tokens rendered next to a number, anywhere in `text`. */
export function renderedCurrencies(text: string): string[] {
  const symbols = [...new Set(Object.values(CURRENCY_SYMBOLS).flat())];
  const escaped = symbols.map((symbol) => symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const codes = Object.keys(CURRENCY_SYMBOLS);
  const alternatives = [...escaped, ...codes].join('|');
  const pattern = new RegExp(
    `(?:${alternatives})(?=\\s*\\d)|(?<=\\d[\\d.,\\u00a0\\u202f ]{0,12})(?:${alternatives})`,
    'g',
  );
  return [...new Set((text.match(pattern) ?? []).map((token) => token.trim()))];
}

/** Can this rendered token stand for this ISO code? */
function tokenMatchesCurrency(token: string, code: string): boolean {
  const upper = code.toUpperCase();
  if (token.toUpperCase() === upper) return true;
  return (CURRENCY_SYMBOLS[upper] ?? []).includes(token);
}

/** The prices this page renders, split into charged and struck-through. */
function splitCandidates(candidates: PriceCandidate[]): { live: number[]; struck: number[] } {
  return {
    live: candidates.filter((candidate) => !candidate.struck).map((candidate) => candidate.value),
    struck: candidates.filter((candidate) => candidate.struck).map((candidate) => candidate.value),
  };
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

/** Two Product nodes sharing a url or @id but disagreeing about the offer. */
export function duplicateConflicts(nodes: Record<string, unknown>[]): string[] {
  const byKey = new Map<string, Set<string>>();

  for (const node of nodes) {
    if (!typesOf(node).includes('Product')) continue;
    const key = str(node['url']) ?? str(node['@id']);
    if (key === undefined) continue;
    const offers = (Array.isArray(node['offers']) ? node['offers'] : [node['offers']]).filter(isObj);
    for (const offer of offers) {
      const fingerprint = `${str(offer['price']) ?? '?'} ${str(offer['availability']) ?? '?'}`;
      const seen = byKey.get(key) ?? new Set<string>();
      seen.add(fingerprint);
      byKey.set(key, seen);
    }
  }

  const out: string[] = [];
  for (const [key, fingerprints] of byKey) {
    if (fingerprints.size > 1) {
      out.push(`${key} is described twice, as ${[...fingerprints].join(' and ')}`);
    }
  }
  return out;
}

const EXPECTED =
  'The price, currency, availability and offer window in the markup say the same thing the page says';

export class OfferTruthConsistencyAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agentic-commerce/offer-truth-consistency',
    category: 'agentic-commerce',
    title: 'Offer Truth Consistency',
    failureTitle: 'Offer Truth Consistency',
    description:
      'Reconciles the Offer in a product page’s structured data against what the same page actually renders: the price, the currency, whether the item can be bought, whether the offer window has closed, and whether two Product nodes describing the same URL disagree. Every rule is a value comparison, not a presence check, and extraction is confined to the product region so a related-products carousel cannot fire it.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'high',
    dossier: 'docs/evidence/audits/agentic-commerce/offer-truth-consistency.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    applicablePageTypes: ['product'],
    guidance: {
      impact:
        'An agent quotes from the structured data; the seller recomputes the real amount at checkout. When the two disagree the buyer has already committed, and the session comes back with `invalid` or `out_of_stock` — the most expensive moment at which a purchase can fail. Google says the same thing from the other side: structured data must be a true representation of the page content. Markup that is present and lying passes every syntax validator on the market.',
      fix: 'Generate the Offer from the same source of truth that renders the page, at the same time. If the JSON-LD comes from a cached catalogue service, invalidate that cache on the same event that flips the button to Sold out. Keep priceValidUntil ahead of today or drop it, keep priceCurrency matching the symbol you render, and never emit two Product nodes for one URL with different prices.',
      code: `<!-- The button and the markup are generated from one value -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "sku": "MC-100",
  "offers": {
    "@type": "Offer",
    "price": "59.00",
    "priceCurrency": "GBP",
    "availability": "https://schema.org/OutOfStock",
    "priceValidUntil": "2027-01-31"
  }
}
</script>
<p class="price">£59.00</p>
<button disabled>Sold out</button>`,
      effort: 'complex',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/agentic-commerce/offer-truth-consistency/',
      tags: ['commerce', 'json-ld', 'price', 'availability', 'acp'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const productPages = ctx.pages.slice(0, MAX_PAGES);
    if (productPages.length === 0) {
      return this.notApplicable(
        'This scan reached no product page, so there is no offer to reconcile.',
        EXPECTED,
        'No product page scanned',
      );
    }

    const failures: string[] = [];
    const warnings: string[] = [];
    let pagesChecked = 0;

    for (const page of productPages) {
      const nodes = allJsonLdNodes(page.structuredData ?? page.jsonLd).filter(isObj);
      const offers = offerNodes(page.structuredData ?? page.jsonLd);
      const priced = offers.find((offer) => offer.price !== undefined);
      const $ = page.$;
      const region = productRegion($);
      const regionText = region.text();
      const label = page.url;

      const declaredCurrency = priced?.priceCurrency ?? offers.find((o) => o.priceCurrency)?.priceCurrency;
      const rendered = renderedCurrencies(regionText);
      const candidates = priceCandidates($, region, declaredCurrency ?? rendered[0] ?? 'USD');
      const { live, struck } = splitCandidates(candidates);

      // JS-ONLY PRICE. Reported and never failed: no price anywhere is a
      // different defect from two prices that disagree.
      if (live.length === 0 && struck.length === 0 && priced === undefined) {
        warnings.push(
          `${label} renders no price in its HTML and declares none in its markup, so the number is injected client-side and no major AI crawler will ever see it`,
        );
        continue;
      }
      pagesChecked += 1;

      // UNMACHINE-READABLE.
      if (priced === undefined && live.length > 0) {
        failures.push(
          `${label} renders a price (${candidates[0]?.text ?? live[0]}) but declares no offers.price, so an agent has nothing to quote`,
        );
      }

      // STOCK CONTRADICTION.
      const availability = offers.find((offer) => offer.availability)?.availability;
      const buyDisabled = $('button, input[type="submit"]', region)
        .toArray()
        .some((element) => {
          const el = $(element);
          const name = `${el.text()} ${el.attr('name') ?? ''} ${el.attr('class') ?? ''} ${el.attr('value') ?? ''}`;
          return BUY_CONTROL.test(name) && el.attr('disabled') !== undefined;
        });
      if (availability && IN_STOCK.test(availability)) {
        if (OUT_OF_STOCK_PHRASES.test(regionText)) {
          failures.push(
            `${label} declares ${availability} while the product region says it is sold out`,
          );
        } else if (buyDisabled) {
          failures.push(
            `${label} declares ${availability} while its add-to-cart control is disabled`,
          );
        }
      } else if (availability && NOT_IN_STOCK.test(availability) && SAYS_IN_STOCK.test(regionText)) {
        failures.push(
          `${label} declares ${availability} while the product region says it is in stock`,
        );
      }

      // STALE OFFER.
      if (priced?.priceValidUntil) {
        const until = new Date(priced.priceValidUntil);
        if (!Number.isNaN(until.getTime()) && until.getTime() < Date.now()) {
          failures.push(
            `${label} carries priceValidUntil ${priced.priceValidUntil}, which has passed, so the quoted price is expired`,
          );
        }
      }

      // PRICE DIVERGENCE. A struck-through candidate is an acceptable non-match.
      if (priced?.price !== undefined && live.length > 0) {
        const declared = priced.price;
        const match = live.some((value) => Math.abs(value - declared) <= Math.abs(declared) * TOLERANCE);
        if (!match) {
          failures.push(
            `${label} declares ${declared} but the product region renders ${[...new Set(live)].slice(0, 3).join(', ')}, so an agent quotes a price the checkout will not honour`,
          );
        }
      }

      // CURRENCY MISMATCH.
      if (declaredCurrency && rendered.length > 0) {
        const agrees = rendered.some((token) => tokenMatchesCurrency(token, declaredCurrency));
        if (!agrees) {
          failures.push(
            `${label} declares ${declaredCurrency} but renders ${rendered.slice(0, 3).join(', ')}`,
          );
        }
      }

      // SALE INVERSION.
      const sale = live.length > 0 ? Math.min(...live) : undefined;
      const regular = struck.length > 0 ? Math.max(...struck) : undefined;
      if (sale !== undefined && regular !== undefined && sale >= regular) {
        failures.push(
          `${label} shows a sale price of ${sale} at or above the struck-through price of ${regular}`,
        );
      }

      // DUPLICATE CONFLICT.
      for (const conflict of duplicateConflicts(nodes)) {
        failures.push(`${label}: ${conflict}`);
      }
    }

    if (pagesChecked === 0) {
      const details = { productPages: productPages.length, warnings: warnings.slice(0, MAX_SHOWN) };
      return {
        ...this.warn(
          warnings[0] ??
            'No product page carries a price in its HTML or in its markup, so there is nothing to reconcile.',
          EXPECTED,
          `${productPages.length} product page(s), none with a static price`,
          'Render the price server-side so a crawler that does not execute JavaScript can read it.',
        ),
        details,
      };
    }

    const details = {
      productPages: productPages.length,
      pagesReconciled: pagesChecked,
      contradictions: failures.length,
      failures: failures.slice(0, MAX_SHOWN),
      warnings: warnings.slice(0, MAX_SHOWN),
    };
    const found = `${pagesChecked} product page(s) reconciled; ${failures.length} contradiction(s), ${warnings.length} page(s) with no static price.`;
    const displayValue = `${failures.length} contradiction(s)`;

    if (failures.length > 0) {
      return {
        ...this.fail(
          failures[0]!,
          EXPECTED,
          found,
          'Generate the Offer and the visible page from one value, at one time.',
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
          'Render the price server-side so a crawler that does not execute JavaScript can read it.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        'The markup and the page agree on price, currency, availability and the offer window.',
        EXPECTED,
        found,
      ),
      displayValue,
      details,
    };
  }
}
