import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { CheckContext } from "#core/check-context";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

const SOURCE_URL =
  "https://developers.google.com/search/docs/crawling-indexing/special-tags";

export class MetaAuthorAudit extends Audit {
  static override meta: AuditMeta = {
    id: "answer-readiness/meta-author",
    category: "answer-readiness",
    // The audit speaks only when the owner publishes the tag, so both titles
    // describe the tag.
    title: "Meta author tag (no AI reader)",
    failureTitle: "A meta author tag that no AI vendor reads is published",
    description:
      'Reports a `<meta name="author">` tag on sampled pages. `author` is a standard HTML metadata name, but Google lists the meta tags it supports, `author` is not among them, and Google says it ignores meta tags it does not support. No AI vendor documents reading the tag. Authorship that machines read lives in schema.org `author` markup and a visible byline.',
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    // Informative, not obsolete: Google never supported the tag, so nothing
    // was withdrawn. The tag is live HTML that nobody documents reading.
    tier: AuditTier.Informative,
    deprecated: {
      kind: NoticeKind.Unconsumed,
      notice:
        "No AI vendor documents reading the meta author tag, and Google ignores meta tags it does not support, author among them. It does no harm.",
      link: SOURCE_URL,
      replacement:
        "A visible byline and schema.org author markup on the article (structured-data/author-schema, answer-readiness/named-author).",
    },
    dossier: "docs/evidence/audits/answer-readiness/meta-author.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "None in either direction. Google ignores the author meta tag and no AI vendor documents reading it, so it neither helps nor hurts.",
      fix: "Nothing is required; the tag can stay. To make authorship machine-readable, add a visible byline and schema.org author markup to the article.",
      code: `{
  "@context": "https://schema.org",
  "@type": "Article",
  "author": { "@type": "Person", "name": "Jane Smith", "url": "https://example.com/authors/jane" }
}`,
      effort: FixEffort.Trivial,
      docsUrl: SOURCE_URL,
      tags: ["meta-tags", "authorship", "unconsumed"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected =
      "No meta author tag is needed: Google ignores it; authorship belongs in schema.org markup";
    const tagged = ctx.pages.filter(
      (page) => (page.meta?.["author"] ?? "").trim().length > 0,
    );

    // Absent artifact, absent verdict: a page without the tag has lost
    // nothing, because nothing reads it.
    if (tagged.length === 0) {
      return this.notApplicable(
        "No sampled page sets a meta author tag.",
        expected,
        "No meta author tag found",
      );
    }

    const first = tagged[0]!;
    return this.pass(
      `A meta author tag is published. Google ignores meta tags it does not support, and author is not one of them; no AI vendor documents reading it. It does no harm. Machine-readable authorship belongs in schema.org author markup and a visible byline.`,
      expected,
      `meta author "${(first.meta?.["author"] ?? "").trim()}" on ${tagged.length} page(s)`,
      first.url,
    );
  }
}
