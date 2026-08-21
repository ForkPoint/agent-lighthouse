// TODO(redeem): this audit survives only if rewritten (approved 2026-08-21).
// Evidence dossier: docs/evidence/deletions/generative-engine/trust-signals.md
// Required rework:
//   Grade B: there is strong, quantified, multi-model empirical data that trust and social-proof
//   cues in retrieved page text change which source an AI answer engine cites — 252,000 controlled
//   trials, 4-5 of 6 models significant, plus a +17% 'Authoritative' effect in the KDD'24 GEO
//   benchmark. Per the rubric that makes it redeemable, and unlike the other three audits here it
//   has a real measured mechanism behind it. But it must be re-specified to check what was actually
//   measured rather than what reads well in a marketing deck: keep and strengthen
//   ratings/reviews-based social proof (coordinating with review-signals.ts so they do not
//   double-count), add checks for evidence-backed claims and comparison content, and delete the
//   promotional-puffery patterns ('free shipping', 'secure checkout', 'money-back guarantee',
//   'sustainable', 'organic', 'handcrafted', 'handmade') since the same study found promotional
//   tone yields no consistent benefit and neutral phrasing wins where significant. Its weight
//   should also be demoted relative to the gatekeeper factors — trust cues are explicitly the
//   'smaller gains' tier.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

const TRUST_PATTERNS = [
  /trusted\s+by/i,
  /\bclients\b/i,
  /\btestimonial/i,
  /\bcase\s+stud/i,
  /\baward/i,
  /\bas\s+seen\s+(in|on)\b/i,
  /\bpartner(s|ed|ship)?\b/i,
  /\bcertif(ied|icate|ication)\b/i,
  /\b(money[-\s]back\s+guarantee|satisfaction\s+guarantee|guaranteed)\b/i,
  /\b(reviews|customer\s+rating|verified\s+(buyer|customer|review)|happy\s+customers)\b/i,
  /\b(sustainable|organic|fair\s+trade|b\s+corp|handcrafted|handmade)\b/i,
  /\b(secure\s+checkout|free\s+returns|free\s+shipping)\b/i,
];

export class TrustSignalsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '10.7',
    category: 'generative-engine',
    title: 'Trust signals on homepage',
    failureTitle: 'Trust signals on homepage',
    description:
      'AI engines scan homepages for trust signals (client logos, testimonials, awards) as authority indicators when deciding whether to recommend your content.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI generative engines scan homepages for trust signals (client logos, testimonials, awards, certifications) as authority indicators when deciding whether to recommend your site. Without these signals, agents rank your site lower than competitors with visible social proof.',
      fix: 'Add a combination of trust elements to your homepage: "Trusted by X clients" text, a client logo grid, customer testimonials with attribution, and links to case studies or awards.',
      code: '<section>\n  <h2>Trusted by 500+ companies</h2>\n  <div class="client-logos"><!-- client logo images --></div>\n  <blockquote>\n    <p>"Outstanding results"</p>\n    <footer>- <cite>Jane Smith, CEO at Company</cite></footer>\n  </blockquote>\n</section>',
      effort: 'moderate',
      tags: ['trust', 'social-proof', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'Homepage contains trust signals: "trusted by", "clients", "testimonial", "case study", "award", or logo grids',
        'No pages scanned',
        {
          priority: 'medium',
          description:
            'AI engines scan homepages for trust signals (client logos, testimonials, awards) as authority indicators when deciding whether to recommend your content.',
          code: '<section>\n  <h2>Trusted by 500+ companies</h2>\n  <div class="client-logos"><!-- logo images --></div>\n</section>',
        },
      );
    }

    const $ = page.$;
    // Scan the whole <body>, not just <main>: trust badges, "as seen in"
    // strips, certifications and testimonials commonly live in the footer or
    // other regions outside <main> (e.g. allbirds), and a main-scoped read
    // misses them. Clone + strip non-content nodes so inline JS/CSS in
    // <script>/<style> can't pollute the text regexes.
    const body = $('body').clone();
    body.find('script, style, noscript, template').remove();
    const text = body.text().replace(/\s+/g, ' ').trim();
    const foundSignals: string[] = [];

    for (const pattern of TRUST_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        foundSignals.push(match[0]);
      }
    }

    // Check for image grids (common logo carousel/grid patterns)
    const logoGrids = $('[class*="logo"], [class*="client"], [class*="partner"], [class*="trust"]');
    const imgInGrids = logoGrids.find('img').length;
    if (imgInGrids >= 3) {
      foundSignals.push(`image grid (${imgInGrids} logos)`);
    }

    if (foundSignals.length >= 2) {
      return this.pass(
        `Found ${foundSignals.length} trust signal(s) on homepage.`,
        'Homepage contains trust signals: "trusted by", "clients", "testimonial", "case study", "award", or logo grids',
        foundSignals.join(', '),
        page.url,
      );
    }

    if (foundSignals.length === 1) {
      return this.warn(
        `Only 1 trust signal found: "${foundSignals[0]}".`,
        'Homepage contains trust signals: "trusted by", "clients", "testimonial", "case study", "award", or logo grids',
        foundSignals[0],
        {
          priority: 'medium',
          description:
            'AI engines scan homepages for trust signals as authority indicators when deciding whether to recommend your content. A single trust signal is weak. Add a combination of "Trusted by X clients" text, client logo grids, testimonials, and case study links to build a stronger authority profile.',
          code: '<section>\n  <h2>Trusted by 500+ companies</h2>\n  <div class="client-logos"><!-- logo images --></div>\n</section>\n<section>\n  <h2>What our clients say</h2>\n  <blockquote><p>"Excellent service"</p><footer>- Client Name</footer></blockquote>\n</section>',
        },
        page.url,
      );
    }

    return this.fail(
      'No trust signals found on the homepage.',
      'Homepage contains trust signals: "trusted by", "clients", "testimonial", "case study", "award", or logo grids',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI generative engines scan homepages for trust signals when assessing whether to recommend your site in AI-generated answers. Without trust indicators like client counts, testimonials, case studies, or awards, agents rank your site lower than competitors with visible social proof.',
        code: '<section>\n  <h2>Trusted by 500+ companies</h2>\n  <div class="client-logos"><!-- client logo images --></div>\n  <blockquote>\n    <p>"Outstanding results"</p>\n    <footer>- <cite>Jane Smith, CEO at Company</cite></footer>\n  </blockquote>\n</section>',
      },
      page.url,
    );
  }
}
