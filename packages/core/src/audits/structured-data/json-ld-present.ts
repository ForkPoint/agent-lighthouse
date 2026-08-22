import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class JsonLdPresentAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'structured-data/json-ld-present',
    category: 'structured-data',
    title: 'JSON-LD present',
    failureTitle: 'JSON-LD present',
    description:
      'AI agents rely on JSON-LD structured data to understand what your site offers, who runs it, and how to interact with it. Without any JSON-LD, agents like ChatGPT and Perplexity treat your site as unstructured text with no machine-readable identity. Add Organization and WebSite schemas to your homepage <head> as a starting point.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/structured-data/json-ld-present.md',
    defaultPriority: 'critical',
    guidance: {
      impact:
        'Without any JSON-LD structured data, AI agents like ChatGPT and Perplexity treat your site as unstructured text with no machine-readable identity. Your brand, products, and services become invisible to AI-powered discovery, search, and recommendation systems.',
      fix: 'Add at least one JSON-LD script block in your homepage <head>. Start with Organization and WebSite schemas to establish your site identity for AI agents.',
      code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company",
  "url": "https://yoursite.com",
  "logo": "https://yoursite.com/logo.png"
}
</script>`,
      effort: 'easy',
      docsUrl:
        'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
      tags: ['json-ld', 'schema', 'foundation'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const allBlocks = ctx.pages.flatMap((p) => p.jsonLd);
    const found = allBlocks.length > 0;

    if (found) {
      return this.pass(
        `Found ${allBlocks.length} JSON-LD block(s) across ${ctx.pages.length} page(s).`,
        'At least one valid JSON-LD block across all pages.',
        `${allBlocks.length} JSON-LD block(s)`,
      );
    }

    return this.fail(
      'No JSON-LD structured data found on any page.',
      'At least one valid JSON-LD block across all pages.',
      'None',
      {
        priority: 'critical',
        description:
          'AI agents rely on JSON-LD structured data to understand what your site offers, who runs it, and how to interact with it. Without any JSON-LD, agents like ChatGPT and Perplexity treat your site as unstructured text with no machine-readable identity. Add Organization and WebSite schemas to your homepage <head> as a starting point.',
        code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company",
  "url": "https://yoursite.com",
  "logo": "https://yoursite.com/logo.png"
}
</script>`,
        docsUrl:
          'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
      },
    );
  }
}
