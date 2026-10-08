import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { flattenJsonLd } from "../../parser";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  PageType,
  ScoreDisplayMode,
} from "../../types";

const ARTICLE_TYPES = ["Article", "NewsArticle", "BlogPosting"];

function matchesAnyType(
  schema: Record<string, unknown>,
  types: string[],
): boolean {
  return types.some((t) => {
    const st = schema["@type"];
    if (typeof st === "string") return st === t;
    if (Array.isArray(st)) return st.includes(t);
    return false;
  });
}

function hasProps(obj: Record<string, unknown>, keys: string[]): string[] {
  return keys.filter((k) => !obj[k]);
}

export class ArticleSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: "structured-data/article-schema",
    category: "structured-data",
    title: "Article schema",
    failureTitle: "Article schema",
    description:
      "AI agents extract Article schema to identify content freshness (datePublished/dateModified), authorship, and topic (headline). Without it, your blog content is treated as generic text with no provenance, reducing its chances of being cited in AI-generated answers.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/structured-data/article-schema.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    applicablePageTypes: [PageType.Article],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "Without Article schema, AI answer engines treat your blog content as generic text with no provenance. You lose content freshness signals (datePublished/dateModified), authorship attribution, and headline extraction -- all of which reduce your chances of being cited in AI-generated answers.",
      fix: "Add Article or BlogPosting JSON-LD to every blog page. Include headline, datePublished, dateModified, and author with a nested Person type.",
      code: `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Article Title",
  "datePublished": "2025-01-15",
  "dateModified": "2025-02-01",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  }
}`,
      effort: FixEffort.Easy,
      docsUrl: "https://schema.org/Article",
      tags: ["json-ld", "schema", "content", "article", "blog"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // The runner has already selected pages with article-purpose evidence.
    const blogPages = ctx.pages;

    if (blogPages.length === 0) {
      return this.notApplicable(
        "No blog/content pages scanned to evaluate Article schema.",
        "Article schema with headline, datePublished, dateModified, author on blog pages.",
        "No content pages or Article schema detected.",
      );
    }

    const requiredProps = [
      "headline",
      "datePublished",
      "dateModified",
      "author",
    ];
    let completeCount = 0;
    let partialCount = 0;

    for (const page of blogPages) {
      const schemas = flattenJsonLd(page.structuredData ?? page.jsonLd);
      const articles = schemas.filter((s) =>
        matchesAnyType(s as Record<string, unknown>, ARTICLE_TYPES),
      );

      if (articles.length > 0) {
        const art = articles[0] as Record<string, unknown>;
        const missing = hasProps(art, requiredProps);
        if (missing.length === 0) {
          completeCount++;
        } else {
          partialCount++;
        }
      }
    }

    const allComplete = completeCount === blogPages.length;
    const someFound = completeCount + partialCount > 0;

    if (allComplete) {
      return this.pass(
        `Article schema with all required properties found on all ${blogPages.length} blog page(s).`,
        "Article schema with headline, datePublished, dateModified, author on blog pages.",
        `${completeCount} complete, ${partialCount} partial, out of ${blogPages.length} blog page(s)`,
      );
    }

    if (someFound) {
      return this.warn(
        `Article schema found on ${completeCount + partialCount} of ${blogPages.length} blog page(s), ${completeCount} complete.`,
        "Article schema with headline, datePublished, dateModified, author on blog pages.",
        `${completeCount} complete, ${partialCount} partial, out of ${blogPages.length} blog page(s)`,
        {
          priority: CheckPriority.High,
          description:
            "AI agents extract Article schema to identify content freshness (datePublished/dateModified), authorship, and topic (headline). Without it, your blog content is treated as generic text with no provenance, reducing its chances of being cited in AI-generated answers.",
          code: `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "datePublished": "2025-01-01",
  "dateModified": "2025-01-02",
  "author": { "@type": "Person", "name": "Author Name" }
}`,
        },
      );
    }

    return this.fail(
      `No Article schema found on ${blogPages.length} blog page(s).`,
      "Article schema with headline, datePublished, dateModified, author on blog pages.",
      `${completeCount} complete, ${partialCount} partial, out of ${blogPages.length} blog page(s)`,
      {
        priority: CheckPriority.High,
        description:
          "AI agents extract Article schema to identify content freshness (datePublished/dateModified), authorship, and topic (headline). Without it, your blog content is treated as generic text with no provenance, reducing its chances of being cited in AI-generated answers.",
        code: `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "datePublished": "2025-01-01",
  "dateModified": "2025-01-02",
  "author": { "@type": "Person", "name": "Author Name" }
}`,
      },
    );
  }
}
