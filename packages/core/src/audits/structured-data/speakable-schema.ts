// TODO(redeem): this audit survives only if rewritten (approved 2026-08-21).
// Evidence dossier: docs/evidence/deletions/structured-data/speakable-schema.md
// Required rework:
//   Grade A: a live vendor doc names a specific agent (Google Assistant) that reads the signal, and
//   the feature is still listed in Google's current supported-features gallery, so the rubric
//   mandates 'redeemable'. But it must be redeemed in narrowed form, not as-is: (a) applicability
//   should be restricted to news/article publishers (the audit currently runs site-wide with no
//   page-type gate and defaults to fail for every non-news site), and (b) the description's claim
//   that Alexa and Siri consume speakable must be deleted — it is unsupported by any vendor doc and
//   directly contradicted by Applebot's documentation, which lists isAccessibleForFree as its only
//   schema.org property. Flag the Gemini-for-Home transition as a re-check trigger.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { flattenJsonLd } from '../../parser';

function allSchemas(ctx: CheckContext): object[] {
  return ctx.pages.flatMap((p) => flattenJsonLd(p.structuredData ?? p.jsonLd));
}

export class SpeakableSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'structured-data/speakable-schema',
    category: 'structured-data',
    title: 'Speakable schema',
    failureTitle: 'Speakable schema',
    description:
      'Voice-based AI agents (Google Assistant, Alexa, Siri) use the speakable property to identify which parts of your page to read aloud. Without it, voice agents must guess which content to vocalize, often choosing poorly. Add cssSelector references to your most important content sections.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/structured-data/speakable-schema.md',
    defaultPriority: 'low',
    guidance: {
      impact:
        'Voice-based AI agents (Google Assistant, Alexa, Siri) use the speakable property to identify which parts of your page to read aloud. Without it, voice agents guess which content to vocalize, often choosing navigation text or boilerplate instead of your key content.',
      fix: 'Add a speakable property with a SpeakableSpecification type to your Article, WebPage, or other content schema. Use cssSelector to point to your most important content elements.',
      code: `{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page Title",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [".article-title", ".article-summary"]
  }
}`,
      effort: 'easy',
      docsUrl: 'https://schema.org/speakable',
      tags: ['json-ld', 'schema', 'voice', 'accessibility', 'speakable'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const schemas = allSchemas(ctx);
    const withSpeakable = schemas.filter((s) => {
      const obj = s as Record<string, unknown>;
      const sp = obj['speakable'] as Record<string, unknown> | undefined;
      return sp && Array.isArray(sp['cssSelector']);
    });

    const found = withSpeakable.length > 0;

    if (found) {
      return this.pass(
        `Speakable property with cssSelector array found on ${withSpeakable.length} schema(s).`,
        'Speakable property with cssSelector array on at least one schema.',
        `${withSpeakable.length} schema(s) with speakable`,
      );
    }

    return this.fail(
      'No speakable property with cssSelector array found.',
      'Speakable property with cssSelector array on at least one schema.',
      'None',
      {
        priority: 'low',
        description:
          'Voice-based AI agents (Google Assistant, Alexa, Siri) use the speakable property to identify which parts of your page to read aloud. Without it, voice agents must guess which content to vocalize, often choosing poorly. Add cssSelector references to your most important content sections.',
        code: `"speakable": {
  "@type": "SpeakableSpecification",
  "cssSelector": [".article-title", ".article-summary"]
}`,
      },
    );
  }
}
