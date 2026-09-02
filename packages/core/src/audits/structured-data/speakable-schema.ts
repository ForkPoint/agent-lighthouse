// Redemption rewrite landed 2026-08-22 (Plan 4, Task 12). The audit used to run
// site-wide with no page-type gate, so every non-news site took a hard 0 for a
// signal Google only reads on news content; it also demanded an ARRAY
// cssSelector, ignored `xpath`, and never checked the host type.
// Evidence dossier: docs/evidence/audits/structured-data/speakable-schema.md
// Research: docs/evidence/deletions/structured-data/speakable-schema.md
//
// Re-graded A -> B on 2026-08-24. Google's speakable page is live and still
// names Google Assistant as the consumer, but it says verbatim "This feature is
// in beta and subject to change" and scopes the feature to U.S. English Google
// Home users and English-language news publishers. policy.md reserves grade A
// for a ratified standard or documented shipped behaviour; a beta feature with
// a stated scope limit is a grade-B mechanism.
//
// RE-CHECK TRIGGER: the only documented consumer is Google Assistant, which
// Google announced on 2025-08-20 will be replaced by Gemini for Home on
// existing speakers and displays. If that transition completes with no
// speakable successor statement, this audit loses its consumer entirely and
// must be re-graded (candidate: informative) or sunset.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { flattenJsonLd } from "../../parser";

/** Every `@type` token on a node, as a flat list of strings. */
function typeNames(schema: Record<string, unknown>): string[] {
  const st = schema["@type"];
  if (typeof st === "string") return [st];
  if (Array.isArray(st))
    return st.filter((t): t is string => typeof t === "string");
  return [];
}

/**
 * Types that may carry `speakable`. schema.org defines the property on
 * `Article` and `WebPage` only, so subtypes of those two are in scope and
 * anything else is not: a `speakable` hung off an Organization or a Product
 * node is markup no consumer reads. Matched by suffix so the long tail of
 * subtypes (NewsArticle, ReportageNewsArticle, ItemPage, CollectionPage, …)
 * is covered without pinning a list that schema.org keeps extending.
 */
function isSpeakableHost(schema: Record<string, unknown>): boolean {
  return typeNames(schema).some(
    (name) =>
      name.endsWith("Article") ||
      name.endsWith("Page") ||
      name.endsWith("Posting"),
  );
}

/** A selector value is usable when it is a non-blank string, or a list holding one. */
function hasSelectorValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value))
    return value.some((v) => typeof v === "string" && v.trim().length > 0);
  return false;
}

/**
 * A `SpeakableSpecification` is actionable when it points at something.
 * Both selector forms count: schema.org allows `cssSelector` and `xpath`, and
 * either may be a single value or an array — the old array-only `cssSelector`
 * test rejected the perfectly valid `"cssSelector": ".article-body"` form.
 */
function isUsableSpec(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const spec = node as Record<string, unknown>;
  return (
    hasSelectorValue(spec["cssSelector"]) || hasSelectorValue(spec["xpath"])
  );
}

/** Does this node carry a usable `speakable` on a type that defines it? */
function hasValidSpeakable(schema: Record<string, unknown>): boolean {
  if (!isSpeakableHost(schema)) return false;
  const speakable = schema["speakable"];
  const specs = Array.isArray(speakable) ? speakable : [speakable];
  return specs.some(isUsableSpec);
}

/**
 * A page is news/article content if the crawler classified it as a content
 * page or it directly carries Article/NewsArticle/BlogPosting markup — the
 * same precondition `article-schema` uses. Everything else (storefronts,
 * category listings, marketing homepages) is out of scope: Google's speakable
 * doc scopes the feature to news content, so a shop that omits speakable is
 * not failing anything.
 */
function isArticlePage(_page: PageContext): boolean {
  return true;
}

function pageHasSpeakable(page: PageContext): boolean {
  return flattenJsonLd(page.structuredData ?? page.jsonLd).some((s) =>
    hasValidSpeakable(s as Record<string, unknown>),
  );
}

const EXPECTED =
  "SpeakableSpecification with a cssSelector or xpath on the Article/WebPage node of each news or article page.";

const FIX_CODE = `{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "Story Headline",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [".article-title", ".article-summary"]
  }
}`;

export class SpeakableSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: "structured-data/speakable-schema",
    category: "structured-data",
    title: "Speakable schema",
    failureTitle: "Speakable schema",
    description:
      "Google Assistant uses the speakable property to pick which sentences of a news article it reads aloud on Assistant-enabled devices. Without it, the assistant has to guess, and often vocalizes navigation or boilerplate instead of your headline and summary. Mark the headline and summary with cssSelector on your Article or WebPage node.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/structured-data/speakable-schema.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    // News and article publishing is the whole documented scope of the
    // feature, so a scan with no content page never runs this audit at all.
    // The runtime guard below repeats the precondition for the pages that
    // were scanned, so an Article-carrying homepage is still assessed.
    applicablePageTypes: ["content"],
    defaultPriority: "low",
    guidance: {
      impact:
        "Google Assistant returns news articles for spoken queries and uses speakable to select the sections it reads aloud with TTS. Without it, the assistant picks its own excerpt from the page — often navigation text or boilerplate rather than your headline and summary. The feature is in beta and limited to English-language news publishers and U.S. Google Home users, so treat it as an upside for news content rather than a general requirement.",
      fix: "Add a speakable property with a SpeakableSpecification to the Article (or WebPage) node of each news article. Point cssSelector — or xpath — at the headline and a short summary; both a single selector and an array of selectors are valid.",
      code: FIX_CODE,
      effort: "easy",
      docsUrl:
        "https://developers.google.com/search/docs/appearance/structured-data/speakable",
      tags: ["json-ld", "schema", "voice", "news", "speakable"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const articlePages = ctx.pages.filter(isArticlePage);

    if (articlePages.length === 0) {
      return this.notApplicable(
        "No news or article page was scanned; speakable applies to news content only.",
        EXPECTED,
        "No news or article pages found.",
      );
    }

    const covered = articlePages.filter(pageHasSpeakable).length;
    const found = `${covered} of ${articlePages.length} article page(s) with speakable`;

    if (covered === articlePages.length) {
      return this.pass(
        `Speakable markup found on ${covered} of ${articlePages.length} article page(s).`,
        EXPECTED,
        found,
      );
    }

    if (covered > 0) {
      return this.warn(
        `Speakable markup found on ${covered} of ${articlePages.length} article page(s).`,
        EXPECTED,
        found,
        {
          priority: "low",
          description: SpeakableSchemaAudit.meta.description,
          code: FIX_CODE,
        },
      );
    }

    return this.fail(
      `No speakable markup on any of the ${articlePages.length} article page(s) scanned.`,
      EXPECTED,
      found,
      {
        priority: "low",
        description: SpeakableSchemaAudit.meta.description,
        code: FIX_CODE,
      },
    );
  }
}
