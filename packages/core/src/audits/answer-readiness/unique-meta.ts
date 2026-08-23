import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class UniqueMetaAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/unique-meta',
    category: 'answer-readiness',
    title: 'Unique meta per page',
    failureTitle: 'Unique meta per page',
    description:
      'AI crawlers use title and description pairs to distinguish between pages. Duplicate meta across pages causes agents to merge or skip content, meaning some of your pages will be invisible in AI-generated answers. Give each page a unique title and description.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/answer-readiness/unique-meta.md',
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
    // Group pages by canonical URL so variant query parameters (e.g. ?variant=123) are not counted as duplicate distinct pages
    const canonicalGroups = new Map<string, (typeof ctx.pages)[0]>();
    for (const page of ctx.pages) {
      let canon = (page.meta?.['canonical'] || page.url).trim();
      try {
        const u = new URL(canon);
        u.search = '';
        u.hash = '';
        canon = u.href;
      } catch {
        // ignore
      }
      if (!canonicalGroups.has(canon)) {
        canonicalGroups.set(canon, page);
      }
    }

    const uniquePages = Array.from(canonicalGroups.values());
    if (uniquePages.length < 2) {
      return this.pass(
        'Only one distinct canonical page scanned; uniqueness check not applicable.',
        'Each page has a unique title + description combination',
        '1 distinct page scanned',
      );
    }

    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    for (const page of uniquePages) {
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
        `All ${uniquePages.length} distinct pages have unique title + description.`,
        'Each page has a unique title + description combination',
        `${uniquePages.length} unique combinations`,
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
