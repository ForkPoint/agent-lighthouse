import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { hiddenFromReaders } from "#core/dom-visibility";
import { inPageChrome } from "#core/page-chrome";
import { weightForGrade } from "#core/scorer";
import type { CheckContext } from "#core/check-context";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

/** Share actions are not links to source content. Match host and path only. */
function isShareLink(url: URL): boolean {
  const host = url.hostname.replace(/^(?:www\.|m\.)/, "");
  return (
    ((host === "twitter.com" || host === "x.com") &&
      /^\/(?:intent\/(?:tweet|post)|share)\/?$/.test(url.pathname)) ||
    (host === "pinterest.com" &&
      /^\/pin\/create\/(?:button|link|bookmarklet)\/?$/.test(url.pathname)) ||
    (host === "reddit.com" && /^\/submit\/?$/.test(url.pathname)) ||
    host === "wa.me" ||
    (host === "api.whatsapp.com" && /^\/send\/?$/.test(url.pathname)) ||
    (host === "t.me" && /^\/share(?:\/url)?\/?$/.test(url.pathname)) ||
    (host === "facebook.com" &&
      /^\/(?:sharer(?:\/sharer\.php|\.php)?|dialog\/share)\/?$/.test(
        url.pathname,
      )) ||
    (host === "linkedin.com" &&
      /^\/(?:sharing\/share-offsite|shareArticle)\/?$/.test(url.pathname))
  );
}

export class ExternalCitationsAudit extends Audit {
  static override meta: AuditMeta = {
    id: "answer-readiness/external-citations",
    category: "answer-readiness",
    title: "External content links",
    failureTitle: "External content links",
    description:
      "Reports external HTTP links in visible content. Their presence does not prove citation quality, authority or factual support.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/answer-readiness/external-citations.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Research on adding relevant citations does not establish a minimum outbound-link count. This observation does not validate claims or affect the score.",
      fix: "Link to sources where they support factual claims. Review relevance and accuracy; do not add links to meet a numeric target.",
      code: '<p>According to <a href="https://research.google/pubs/">Google Research</a>, the cited paper describes the method.\nSee also <a href="https://w3.org/standards">W3C standards</a>.</p>',
      effort: FixEffort.Easy,
      tags: ["trust", "e-e-a-t", "content-quality", "generative-engine"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const links = new Set<string>();
    let relevant = 0;
    for (const page of ctx.pages) {
      const $ = page.$;
      const pageLinks = new Set<string>();
      $("a[href]").each((_, el) => {
        if (
          hiddenFromReaders($, el) ||
          inPageChrome($, el) ||
          $(el).closest('aside, [role="complementary"]').length
        )
          return;
        const href = $(el).attr("href")?.trim();
        if (!href) return;
        try {
          const url = new URL(href, page.url);
          const host = ctx.domain.toLowerCase().replace(/^www\./, "");
          if (
            !["http:", "https:"].includes(url.protocol) ||
            isShareLink(url) ||
            url.hostname === host ||
            url.hostname.endsWith(`.${host}`)
          )
            return;
          url.hash = "";
          pageLinks.add(url.href);
        } catch {
          // Invalid links do not establish an external reference.
        }
      });
      if (pageLinks.size) relevant++;
      for (const link of pageLinks) links.add(link);
    }
    const expected =
      "External content links where the content calls for sources; no minimum count";
    if (!links.size)
      return this.notApplicable(
        "No external content links detected; a citation obligation is not established.",
        expected,
        "No external content links",
      );
    return this.pass(
      `Observed ${links.size} distinct external content link(s) on ${relevant} page(s). This does not establish source quality.`,
      expected,
      `Examples: ${[...links].sort().slice(0, 5).join(", ")}`,
    );
  }
}
