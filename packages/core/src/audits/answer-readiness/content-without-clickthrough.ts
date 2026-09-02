import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";
import { getMainContentText, getWordCount } from "../../parser";
import { scanReadPageText, unreadPageTextReason } from "../../scan-evidence";

const TEASER_PATTERNS = [
  /click\s+(here\s+)?to\s+read\s+more/i,
  /contact\s+us\s+to\s+learn/i,
  /sign\s+up\s+to\s+(see|view|read|access)/i,
  /subscribe\s+to\s+(see|view|read|access|unlock)/i,
  /download\s+(the\s+)?(full|complete)\s+(guide|report|whitepaper)/i,
  /register\s+to\s+(access|view|read)/i,
  /fill\s+(out|in)\s+(the\s+)?form\s+to/i,
  /get\s+the\s+full\s+(story|details|report)/i,
];

export class ContentWithoutClickthroughAudit extends Audit {
  static override meta: AuditMeta = {
    id: "answer-readiness/content-without-clickthrough",
    category: "answer-readiness",
    title: "Content answers without click-through",
    failureTitle: "Content answers without click-through",
    description:
      "AI answer engines skip teaser content that gates answers behind sign-ups or downloads. Provide substantive answers directly on the page.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier:
      "docs/evidence/audits/answer-readiness/content-without-clickthrough.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "high",
    guidance: {
      impact:
        'AI answer engines skip pages dominated by teaser content ("click to read more", "sign up to access"). These pages provide no extractable answers, so agents will never surface your content in AI-generated responses, costing you visibility in AI search.',
      fix: "Replace gated teasers with substantive, self-contained answers directly on the page. Move lead-generation CTAs to secondary positions after the main content.",
      code: '<!-- Instead of: "Download our guide to learn more" -->\n<h2>How It Works</h2>\n<p>Our API supports REST and GraphQL endpoints with OAuth 2.0 authentication, processing up to 50,000 requests per second.</p>',
      effort: "moderate",
      tags: ["content-quality", "answer-engine"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        "No pages scanned.",
        'No "click to read more" or "contact us to learn" teasers dominating the page',
        "No pages scanned",
        {
          priority: "high",
          description: ContentWithoutClickthroughAudit.meta.description,
          code: "<!-- Replace gated content with direct answers -->\n<p>Our API supports REST and GraphQL endpoints with OAuth 2.0 authentication.</p>",
        },
      );
    }

    const teaserPages: Array<{ url: string; teasers: string[] }> = [];

    for (const p of ctx.pages) {
      const text = getMainContentText(p.$);
      const found: string[] = [];
      for (const pattern of TEASER_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
          found.push(match[0]);
        }
      }
      if (found.length >= 2) {
        teaserPages.push({ url: p.url, teasers: found });
      }
    }

    if (teaserPages.length === 0) {
      // Low-content check, but never on the homepage: JS/image-driven storefront
      // homepages legitimately render little server-side text, so a word-count
      // warning there is noise. Evaluate a non-homepage page instead.
      const checkPage = ctx.pages.find((p) => {
        if (p.url.replace(/\/$/, "") === ctx.baseUrl.replace(/\/$/, ""))
          return false;
        let pathname = "";
        try {
          pathname = new URL(p.url).pathname.toLowerCase();
        } catch {
          pathname = "";
        }
        if (pathname.endsWith(".xml")) return false;
        /* v8 ignore next -- FetchResult.body is typed as required string; null guard is defensive */
        const head = (p.fetchResult.body ?? "")
          .slice(0, 64)
          .trimStart()
          .toLowerCase();
        return !head.startsWith("<?xml");
      });
      if (checkPage) {
        const wordCount = getWordCount(checkPage.$);
        if (wordCount < 50) {
          return this.warn(
            "Insufficient content to evaluate.",
            'No "click to read more" or "contact us to learn" teasers dominating the page',
            `Only ${wordCount} words on ${checkPage.url}`,
            {
              priority: "medium",
              description:
                "The page has very little content (fewer than 50 words), making it impossible to determine whether it provides substantive answers. AI answer engines need sufficient content to extract meaningful answers.",
              code: "<main>\n  <p>Provide at least 50 words of substantive content that directly answers user questions.</p>\n</main>",
            },
            checkPage.url,
          );
        }
      }

      // Teasers are body copy. A page that served none has no self-contained
      // content to certify — the low-content branch above skips the homepage,
      // which on a shell scan is often the only page there is.
      if (!scanReadPageText(ctx.evidence)) {
        return this.notApplicable(
          "The scanned page served no readable text, so there was no content to judge for teasers.",
          'No "click to read more" or "contact us to learn" teasers dominating the page',
          unreadPageTextReason(ctx.evidence),
        );
      }

      return this.pass(
        "No excessive click-through teasers found.",
        'No "click to read more" or "contact us to learn" teasers dominating the page',
        "Content is self-contained",
        page.url,
      );
    }

    const details = teaserPages
      .map((tp) => `${tp.url}: ${tp.teasers.join(", ")}`)
      .join("; ");

    return this.fail(
      `Found click-through teasers on ${teaserPages.length} page(s).`,
      'No "click to read more" or "contact us to learn" teasers dominating the page',
      details.length > 200 ? details.slice(0, 200) + "..." : details,
      {
        priority: "high",
        description:
          'AI answer engines skip pages dominated by teaser content ("click to read more", "contact us to learn"). These pages provide no extractable answers, so agents will never surface your content in AI-generated responses. Provide substantive answers directly on the page.',
        code: '<!-- Replace "Download our guide to learn more" with: -->\n<h2>How It Works</h2>\n<p>Direct, substantive answer that AI agents can extract and cite.</p>',
      },
      teaserPages[0].url,
    );
  }
}
