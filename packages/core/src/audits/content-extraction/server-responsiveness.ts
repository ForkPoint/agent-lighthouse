// TODO(rewrite): approved 2026-08-21 — this audit and technical-readiness/fast-response-time
// (8.12) collapse into one `content-extraction/server-responsiveness` check in Plan 4:
// median TTFB across the crawled pages, banded rather than pass/fail on a single sample.
// Evidence dossier: docs/evidence/audits/content-extraction/server-responsiveness.md

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

/** Threshold in milliseconds for TTFB: fast <= 800ms, slow > 1800ms */
const FAST_TTFB_MS = 800;
const SLOW_TTFB_MS = 1800;

export class FastPageLoadAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/server-responsiveness',
    category: 'content-extraction',
    title: 'Fast page load',
    failureTitle: 'Fast page load',
    description:
      'AI crawlers have limited time budgets. Fast Time-to-First-Byte (TTFB) ensures crawlers can fetch more of your pages within their allotted time.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/server-responsiveness.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI crawlers operate on strict time budgets. Slow Time-to-First-Byte (TTFB) means crawlers index fewer of your pages per session, leaving content undiscovered and reducing your visibility in AI-powered search results.',
      fix: 'Optimize server response times by enabling caching (Redis, Varnish), deploying a CDN (Cloudflare, Fastly), reducing server-side computation, and enabling HTTP/2 or HTTP/3. Target TTFB under 800ms for all pages.',
      code: '# Potential optimizations:\n# - Enable server-side caching (Redis, Varnish)\n# - Use a CDN (Cloudflare, Fastly, Vercel Edge)\n# - Optimize database queries and indexes\n# - Enable HTTP/2 or HTTP/3\n# - Use static generation where possible',
      effort: 'moderate',
      tags: ['performance', 'crawl-budget', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (ctx.pages.length === 0) {
      return this.fail('No pages scanned.', `TTFB <= ${FAST_TTFB_MS}ms`, 'No pages scanned', {
        priority: 'medium',
        description: FastPageLoadAudit.meta.description,
      });
    }

    const slowPages: Array<{ url: string; ttfb: number }> = [];

    for (const page of ctx.pages) {
      if (page.fetchResult.ttfbMs > SLOW_TTFB_MS) {
        slowPages.push({ url: page.url, ttfb: page.fetchResult.ttfbMs });
      }
    }

    const avgTtfb = Math.round(
      ctx.pages.reduce((sum, p) => sum + p.fetchResult.ttfbMs, 0) / ctx.pages.length,
    );

    if (slowPages.length > 0) {
      return this.fail(
        `${slowPages.length}/${ctx.pages.length} page(s) have TTFB > ${SLOW_TTFB_MS}ms (avg ${avgTtfb}ms).`,
        `TTFB <= ${FAST_TTFB_MS}ms`,
        `Slow pages: ${slowPages
          .slice(0, 5)
          .map((p) => `${p.url} (${p.ttfb}ms)`)
          .join(', ')}${slowPages.length > 5 ? ` (+${slowPages.length - 5} more)` : ''}`,
        {
          priority: 'medium',
          description:
            'Some pages have very slow Time-to-First-Byte (TTFB), which may cause AI crawlers to time out or skip them. Optimize server response times through caching, CDN usage, or reducing server-side processing.',
          code: `# Potential optimizations:\n# - Enable server-side caching\n# - Use a CDN (Cloudflare, Fastly)\n# - Optimize database queries\n# - Enable HTTP/2 or HTTP/3`,
        },
        slowPages[0]?.url,
      );
    }

    if (avgTtfb > FAST_TTFB_MS) {
      return this.warn(
        `Average TTFB is ${avgTtfb}ms across ${ctx.pages.length} page(s).`,
        `TTFB <= ${FAST_TTFB_MS}ms`,
        `Average ${avgTtfb}ms`,
        {
          priority: 'low',
          description:
            'Average TTFB is above the ideal threshold. Faster responses help AI crawlers index more pages within their time budget.',
          code: `# Potential optimizations:\n# - Enable server-side caching\n# - Use a CDN\n# - Optimize server-side rendering`,
        },
      );
    }

    return this.pass(
      `Average TTFB is ${avgTtfb}ms across ${ctx.pages.length} page(s).`,
      `TTFB <= ${FAST_TTFB_MS}ms`,
      `Average ${avgTtfb}ms`,
    );
  }
}
