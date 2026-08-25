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
      'llms.txt is a community convention: a markdown index of your site at /llms.txt. No AI vendor documents a crawler or agent that reads it, and Google states Search ignores it, so this check is reported and never scored. Chrome Lighthouse checks the same three conformance rules and treats a missing file as not applicable.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/machine-discovery/llms-txt-exists.md',
    defaultPriority: 'low',
    guidance: {
      impact:
        'Thousands of sites publish an llms.txt, including every major AI lab, but as publishers rather than readers. No vendor documentation names an agent that fetches it, and Google Search Central states Search ignores it. Publishing one is cheap and harmless; it is not a documented path to any AI answer.',
      fix: 'Optional. If you publish one, create /llms.txt in markdown with an H1 heading, at least one [text](url) link and more than 50 characters — the three rules the one shipping checker enforces. Optionally advertise it with <link rel="alternate" href="/llms.txt"> in <head>.',
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
      // A site that links to llms.txt and does not serve it has a broken
      // promise of its own making, which is worth a warning. A site that never
      // claimed to have one has done nothing wrong: the file is optional, and
      // the only shipping checker of it scores a 404 not-applicable.
      if (!link) {
        return this.notApplicable(
          'No llms.txt at the site root. The file is an optional community convention with no documented agent consumer, so its absence is not a defect.',
          'GET /llms.txt returns 200 with markdown starting with #',
          `${status}; ${linkNote}`,
          page?.url,
        );
      }
      return this.warn(
        'The page links to llms.txt but the file is not served at the site root.',
        'GET /llms.txt returns 200 with markdown starting with #',
        `${status}; ${linkNote}`,
        'low',
        page?.url,
      );
    }

    if (!result.body.trimStart().startsWith('#')) {
      return this.warn(
        'llms.txt missing markdown heading.',
        'Body starts with # (H1 heading)',
        `Body starts with "${result.body.trimStart().slice(0, 40)}..."; ${linkNote}`,
        'low',
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
