import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class LlmsTxtLinkAudit extends Audit {
  static override meta: AuditMeta = {
    id: '4.11',
    category: 'meta-tags',
    title: 'llms.txt link in head',
    failureTitle: 'llms.txt link in head',
    description:
      'The llms.txt link in <head> is how AI agents discover your LLM-friendly content manifest. Without this link tag, agents must guess that /llms.txt exists or rely on well-known URL conventions. An explicit link ensures every AI crawler that visits your page can immediately find your structured content.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'The llms.txt link in <head> is how AI agents discover your LLM-friendly content manifest. Without it, agents must guess that /llms.txt exists or rely on well-known URL conventions, meaning many AI crawlers will never find your structured content.',
      fix: 'Add a <link rel="alternate"> tag in <head> pointing to your llms.txt file with type="text/plain" and a descriptive title.',
      code: '<link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt">',
      effort: 'trivial',
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
        (l.title ?? '').toLowerCase().includes('llms'),
    );
    /* v8 ignore stop */

    if (link) {
      return this.pass(
        `llms.txt link found: "${link.href}".`,
        '<link rel="alternate" type="text/plain" title="...LLMs...">',
        `href="${link.href}" title="${link.title}"`,
        page.url,
      );
    }

    return this.fail(
      'No llms.txt link found in <head>.',
      '<link rel="alternate" type="text/plain" title="...LLMs...">',
      'Not found',
      {
        priority: 'high',
        description:
          'The llms.txt link in <head> is how AI agents discover your LLM-friendly content manifest. Without this link tag, agents must guess that /llms.txt exists or rely on well-known URL conventions. An explicit link ensures every AI crawler that visits your page can immediately find your structured content.',
        code: '<link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt">',
      },
      page?.url,
    );
  }
}
