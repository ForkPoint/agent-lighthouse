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
  PageType,
  ScoreDisplayMode,
} from "#core/types";

const SOURCE_URL =
  "https://developers.google.com/search/docs/crawling-indexing/special-tags";

export class MetaAuthorAudit extends Audit {
  static override meta: AuditMeta = {
    id: "answer-readiness/meta-author",
    category: "answer-readiness",
    // An obsolete audit speaks only when the owner still publishes the tag,
    // so both titles describe the tag.
    title: "Meta author tag (ignored)",
    failureTitle: "A meta author tag that Google ignores is published",
    description:
      'Reports a `<meta name="author">` tag on sampled article pages. Google lists the meta tags it supports, `author` is not among them, and Google says it ignores meta tags it does not support. No AI vendor documents reading the tag. Authorship that machines read lives in schema.org `author` markup and a visible byline.',
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    evidenceGrade: EvidenceGrade.D,
    tier: AuditTier.Obsolete,
    deprecated: {
      kind: NoticeKind.Obsolete,
      notice:
        "Google ignores meta tags it does not support, and author is not one it supports. No AI vendor documents reading the tag. It does no harm.",
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
    // Unchanged from the scored-era audit: authorship is an article concern.
    applicablePageTypes: [PageType.Article],
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
      tags: ["meta-tags", "authorship", "obsolete"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected =
      "No meta author tag is needed: Google ignores it; authorship belongs in schema.org markup";
    const tagged = ctx.pages.filter(
      (page) => (page.meta?.["author"] ?? "").trim().length > 0,
    );

    // Absent artifact, absent verdict. The obsolete tier speaks only about a
    // tag the owner still publishes; a page without one has lost nothing.
    if (tagged.length === 0) {
      return this.notApplicable(
        "No sampled page sets a meta author tag, so there is nothing to retire.",
        expected,
        "No meta author tag found",
      );
    }

    const first = tagged[0]!;
    return this.warn(
      `A meta author tag is published. Google ignores meta tags it does not support, and author is not one of them; no AI vendor documents reading it. It does no harm. Machine-readable authorship belongs in schema.org author markup and a visible byline.`,
      expected,
      `meta author "${(first.meta?.["author"] ?? "").trim()}" on ${tagged.length} page(s)`,
      CheckPriority.Low,
      first.url,
    );
  }
}
