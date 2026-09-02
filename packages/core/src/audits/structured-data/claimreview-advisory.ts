// Graduated from proposal 2026-08-22 (Plan 5, Task 11).
// Evidence dossier: docs/evidence/audits/structured-data/claimreview-advisory.md
//
// This is the wave's one informative audit, and deliberately so: it reports the
// state of an external product — Google's withdrawal of ClaimReview from Search
// — rather than the quality of the site. Scoring it would push publishers to
// invest in a channel its largest documented consumer is leaving. Absence is
// notApplicable, never a pass: a site with no fact-check markup has nothing to
// be advised about.
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";
import { allJsonLdNodes } from "../../parser";

interface ClaimReviewNode {
  pageUrl: string;
  claimReviewed?: string;
  url?: string;
  ratingLabel?: string;
  hasRating: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeOf(node: Record<string, unknown>): string[] {
  const raw = node["@type"];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw))
    return raw.filter((t): t is string => typeof t === "string");
  return [];
}

function collect(ctx: CheckContext): {
  nodes: ClaimReviewNode[];
  perPage: Map<string, number>;
} {
  const nodes: ClaimReviewNode[] = [];
  const perPage = new Map<string, number>();

  for (const page of ctx.pages) {
    for (const raw of allJsonLdNodes(page.jsonLd)) {
      if (!isObject(raw)) continue;
      if (!typeOf(raw).includes("ClaimReview")) continue;

      const rating = raw["reviewRating"];
      const alternateName = isObject(rating)
        ? rating["alternateName"]
        : undefined;
      nodes.push({
        pageUrl: page.url,
        ...(typeof raw["claimReviewed"] === "string" &&
        raw["claimReviewed"].trim()
          ? { claimReviewed: raw["claimReviewed"] }
          : {}),
        ...(typeof raw["url"] === "string" && raw["url"].trim()
          ? { url: raw["url"] }
          : {}),
        ...(typeof alternateName === "string" && alternateName.trim()
          ? { ratingLabel: alternateName }
          : {}),
        hasRating: isObject(rating),
      });
      perPage.set(page.url, (perPage.get(page.url) ?? 0) + 1);
    }
  }

  return { nodes, perPage };
}

/** The advisory itself, appended to every non-notApplicable message. */
const ADVISORY =
  "Google is phasing out support for ClaimReview markup in Google Search, with no deprecation date published. The Fact Check Explorer still consumes it, so existing markup is not worthless — it is simply no longer a Search surface, and is not an AI-readiness lever.";

const EXPECTED =
  "ClaimReview markup, where a site keeps it, carries claimReviewed, url and a human-readable reviewRating.alternateName, one node per page";

const SAMPLE = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ClaimReview",
  "claimReviewed": "The mayor doubled the city budget in one year.",
  "url": "https://example.com/fact-checks/city-budget",
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": 2,
    "bestRating": 5,
    "alternateName": "Mostly false"
  }
}
</script>`;

export class ClaimreviewAdvisoryAudit extends Audit {
  static override meta: AuditMeta = {
    id: "structured-data/claimreview-advisory",
    category: "structured-data",
    title: "ClaimReview investment advisory",
    failureTitle: "ClaimReview investment advisory",
    description:
      "ADVISORY / UNSCORED. Detects ClaimReview markup and tells the operator the truth about its status rather than rewarding coverage: Google is phasing out ClaimReview support in Search, while the Fact Check Explorer still consumes it. Also validates the required shape and the one-per-page constraint for sites that keep it.",
    scoreDisplayMode: "informative",
    weight: weightForGrade("A", "informative"),
    evidenceGrade: "A",
    tier: "informative",
    dossier: "docs/evidence/audits/structured-data/claimreview-advisory.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "low",
    guidance: {
      impact:
        "Google's fact check documentation states plainly: 'We're phasing out support for ClaimReview markup in Google Search', with no deprecation date, and notes only one ClaimReview element per page qualifies for rich results. A check that scored ClaimReview coverage as an AI-readiness win would therefore push publishers to invest in a channel its largest documented consumer is actively withdrawing from. FALSIFIABLE and grade A on the evidence, but it measures the state of an external product, not the quality of the site — which is exactly why it must not contribute to a score.",
      fix: 'Do not add ClaimReview markup for Google Search: support is being withdrawn. If you already publish it, keep it well-formed for the Fact Check Explorer — claimReviewed, url, and a reviewRating carrying a human-readable alternateName such as "Mostly false" — and keep exactly one ClaimReview node per page, since only one has ever qualified. Spend new effort on the schema types AI systems actually consume rather than on extending fact-check coverage.',
      code: SAMPLE,
      effort: "trivial",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/structured-data/claimreview-advisory/",
      tags: [
        "schema",
        "claimreview",
        "fact-check",
        "advisory",
        "trust-provenance",
      ],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const { nodes, perPage } = collect(ctx);

    if (nodes.length === 0) {
      return this.notApplicable(
        "No ClaimReview markup on the scanned pages. Absence is not a defect — this audit exists to advise sites that already publish fact-check markup.",
        EXPECTED,
        "No ClaimReview node on the scanned pages",
      );
    }

    const first = nodes[0]!;
    const duplicated = [...perPage.entries()].filter(([, count]) => count > 1);
    const missingClaim = nodes.filter((n) => !n.claimReviewed);
    const missingUrl = nodes.filter((n) => !n.url);
    const unlabelled = nodes.filter((n) => n.hasRating && !n.ratingLabel);
    const noRating = nodes.filter((n) => !n.hasRating);

    const defects: string[] = [];
    if (duplicated.length > 0) {
      defects.push(
        `${duplicated.length} page(s) carry more than one ClaimReview node, and only one per page has ever qualified`,
      );
    }
    if (missingClaim.length > 0) {
      defects.push(
        `${missingClaim.length} node(s) carry no claimReviewed text`,
      );
    }
    if (missingUrl.length > 0)
      defects.push(`${missingUrl.length} node(s) carry no url`);
    if (noRating.length > 0)
      defects.push(`${noRating.length} node(s) carry no reviewRating`);
    if (unlabelled.length > 0) {
      defects.push(
        `${unlabelled.length} node(s) carry a reviewRating with only a numeric ratingValue and no human-readable alternateName`,
      );
    }

    const found = `${nodes.length} ClaimReview node(s) across ${perPage.size} page(s)`;

    if (defects.length > 0) {
      return this.warn(
        `${defects.join("; ")}. ${ADVISORY}`,
        EXPECTED,
        `${found}; ${defects.length} shape defect(s)`,
        "low",
        first.pageUrl,
      );
    }

    return this.pass(
      `${nodes.length} well-formed ClaimReview node(s) found. ${ADVISORY}`,
      EXPECTED,
      found,
      first.pageUrl,
    );
  }
}
