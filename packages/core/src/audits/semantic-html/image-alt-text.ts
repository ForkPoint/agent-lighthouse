import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { extractImages } from '../../parser';

export class ImageAltTextAudit extends Audit {
  static override meta: AuditMeta = {
    id: '6.15',
    category: 'semantic-html',
    title: 'Image alt text coverage',
    failureTitle: 'Image alt text coverage',
    description:
      'Most AI agents are text-only and rely entirely on alt text to understand images. Missing alt text makes your visual content invisible to AI systems, meaning product images, diagrams, and infographics contribute nothing to AI-generated answers about your page.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'Most AI agents are text-only and rely entirely on alt text to understand images. Missing alt text makes your product photos, diagrams, and infographics completely invisible to AI systems, meaning they contribute nothing to AI-generated answers about your pages.',
      fix: 'Add descriptive alt text to every non-decorative image. Describe what the image shows and why it matters in context. For product images, include the product name and key visual features. For decorative images, use an empty alt="" with role="presentation" instead.',
      code: '<img src="product.jpg" alt="Blue running shoe, side view, with breathable mesh upper and cushioned sole">',
      effort: 'moderate',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/alt',
      tags: ['images', 'alt-text', 'accessibility', 'semantic'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let totalImages = 0;
    let imagesWithAlt = 0;

    for (const page of ctx.pages) {
      const images = extractImages(page.$);
      for (const img of images) {
        // Skip images explicitly marked decorative — they intentionally have no
        // informative alt text and are covered by the decorative-images audit (6.16):
        //  - an empty `alt=""` (present but blank) signals decorative intent, OR
        //  - role="presentation"/"none" removes the image from the accessibility tree.
        // An img with NO alt attribute at all (hasAlt === false) is a real failure
        // and is still counted against coverage below.
        const isExplicitlyEmptyAlt = img.hasAlt && img.alt === '';
        const isPresentationRole = img.role === 'presentation' || img.role === 'none';
        if (isExplicitlyEmptyAlt || isPresentationRole) continue;

        totalImages++;
        if (img.alt && img.alt.trim().length > 0) {
          imagesWithAlt++;
        }
      }
    }

    if (totalImages === 0) {
      return this.pass(
        'No non-decorative images found — check not applicable.',
        '100% of non-decorative images have descriptive alt text',
        'No non-decorative images',
      );
    }

    const coverage = imagesWithAlt / totalImages;
    const allCovered = coverage === 1;
    const mostCovered = coverage >= 0.8;

    if (allCovered) {
      return this.pass(
        `All ${totalImages} non-decorative image(s) have descriptive alt text.`,
        '100% of non-decorative images have non-empty descriptive alt text',
        `${imagesWithAlt}/${totalImages} images with alt text (${Math.round(coverage * 100)}%)`,
      );
    }

    if (mostCovered) {
      return this.warn(
        `${imagesWithAlt}/${totalImages} non-decorative image(s) have alt text (${Math.round(coverage * 100)}%).`,
        '100% of non-decorative images have non-empty descriptive alt text',
        `${imagesWithAlt}/${totalImages} images with alt text (${Math.round(coverage * 100)}%)`,
        {
          priority: 'high',
          description:
            'Most AI agents are text-only and rely entirely on alt text to understand images. Missing alt text makes your visual content invisible to AI systems, meaning product images, diagrams, and infographics contribute nothing to AI-generated answers about your page.',
          code: '<img src="product.jpg" alt="Product name shown from the front, featuring key design element">',
        },
      );
    }

    return this.fail(
      `${imagesWithAlt}/${totalImages} non-decorative image(s) have alt text (${Math.round(coverage * 100)}%).`,
      '100% of non-decorative images have non-empty descriptive alt text',
      `${imagesWithAlt}/${totalImages} images with alt text (${Math.round(coverage * 100)}%)`,
      {
        priority: 'high',
        description:
          'Most AI agents are text-only and rely entirely on alt text to understand images. Missing alt text makes your visual content invisible to AI systems, meaning product images, diagrams, and infographics contribute nothing to AI-generated answers about your page.',
        code: '<img src="product.jpg" alt="Product name shown from the front, featuring key design element">',
      },
    );
  }
}
