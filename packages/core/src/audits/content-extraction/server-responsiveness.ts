import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";

/**
 * Bands, not a cliff. 800ms is the widely used "good TTFB" target; 2500ms is
 * the low end of the 2-3 second abandonment window both source audits cite in
 * their own copy — 8.12 failed at 800ms while its description said crawlers
 * "abandon requests over 2-3 seconds", a threefold disagreement with itself.
 */
const FAST_TTFB_MS = 800;
const SLOW_TTFB_MS = 2500;

/** Median of a non-empty list, rounded; the mean of the two middle samples on an even count. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0);
  return Math.round(value);
}

const EXPECTED = `Median TTFB across the crawled pages <= ${FAST_TTFB_MS}ms (warn to ${SLOW_TTFB_MS}ms).`;

export class ServerResponsivenessAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/server-responsiveness",
    category: "content-extraction",
    title: "Server responsiveness",
    failureTitle: "Server responsiveness",
    description:
      "AI crawlers fetch fewer pages per session from a slow origin, and a user-triggered agent fetch that outlasts the client budget is abandoned before bytes arrive. This measures the median time to first byte across the crawled pages, not a single cold sample.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/content-extraction/server-responsiveness.md",
    // Gate exemption: TTFB is measured from the response, and a shell answers as fast
    // or as slow as anything else the origin serves.
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "medium",
    guidance: {
      impact:
        'Google documents that crawl capacity falls when a host slows down ("if the site slows down… the limit goes down and Google crawls less"), and slow origins are where logged HTTP 499 client-closed-request clusters from AI fetchers appear. A slow origin therefore gets less of its content into the indexes AI answers are drawn from.',
      fix: "Reduce time to first byte: cache at the origin (Redis, Varnish, nginx microcaching), serve through a CDN with edge caching, cut database work on the critical path, and pre-render or statically generate content pages. Note that the figure below is measured from the scanner and includes DNS, TCP and TLS setup.",
      code: "# Nginx microcaching example:\nproxy_cache_path /tmp/cache levels=1:2 keys_zone=ai:10m max_size=1g;\nproxy_cache_valid 200 1m;\nadd_header X-Cache-Status $upstream_cache_status;",
      effort: "moderate",
      docsUrl: "https://web.dev/articles/ttfb",
      tags: ["performance", "crawl-budget", "discoverability", "speed"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // A challenge or JS interstitial is slow by design; that is bot protection,
    // not a performance defect, and another audit reports it.
    if (ctx.wafProtection?.isBlocked) {
      return this.notApplicable(
        `Response time could not be measured — the scan was blocked by ${ctx.wafProtection.name}.`,
        EXPECTED,
        `Blocked by ${ctx.wafProtection.name}`,
      );
    }

    // A failed fetch reports ttfbMs = the full timeout, which is an error, not
    // a slow origin. Reachability is a different audit's subject.
    const measured = ctx.pages.filter(
      (p) => !p.fetchResult.error && p.fetchResult.status !== 0,
    );
    const unmeasured = ctx.pages.length - measured.length;

    if (measured.length === 0) {
      return this.notApplicable(
        ctx.pages.length === 0
          ? "No pages scanned, so there is no response time to measure."
          : "No page fetch completed, so there is no response time to measure.",
        EXPECTED,
        `${ctx.pages.length} page(s) scanned, 0 measurable`,
      );
    }

    const samples = measured.map((p) => p.fetchResult.ttfbMs);
    const medianTtfb = median(samples);
    const slowest = Math.max(...samples);
    const overSlowBand = samples.filter((ms) => ms > SLOW_TTFB_MS).length;

    const found =
      `Median TTFB ${medianTtfb}ms across ${measured.length} page(s) ` +
      `(slowest ${slowest}ms, ${overSlowBand} over ${SLOW_TTFB_MS}ms` +
      `${unmeasured > 0 ? `, ${unmeasured} page(s) could not be measured` : ""}); ` +
      `includes DNS, TCP and TLS connection setup measured from the scanner's location.`;

    if (medianTtfb <= FAST_TTFB_MS) {
      return this.pass(
        `Median TTFB is ${medianTtfb}ms across ${measured.length} measured page(s).`,
        EXPECTED,
        found,
      );
    }

    if (medianTtfb <= SLOW_TTFB_MS) {
      return this.warn(
        `Median TTFB is ${medianTtfb}ms across ${measured.length} measured page(s) — above the ${FAST_TTFB_MS}ms target.`,
        EXPECTED,
        found,
        {
          priority: "medium",
          description:
            "A median above the 800ms target leaves less of the site inside a crawler session and closer to the point where a user-triggered agent fetch is abandoned. Note the figure includes connection setup from the scanner, so part of it may be distance rather than server work.",
          code: "# Potential optimizations:\n# - Enable server-side caching (Redis, Varnish, nginx microcaching)\n# - Serve through a CDN with edge caching\n# - Optimize database queries on the critical path",
        },
      );
    }

    return this.fail(
      `Median TTFB is ${medianTtfb}ms across ${measured.length} measured page(s) — beyond the ${SLOW_TTFB_MS}ms abandonment band.`,
      EXPECTED,
      found,
      {
        priority: "high",
        description:
          "A median TTFB in seconds means most pages sit inside the window where AI fetchers are observed to close the connection before bytes arrive, and Google documents crawl capacity falling as host latency rises. This is a whole-site figure, not one unlucky sample.",
        code: "# Potential optimizations:\n# - Enable server-side caching (Redis, Varnish, nginx microcaching)\n# - Serve through a CDN with edge caching\n# - Pre-render or statically generate content pages\n# - Enable HTTP/2 or HTTP/3",
      },
      measured.find((p) => p.fetchResult.ttfbMs === slowest)?.url,
    );
  }
}
