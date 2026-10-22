import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { hiddenFromReaders, readerText } from "#core/dom-visibility";
import { isW3CDateTime } from "#core/gatherers/sitemap";
import { inPageChrome } from "#core/page-chrome";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

// Deliberately limited to ISO/numeric full dates and English named full dates.
// A year, price or version alone does not establish date-bearing content.
const VISIBLE_DATE =
  /\b(?:\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])|(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/\d{4}|(?:0?[1-9]|[12]\d|3[01])[/-](?:0?[1-9]|1[0-2])[/-]\d{4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{4})\b/i;

export class TimeElementAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/time-element",
    category: "content-extraction",
    title: "Machine-readable time markup",
    failureTitle: "Machine-readable time markup",
    description:
      "Time markup can expose a machine-readable date or time. This informative check measures markup on date-bearing pages, not AI freshness scoring.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/content-extraction/time-element.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Date-extraction tools can use time elements alongside other date signals. No documented AI consumer requires this markup; it remains an unscored convention check.",
      fix: "Wrap all dates and times in <time> elements with a datetime attribute in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDThh:mm:ss). Include publication dates, event dates, and last-modified dates.",
      code: '<p>Published on <time datetime="2025-01-15">January 15, 2025</time></p>\n<p>Event starts <time datetime="2025-03-20T09:00:00-05:00">March 20 at 9 AM EST</time></p>',
      effort: FixEffort.Trivial,
      docsUrl: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time",
      tags: ["dates", "time", "semantic", "html"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let relevant = 0;
    let marked = 0;
    for (const page of ctx.pages) {
      const $ = page.$;
      let hasDate = false;
      let hasTime = false;
      $("time, p, span, dd, dt, li").each((_, el) => {
        const node = $(el);
        const isTime = node.is("time");
        // Test the raw text first so only date-bearing elements pay for the
        // ancestor walks and the visible-text walk below.
        if (!isTime && !VISIBLE_DATE.test(node.text())) return true;
        if (hiddenFromReaders($, el) || inPageChrome($, el)) return true;
        const text = readerText($, el).trim();
        if (isTime) {
          hasDate = true;
          const datetime = node.attr("datetime");
          // An explicit attribute is a presence check, not calendar validation.
          // Without it, HTML permits the element's machine-readable text.
          if (
            datetime !== undefined
              ? datetime.trim().length > 0
              : isW3CDateTime(text) ||
                /^(?:[0-9]{2}:[0-9]{2}(?::[0-9]{2})?|[0-9]{4}|[0-9]{4}-[0-9]{2}|[0-9]{4}-W[0-9]{2}|P[0-9TDHMS.]+)$/.test(
                  text,
                )
          )
            hasTime = true;
        } else if (VISIBLE_DATE.test(text)) {
          hasDate = true;
        }
        return !(hasDate && hasTime);
      });
      if (!hasDate) continue;
      relevant++;
      if (hasTime) marked++;
    }
    const expected =
      "Machine-readable time markup on pages with visible dates or time elements";
    if (!relevant)
      return this.notApplicable(
        "No date-bearing content detected.",
        expected,
        "No relevant pages",
      );
    const found = `${marked}/${relevant} date-bearing pages have time markup`;
    if (marked === relevant) return this.pass(found, expected, found);
    if (marked) return this.warn(found, expected, found);
    return this.fail(
      "No machine-readable time markup found on date-bearing pages.",
      expected,
      found,
    );
  }
}
