import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { flattenJsonLd } from '../../parser';

function allSchemas(ctx: CheckContext): object[] {
  return ctx.pages.flatMap((p) => flattenJsonLd(p.structuredData ?? p.jsonLd));
}

export class SpeakableSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: '3.9',
    category: 'structured-data',
    title: 'Speakable schema',
    failureTitle: 'Speakable schema',
    description:
      'Voice-based AI agents (Google Assistant, Alexa, Siri) use the speakable property to identify which parts of your page to read aloud. Without it, voice agents must guess which content to vocalize, often choosing poorly. Add cssSelector references to your most important content sections.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
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
