// TODO(merge): folds into access-crawl-control/robots-directives in Plan 4 (approved 2026-08-21).
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class MetaRobotsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/meta-robots',
    category: 'access-crawl-control',
    title: 'meta robots not blocking',
    failureTitle: 'meta robots not blocking',
    description:
      'The "noindex" directive tells AI crawlers like GPTBot and ClaudeBot to skip this page entirely. Your content will be invisible to AI answer engines and will never appear in AI-generated responses. Remove "noindex" unless you intentionally want to block AI indexing.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/meta-robots.md',
    defaultPriority: 'critical',
    guidance: {
      impact:
        'The "noindex" directive tells AI crawlers like GPTBot and ClaudeBot to skip this page entirely. Your content will be invisible to AI answer engines and will never appear in AI-generated responses.',
      fix: 'Remove the "noindex" directive from the meta robots tag. Replace with "index, follow" or remove the tag entirely to allow AI indexing.',
      code: '<meta name="robots" content="index, follow">',
      effort: 'trivial',
      tags: ['meta-tags', 'indexing', 'critical'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const robots = (page?.meta?.['robots'] ?? '').trim().toLowerCase();

    if (!robots) {
      return this.pass(
        'No meta robots tag found (not blocking by default).',
        'meta[robots] absent or does not contain "noindex"',
        'Not present',
        page?.url,
      );
    }

    if (robots.includes('noindex')) {
      return this.fail(
        `meta robots contains "noindex": "${robots}".`,
        'meta[robots] does not contain "noindex"',
        robots,
        {
          priority: 'critical',
          description:
            'The "noindex" directive tells AI crawlers like GPTBot and ClaudeBot to skip this page entirely. Your content will be invisible to AI answer engines and will never appear in AI-generated responses. Remove "noindex" unless you intentionally want to block AI indexing.',
          code: '<meta name="robots" content="index, follow">',
        },
        page?.url,
      );
    }

    return this.pass(
      `meta robots is "${robots}" (no blocking directives).`,
      'meta[robots] does not contain "noindex"',
      robots,
      page.url,
    );
  }
}
