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

export class AuthorSameAsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/author-same-as',
    category: 'answer-readiness',
    title: 'Author schema with sameAs',
    failureTitle: 'Author schema with sameAs',
    description:
      'AI RAG systems cross-reference author identity across platforms via sameAs URLs. Without external profile links, agents cannot verify author expertise.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/answer-readiness/author-same-as.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI RAG systems cross-reference author identity across platforms via sameAs URLs to build an expertise graph. Without external profile links, agents cannot verify that your author is the same expert they see on LinkedIn, Twitter, or GitHub, reducing trust weight.',
      fix: "Add a sameAs array to your JSON-LD author object with URLs to the author's LinkedIn, Twitter/X, GitHub, or other professional profiles.",
      code: '"author": {\n  "@type": "Person",\n  "name": "Jane Smith",\n  "sameAs": [\n    "https://linkedin.com/in/janesmith",\n    "https://twitter.com/janesmith",\n    "https://github.com/janesmith"\n  ]\n}',
      effort: 'easy',
      docsUrl: 'https://schema.org/sameAs',
      tags: ['trust', 'e-e-a-t', 'json-ld', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'JSON-LD author has sameAs array with external profile URLs',
        'No pages scanned',
        {
          priority: 'medium',
          description:
            'AI RAG systems cross-reference author identity across platforms via sameAs URLs. Without external profile links, agents cannot verify author expertise.',
          code: '"author": { "@type": "Person", "name": "Jane Smith", "sameAs": ["https://linkedin.com/in/janesmith"] }',
        },
      );
    }

    for (const p of ctx.pages) {
      const articles = findJsonLdByType(p.jsonLd, [
        'Article',
        'BlogPosting',
        'NewsArticle',
        'WebPage',
        'TechArticle',
        'Person',
      ]);

      for (const article of articles) {
        // Check if the object itself is a Person with sameAs
        const authorObj =
          article['@type'] === 'Person'
            ? article
            : (article['author'] as Record<string, unknown> | undefined);

        if (!authorObj || typeof authorObj !== 'object') continue;

        const authors = Array.isArray(authorObj) ? authorObj : [authorObj];
        for (const a of authors) {
          if (typeof a !== 'object' || a === null) continue;
          const rec = a as Record<string, unknown>;
          const sameAs = rec['sameAs'];
          if (Array.isArray(sameAs) && sameAs.length > 0) {
            const urls = sameAs.filter(
              (s) => typeof s === 'string' && (s.startsWith('http://') || s.startsWith('https://')),
            );
            if (urls.length > 0) {
              return this.pass(
                `Author sameAs found with ${urls.length} external profile URL(s).`,
                'JSON-LD author has sameAs array with external profile URLs',
                urls.slice(0, 3).join(', '),
                p.url,
              );
            }
          }
          // Single string sameAs
          if (
            typeof sameAs === 'string' &&
            (sameAs.startsWith('http://') || sameAs.startsWith('https://'))
          ) {
            return this.pass(
              'Author sameAs found with an external profile URL.',
              'JSON-LD author has sameAs array with external profile URLs',
              sameAs,
              p.url,
            );
          }
        }
      }
    }

    return this.fail(
      'No author sameAs with external profile URLs found in JSON-LD.',
      'JSON-LD author has sameAs array with external profile URLs',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI RAG systems cross-reference author identity across platforms via sameAs URLs to build an expertise graph. Without external profile links (LinkedIn, Twitter, GitHub), agents cannot verify that "Jane Smith" on your site is the same expert they see on other platforms, reducing the trust weight of your content.',
        code: '"author": {\n  "@type": "Person",\n  "name": "Jane Smith",\n  "sameAs": [\n    "https://linkedin.com/in/janesmith",\n    "https://twitter.com/janesmith",\n    "https://github.com/janesmith"\n  ]\n}',
      },
      page.url,
    );
  }
}
