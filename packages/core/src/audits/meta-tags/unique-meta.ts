import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class UniqueMetaAudit extends Audit {
  static override meta: AuditMeta = {
    id: '4.5',
    category: 'meta-tags',
    title: 'Unique meta per page',
    failureTitle: 'Unique meta per page',
    description:
      'AI crawlers use title and description pairs to distinguish between pages. Duplicate meta across pages causes agents to merge or skip content, meaning some of your pages will be invisible in AI-generated answers. Give each page a unique title and description.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'AI crawlers use title and description pairs to distinguish between pages. Duplicate meta across pages causes agents to merge or skip content, meaning some pages become invisible in AI-generated answers.',
      fix: 'Give each page a unique <title> and <meta name="description"> that specifically describes that page\'s content. Avoid template descriptions that repeat across pages.',
      code: '<title>Unique Page Title - Your Site</title>\n<meta name="description" content="Unique description for this specific page.">',
      effort: 'easy',
      tags: ['meta-tags', 'seo', 'deduplication'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (ctx.pages.length < 2) {
      return this.pass(
        'Only one page scanned; uniqueness check not applicable.',
        'Each page has a unique title + description combination',
        '1 page scanned',
      );
    }

    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    for (const page of ctx.pages) {
      /* v8 ignore next */
      const title = (page.meta?.['title'] ?? page.$?.('title').text() ?? '').trim();
      const desc = (page.meta?.['description'] ?? '').trim();
      const key = `${title}|||${desc}`;

      if (seen.has(key)) {
        duplicates.push(`"${page.url}" duplicates "${seen.get(key)}"`);
      } else {
        seen.set(key, page.url);
      }
    }

    if (duplicates.length === 0) {
      return this.pass(
        `All ${ctx.pages.length} pages have unique title + description.`,
        'Each page has a unique title + description combination',
        `${ctx.pages.length} unique combinations`,
      );
    }

    return this.fail(
      `Duplicate title + description found across pages.`,
      'Each page has a unique title + description combination',
      duplicates.join('; '),
      {
        priority: 'high',
        description:
          'AI crawlers use title and description pairs to distinguish between pages. Duplicate meta across pages causes agents to merge or skip content, meaning some of your pages will be invisible in AI-generated answers. Give each page a unique title and description.',
        code: '<title>Unique Page Title</title>\n<meta name="description" content="Unique description for this specific page.">',
      },
    );
  }
}
