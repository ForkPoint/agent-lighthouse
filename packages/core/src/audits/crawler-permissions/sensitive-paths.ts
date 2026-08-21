// TODO(redeem): this audit survives only if rewritten (approved 2026-08-21).
// Evidence dossier: docs/evidence/deletions/crawler-permissions/sensitive-paths.md
// Required rework:
//   Grade A on the mechanism: named AI crawlers are documented to honor path-level Disallow, with
//   literal directory examples from Apple (Applebot and the AI-training token Applebot-Extended,
//   'Disallow: /private/') and Meta (meta-externalagent, 'Disallow: /private/ # Disallow a specific
//   directory'), on top of the ratified RFC 9309 path-matching semantics that OpenAI and Anthropic
//   both point publishers to. Per the rubric that makes it redeemable — but it needs surgery, not
//   preservation as written. Required changes: (a) drop the security/privacy framing entirely and
//   cite RFC 9309's 'not a substitute for valid content security measures'; reframe as crawl
//   hygiene — keeping low-value, non-canonical, or session-bearing URLs out of AI crawls and
//   answers. (b) Remove /api/ from the default sensitive list or make it opt-in; blocking API paths
//   works against agent readiness, and the audit currently fails sites at 'high' priority for
//   exposing exactly what agents need. (c) Add the caveat that user-initiated fetchers
//   (ChatGPT-User, Perplexity-User) are documented not to honor these rules, so this must never be
//   presented as protection. (d) Downgrade defaultPriority from 'high' to low/medium — no vendor
//   evidence supports a high-severity finding here.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { parseRobotsTxt, checkSensitivePaths } from './_robots-txt-helpers';

const SENSITIVE_PATHS = ['/api/', '/admin/'];

export class SensitivePathsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '2.23',
    category: 'crawler-permissions',
    title: 'Sensitive paths protected',
    failureTitle: 'Sensitive paths protected',
    description:
      'Without robots.txt, AI crawlers can access sensitive paths like /api/ and /admin/. This may expose internal endpoints, admin panels, or debug information in AI training data and search results.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'Without Disallow rules for sensitive paths, AI crawlers can access /api/ and /admin/ endpoints. Internal endpoints and admin interfaces could appear in AI training data or be exposed in AI-powered search results, creating security and privacy risks.',
      fix: 'Add Disallow rules in robots.txt for sensitive paths like /api/, /admin/, /internal/, and any other private directories that should not be crawled.',
      code: 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /internal/',
      effort: 'trivial',
      tags: ['robots-txt', 'security', 'crawler-permissions'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const robotsFile = ctx.rootFiles['/robots.txt'];

    if (!robotsFile || robotsFile.status !== 200 || !robotsFile.body) {
      return this.warn(
        'No robots.txt found — sensitive paths like /api/ and /admin/ are not explicitly protected.',
        '/api/, /admin/, or similar paths are disallowed in robots.txt',
        'No robots.txt found',
        {
          priority: 'medium',
          description:
            'Without robots.txt, AI crawlers can access sensitive paths like /api/ and /admin/. This may expose internal endpoints, admin panels, or debug information in AI training data and search results. Create a robots.txt with Disallow rules for private areas.',
          code: 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /internal/',
        },
      );
    }

    const groups = parseRobotsTxt(robotsFile.body);
    const { protected: protectedPaths, unprotected } = checkSensitivePaths(groups, SENSITIVE_PATHS);

    if (unprotected.length === 0) {
      return this.pass(
        `Sensitive paths are protected: ${protectedPaths.join(', ')}`,
        '/api/, /admin/, or similar paths are disallowed in robots.txt',
        `Protected: ${protectedPaths.join(', ')}`,
      );
    }

    if (protectedPaths.length > 0) {
      return this.warn(
        `Some sensitive paths are not protected: ${unprotected.join(', ')}`,
        '/api/, /admin/, or similar paths are disallowed in robots.txt',
        `Protected: ${protectedPaths.join(', ')}; Unprotected: ${unprotected.join(', ')}`,
        {
          priority: 'medium',
          description: `Some sensitive paths are still accessible to crawlers. AI agents may index internal content from these paths, potentially exposing it in AI search results. Add Disallow rules for: ${unprotected.join(', ')}.`,
          code: unprotected.map((p) => `Disallow: ${p}`).join('\n'),
        },
      );
    }

    return this.fail(
      'No sensitive paths are protected in robots.txt. /api/ and /admin/ are accessible to all crawlers.',
      '/api/, /admin/, or similar paths are disallowed in robots.txt',
      `Unprotected: ${unprotected.join(', ')}`,
      {
        priority: 'high',
        description:
          'None of your sensitive paths (/api/, /admin/) are protected from AI crawlers. Internal endpoints and admin interfaces could appear in AI training data or be exposed in AI-powered search results. Add Disallow rules immediately.',
        code: 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/',
      },
    );
  }
}
