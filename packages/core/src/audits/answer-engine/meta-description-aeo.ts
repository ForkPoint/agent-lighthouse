// TODO(redeem): this audit survives only if rewritten (pending triage approval). Target tier: scored.
// Evidence dossier: docs/evidence/audits/answer-engine/meta-description-aeo.md
// Required rework:
//   Redeem via merge into meta-description: one audit, quality criteria without the invented 'AEO
//   formula'.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

const ACTION_RESULT_PATTERN =
  /\b(learn|understand|get|find|compare|see|discover|build|create|use|try|start)\b.*\b(how|what|why|when|steps|guide|tips|ways|results|benefits|features)\b/i;

// Concrete value signals: materials, product qualities, and trust/value props
// that make an ecommerce description specific enough to be a useful answer
// candidate even without a how-to formula.
const CONCRETE_SIGNAL =
  /\b(cotton|wool|merino|silk|cashmere|linen|denim|leather|gold|silver|platinum|diamond|stainless|ceramic|bamboo|organic|recycled|sustainable|vegan|cruelty-free|handmade|hand-crafted|ethically|free\s+shipping|money-back|guarantee|warranty|returns?|lifetime|waterproof|seamless|breathable|machine\s+washable)\b/i;

// Pure-filler descriptions: a generic opener with nothing concrete after it.
const GENERIC_DOMINATES =
  /^(?:discover|explore|shop|browse|welcome\s+to|find\s+(?:out|your)|learn\s+more|check\s+out)\b[^.]*$/i;

export class MetaDescriptionAeoAudit extends Audit {
  static override meta: AuditMeta = {
    id: '9.11',
    category: 'answer-engine',
    title: 'Meta description follows AEO formula',
    failureTitle: 'Meta description follows AEO formula',
    description:
      'AI engines use meta descriptions as answer candidates. An action/result formula ("Learn how to X to achieve Y") matches more user queries than generic marketing language.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'AI engines use meta descriptions as answer candidates when generating responses. Generic marketing language ("Discover our solutions") provides no specific answer content and gets deprioritized. An action/result formula directly matches the queries AI agents are answering.',
      fix: 'Rewrite your meta description using an action/result formula: "Learn how to [action] to [achieve result]." Avoid generic openers like "Welcome to", "Discover", or "Explore".',
      code: '<meta name="description" content="Learn how to optimize your site for AI engines to increase visibility in answer results and drive qualified traffic.">',
      effort: 'easy',
      tags: ['copywriting', 'meta-tags', 'answer-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'Description is concrete and specific, not generic marketing filler',
        'No pages scanned',
        {
          priority: 'high',
          description: MetaDescriptionAeoAudit.meta.description,
          code: '<meta name="description" content="Learn how to optimize your site for AI engines to increase visibility in answer results and drive qualified traffic.">',
        },
      );
    }

    const desc = page.meta?.['description'] ?? '';

    if (!desc) {
      return this.fail(
        'No meta description found.',
        'Description is concrete and specific, not generic marketing filler',
        'Not found',
        {
          priority: 'high',
          description:
            'AI engines use meta descriptions as answer candidates when generating responses. Without a meta description, agents must extract a summary from body text, which is less targeted. Use an action/result formula ("Learn how to X to achieve Y") to match more user queries.',
          code: '<meta name="description" content="Learn how to optimize your site for AI agents to increase visibility in AI-generated answers.">',
        },
        page.url,
      );
    }

    const hasActionResult = ACTION_RESULT_PATTERN.test(desc);
    const hasNumber = /\d/.test(desc);
    // A capitalized word past the first one signals a named product/brand.
    const hasProperNoun = /\S+\s+.*\b[A-Z][a-zA-Z]{2,}/.test(desc);
    const isConcrete =
      hasActionResult || hasNumber || hasProperNoun || CONCRETE_SIGNAL.test(desc);

    if (isConcrete) {
      return this.pass(
        hasActionResult
          ? 'Meta description follows an action/result pattern.'
          : 'Meta description is concrete and specific (named products, materials, or value props).',
        'Description is concrete and specific, not generic marketing filler',
        desc,
        page.url,
      );
    }

    // Only flag when the description is dominated by generic marketing filler.
    if (GENERIC_DOMINATES.test(desc)) {
      return this.warn(
        'Meta description is generic marketing filler with no specific answer content.',
        'Description is concrete and specific, not generic marketing filler',
        desc,
        {
          priority: 'medium',
          description:
            'AI engines deprioritize generic marketing language ("Discover our solutions") because it provides no specific answer content. Add specifics — named products, materials, numbers, or a clear value proposition — so the description can serve as an answer candidate.',
          code: '<meta name="description" content="Learn how to optimize your site for AI engines to increase visibility in answer results and drive qualified traffic.">',
        },
        page.url,
      );
    }

    // Non-empty but neither strongly concrete nor pure filler — informational,
    // not a problem worth penalizing.
    return this.pass(
      'Meta description is present and substantive.',
      'Description is concrete and specific, not generic marketing filler',
      desc,
      page.url,
    );
  }
}
