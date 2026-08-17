import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class LlmsFullTxtLinkAudit extends Audit {
  static override meta: AuditMeta = {
    id: '4.12',
    category: 'meta-tags',
    title: 'llms-full.txt link in head',
    failureTitle: 'llms-full.txt link in head',
    description:
      'The llms-full.txt file provides AI agents with a comprehensive, unabridged version of your content optimized for ingestion into context windows. Adding this link in <head> lets agents choose between the summary (llms.txt) and full content versions based on their context budget.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'The llms-full.txt file provides AI agents with a comprehensive, unabridged version of your content optimized for large context windows. Without it, agents are limited to the summary version, potentially missing important details about your offerings.',
      fix: 'Create a llms-full.txt file with comprehensive content and add a <link rel="alternate"> tag in <head> pointing to it.',
      code: '<link rel="alternate" type="text/plain" href="/llms-full.txt" title="LLMs-full.txt">',
      effort: 'moderate',
      docsUrl: 'https://llmstxt.org/',
      tags: ['meta-tags', 'llms-txt', 'ai-discovery'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    /* v8 ignore start */
    const link = page?.headLinks?.find(
      (l) =>
        l.rel === 'alternate' &&
        l.type === 'text/plain' &&
        (l.title ?? '').toLowerCase().includes('llms-full'),
    );
    /* v8 ignore stop */

    if (link) {
      return this.pass(
        `llms-full.txt link found: "${link.href}".`,
        '<link rel="alternate" type="text/plain" title="...LLMs-full...">',
        `href="${link.href}" title="${link.title}"`,
        page.url,
      );
    }

    return this.fail(
      'No llms-full.txt link found in <head>.',
      '<link rel="alternate" type="text/plain" title="...LLMs-full...">',
      'Not found',
      {
        priority: 'medium',
        description:
          'The llms-full.txt file provides AI agents with a comprehensive, unabridged version of your content optimized for ingestion into context windows. Adding this link in <head> lets agents choose between the summary (llms.txt) and full content versions based on their context budget.',
        code: '<link rel="alternate" type="text/plain" href="/llms-full.txt" title="LLMs-full.txt">',
      },
      page?.url,
    );
  }
}
