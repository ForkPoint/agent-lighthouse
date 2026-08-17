import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { getWordCount } from '../../parser';

export class ContentDepthAudit extends Audit {
  static override meta: AuditMeta = {
    id: '6.14',
    category: 'semantic-html',
    title: 'Sufficient content depth',
    failureTitle: 'Sufficient content depth',
    description:
      'AI RAG systems need sufficient content depth to generate accurate, detailed answers. Pages with fewer than 300 words provide too little context for meaningful vector embeddings, causing your content to rank poorly in retrieval and be excluded from AI-generated responses.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Pages with fewer than 300 words provide too little context for AI RAG systems to generate accurate, detailed answers. Thin content produces weak vector embeddings that rank poorly in retrieval, causing your pages to be excluded from AI-generated responses entirely.',
      fix: 'Expand thin pages with substantive content: add detailed explanations, practical examples, FAQs, and relevant context. Aim for at least 300 words of meaningful content per page. Avoid filler text -- focus on answering real user questions comprehensively.',
      effort: 'moderate',
      tags: ['content', 'depth', 'quality'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let pagesAboveThreshold = 0;
    const wordCounts: Array<{ url: string; count: number }> = [];

    for (const page of ctx.pages) {
      const count = getWordCount(page.$);
      wordCounts.push({ url: page.url, count });
      if (count > 300) pagesAboveThreshold++;
    }

    const allPass = pagesAboveThreshold === ctx.pages.length;
    const majorityPass = pagesAboveThreshold > ctx.pages.length / 2;
    const homepagePass = wordCounts.length > 0 && wordCounts[0].count > 300;

    const lowestPage = wordCounts.reduce(
      (min, wc) => (wc.count < min.count ? wc : min),
      wordCounts[0] ?? { url: '', count: 0 },
    );

    if (allPass) {
      return this.pass(
        'All pages have sufficient content depth (>300 words).',
        'More than 300 words of content per page',
        `${pagesAboveThreshold}/${ctx.pages.length} pages above threshold`,
      );
    }

    if (majorityPass || homepagePass) {
      return this.warn(
        `${pagesAboveThreshold}/${ctx.pages.length} page(s) have >300 words. Lowest: ${lowestPage.count} words.`,
        'More than 300 words of content per page',
        `${pagesAboveThreshold}/${ctx.pages.length} pages above threshold`,
        {
          priority: 'medium',
          description:
            'AI RAG systems need sufficient content depth to generate accurate, detailed answers. Pages with fewer than 300 words provide too little context for meaningful vector embeddings, causing your content to rank poorly in retrieval and be excluded from AI-generated responses.',
          code: '<!-- Ensure each page has 300+ words of substantive content -->\n<!-- Expand thin pages with detailed explanations, examples, and context -->',
        },
      );
    }

    return this.fail(
      `${pagesAboveThreshold}/${ctx.pages.length} page(s) have >300 words. Lowest: ${lowestPage.count} words.`,
      'More than 300 words of content per page',
      `${pagesAboveThreshold}/${ctx.pages.length} pages above threshold`,
      {
        priority: 'medium',
        description:
          'AI RAG systems need sufficient content depth to generate accurate, detailed answers. Pages with fewer than 300 words provide too little context for meaningful vector embeddings, causing your content to rank poorly in retrieval and be excluded from AI-generated responses.',
        code: '<!-- Ensure each page has 300+ words of substantive content -->\n<!-- Expand thin pages with detailed explanations, examples, and context -->',
      },
    );
  }
}
