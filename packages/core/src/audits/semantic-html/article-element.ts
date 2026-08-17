import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class ArticleElementAudit extends Audit {
  static override meta: AuditMeta = {
    id: '6.4',
    category: 'semantic-html',
    title: '<article> used for content',
    failureTitle: '<article> used for content',
    description:
      'RAG systems chunk content by <article> boundaries for vector embedding, treating each article as an independent retrieval unit. Without <article> tags, AI chunking algorithms fall back to arbitrary text splitting, which fragments related content across multiple embeddings and reduces answer quality.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'RAG systems chunk content by <article> boundaries for vector embedding, treating each article as an independent retrieval unit. Without <article> tags, AI chunking algorithms fall back to arbitrary text splitting, which fragments related content across embeddings and reduces answer quality.',
      fix: 'Wrap each self-contained content block (blog post, news story, product card, forum post) in an <article> element. Each <article> should make sense on its own and include a heading.',
      code: '<article>\n  <h2>Article Title</h2>\n  <p>Self-contained content block that makes sense independently...</p>\n</article>',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/article',
      tags: ['article', 'structure', 'semantic', 'html'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let pagesWithArticle = 0;

    for (const page of ctx.pages) {
      if (page.$('article').length > 0) pagesWithArticle++;
    }

    const majorityPass =
      pagesWithArticle > Math.floor(ctx.pages.length / 2) ||
      (ctx.pages[0] && ctx.pages[0].$('article').length > 0);
    const allPass = pagesWithArticle === ctx.pages.length;

    if (allPass) {
      return this.pass(
        'All content pages use <article> elements.',
        '<article> elements on content pages',
        `${pagesWithArticle}/${ctx.pages.length} pages with <article>`,
      );
    }

    if (majorityPass) {
      return this.warn(
        `${pagesWithArticle}/${ctx.pages.length} page(s) use <article> elements.`,
        '<article> elements on content pages',
        `${pagesWithArticle}/${ctx.pages.length} pages with <article>`,
      );
    }

    return this.fail(
      `${pagesWithArticle}/${ctx.pages.length} page(s) use <article> elements.`,
      '<article> elements on content pages',
      `${pagesWithArticle}/${ctx.pages.length} pages with <article>`,
      {
        priority: 'medium',
        description:
          'RAG systems chunk content by <article> boundaries for vector embedding, treating each article as an independent retrieval unit. Without <article> tags, AI chunking algorithms fall back to arbitrary text splitting, which fragments related content across multiple embeddings and reduces answer quality.',
        code: '<article>\n  <h2>Article Title</h2>\n  <p>Self-contained content block...</p>\n</article>',
      },
    );
  }
}
