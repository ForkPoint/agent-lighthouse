import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { extractScripts } from '../../parser';

export class NoRenderBlockingAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.14',
    category: 'technical-readiness',
    title: 'No render-blocking resources',
    failureTitle: 'No render-blocking resources',
    description:
      'Render-blocking scripts delay the HTML content that AI crawlers extract. Since AI agents do not execute JavaScript, blocking scripts add latency without providing any benefit to AI crawling. Use defer, async, or type="module" to unblock HTML delivery.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Synchronous scripts in <head> block HTML parsing and delay content delivery. Since AI crawlers do not execute JavaScript, these scripts add pure latency with zero benefit — the crawler waits for scripts to download but never runs them. This wastes crawl budget and slows TTFB, reducing the number of pages AI agents can index.',
      fix: 'Add the defer or async attribute to all <script> tags in <head>, or convert them to type="module". Move non-critical scripts to the end of <body> if they cannot be deferred.',
      code: '<!-- Before (blocking): -->\n<script src="app.js"></script>\n\n<!-- After (non-blocking): -->\n<script src="app.js" defer></script>',
      effort: 'easy',
      docsUrl: 'https://web.dev/articles/render-blocking-resources',
      tags: ['performance', 'rendering', 'scripts'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];

    if (!page) {
      return this.warn(
        'No homepage data available to check for render-blocking resources.',
        'No synchronous <script> tags in <head> without defer/async/type=module',
        'No homepage fetched',
        undefined,
        undefined,
      );
    }

    const $ = page.$;
    const allScripts = extractScripts($);

    // Build a set of src values for scripts in <head> so we can identify head scripts
    const headScriptSrcs = new Set<string>();
    $('head script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) headScriptSrcs.add(src);
    });

    // Count inline scripts in <head> (no src)
    const headInlineCount = $('head script:not([src])').length;

    // Filter for blocking scripts: external scripts in <head> without async/defer/module
    // Scripts with noModule are ignored by modern browsers, so they are not render-blocking
    const blockingScripts = allScripts.filter(
      (s) =>
        !s.inline &&
        s.src &&
        headScriptSrcs.has(s.src) &&
        !s.async &&
        !s.defer &&
        !s.isModule &&
        !s.noModule,
    );

    const totalHeadScripts = headScriptSrcs.size + headInlineCount;

    if (blockingScripts.length === 0) {
      // Check if the page body appears to be empty or very short
      /* v8 ignore next */
      const bodyText = page.fetchResult.body ?? '';
      if (bodyText.length < 100) {
        return this.warn(
          'Page appears to have no content — may not be rendering correctly.',
          'No synchronous <script> tags in <head> without defer/async/type=module',
          `Page body is only ${bodyText.length} characters`,
          {
            priority: 'high',
            description:
              'The page has virtually no HTML content, which may indicate a rendering failure or a client-side-only application. AI crawlers cannot process JavaScript, so an empty initial HTML response means no content will be indexed.',
            code: '<!-- Ensure your server returns meaningful HTML content in the initial response -->',
          },
          page.url,
        );
      }

      return this.pass(
        'No render-blocking synchronous scripts found in <head>.',
        'No synchronous <script> tags in <head> without defer/async/type=module',
        `${totalHeadScripts} script(s) in <head>, none blocking`,
        page.url,
      );
    }

    /* v8 ignore next */
    const blockingSrcs = blockingScripts
      .map((s) => s.src ?? 'unknown')
      .slice(0, 5)
      .join(', ');

    return this.fail(
      `Found ${blockingScripts.length} render-blocking script(s) in <head>. These delay page rendering for AI agents.`,
      'No synchronous <script> tags in <head> without defer/async/type=module',
      `${blockingScripts.length} blocking script(s): ${blockingSrcs}`,
      {
        priority: 'medium',
        description:
          'Render-blocking scripts delay the HTML content that AI crawlers extract. Since AI agents do not execute JavaScript, blocking scripts add latency without providing any benefit to AI crawling. Use defer, async, or type="module" to unblock HTML delivery.',
        code: '<script src="app.js" defer></script>',
      },
      page.url,
    );
  }
}
