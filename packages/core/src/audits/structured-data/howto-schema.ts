import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext, PageContext } from "#core/check-context";
import { weightForGrade } from "#core/scorer";
import { flattenJsonLd } from "#core/parser";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

function matchesType(schema: Record<string, unknown>, type: string): boolean {
  const t = schema["@type"];
  if (typeof t === "string") return t === type;
  if (Array.isArray(t)) return t.includes(type);
  return false;
}

/** True when the page's structured data carries a HowTo node. */
function hasHowTo(page: PageContext): boolean {
  return flattenJsonLd(page.structuredData ?? page.jsonLd).some((node) =>
    matchesType(node as Record<string, unknown>, "HowTo"),
  );
}

const SOURCE_URL =
  "https://developers.google.com/search/blog/2023/08/howto-faq-changes";

export class HowToSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: "structured-data/howto-schema",
    category: "structured-data",
    // An obsolete audit speaks only when the owner still publishes the
    // markup, so both titles describe the markup.
    title: "HowTo schema (retired rich result)",
    failureTitle: "HowTo markup for a retired rich result is published",
    description:
      "Reports HowTo structured data still published on sampled pages. Its only documented consumer was Google's How-to rich result, which Google stopped showing in September 2023, and no AI vendor documents reading the markup. Google says unused structured data causes no problems, so removal is optional.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    evidenceGrade: EvidenceGrade.D,
    tier: AuditTier.Obsolete,
    deprecated: {
      kind: NoticeKind.Obsolete,
      notice:
        "Google stopped showing How-to rich results in September 2023, and no AI vendor documents reading HowTo markup. The markup does no harm.",
      link: SOURCE_URL,
      replacement:
        "Nothing is needed. Clear numbered steps in the visible page text are what readers and agents use.",
    },
    dossier: "docs/evidence/audits/structured-data/howto-schema.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "None in either direction. Google no longer shows How-to rich results and no AI vendor documents reading HowTo markup, so it neither helps nor hurts.",
      fix: "Nothing is required. Removing the HowTo markup is optional; Google says unused structured data causes no problems. Do not add it to new pages for search or AI visibility.",
      effort: FixEffort.Trivial,
      docsUrl: SOURCE_URL,
      tags: ["json-ld", "schema", "how-to", "obsolete"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected =
      "No HowTo markup is needed: Google retired the How-to rich result in 2023";
    const pages = ctx.pages.filter(hasHowTo);

    // Absent artifact, absent verdict. The obsolete tier speaks only about
    // markup the owner still publishes; numbered steps without markup are
    // no longer a finding.
    if (pages.length === 0) {
      return this.notApplicable(
        "No sampled page publishes HowTo markup, so there is nothing to retire.",
        expected,
        "No HowTo markup found",
      );
    }

    return this.warn(
      "HowTo markup is published. Google stopped showing How-to rich results in September 2023, and no AI vendor documents reading HowTo markup. It does no harm; removal is optional.",
      expected,
      `HowTo markup on ${pages.length} page(s)`,
      CheckPriority.Low,
      pages[0]!.url,
    );
  }
}
