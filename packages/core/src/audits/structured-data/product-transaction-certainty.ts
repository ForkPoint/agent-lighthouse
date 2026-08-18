import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { flattenJsonLd } from '../../parser';

function matchesAnyType(schema: Record<string, unknown>, types: string[]): boolean {
  return types.some((t) => {
    const st = schema['@type'];
    if (typeof st === 'string') return st === t;
    if (Array.isArray(st)) return st.includes(t);
    return false;
  });
}

function asOfferList(offers: unknown): Record<string, unknown>[] {
  if (!offers) return [];
  const list = Array.isArray(offers) ? offers : [offers];
  return list.filter((o): o is Record<string, unknown> => !!o && typeof o === 'object');
}

interface CertaintySignals {
  availability: boolean;
  priceValidUntil: boolean;
  pricePair: boolean;
  returnPolicy: boolean;
}

/** The 4 transactional certainty signals an AI shopping assistant needs. */
const SIGNAL_LABELS: Record<keyof CertaintySignals, string> = {
  availability: 'offers.availability',
  priceValidUntil: 'offers.priceValidUntil',
  pricePair: 'offers.price + offers.priceCurrency',
  returnPolicy: 'hasMerchantReturnPolicy',
};

export class ProductTransactionCertaintyAudit extends Audit {
  static override meta: AuditMeta = {
    id: '3.24',
    category: 'structured-data',
    title: 'Product transactional certainty',
    failureTitle: 'Product transactional certainty',
    description:
      'AI shopping assistants need more than a product name and price to make an authoritative recommendation: they must know whether the item is in stock, how long the quoted price is valid, and what the return policy is before they commit a user to a purchase. A Product schema that only carries name and price forces agents to guess at availability, quote potentially stale prices, and stay silent on returns — all of which erode transactional certainty in agentic commerce flows. Complete your Offer with availability, priceValidUntil, and a valid price + priceCurrency pair, and attach hasMerchantReturnPolicy to the Product or Offer.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    applicablePageTypes: ['product'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'Without availability, priceValidUntil, a valid price/currency pair, and a return policy in your Product schema, AI shopping assistants cannot make an authoritative recommendation. Agents either skip your product or answer with guessed availability, stale prices, and unknown return terms — costing you conversions in agent-driven purchases.',
      fix: 'Complete the Offer block in your Product JSON-LD with availability (a schema.org ItemAvailability value), priceValidUntil (ISO date), and a valid price + priceCurrency pair. Add hasMerchantReturnPolicy to the Product or Offer. Also ensure unique identifiers (GTIN/MPN/SKU) are present — see the Product identifiers audit — so agents can match the exact item.',
      code: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "offers": {
    "@type": "Offer",
    "price": "99.00",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31",
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "US",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 30
    }
  }
}`,
      effort: 'moderate',
      docsUrl: 'https://schema.org/Offer',
      tags: ['json-ld', 'schema', 'product', 'ecommerce', 'agentic-commerce'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const schemas = ctx.pages.flatMap((p) => flattenJsonLd(p.structuredData ?? p.jsonLd));
    const products = schemas.filter((s) =>
      matchesAnyType(s as Record<string, unknown>, [
        'Product',
        'IndividualProduct',
        'ProductModel',
      ]),
    );

    if (products.length === 0) {
      return this.notApplicable(
        'No Product schema found on any page to evaluate transactional certainty.',
        'Product schema with offers containing availability, priceValidUntil, price + priceCurrency, and hasMerchantReturnPolicy.',
        'None',
      );
    }

    // Evaluate every Product and keep the best-covered one so one complete
    // listing is not dragged down by sparse siblings.
    let best: { signals: CertaintySignals; count: number } | null = null;

    for (const product of products) {
      const obj = product as Record<string, unknown>;
      const offers = asOfferList(obj['offers']);
      if (offers.length === 0) continue;

      const signals: CertaintySignals = {
        availability: offers.some((o) => !!o['availability']),
        priceValidUntil: offers.some((o) => !!o['priceValidUntil']),
        pricePair: offers.some(
          (o) =>
            o['price'] !== undefined &&
            o['price'] !== null &&
            o['price'] !== '' &&
            !!o['priceCurrency'],
        ),
        returnPolicy:
          !!obj['hasMerchantReturnPolicy'] ||
          offers.some((o) => !!o['hasMerchantReturnPolicy']),
      };
      const count = Object.values(signals).filter(Boolean).length;
      if (!best || count > best.count) best = { signals, count };
    }

    const expected =
      'Product schema with offers containing availability, priceValidUntil, price + priceCurrency, and hasMerchantReturnPolicy.';

    if (!best) {
      return this.fail(
        'Product schema found but no Offer block — no transactional data for agents to act on.',
        expected,
        '0/4 certainty signals (no offers)',
        {
          priority: 'high',
          description:
            'AI shopping assistants cannot quote a price, check stock, or state return terms without an Offer block. Add offers with price, priceCurrency, availability, priceValidUntil, and hasMerchantReturnPolicy.',
        },
      );
    }

    const missing = (Object.keys(best.signals) as (keyof CertaintySignals)[])
      .filter((k) => !best!.signals[k])
      .map((k) => SIGNAL_LABELS[k]);

    if (best.count === 4) {
      return this.pass(
        'All transactional certainty signals present: availability, priceValidUntil, price + priceCurrency, and return policy.',
        expected,
        '4/4 certainty signals',
      );
    }

    if (best.count >= 2) {
      return this.warn(
        `Missing purchasing data points: ${missing.join(', ')}.`,
        expected,
        `${best.count}/4 certainty signals (missing: ${missing.join(', ')})`,
        {
          priority: 'high',
          description: `AI shopping assistants are missing ${missing.join(', ')} and cannot give an authoritative recommendation for this product. Complete the Offer block so agents can quote stock, price validity, and return terms with certainty.`,
        },
      );
    }

    return this.fail(
      `Product relies on name and price alone — missing: ${missing.join(', ')}.`,
      expected,
      `${best.count}/4 certainty signals (missing: ${missing.join(', ')})`,
      {
        priority: 'high',
        description: `AI shopping assistants are missing ${missing.join(', ')} and cannot give an authoritative recommendation for this product. Complete the Offer block so agents can quote stock, price validity, and return terms with certainty.`,
      },
    );
  }
}
