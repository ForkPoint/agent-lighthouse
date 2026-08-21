// TODO(redeem): this audit survives only if rewritten (pending triage approval). Target tier: experimental.
// Evidence dossier: docs/evidence/audits/access-crawl-control/ai-content-declaration.md
// Required rework:
//   Evidence upgrade from delete: noai/noimageai/tdm-reservation declaration meta tags graded
//   D/experimental — real emerging opt-out ecosystem, no ratified consumer yet. Experimental,
//   unscored, rework to check the real directive names.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class AiContentDeclarationAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/ai-content-declaration',
    category: 'access-crawl-control',
    title: 'ai-content-declaration meta',
    failureTitle: 'ai-content-declaration meta',
    description:
      'The ai-content-declaration meta tag is how AI systems discover your llms.txt or AI usage policy. It signals to crawlers like GPTBot and ClaudeBot where to find machine-readable instructions about how to handle your content. Without it, AI systems have no programmatic way to find your content preferences.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('D', 'experimental'),
    evidenceGrade: 'D',
    tier: 'experimental',
    dossier: 'docs/evidence/audits/access-crawl-control/ai-content-declaration.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without an ai-content-declaration meta tag, AI systems like GPTBot and ClaudeBot have no programmatic way to find your content policy or llms.txt file. This means they cannot respect your content preferences automatically.',
      fix: 'Add a <meta name="ai-content-declaration"> tag with a valid URL pointing to your AI content policy or llms.txt file.',
      code: '<meta name="ai-content-declaration" content="https://yoursite.com/llms.txt">',
      effort: 'trivial',
      tags: ['meta-tags', 'ai-policy', 'ai-discovery'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const value = (page?.meta?.['ai-content-declaration'] ?? '').trim();

    if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
      return this.pass(
        `ai-content-declaration is set to "${value}".`,
        'meta[ai-content-declaration] with a valid URL',
        value,
        page.url,
      );
    }

    if (value) {
      return this.warn(
        `ai-content-declaration is present but not a valid URL: "${value}".`,
        'meta[ai-content-declaration] with a valid URL',
        value,
        {
          priority: 'medium',
          description:
            'The ai-content-declaration meta tag tells AI systems where to find your content policy (e.g., llms.txt, AI usage guidelines). The value must be a valid URL so agents can programmatically fetch and respect your content preferences. Fix the URL to start with http:// or https://.',
          code: '<meta name="ai-content-declaration" content="https://yoursite.com/ai-policy">',
        },
        page?.url,
      );
    }

    return this.fail(
      'No ai-content-declaration meta tag found.',
      'meta[ai-content-declaration] with a valid URL',
      'Not found',
      {
        priority: 'medium',
        description:
          'The ai-content-declaration meta tag is how AI systems discover your llms.txt or AI usage policy. It signals to crawlers like GPTBot and ClaudeBot where to find machine-readable instructions about how to handle your content. Without it, AI systems have no programmatic way to find your content preferences.',
        code: '<meta name="ai-content-declaration" content="https://yoursite.com/llms.txt">',
      },
      page?.url,
    );
  }
}
