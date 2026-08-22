// Graduated from proposal 2026-08-22 (Plan 5, Task 17).
// Evidence dossier: docs/evidence/audits/agentic-commerce/landed-cost-and-returns.md
//
// Agents rank competing offers on landed cost and delivery date. Both are
// numbers, so both have to exist as numbers rather than as prose on a
// /shipping page.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { flattenJsonLd } from '../../parser';

/** The three values schema.org allows for returnPolicyCategory. */
const RETURN_CATEGORIES = new Set([
  'MerchantReturnFiniteReturnWindow',
  'MerchantReturnNotPermitted',
  'MerchantReturnUnlimitedWindow',
]);

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

/** The bare enum name, whether it arrived bare or as a schema.org URL. */
function enumName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const parts = value.split('/');
  return parts[parts.length - 1] || undefined;
}

function numberOf(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

/** A QuantitativeValue in days, as the feed's positional string needs it. */
function dayRange(value: unknown): { min: number; max: number } | undefined {
  const node = first(value);
  if (!node) return undefined;
  const unit = typeof node['unitCode'] === 'string' ? node['unitCode'].toUpperCase() : undefined;
  if (unit && unit !== 'DAY' && unit !== 'D') return undefined;
  const min = numberOf(node['minValue']);
  const max = numberOf(node['maxValue']);
  if (min === undefined || max === undefined) return undefined;
  return { min, max };
}

interface ShippingLeg {
  ok: boolean;
  problems: string[];
  /** The positional feed value, when the leg is complete enough to build one. */
  feed?: string;
  doesNotShip?: boolean;
}

function assessShipping(offer: Record<string, unknown>): ShippingLeg {
  const details = first(offer['shippingDetails']);
  if (!details) {
    return {
      ok: false,
      problems: [
        'the Offer carries no shippingDetails, so an agent has no shipping cost or delivery window to rank the offer on',
      ],
    };
  }

  if (details['doesNotShip'] === true || details['doesNotShip'] === 'true') {
    return { ok: true, problems: [], doesNotShip: true };
  }

  const problems: string[] = [];
  const rate = first(details['shippingRate']);
  const price = rate ? numberOf(rate['value']) : undefined;
  const currency = rate && typeof rate['currency'] === 'string' ? rate['currency'] : undefined;
  if (price === undefined || !currency) {
    problems.push(
      'shippingRate is not a MonetaryAmount with a numeric value and a currency, so the shipping cost is not a number an agent can add up',
    );
  }

  const destination = first(details['shippingDestination']);
  const country =
    destination && typeof destination['addressCountry'] === 'string'
      ? destination['addressCountry']
      : typeof details['shippingDestination'] === 'string'
        ? (details['shippingDestination'] as string)
        : undefined;
  if (!country) problems.push('shippingDestination carries no addressCountry');

  const delivery = first(details['deliveryTime']);
  const handling = dayRange(delivery?.['handlingTime']);
  const transit = dayRange(delivery?.['transitTime']);
  if (!handling || !transit) {
    const misplaced = details['handlingTime'] !== undefined || details['transitTime'] !== undefined;
    problems.push(
      misplaced
        ? 'handlingTime and transitTime must be nested under deliveryTime (ShippingDeliveryTime), not set directly on OfferShippingDetails'
        : 'deliveryTime does not carry both handlingTime and transitTime as QuantitativeValue with numeric minValue/maxValue in unitCode DAY',
    );
  }

  const region =
    destination && typeof destination['addressRegion'] === 'string' ? destination['addressRegion'] : '';
  const service = typeof details['name'] === 'string' && details['name'].trim() ? details['name'].trim() : 'standard';
  const feed =
    price !== undefined && country && handling && transit
      ? `${country}:${region}:${service}:${price.toFixed(2)}:${handling.max}:${transit.max}`
      : undefined;

  return { ok: problems.length === 0, problems, ...(feed ? { feed } : {}) };
}

interface ReturnsLeg {
  ok: boolean;
  /** Satisfies Google only through a URL, which is not a comparable number. */
  linkOnly: boolean;
  problems: string[];
  feed?: string;
}

function assessReturns(policy: Record<string, unknown> | undefined): ReturnsLeg {
  if (!policy) {
    return {
      ok: false,
      linkOnly: false,
      problems: [
        'no hasMerchantReturnPolicy on the Offer or the Organization, so the return window is not machine-readable',
      ],
    };
  }

  const category = enumName(policy['returnPolicyCategory']);
  const country = policy['applicableCountry'];
  const hasLink = typeof policy['merchantReturnLink'] === 'string' && policy['merchantReturnLink'].trim();

  if (!category && hasLink) {
    return {
      ok: false,
      linkOnly: true,
      problems: [
        'the return policy satisfies Google only through merchantReturnLink — a URL is not a number an agent can compare, so the return window stays unreadable',
      ],
    };
  }

  const problems: string[] = [];
  if (!category || !RETURN_CATEGORIES.has(category)) {
    problems.push('returnPolicyCategory is missing or outside the three-value enum');
  }
  if (typeof country !== 'string' || !/^[A-Za-z]{2}$/.test(country)) {
    problems.push('applicableCountry is missing or is not an ISO 3166-1 alpha-2 code');
  }

  let days: number | undefined;
  if (category === 'MerchantReturnFiniteReturnWindow') {
    days = numberOf(policy['merchantReturnDays']);
    if (days === undefined || !Number.isInteger(days) || days <= 0) {
      problems.push(
        'returnPolicyCategory is MerchantReturnFiniteReturnWindow, so merchantReturnDays must be a positive integer',
      );
    }
  }

  return {
    ok: problems.length === 0,
    linkOnly: false,
    problems,
    ...(days !== undefined && days > 0 ? { feed: `return_deadline_in_days=${days}` } : {}),
  };
}

/** The first Offer on a product page, plus the page it came from. */
function findOffer(ctx: CheckContext): { offer: Record<string, unknown>; page: PageContext } | undefined {
  for (const page of ctx.pages) {
    if (page.pageType !== 'product') continue;
    for (const node of flattenJsonLd(page.jsonLd)) {
      if (!isObject(node)) continue;
      if (typesOf(node).includes('Offer')) return { offer: node, page };
      const offer = first(node['offers']);
      if (offer) return { offer, page };
    }
  }
  return undefined;
}

/** A returns policy declared anywhere: on the Offer, or on the Organization. */
function findReturnPolicy(ctx: CheckContext, offer: Record<string, unknown>) {
  const own = first(offer['hasMerchantReturnPolicy']);
  if (own) return own;
  for (const page of ctx.pages) {
    for (const node of flattenJsonLd(page.jsonLd)) {
      if (!isObject(node)) continue;
      const policy = first(node['hasMerchantReturnPolicy']);
      if (policy) return policy;
    }
  }
  return undefined;
}

const EXPECTED =
  'Every product offer carries shippingDetails with a numeric shippingRate, a destination country and handlingTime plus transitTime nested under deliveryTime, and a return policy with applicableCountry, returnPolicyCategory and — for a finite window — merchantReturnDays';

const SAMPLE = `{
  "@type": "Offer",
  "shippingDetails": {
    "@type": "OfferShippingDetails",
    "shippingRate": { "@type": "MonetaryAmount", "value": 5.99, "currency": "USD" },
    "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "US" },
    "deliveryTime": {
      "@type": "ShippingDeliveryTime",
      "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 1, "unitCode": "DAY" },
      "transitTime": { "@type": "QuantitativeValue", "minValue": 1, "maxValue": 3, "unitCode": "DAY" }
    }
  },
  "hasMerchantReturnPolicy": {
    "@type": "MerchantReturnPolicy",
    "applicableCountry": "US",
    "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
    "merchantReturnDays": 30
  }
}`;

export class LandedCostAndReturnsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agentic-commerce/landed-cost-and-returns',
    category: 'agentic-commerce',
    title: 'Landed-cost and returns machine readability',
    failureTitle: 'Landed-cost and returns machine readability',
    description:
      'Requires structured, agent-parsable shipping cost, handling and transit times, and a return window expressed as an integer — the exact inputs an agent needs to rank offers and the exact fields the ACP checkout session must compute.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agentic-commerce/landed-cost-and-returns.md',
    applicablePageTypes: ['product'],
    defaultPriority: 'high',
    guidance: {
      impact:
        "Falsifiable claim: ACP makes `fulfillment_options` and `totals` REQUIRED on every CheckoutSession, and the seller — not the agent — is responsible for 'calculating all amounts (item prices, discounts, taxes, shipping)'; totals must break down into typed entries including `fulfillment` and `tax` before status can reach `ready_for_payment`. Upstream of that, the OpenAI feed `shipping` field is a rigid positional string country:region:service_class:price:handling_days:transit_days, and the returns fields are accepts_returns, return_deadline_in_days (positive integer) and return_policy URL. Agents rank competing offers on landed cost and delivery date, both of which are numbers. A merchant that publishes shipping and returns only as prose on a /shipping page supplies no number, so it either loses the comparison or forces a headless-browser fallback. Disproof condition: agents consistently ranking offers correctly from prose-only shipping pages.",
      fix: 'Add OfferShippingDetails to every offer: shippingRate as a MonetaryAmount with a numeric value and a currency, shippingDestination.addressCountry, and handlingTime plus transitTime as QuantitativeValue nested under deliveryTime — not directly on OfferShippingDetails, which is the common mistake. Add hasMerchantReturnPolicy with applicableCountry and returnPolicyCategory, and for a finite window a positive integer merchantReturnDays. Where you genuinely do not ship, say so with doesNotShip: true; an explicit answer is an answer. A merchantReturnLink alone is not enough: an agent cannot compare a URL.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/agentic-commerce/landed-cost-and-returns.md',
      tags: ['acp', 'shipping', 'returns', 'feed', 'commerce'],
    },
  };

  private recommendation() {
    return {
      priority: 'high' as const,
      description: LandedCostAndReturnsAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const found = findOffer(ctx);
    if (!found) {
      return this.notApplicable(
        'No product page with an Offer was scanned, so there is no landed cost or return window to read.',
        EXPECTED,
        'No product Offer on the scanned pages',
      );
    }

    const shipping = assessShipping(found.offer);
    const returns = assessReturns(findReturnPolicy(ctx, found.offer));

    const feedParts = [
      shipping.feed ? `shipping=${shipping.feed}` : undefined,
      shipping.doesNotShip ? 'shipping=doesNotShip' : undefined,
      returns.feed,
    ].filter(Boolean);
    const foundText = `shipping leg ${shipping.ok ? 'complete' : 'incomplete'}; returns leg ${
      returns.ok ? 'complete' : returns.linkOnly ? 'link only' : 'incomplete'
    }${feedParts.length ? `; feed: ${feedParts.join(' ')}` : ''}`;

    const problems = [...shipping.problems, ...(returns.linkOnly ? [] : returns.problems)];
    if (problems.length > 0) {
      return this.fail(
        `The offer cannot be ranked on landed cost: ${problems.join('; ')}.`,
        EXPECTED,
        foundText,
        this.recommendation(),
        found.page.url,
      );
    }

    if (returns.linkOnly) {
      return this.warn(
        `The shipping leg is machine-readable, but ${returns.problems.join('; ')}.`,
        EXPECTED,
        foundText,
        this.recommendation(),
        found.page.url,
      );
    }

    return this.pass(
      'Shipping cost, handling and transit times and the return window are all machine-readable numbers.',
      EXPECTED,
      foundText,
      found.page.url,
    );
  }
}
