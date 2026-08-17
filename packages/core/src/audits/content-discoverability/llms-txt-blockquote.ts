import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

export class LlmsTxtBlockquoteAudit extends Audit {
  static override meta: AuditMeta = {
    id: '1.2',
    category: 'content-discoverability',
    title: 'llms.txt has blockquote summary',
    failureTitle: 'llms.txt has blockquote summary',
    description:
      'The blockquote summary gives AI agents a one-sentence overview of your site without reading further.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without a blockquote summary, AI agents have no quick way to understand what your site offers. They must parse the entire llms.txt file before deciding if your content is relevant, leading to slower and less accurate AI responses about your business.',
      fix: 'Add a blockquote line (starting with >) immediately after the H1 heading in your llms.txt file. Write a concise 1-2 sentence summary of what your site provides.',
      code: '# Your Site Name\n\n> Your site provides X for Y. It covers topics including A, B, and C.',
      effort: 'trivial',
      docsUrl: 'https://llmstxt.org/',
      tags: ['llms-txt', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/llms.txt'];

    if (!result || !isOk(result)) {
      return this.fail(
        'llms.txt not found; cannot check for blockquote summary.',
        '> blockquote line after H1',
        'File not found',
        {
          priority: 'critical',
          description:
            'First, create your llms.txt file (see check 1.1). The blockquote summary gives AI agents a one-sentence overview of your site without reading further.',
          code: `# Your Site Name\n\n> Brief description of your site for AI agents.\n\n## Pages\n- [Home](/): Main landing page\n- [About](/about/): Company information`,
        },
      );
    }

    const lines = result.body.split('\n');
    const h1Index = lines.findIndex((l) => l.trimStart().startsWith('# '));
    if (h1Index === -1) {
      return this.fail('No H1 heading found in llms.txt.', '> blockquote after H1', 'No H1 found', {
        priority: 'high',
        description:
          'llms.txt needs an H1 heading before the blockquote summary. AI agents use the heading to identify your site and the blockquote as a concise summary.',
        code: `# Your Site Name\n\n> Brief description of what your site offers to AI agents.`,
      });
    }

    // Look for a blockquote line after the H1
    const afterH1 = lines.slice(h1Index + 1);
    const hasBlockquote = afterH1.some((l) => l.trimStart().startsWith('> '));

    if (!hasBlockquote) {
      return this.fail(
        'llms.txt has no blockquote summary after the H1 heading.',
        '> blockquote summary line after H1',
        'No > line found after H1',
        {
          priority: 'medium',
          description:
            'The blockquote summary gives AI agents a concise overview of your site in 1-2 sentences. It appears right after the H1 heading and helps agents decide whether your site is relevant to a user query.',
          code: `> Your site provides X for Y. It covers topics including A, B, and C.`,
        },
      );
    }

    return this.pass(
      'llms.txt contains a blockquote summary after the H1 heading.',
      '> blockquote after H1',
      'Blockquote found',
    );
  }
}
