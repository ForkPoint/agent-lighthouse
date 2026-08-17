import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { extractImages } from '../../parser';

export class DecorativeImagesAudit extends Audit {
  static override meta: AuditMeta = {
    id: '6.16',
    category: 'semantic-html',
    title: 'Decorative images marked correctly',
    failureTitle: 'Decorative images marked correctly',
    description:
      'AI agents processing the accessibility tree treat images with empty alt but no role="presentation" as potentially missing alt text rather than intentionally decorative. Adding role="presentation" explicitly tells agents to skip these images, preventing them from flagging false content gaps.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents processing the accessibility tree treat images with empty alt but no role="presentation" as potentially missing alt text rather than intentionally decorative. This creates false-positive content gaps and wastes agent processing on irrelevant images.',
      fix: 'Add role="presentation" (or role="none") to all decorative images that already have an empty alt attribute. This explicitly tells AI agents and assistive technologies to skip these images entirely.',
      code: '<img src="decorative-border.png" alt="" role="presentation">',
      effort: 'trivial',
      docsUrl:
        'https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/presentation_role',
      tags: ['images', 'decorative', 'accessibility', 'semantic'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let decorativeCount = 0;
    let correctlyMarked = 0;

    for (const page of ctx.pages) {
      const images = extractImages(page.$);
      for (const img of images) {
        // An image with empty alt is considered decorative
        if (img.alt === '') {
          decorativeCount++;
          if (
            img.role === 'presentation' ||
            img.role === 'none' ||
            img.ariaHidden === 'true'
          ) {
            correctlyMarked++;
          }
        }
      }
    }

    if (decorativeCount === 0) {
      return this.pass(
        'No decorative images (empty alt) found — check not applicable.',
        'Images with empty alt have role="presentation"',
        'No images with empty alt',
      );
    }

    const allCorrect = correctlyMarked === decorativeCount;
    const majorityCorrect = correctlyMarked > decorativeCount / 2;

    if (allCorrect) {
      return this.pass(
        `All ${decorativeCount} decorative image(s) have role="presentation".`,
        'Images with empty alt have role="presentation"',
        `${correctlyMarked}/${decorativeCount} correctly marked`,
      );
    }

    if (majorityCorrect) {
      return this.warn(
        `${correctlyMarked}/${decorativeCount} decorative image(s) have role="presentation".`,
        'Images with empty alt have role="presentation"',
        `${correctlyMarked}/${decorativeCount} correctly marked`,
        {
          priority: 'medium',
          description:
            'AI agents processing the accessibility tree treat images with empty alt but no role="presentation" as potentially missing alt text rather than intentionally decorative. Adding role="presentation" explicitly tells agents to skip these images, preventing them from flagging false content gaps.',
          code: '<img src="decorative-bg.png" alt="" role="presentation">',
        },
      );
    }

    return this.fail(
      `${correctlyMarked}/${decorativeCount} decorative image(s) have role="presentation".`,
      'Images with empty alt have role="presentation"',
      `${correctlyMarked}/${decorativeCount} correctly marked`,
      {
        priority: 'medium',
        description:
          'AI agents processing the accessibility tree treat images with empty alt but no role="presentation" as potentially missing alt text rather than intentionally decorative. Adding role="presentation" explicitly tells agents to skip these images, preventing them from flagging false content gaps.',
        code: '<img src="decorative-bg.png" alt="" role="presentation">',
      },
    );
  }
}
