import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { extractImages } from '../../parser';

export class ImageDimensionsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.15',
    category: 'technical-readiness',
    title: 'Images have explicit dimensions',
    failureTitle: 'Images have explicit dimensions',
    description:
      'AI agents that use visual screenshots (like Claude computer use) need stable page layouts to identify interactive elements. Missing image dimensions cause layout shifts that move elements between screenshots, breaking coordinate-based click targeting in agentic workflows.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Missing width and height attributes on images cause layout shifts (CLS) as images load. AI agents that use visual screenshots (such as Claude computer use) see elements jump positions between frames, breaking coordinate-based click targeting. High CLS also hurts Core Web Vitals scores, which AI trust-scoring systems factor into content quality rankings.',
      fix: 'Add explicit width and height attributes to all <img> tags. Use CSS aspect-ratio or the HTML attributes to reserve space before the image loads. For responsive images, set width/height to the intrinsic dimensions and use CSS to scale.',
      code: '<img src="product.jpg" width="800" height="600" alt="Product photo"\n     style="max-width: 100%; height: auto;">',
      effort: 'easy',
      docsUrl: 'https://web.dev/articles/optimize-cls',
      tags: ['performance', 'layout', 'images'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];

    if (!page) {
      return this.warn(
        'No homepage data available to check image dimensions.',
        'All <img> tags have width and height attributes',
        'No homepage fetched',
        undefined,
        undefined,
      );
    }

    const rawImages = extractImages(page.$);

    if (rawImages.length === 0) {
      return this.pass(
        'No images found on the homepage.',
        'All <img> tags have width and height attributes',
        'No <img> tags found',
        page.url,
      );
    }

    // Exclude inline data URI spacers and dummy anchors which do not cause network-delayed CLS
    const images = rawImages.filter((img) => {
      const src = img.src?.trim();
      return src !== '#' && !src?.startsWith('data:image/');
    });

    if (images.length === 0) {
      return this.pass(
        'No external image resources found on the page.',
        'All <img> tags have width and height attributes',
        'No external images (only data URIs)',
        page.url,
      );
    }

    const withoutDimensions = images.filter((img) => !img.width || !img.height);

    if (withoutDimensions.length === 0) {
      return this.pass(
        `All ${images.length} image(s) have explicit width and height attributes.`,
        'All <img> tags have width and height attributes',
        `${images.length} image(s), all with dimensions`,
        page.url,
      );
    }

    const ratio = (images.length - withoutDimensions.length) / images.length;
    const missingSrcs = withoutDimensions
      .map((img) => img.src || '(inline)')
      .slice(0, 5)
      .join(', ');

    if (ratio >= 0.5) {
      return this.warn(
        `${withoutDimensions.length} of ${images.length} image(s) are missing explicit width/height attributes. This causes layout shifts.`,
        'All <img> tags have width and height attributes',
        `Missing dimensions: ${missingSrcs}`,
        {
          priority: 'medium',
          description:
            'AI agents that use visual screenshots (like Claude computer use) need stable page layouts to identify interactive elements. Missing image dimensions cause layout shifts that move elements between screenshots, breaking coordinate-based click targeting in agentic workflows.',
          code: '<img src="photo.jpg" width="800" height="600" alt="...">',
        },
        page.url,
      );
    }

    return this.fail(
      `${withoutDimensions.length} of ${images.length} image(s) are missing explicit width/height attributes. This causes layout shifts.`,
      'All <img> tags have width and height attributes',
      `Missing dimensions: ${missingSrcs}`,
      {
        priority: 'medium',
        description:
          'AI agents that use visual screenshots (like Claude computer use) need stable page layouts to identify interactive elements. Missing image dimensions cause layout shifts that move elements between screenshots, breaking coordinate-based click targeting in agentic workflows.',
        code: '<img src="photo.jpg" width="800" height="600" alt="...">',
      },
      page.url,
    );
  }
}
