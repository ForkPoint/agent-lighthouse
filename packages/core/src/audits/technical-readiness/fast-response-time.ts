import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class FastResponseTimeAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.12',
    category: 'technical-readiness',
    title: 'Fast response time',
    failureTitle: 'Fast response time',
    description:
      'AI crawlers have strict timeout budgets per page. GPTBot and ClaudeBot typically abandon requests over 2-3 seconds, and slow TTFB reduces the number of pages they crawl per session. Optimize to under 800ms with server-side caching, CDN, and reduced backend processing.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'AI crawlers like GPTBot and ClaudeBot enforce strict per-page timeout budgets (typically 2-3 seconds). A slow TTFB means fewer of your pages get crawled per session, and pages that exceed the timeout are abandoned entirely. Over time, this results in incomplete coverage in AI knowledge bases — your products and content simply do not appear in AI-generated answers.',
      fix: 'Reduce Time to First Byte (TTFB) to under 800ms. Use server-side caching (Redis, in-memory), deploy behind a CDN with edge caching, minimize database queries on critical paths, and consider pre-rendering or static generation for content pages.',
      code: '# Nginx microcaching example:\nproxy_cache_path /tmp/cache levels=1:2 keys_zone=ai:10m max_size=1g;\nproxy_cache_valid 200 1m;\nadd_header X-Cache-Status $upstream_cache_status;',
      effort: 'moderate',
      docsUrl: 'https://web.dev/articles/ttfb',
      tags: ['performance', 'speed'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];

    if (!page) {
      return this.warn(
        'No homepage data available to measure response time.',
        'Homepage TTFB < 800ms',
        'No homepage fetched',
        undefined,
        undefined,
      );
    }

    const ttfb = page.fetchResult.ttfbMs;

    // If the request failed (error or status 0), TTFB of 0 is not a real measurement
    if (page.fetchResult.error || page.fetchResult.status === 0) {
      return this.fail(
        'Could not measure response time — request failed.',
        'Homepage TTFB < 800ms',
        page.fetchResult.error
          ? `Error: ${page.fetchResult.error}`
          : 'Request failed with status 0',
        {
          priority: 'critical',
          description:
            'The homepage request failed entirely, so response time could not be measured. AI crawlers that cannot reach your site will exclude it from their knowledge bases. Verify the server is responding correctly.',
          code: '# Check server health:\ncurl -I https://your-site.com/',
        },
        page.url,
      );
    }

    if (ttfb < 800) {
      return this.pass(
        `Homepage TTFB is ${ttfb}ms — well within the 800ms threshold.`,
        'Homepage TTFB < 800ms',
        `TTFB: ${ttfb}ms`,
        page.url,
      );
    }

    return this.fail(
      `Homepage TTFB is ${ttfb}ms — exceeds the 800ms threshold. Slow responses degrade AI agent experience.`,
      'Homepage TTFB < 800ms',
      `TTFB: ${ttfb}ms`,
      {
        priority: 'high',
        description:
          'AI crawlers have strict timeout budgets per page. GPTBot and ClaudeBot typically abandon requests over 2-3 seconds, and slow TTFB reduces the number of pages they crawl per session. Optimize to under 800ms with server-side caching, CDN, and reduced backend processing.',
        code: '# For nginx, add microcaching:\nproxy_cache_valid 200 1m;\nadd_header X-Cache-Status $upstream_cache_status;',
      },
      page.url,
    );
  }
}
