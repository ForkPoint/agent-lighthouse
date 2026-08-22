import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import type { FetchResult } from '../../fetcher';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

/** Link relations the llms.txt v2 spec defines for pointing at the file. */
const DISCOVERY_RELS = new Set(['alternate', 'describedby']);

/**
 * Find a `<link>` that points at /llms.txt.
 *
 * Absorbed from v1 4.11 with its review's required fixes: match on the href's
 * filename (not on the optional, language-dependent `title`), accept any
 * content type (llms.txt is Markdown, and servers append charset), and treat
 * `rel` as a normalized token list rather than an exact string. Anchoring on
 * the exact filename is what stops an `llms-full.txt` link from counting.
 */
function findDiscoveryLink(page: PageContext | undefined): { href: string } | null {
  for (const link of page?.headLinks ?? []) {
    const rels = link.rel.toLowerCase().trim().split(/\s+/);
    if (!rels.some((rel) => DISCOVERY_RELS.has(rel))) continue;
    try {
      const url = new URL(link.href, page!.url);
      if (/\/llms\.txt$/i.test(url.pathname)) return { href: link.href };
    } catch {
      // Skip unparseable hrefs.
    }
  }
  return null;
}

export class LlmsTxtExistsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/llms-txt-exists',
    category: 'machine-discovery',
    title: 'llms.txt exists',
    failureTitle: 'llms.txt exists',
    description:
      'llms.txt is the primary way AI agents discover your site content. Without it, LLMs must crawl your entire site to understand what you offer. Create this file at your site root; a <link> in <head> pointing at it is reported as an optional discovery hint.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/machine-discovery/llms-txt-exists.md',
    defaultPriority: 'critical',
    guidance: {
      impact:
        'llms.txt is the primary entry point for AI agents discovering your site. Without it, LLMs like ChatGPT, Perplexity, and Claude must crawl your entire site blindly, often missing key pages and providing incomplete or inaccurate answers about your business.',
      fix: 'Create a /llms.txt file at your site root in markdown format. Include an H1 heading with your site name, a blockquote summary, and organized sections with links to your key pages. Optionally advertise it with <link rel="alternate" href="/llms.txt"> in <head>.',
      code: '# Your Site Name\n\n> Brief description of your site for AI agents.\n\n## Pages\n- [Home](/): Main landing page\n- [About](/about/): Company information\n\n## Resources\n- [Sitemap](/sitemap.xml): Full URL list\n- [RSS](/rss.xml): Content feed\n\n<!-- optional discovery hint in <head> -->\n<link rel="alternate" type="text/markdown" href="/llms.txt" title="llms.txt">',
      effort: 'easy',
      docsUrl: 'https://llmstxt.org/',
      tags: ['llms-txt', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/llms.txt'];
    const page = ctx.pages[0];
    const link = findDiscoveryLink(page);
    // The well-known path is the spec's discovery mechanism and no agent is
    // documented to read the head link, so its state is reported, never scored.
    const linkNote = link ? `discovery <link> → ${link.href}` : 'no discovery <link> in <head>';

    if (!result || !isOk(result)) {
      const status = result ? `HTTP ${result.status}` : 'No response';
      return this.fail(
        link
          ? 'The page links to llms.txt but the file is not served at the site root.'
          : 'llms.txt not found at site root.',
        'GET /llms.txt returns 200 with markdown starting with #',
        `${status}; ${linkNote}`,
        'critical',
        page?.url,
      );
    }

    if (!result.body.trimStart().startsWith('#')) {
      return this.warn(
        'llms.txt missing markdown heading.',
        'Body starts with # (H1 heading)',
        `Body starts with "${result.body.trimStart().slice(0, 40)}..."; ${linkNote}`,
        'high',
        page?.url,
      );
    }

    return this.pass(
      'llms.txt exists and is valid.',
      'HTTP 200 with # heading',
      `HTTP 200 with # heading; ${linkNote}`,
      page?.url,
    );
  }
}
