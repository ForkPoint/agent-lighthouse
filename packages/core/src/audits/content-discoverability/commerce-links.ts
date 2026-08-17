import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class CommerceLinksAudit extends Audit {
  static override meta: AuditMeta = {
    id: '1.23',
    category: 'content-discoverability',
    title: 'Critical commerce links',
    failureTitle: 'Critical commerce links',
    description:
      'AI agents must provide transparency on shipping and returns to help users make buying decisions. Finding and verifying these links is essential for "Instant Checkout" readiness.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI shopping agents cannot complete purchase recommendations without verifiable return, shipping, and seller information. Missing these links disqualifies your store from "Instant Checkout" flows and erodes buyer trust.',
      fix: 'Add clearly labeled links to your return policy, shipping information, and seller/contact pages in your site footer or navigation. Use descriptive anchor text like "Return Policy", "Shipping & Delivery", and "About Us".',
      code: '<footer>\n  <a href="/returns">Return Policy</a>\n  <a href="/shipping">Shipping & Delivery</a>\n  <a href="/about">About Us</a>\n</footer>',
      effort: 'easy',
      tags: ['commerce', 'trust', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) return this.fail('No pages for analysis.', '', 'None');

    const $ = page.$;
    const links = $('a[href]')
      .map((_, el) => ({
        text: $(el).text().toLowerCase(),
        href: $(el).attr('href')?.toLowerCase() || '',
      }))
      .get();

    const policies: Record<string, boolean> = {
      return: false,
      shipping: false,
      seller: false,
    };

    for (const link of links) {
      if (link.href.includes('return') || link.text.includes('return policy'))
        policies.return = true;
      if (link.href.includes('shipping') || link.text.includes('delivery'))
        policies.shipping = true;
      if (
        link.href.includes('seller') ||
        link.text.includes('about us') ||
        link.href.includes('contact')
      )
        policies.seller = true;
    }

    const found = Object.entries(policies)
      .filter(([_, v]) => v)
      .map(([k]) => k);
    const missing = Object.entries(policies)
      .filter(([_, v]) => !v)
      .map(([k]) => k);

    if (missing.length === 0) {
      return this.pass(
        'Found links for return policy, shipping, and seller info.',
        'Links to return policy, shipping, and seller/contact pages.',
        'All present',
      );
    }

    if (found.length > 0) {
      return this.warn(
        `Missing some critical commerce links: ${missing.join(', ')}.`,
        'Links to return policy, shipping, and seller/contact pages.',
        `Found: ${found.join(', ')}`,
        {
          priority: 'medium',
          description:
            'AI agents require easy access to shipping and return information to finalize transactions.',
        },
      );
    }

    return this.fail(
      'Missing all critical commerce links (Return, Shipping, Seller).',
      'Links to return policy, shipping, and seller/contact pages.',
      'None found',
      {
        priority: 'medium',
        description:
          'Provide clear, discoverable links to your policies in the footer to help AI agents process orders.',
      },
    );
  }
}
