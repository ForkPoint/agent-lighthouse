import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import type { CheerioAPI } from 'cheerio';
import { flattenJsonLd } from '../../parser';

/**
 * Return every flattened JSON-LD node whose @type matches one of the given
 * types. Uses the shared deep flattener so types nested in arrays / under
 * properties (not just @graph) are found.
 */
function findJsonLdByType(jsonLd: object[], types: string[]): Record<string, unknown>[] {
  const lowerTypes = new Set(types.map((t) => t.toLowerCase()));
  return (flattenJsonLd(jsonLd) as Record<string, unknown>[]).filter((record) => {
    const objType = record['@type'];
    if (!objType) return false;
    const typeArr = Array.isArray(objType) ? objType : [objType];
    return typeArr.some((t) => typeof t === 'string' && lowerTypes.has(t.toLowerCase()));
  });
}

/**
 * Full-body text (scripts/styles stripped), not just <main>. Brand mentions
 * routinely live outside <main> — header logo alt text, footer copyright
 * ("© 2026 Acme Italy"), nav — so a <main>-only scan false-fails brands that
 * are clearly present on the page.
 */
function getBodyText($: CheerioAPI): string {
  const body = $('body').clone();
  body.find('script, style, noscript, template').remove();
  return body.text().replace(/\s+/g, ' ').trim();
}

/**
 * Strip a trailing legal-entity suffix ("Inc.", "LLC", "Ltd", "Co", ...) so the
 * schema's legal name ("Knix Inc.") still matches the trading name ("Knix")
 * that actually appears in body copy.
 */
function stripLegalSuffix(name: string): string {
  return name.replace(/[,]?\s+(?:inc|llc|ltd|co|corp|gmbh|company)\.?$/i, '').trim();
}

export class BrandNameAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/brand-name',
    category: 'answer-readiness',
    title: 'Brand name in body text',
    failureTitle: 'Brand name in body text',
    description:
      'AI engines build entity graphs by matching Organization schema names to in-content mentions. If your brand name only appears in schema but not body text, agents cannot associate your content with your entity.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/answer-readiness/brand-name.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI engines build entity graphs by matching Organization schema names to in-content mentions. If your brand name only appears in schema but not body text, agents cannot associate your content with your entity, weakening brand recognition in AI responses.',
      fix: 'Mention your brand name naturally in the body text of your pages. Ensure it matches the name in your Organization JSON-LD schema exactly.',
      code: '<p>At YourBrand, we build tools that help developers ship faster.</p>\n\n<!-- Ensure JSON-LD matches: -->\n<script type="application/ld+json">\n{"@context":"https://schema.org","@type":"Organization","name":"YourBrand"}\n</script>',
      effort: 'trivial',
      tags: ['brand', 'entity', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'Organization name from JSON-LD appears in <main> text content',
        'No pages scanned',
      );
    }

    // Collect every candidate brand name we can find. The Organization `name`
    // is often the legal entity ("Knix Inc.") that never appears verbatim in
    // body copy, so we also gather WebSite/publisher names and og:site_name and
    // try each (plus a legal-suffix-stripped variant) when matching.
    const candidates: string[] = [];
    const addCandidate = (value: unknown): void => {
      if (typeof value === 'string' && value.trim()) candidates.push(value.trim());
    };

    for (const p of ctx.pages) {
      const orgs = findJsonLdByType(p.jsonLd, ['Organization', 'LocalBusiness', 'Corporation']);
      for (const org of orgs) addCandidate(org['name']);

      // WebSite/Article publisher names and the WebSite's own name.
      const articles = findJsonLdByType(p.jsonLd, ['Article', 'BlogPosting', 'WebPage', 'WebSite']);
      for (const article of articles) {
        addCandidate(article['name']);
        const publisher = article['publisher'] as Record<string, unknown> | undefined;
        if (publisher && typeof publisher === 'object') addCandidate(publisher['name']);
      }
    }

    // Fallback: og:site_name.
    addCandidate(page.meta?.['og:site_name']);

    const orgName = candidates[0] ?? '';

    if (!orgName) {
      return this.warn(
        'No organization name found in JSON-LD or og:site_name to check against body text.',
        'Organization name from JSON-LD appears in <main> text content',
        'No org name in schema',
        {
          priority: 'medium',
          description:
            'AI agents need to identify your brand to attribute content correctly. Without an Organization schema with your brand name, agents cannot connect your pages to your entity in AI knowledge graphs. Add Organization schema and mention your brand naturally in body text.',
          code: '<script type="application/ld+json">\n{"@context":"https://schema.org","@type":"Organization","name":"Your Brand"}\n</script>',
        },
        page.url,
      );
    }

    // Build the set of names to try: every candidate plus its
    // legal-suffix-stripped variant (de-duped, longest first so the most
    // specific brand name is reported on a match).
    const matchNames = [
      ...new Set(candidates.flatMap((c) => [c, stripLegalSuffix(c)]).filter(Boolean)),
    ].sort((a, b) => b.length - a.length);

    // Check if any brand name variant appears in body text of any page
    for (const p of ctx.pages) {
      const text = getBodyText(p.$);
      for (const name of matchNames) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundary = new RegExp(`\\b${escaped}\\b`, 'i');
        if (wordBoundary.test(text)) {
          return this.pass(
            `Brand name "${name}" appears in body text.`,
            'Organization name from JSON-LD appears in <main> text content',
            name,
            p.url,
          );
        }
      }
    }

    return this.fail(
      `Brand name "${orgName}" not found in body text of any scanned page.`,
      'Organization name from JSON-LD appears in <main> text content',
      `"${orgName}" not in body text`,
      {
        priority: 'medium',
        description:
          'AI engines build entity graphs by matching Organization schema names to in-content mentions. If your brand name only appears in schema but not body text, agents cannot associate your content with your entity. Mention your brand name naturally in the body to strengthen entity recognition.',
        code: '<!-- Mention your brand naturally in content: -->\n<p>At YourBrand, we build tools that help developers ship faster.</p>',
      },
      page.url,
    );
  }
}
