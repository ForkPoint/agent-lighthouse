import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

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

export class AuthorPageAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/author-page',
    category: 'answer-readiness',
    title: 'Author page exists',
    failureTitle: 'Author page exists',
    description:
      'AI engines follow author page links to verify credentials and build author expertise profiles. A dedicated author page strengthens E-E-A-T signals.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/answer-readiness/author-page.md',
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        "AI engines follow author page URLs from JSON-LD and visible bylines to verify credentials and build expertise profiles. Without a linked, accessible author page, agents cannot validate your content creators' qualifications, reducing trust weight in AI recommendations.",
      fix: 'Create a dedicated author page for each content creator with a bio, credentials, and expertise areas. Link to it from the JSON-LD author.url property and ensure it returns HTTP 200.',
      code: '"author": {\n  "@type": "Person",\n  "name": "Jane Smith",\n  "url": "https://yoursite.com/authors/jane-smith"\n}',
      effort: 'moderate',
      tags: ['trust', 'e-e-a-t', 'json-ld', 'generative-engine'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'Author links in content resolve to 200',
        'No pages scanned',
        {
          priority: 'medium',
          description:
            'AI engines follow author page links to verify credentials and build author expertise profiles. A dedicated author page strengthens E-E-A-T signals.',
          code: '"author": { "@type": "Person", "name": "Jane Smith", "url": "https://yoursite.com/authors/jane-smith" }',
        },
      );
    }

    // Find author links from JSON-LD
    const authorUrls: string[] = [];

    for (const p of ctx.pages) {
      const articles = findJsonLdByType(p.jsonLd, [
        'Article',
        'BlogPosting',
        'NewsArticle',
        'WebPage',
        'TechArticle',
      ]);
      for (const article of articles) {
        const author = article['author'] as
          | Record<string, unknown>
          | Record<string, unknown>[]
          | undefined;
        if (!author) continue;
        const authors = Array.isArray(author) ? author : [author];
        for (const a of authors) {
          if (typeof a === 'object' && a !== null) {
            const url = (a as Record<string, unknown>)['url'];
            if (typeof url === 'string' && url.startsWith('http')) {
              authorUrls.push(url);
            }
          }
        }
      }

      // Also check for author links in HTML
      const $ = p.$;
      $('a[rel="author"], [class*="author"] a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          try {
            const resolved = new URL(href, p.url).href;
            authorUrls.push(resolved);
          } catch {
            // ignore invalid URLs
          }
        }
      });
    }

    if (authorUrls.length === 0) {
      return this.fail(
        'No author page links found in content or JSON-LD.',
        'Author links in content resolve to 200',
        'No author URLs found',
        {
          priority: 'medium',
          description:
            "AI engines follow author page URLs from JSON-LD and visible bylines to verify credentials and build expertise profiles. Without a linked author page, agents cannot validate your content creators' qualifications, reducing trust weight in AI-generated recommendations.",
          code: '"author": {\n  "@type": "Person",\n  "name": "Jane Smith",\n  "url": "https://yoursite.com/authors/jane-smith"\n}',
        },
        page.url,
      );
    }

    // Verify the first author URL
    const urlToCheck = authorUrls[0];
    try {
      const result = await ctx.fetch({ url: urlToCheck });
      if (result.status === 200) {
        return this.pass(
          `Author page at "${urlToCheck}" returns 200.`,
          'Author links in content resolve to 200',
          `${urlToCheck} (HTTP ${result.status})`,
          page.url,
        );
      }

      return this.fail(
        `Author page at "${urlToCheck}" returned HTTP ${result.status}.`,
        'Author links in content resolve to 200',
        `${urlToCheck} (HTTP ${result.status})`,
        {
          priority: 'medium',
          description:
            'AI engines that follow your author page link and get a non-200 response will flag the author as unverifiable, negating the trust benefit of having named authors. Fix the URL to return a 200 status with real author bio content.',
          code: '# Verify: curl -I https://yoursite.com/authors/jane-smith\n# Ensure the page returns 200 with author bio content',
        },
        page.url,
      );
    } catch {
      return this.fail(
        `Failed to fetch author page at "${urlToCheck}".`,
        'Author links in content resolve to 200',
        `${urlToCheck} (fetch error)`,
        {
          priority: 'medium',
          description:
            'AI engines verify author page URLs by fetching them. A failing author page URL signals broken credentials to AI trust-scoring systems. Ensure the author page URL is reachable and returns a 200 status with meaningful bio content.',
          code: '# Fix the author URL in your JSON-LD or check for server errors\n# curl -I https://yoursite.com/authors/jane-smith',
        },
        page.url,
      );
    }
  }
}
