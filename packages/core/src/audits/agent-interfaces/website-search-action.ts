// TODO(merge): folds into agent-interfaces/search-endpoint in Plan 4 (approved 2026-08-21).
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { flattenJsonLd } from '../../parser';

function matchesType(schema: Record<string, unknown>, type: string): boolean {
  const t = schema['@type'];
  if (typeof t === 'string') return t === type;
  if (Array.isArray(t)) return t.includes(type);
  return false;
}

function allSchemas(ctx: CheckContext): object[] {
  return ctx.pages.flatMap((p) => flattenJsonLd(p.structuredData ?? p.jsonLd));
}

export class WebSiteSearchActionAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/website-search-action',
    category: 'agent-interfaces',
    title: 'WebSite schema with SearchAction',
    failureTitle: 'WebSite schema with SearchAction',
    description:
      'SearchAction tells AI agents how to search your site programmatically. When a user asks ChatGPT to "find X on yoursite.com", the agent uses this schema to construct a search URL. Without it, agents have no machine-readable way to query your content.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('D', 'informative'),
    evidenceGrade: 'D',
    tier: 'informative',
    dossier: 'docs/evidence/audits/agent-interfaces/website-search-action.md',
    applicablePageTypes: ['homepage'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'Without WebSite schema with SearchAction, AI agents have no machine-readable way to search your site. When a user asks ChatGPT to "find X on yoursite.com", the agent cannot construct a search URL and will either skip your site or guess incorrectly.',
      fix: 'Add WebSite JSON-LD to your homepage with a potentialAction of type SearchAction. The target must be a URL template with a {search_term_string} placeholder, and query-input must declare the parameter name.',
      code: `{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://yoursite.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://yoursite.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}`,
      effort: 'trivial',
      docsUrl: 'https://schema.org/SearchAction',
      tags: ['json-ld', 'schema', 'search', 'website', 'sitelinks'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const schemas = allSchemas(ctx);
    const webSites = schemas.filter((s) => matchesType(s as Record<string, unknown>, 'WebSite'));

    if (webSites.length === 0) {
      return this.fail(
        'No WebSite schema found.',
        'WebSite schema with potentialAction SearchAction and target URL template.',
        'None',
        {
          priority: 'high',
          description:
            'SearchAction tells AI agents how to search your site programmatically. When a user asks ChatGPT to "find X on yoursite.com", the agent uses this schema to construct a search URL. Without it, agents have no machine-readable way to query your content.',
          code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://yoursite.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://yoursite.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>`,
        },
      );
    }

    const ws = webSites[0] as Record<string, unknown>;
    const action = ws['potentialAction'] as Record<string, unknown> | undefined;
    const hasSearchAction =
      action &&
      matchesType(action, 'SearchAction') &&
      typeof action['target'] === 'string' &&
      action['target'].includes('{');

    if (hasSearchAction) {
      return this.pass(
        'WebSite schema with SearchAction and URL template found.',
        'WebSite schema with potentialAction SearchAction and target URL template.',
        'Complete WebSite SearchAction',
      );
    }

    return this.warn(
      'WebSite schema found but missing proper SearchAction with target URL template.',
      'WebSite schema with potentialAction SearchAction and target URL template.',
      'WebSite schema without proper SearchAction',
      {
        priority: 'medium',
        description:
          'SearchAction tells AI agents how to search your site programmatically. When a user asks an AI agent to "find X on yoursite.com", the agent uses this schema to construct a search URL and return results. Add a potentialAction with a target URL template.',
        code: `"potentialAction": {
  "@type": "SearchAction",
  "target": "https://yoursite.com/search?q={search_term_string}",
  "query-input": "required name=search_term_string"
}`,
      },
    );
  }
}
