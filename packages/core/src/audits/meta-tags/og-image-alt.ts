import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class OgImageAltAudit extends Audit {
  static override meta: AuditMeta = {
    id: '4.9',
    category: 'meta-tags',
    title: 'og:image:alt present',
    failureTitle: 'og:image:alt present',
    description:
      "AI agents cannot process images directly and rely on og:image:alt text to understand your page's visual content. Without alt text, the OG image is invisible to text-based AI systems that generate answers and summaries about your page.",
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        "AI agents cannot process images directly and rely on og:image:alt text to understand your page's visual content. Without alt text, the OG image is invisible to text-based AI systems generating answers about your page.",
      fix: 'Add an og:image:alt meta tag with a descriptive text that explains what the OG image shows. Keep it concise but informative.',
      code: '<meta property="og:image" content="https://yoursite.com/image.png">\n<meta property="og:image:alt" content="Screenshot of the dashboard showing analytics overview">',
      effort: 'trivial',
      docsUrl: 'https://ogp.me/',
      tags: ['meta-tags', 'open-graph', 'a11y'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const ogImage = (page?.meta?.['og:image'] ?? '').trim();
    const ogImageAlt = (page?.meta?.['og:image:alt'] ?? '').trim();

    if (!ogImage) {
      return this.warn(
        'No og:image found, so og:image:alt is not applicable.',
        'og:image:alt with descriptive alt text when og:image is set',
        'No og:image',
        {
          priority: 'medium',
          description:
            'AI agents cannot process images directly and rely on og:image:alt text to understand visual content. Without an og:image and alt text, agents have no visual context to reference when generating answers about your page.',
          code: '<meta property="og:image" content="https://yoursite.com/image.png">\n<meta property="og:image:alt" content="Description of the image">',
        },
        page?.url,
      );
    }

    if (ogImageAlt) {
      return this.pass(
        `og:image:alt is "${ogImageAlt}".`,
        'og:image:alt with descriptive alt text when og:image is set',
        ogImageAlt,
        page.url,
      );
    }

    return this.fail(
      'og:image is set but og:image:alt is missing.',
      'og:image:alt with descriptive alt text when og:image is set',
      'Not found',
      {
        priority: 'medium',
        description:
          "AI agents cannot process images directly and rely on og:image:alt text to understand your page's visual content. Without alt text, the OG image is invisible to text-based AI systems that generate answers and summaries about your page.",
        code: '<meta property="og:image:alt" content="Description of the image">',
      },
      page?.url,
    );
  }
}
