import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

/** Coerce an unknown JSON value to a string; non-strings → ''. */
function asString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

/**
 * Walk all JSON-LD blocks (including @graph arrays) and return every
 * object whose @type matches at least one of the given types.
 */
function findJsonLdByType(jsonLd: object[], types: string[]): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const lowerTypes = new Set(types.map((t) => t.toLowerCase()));

  function walk(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }

    const record = obj as Record<string, unknown>;

    const objType = record['@type'];
    if (objType) {
      const typeArr = Array.isArray(objType) ? objType : [objType];
      for (const t of typeArr) {
        if (typeof t === 'string' && lowerTypes.has(t.toLowerCase())) {
          results.push(record);
        }
      }
    }

    // Recurse into @graph
    if (record['@graph'] && Array.isArray(record['@graph'])) {
      for (const item of record['@graph']) walk(item);
    }
  }

  for (const block of jsonLd) walk(block);
  return results;
}

export class LastModifiedSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: '10.10',
    category: 'generative-engine',
    title: 'Last modified date in schema',
    failureTitle: 'Last modified date in schema',
    description:
      'AI engines use dateModified in JSON-LD to determine content freshness. Content that shows recent updates is prioritized over stale content.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI generative engines use dateModified in JSON-LD to rank content by freshness. Without it, agents cannot determine when your content was last reviewed, causing it to be treated as potentially stale compared to competitors with recent dateModified values.',
      fix: 'Add a dateModified property to your Article/BlogPosting JSON-LD that differs from datePublished. Update dateModified automatically whenever you revise the content.',
      code: '{\n  "@type": "Article",\n  "datePublished": "2025-01-01T10:00:00Z",\n  "dateModified": "2025-01-20T10:00:00Z"\n}',
      effort: 'easy',
      docsUrl: 'https://schema.org/dateModified',
      tags: ['freshness', 'json-ld', 'schema', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'JSON-LD dateModified present and different from datePublished',
        'No pages scanned',
        {
          priority: 'medium',
          description:
            'AI engines use dateModified in JSON-LD to determine content freshness. Content that shows recent updates is prioritized over stale content.',
          code: '"dateModified": "2025-01-20T10:00:00Z"',
        },
      );
    }

    for (const p of ctx.pages) {
      const articles = findJsonLdByType(p.structuredData ?? p.jsonLd, [
        'Article',
        'BlogPosting',
        'NewsArticle',
        'WebPage',
        'TechArticle',
      ]);

      for (const article of articles) {
        const dateModified = article['dateModified'];
        const datePublished = article['datePublished'];

        if (typeof dateModified === 'string' && dateModified.trim()) {
          if (typeof datePublished === 'string' && dateModified.trim() !== datePublished.trim()) {
            return this.pass(
              `dateModified ("${dateModified}") differs from datePublished ("${datePublished}").`,
              'JSON-LD dateModified present and different from datePublished',
              `dateModified: ${dateModified}, datePublished: ${datePublished}`,
              p.url,
            );
          }

          // dateModified exists but same as datePublished or no datePublished
          return this.warn(
            datePublished
              ? `dateModified equals datePublished ("${dateModified}"). Update dateModified when content changes.`
              : `dateModified is set ("${dateModified}") but no datePublished for comparison.`,
            'JSON-LD dateModified present and different from datePublished',
            `dateModified: ${dateModified}${datePublished ? `, datePublished: ${asString(datePublished)}` : ''}`,
            {
              priority: 'low',
              description:
                'AI engines compare dateModified to datePublished to detect actively maintained content. When they match, agents treat the content as never-updated since publication. Update dateModified each time you revise content to signal freshness.',
            },
            p.url,
          );
        }
      }
    }

    return this.fail(
      'No dateModified found in any JSON-LD schema.',
      'JSON-LD dateModified present and different from datePublished',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI generative engines use dateModified in JSON-LD to rank content by freshness. Without it, agents cannot determine when your content was last reviewed, causing it to be treated as potentially stale. Add dateModified and update it whenever you revise content.',
        code: '"datePublished": "2025-01-01T10:00:00Z",\n"dateModified": "2025-01-20T10:00:00Z"',
      },
      page.url,
    );
  }
}
