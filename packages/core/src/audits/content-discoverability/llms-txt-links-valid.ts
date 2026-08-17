import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { type FetchResult, isSafeUrl } from '../../fetcher';
import { extractMarkdownLinks } from '../../parser';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

export class LlmsTxtLinksValidAudit extends Audit {
  static override meta: AuditMeta = {
    id: '1.5',
    category: 'content-discoverability',
    title: 'llms.txt links are valid',
    failureTitle: 'llms.txt links are valid',
    description:
      'Valid links in llms.txt ensure AI agents can navigate to your content without encountering dead ends.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'Broken links in llms.txt send AI agents to dead ends, wasting their context window and degrading the quality of answers about your site. Users asking AI about your products or services will get error messages instead of useful information.',
      fix: 'Verify all links in your llms.txt resolve to HTTP 200. Remove links to deleted pages and update any URLs that have changed. Run this check after every site deployment.',
      code: '- [Page Name](/correct-path): Description of the page content',
      effort: 'easy',
      docsUrl: 'https://llmstxt.org/',
      tags: ['llms-txt', 'broken-links', 'discoverability'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const result = ctx.rootFiles['/llms.txt'];

    if (!result || !isOk(result)) {
      return this.fail(
        'llms.txt not found; cannot validate links.',
        'All links return HTTP 200',
        'File not found',
        {
          priority: 'critical',
          description:
            'First, create your llms.txt file (see check 1.1). Valid links in llms.txt ensure AI agents can navigate to your content without encountering dead ends.',
          code: `# Your Site Name\n\n> Brief description of your site for AI agents.\n\n## Pages\n- [Home](/): Main landing page\n- [About](/about/): Company information`,
        },
      );
    }

    const links = extractMarkdownLinks(result.body);

    if (links.length === 0) {
      return this.warn(
        'No links found in llms.txt to validate.',
        'All links return HTTP 200',
        'No links found',
        {
          priority: 'medium',
          description:
            'llms.txt should contain links to your key pages. Without links, the file does not help AI agents discover your content.',
          code: `- [Home](/): Main landing page\n- [About](/about/): Company information`,
        },
      );
    }

    // Resolve relative URLs and filter out unsafe ones (SSRF protection)
    const resolved: string[] = [];
    for (const l of links) {
      try {
        const abs = new URL(l.url, ctx.baseUrl).href;
        if (await isSafeUrl(abs)) resolved.push(abs);
      } catch {
        // skip malformed URLs
      }
    }

    const results = await Promise.all(resolved.map((url) => ctx.fetch({ url })));

    const broken = results.filter((r) => !isOk(r));

    if (broken.length > 0) {
      const topBroken = broken.slice(0, 10).map((r) => `${r.url} (${r.status})`).join(', ');
      const brokenSummary = broken.length > 10 ? `${topBroken} (+${broken.length - 10} more)` : topBroken;
      return this.fail(
        `${broken.length}/${links.length} link(s) are broken.`,
        'All links return HTTP 200',
        `Broken: ${brokenSummary}`,
        {
          priority: 'high',
          description:
            'Broken links in llms.txt cause AI agents to hit dead ends, wasting their context window and degrading user experience. Fix the URLs to point to valid pages or remove links to pages that no longer exist.',
          code: `- [Page Name](/correct-path): Description of the page`,
        },
      );
    }

    return this.pass(
      `All ${links.length} link(s) return HTTP 200.`,
      'All links return HTTP 200',
      `${links.length}/${links.length} valid`,
    );
  }
}
