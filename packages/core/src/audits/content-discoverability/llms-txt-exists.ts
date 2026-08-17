import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

export class LlmsTxtExistsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '1.1',
    category: 'content-discoverability',
    title: 'llms.txt exists',
    failureTitle: 'llms.txt exists',
    description:
      'llms.txt is the primary way AI agents discover your site content. Without it, LLMs must crawl your entire site to understand what you offer. Create this file at your site root.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'critical',
    guidance: {
      impact:
        'llms.txt is the primary entry point for AI agents discovering your site. Without it, LLMs like ChatGPT, Perplexity, and Claude must crawl your entire site blindly, often missing key pages and providing incomplete or inaccurate answers about your business.',
      fix: 'Create a /llms.txt file at your site root in markdown format. Include an H1 heading with your site name, a blockquote summary, and organized sections with links to your key pages.',
      code: '# Your Site Name\n\n> Brief description of your site for AI agents.\n\n## Pages\n- [Home](/): Main landing page\n- [About](/about/): Company information\n\n## Resources\n- [Sitemap](/sitemap.xml): Full URL list\n- [RSS](/rss.xml): Content feed',
      effort: 'easy',
      docsUrl: 'https://llmstxt.org/',
      tags: ['llms-txt', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/llms.txt'];

    if (!result || !isOk(result)) {
      return this.fail(
        'llms.txt not found at site root.',
        'GET /llms.txt returns 200 with markdown starting with #',
        result ? `HTTP ${result.status}` : 'No response',
        'critical',
      );
    }

    if (!result.body.trimStart().startsWith('#')) {
      return this.warn(
        'llms.txt missing markdown heading.',
        'Body starts with # (H1 heading)',
        `Body starts with "${result.body.trimStart().slice(0, 40)}..."`,
        'high',
      );
    }

    return this.pass(
      'llms.txt exists and is valid.',
      'HTTP 200 with # heading',
      'HTTP 200 with # heading',
    );
  }
}
