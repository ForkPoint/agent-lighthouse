import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class ExternalCitationsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/external-citations',
    category: 'answer-readiness',
    title: 'External citations',
    failureTitle: 'External citations',
    description:
      'Linking to authoritative sources signals expertise. AI RAG systems cross-reference your citations to validate claims and assess content quality.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/answer-readiness/external-citations.md',
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI RAG systems cross-reference your outbound citations against their knowledge graph to validate claims. Pages without external references appear as unsourced opinion, receiving lower trust scores in AI-generated answers.',
      fix: 'Add at least 2 outbound links per content page to authoritative external sources that support your claims. Link to research papers, official documentation, or industry authorities.',
      code: '<p>According to <a href="https://research.google/pubs/">Google Research</a>, this approach improves accuracy by 40%.\nSee also <a href="https://w3.org/standards">W3C standards</a>.</p>',
      effort: 'easy',
      tags: ['trust', 'e-e-a-t', 'content-quality', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'At least 2 <a> tags pointing to external domains per content page',
        'No pages scanned',
        {
          priority: 'medium',
          description:
            'Linking to authoritative sources signals expertise. AI RAG systems cross-reference your citations to validate claims and assess content quality.',
          code: '<p>According to <a href="https://research.google/pubs/">Google Research</a>, this approach improves accuracy by 40%.</p>',
        },
      );
    }

    let pagesWithSufficientLinks = 0;
    let totalExternalLinks = 0;
    const examples: string[] = [];

    for (const p of ctx.pages) {
      const $ = p.$;
      const externalLinks: string[] = [];

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
          const url = new URL(href, p.url);
          if (
            url.hostname !== ctx.domain &&
            !url.hostname.endsWith(`.${ctx.domain}`) &&
            (url.protocol === 'http:' || url.protocol === 'https:')
          ) {
            externalLinks.push(url.hostname);
          }
        } catch {
          // ignore invalid URLs
        }
      });

      totalExternalLinks += externalLinks.length;
      if (externalLinks.length >= 2) {
        pagesWithSufficientLinks++;
      }
      if (examples.length < 5) {
        examples.push(...externalLinks.slice(0, 5 - examples.length));
      }
    }

    if (pagesWithSufficientLinks > 0) {
      return this.pass(
        `Found ${totalExternalLinks} external link(s) across ${ctx.pages.length} page(s); ${pagesWithSufficientLinks} page(s) have 2+ external links.`,
        'At least 2 <a> tags pointing to external domains per content page',
        `External domains: ${[...new Set(examples)].join(', ')}`,
        page.url,
      );
    }

    if (totalExternalLinks > 0) {
      return this.warn(
        `Found ${totalExternalLinks} external link(s) but no page has 2+ external citations.`,
        'At least 2 <a> tags pointing to external domains per content page',
        `External domains: ${[...new Set(examples)].join(', ')}`,
        {
          priority: 'medium',
          description:
            'Linking to authoritative sources signals expertise to AI systems. AI RAG systems cross-reference your outbound citations against their knowledge graph to validate claims. Pages with more external citations to authoritative domains receive higher trust scores in AI-generated recommendations.',
          code: '<p>According to <a href="https://authoritative-source.com/study">this research</a>, the approach improves outcomes by 40%.</p>',
        },
        page.url,
      );
    }

    return this.fail(
      'No external links found on any scanned page.',
      'At least 2 <a> tags pointing to external domains per content page',
      'Not found',
      {
        priority: 'medium',
        description:
          'Linking to authoritative external sources signals well-researched expertise to AI systems. AI RAG systems cross-reference citations against their knowledge graph to validate your claims. Pages without external references appear as unsourced opinion, receiving lower trust scores in AI-generated answers.',
        code: '<p>Research from <a href="https://authoritative-source.com">Source</a> confirms this approach.\nSee also <a href="https://another-authority.org/data">additional data</a>.</p>',
      },
      page.url,
    );
  }
}
