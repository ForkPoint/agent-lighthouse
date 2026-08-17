import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { extractImages } from '../../parser';

export class LcpNotLazyAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.16',
    category: 'technical-readiness',
    title: 'LCP element not lazy-loaded',
    failureTitle: 'LCP element not lazy-loaded',
    description:
      'AI agents that use visual screenshots see a blank placeholder for lazy-loaded hero images, missing critical visual context. For Core Web Vitals, lazy-loading the LCP element also degrades your performance score, which AI trust-scoring systems factor into content quality rankings.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        "Lazy-loading the Largest Contentful Paint (LCP) element delays the most important visual content on the page. AI agents using visual screenshots see a blank placeholder instead of your hero image, and Core Web Vitals scores suffer — both of which reduce your content's ranking in AI trust-scoring systems.",
      fix: 'Remove loading="lazy" from the first/largest image on the page (the LCP candidate). Instead, add fetchpriority="high" to tell the browser to prioritize loading this image immediately.',
      code: '<!-- Before (bad): -->\n<img src="hero.jpg" loading="lazy" alt="...">\n\n<!-- After (good): -->\n<img src="hero.jpg" fetchpriority="high" alt="...">',
      effort: 'trivial',
      docsUrl: 'https://web.dev/articles/lcp-lazy-loading',
      tags: ['performance', 'images', 'lcp'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];

    if (!page) {
      return this.warn(
        'No homepage data available to check LCP element.',
        'First/largest image does not have loading="lazy"',
        'No homepage fetched',
        undefined,
        undefined,
      );
    }

    const images = extractImages(page.$);

    if (images.length === 0) {
      return this.pass(
        'No images found on the homepage — LCP check not applicable.',
        'First/largest image does not have loading="lazy"',
        'No <img> tags found',
        page.url,
      );
    }

    // The first image is a reasonable proxy for the LCP element
    const firstImage = images[0];

    if (firstImage.loading === 'lazy') {
      return this.fail(
        `The first image (likely LCP element) has loading="lazy", which delays rendering of the most important content.`,
        'First/largest image does not have loading="lazy"',
        `First image (${firstImage.src || '(inline)'}) has loading="lazy"`,
        {
          priority: 'high',
          description:
            'AI agents that use visual screenshots see a blank placeholder for lazy-loaded hero images, missing critical visual context. For Core Web Vitals, lazy-loading the LCP element also degrades your performance score, which AI trust-scoring systems factor into content quality rankings.',
          code: '<img src="hero.jpg" fetchpriority="high" alt="...">',
        },
        page.url,
      );
    }

    return this.pass(
      'The first image (likely LCP element) is not lazy-loaded.',
      'First/largest image does not have loading="lazy"',
      `First image (${firstImage.src || '(inline)'}) — loading="${firstImage.loading ?? 'eager (default)'}"`,
      page.url,
    );
  }
}
