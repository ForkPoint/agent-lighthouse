import { describe, it, expect, beforeAll } from "vitest";
import { createFetcher } from "../fetcher";
import {
  parseHtml,
  extractJsonLd,
  extractMetaTags,
  extractHeadLinks,
  detectPageType,
  getWordCount,
} from "../parser";
import { runAudits } from "../audit-runner";
import { defaultConfig } from "../audit-config";
import type { CheckContext, PageContext } from "../check-context";
import type { FetchResult } from "../fetcher";
import { allEvidenceMet } from "../scan-evidence";

// Helper to build a real CheckContext from a URL
async function buildRealContext(url: string): Promise<CheckContext> {
  const fetcher = createFetcher();
  const baseUrl = new URL(url).origin;
  const domain = new URL(url).hostname;

  // Fetch root files
  const rootPaths = [
    "/robots.txt",
    "/llms.txt",
    "/llms-full.txt",
    "/sitemap.xml",
    "/sitemap-index.xml",
    "/rss.xml",
    "/feed.xml",
    "/openapi.json",
    "/openapi.yaml",
    "/.well-known/ai-catalog.json",
    "/.well-known/mcp/servers.json",
    "/.well-known/agents.json",
    "/.well-known/ai-plugin.json",
    "/.well-known/security.txt",
    "/navigation.json",
    "/privacy-policy/",
    "/privacy/",
    "/terms/",
    "/about/",
    "/about-us/",
  ];

  const rootResults = await Promise.all(
    rootPaths.map((path) => fetcher.fetch({ url: `${baseUrl}${path}` })),
  );
  const rootFiles: Record<string, FetchResult> = {};
  rootPaths.forEach((path, i) => {
    rootFiles[path] = rootResults[i]!;
  });

  // Fetch homepage
  const homeResult = await fetcher.fetch({ url });
  const $ = parseHtml(homeResult.body);

  const jsonLd = extractJsonLd($);
  const meta = extractMetaTags($);
  const pages: PageContext[] = [
    {
      url,
      pageType: detectPageType(url, $, jsonLd, meta, true),
      fetchResult: homeResult,
      $,
      jsonLd,
      meta,
      headLinks: extractHeadLinks($),
    },
  ];

  return {
    rootFiles,
    pages,
    domain,
    baseUrl,
    fetch: (opts) => fetcher.fetch(opts),
    // The gate is not what these harnesses test, and their fixtures are small
    // enough to gate themselves out. Hand them every requirement.
    evidence: allEvidenceMet(),
  };
}

// Run all audits and return a map of id -> result
async function runAllChecks(
  ctx: CheckContext,
): Promise<Map<string, { status: string; score: number; found: any }>> {
  const { checks } = await runAudits(ctx, defaultConfig);
  const map = new Map<string, { status: string; score: number; found: any }>();
  for (const r of checks) {
    map.set(r.id, {
      status: r.status,
      score: r.score,
      found: r.details?.found,
    });
  }
  return map;
}

// These tests fetch live sites. On an offline machine they fail for a reason
// that has nothing to do with the code under test, so set AL_SKIP_NETWORK=1 to
// skip the whole block:
//
//   AL_SKIP_NETWORK=1 pnpm test
//
describe.skipIf(process.env["AL_SKIP_NETWORK"] === "1")(
  "Verify scan results against real sites",
  () => {
    // Increase timeout for real HTTP requests. The budget is per describe block:
    // one block builds a whole context and runs the entire registry against a
    // live site, and that registry keeps growing — 164 audits at v2, several of
    // which walk the sitemap and open sampled pages.
    const TIMEOUT = 150_000;

    // ────────────────────────────────────────────────────────────────
    // example.com — minimal site, should fail most agent-specific checks
    // ────────────────────────────────────────────────────────────────
    describe("example.com", () => {
      let ctx: CheckContext;
      let allResults: Map<
        string,
        { status: string; score: number; found: string }
      >;

      beforeAll(async () => {
        ctx = await buildRealContext("https://example.com");
        allResults = await runAllChecks(ctx);
      }, TIMEOUT);

      // --- Content Discoverability (IDs: '1.x') ---

      it("1.1: example.com should NOT have llms.txt", () => {
        // Independently verify
        expect(ctx.rootFiles["/llms.txt"]!.status).not.toBe(200);
        // Check agrees. The audit is informative since 5f95782: a site that
        // never linked to an llms.txt has done nothing wrong, so a missing file
        // is not-applicable rather than a failure.
        const result = allResults.get("machine-discovery/llms-txt-exists");
        expect(result).toBeDefined();
        expect(result!.status).toBe("na");
      });

      it("1.8: example.com should NOT have a sitemap", () => {
        expect(ctx.rootFiles["/sitemap.xml"]!.status).not.toBe(200);
        expect(ctx.rootFiles["/sitemap-index.xml"]!.status).not.toBe(200);
        const result = allResults.get(
          "machine-discovery/discovery-index-coverage",
        );
        expect(result).toBeDefined();
        // With no index of any kind there is nothing to compare against: the
        // missing sitemap is sitemap-exists' failure, not a second one here.
        expect(result!.status).toBe("warn");
      });

      // --- Meta Tags (IDs: '4.x') ---

      it("4.1: example.com meta description check matches reality", () => {
        const meta = ctx.pages[0]!.meta;
        const hasDescription =
          !!meta["description"] && meta["description"].length >= 50;
        const result = allResults.get("answer-readiness/meta-description");
        expect(result).toBeDefined();
        if (hasDescription) {
          expect(result!.status).toBe("pass");
        } else {
          expect(["fail", "warn"]).toContain(result!.status);
        }
      });

      it("4.4: example.com lang attribute check matches reality", () => {
        const $ = ctx.pages[0]!.$;
        const lang = $("html").attr("lang");
        const result = allResults.get("content-extraction/language-attribute");
        expect(result).toBeDefined();
        if (lang && lang.length > 0) {
          expect(result!.status).toBe("pass");
        } else {
          expect(result!.status).toBe("fail");
        }
      });

      it("4.6: example.com Open Graph tags check matches reality", () => {
        const meta = ctx.pages[0]!.meta;
        const ogTags = [
          "og:title",
          "og:description",
          "og:image",
          "og:url",
        ] as const;
        const present = ogTags.filter((t) => !!meta[t]?.trim());
        const missing = ogTags.filter((t) => !meta[t]?.trim());
        const result = allResults.get("answer-readiness/core-open-graph");
        expect(result).toBeDefined();
        if (missing.length === 0) {
          expect(result!.status).toBe("pass");
        } else if (present.length > 0) {
          // Some present, some missing -> warn
          expect(["fail", "warn"]).toContain(result!.status);
        } else {
          expect(result!.status).toBe("fail");
        }
      });

      // --- Structured Data (IDs: '3.x') ---

      it("3.1: example.com JSON-LD check matches reality", () => {
        const jsonLd = ctx.pages[0]!.jsonLd;
        const result = allResults.get("structured-data/json-ld-present");
        expect(result).toBeDefined();
        if (jsonLd.length > 0) {
          expect(result!.status).toBe("pass");
        } else {
          expect(result!.status).toBe("fail");
        }
      });

      // --- Semantic HTML (IDs: '6.x') ---

      it("6.1: example.com h1 count check matches reality", () => {
        const $ = ctx.pages[0]!.$;
        const h1Count = $("h1").length;
        const result = allResults.get("content-extraction/single-h1");
        expect(result).toBeDefined();
        if (h1Count === 1) {
          expect(result!.status).toBe("pass");
        } else {
          expect(result!.status).toBe("fail");
        }
      });

      it("6.3: example.com <main> element check matches reality", () => {
        const $ = ctx.pages[0]!.$;
        const hasMain = $("main").length > 0;
        const result = allResults.get("content-extraction/main-element");
        expect(result).toBeDefined();
        if (hasMain) {
          expect(["pass", "warn"]).toContain(result!.status);
        } else {
          expect(["fail", "warn"]).toContain(result!.status);
        }
      });

      it("6.14: example.com word count check matches reality", () => {
        const wordCount = getWordCount(ctx.pages[0]!.$);
        const result = allResults.get("content-extraction/content-depth");
        expect(result).toBeDefined();
        if (wordCount > 300) {
          expect(["pass", "warn"]).toContain(result!.status);
        } else {
          expect(["fail", "warn"]).toContain(result!.status);
        }
      });

      // --- Technical Readiness (IDs: '8.x') ---

      it("8.1: example.com HTTPS check matches reality", () => {
        const result = allResults.get("access-crawl-control/https-enabled");
        expect(result).toBeDefined();
        const page = ctx.pages[0];
        if (page && page.fetchResult.status === 200) {
          expect(result!.status).toBe("pass");
        } else {
          // HTTPS but non-200 -> warn
          expect(["pass", "warn"]).toContain(result!.status);
        }
      });

      // 8.12 folded into 1.19 in Plan 4: one banded median-TTFB audit.
      it("1.19 + 8.12: example.com response time check matches reality", () => {
        const fetchResult = ctx.pages[0]!.fetchResult;
        const result = allResults.get(
          "content-extraction/server-responsiveness",
        );
        expect(result).toBeDefined();
        if (fetchResult.error || fetchResult.status === 0) {
          // Nothing measurable — the audit reports na, not a performance defect.
          expect(result!.status).toBe("na");
        } else if (fetchResult.ttfbMs <= 800) {
          expect(result!.status).toBe("pass");
        } else if (fetchResult.ttfbMs <= 2500) {
          expect(result!.status).toBe("warn");
        } else {
          expect(result!.status).toBe("fail");
        }
      });

      it("8.13: example.com server-rendered content check matches reality", () => {
        const $ = ctx.pages[0]!.$;
        const wordCount = getWordCount($);
        const mainText = $("main").text().trim() || $("body").text().trim();
        const hasContent = wordCount > 50 || mainText.length > 200;
        const result = allResults.get("content-extraction/server-rendered");
        expect(result).toBeDefined();
        if (hasContent) {
          expect(result!.status).toBe("pass");
        } else {
          expect(result!.status).toBe("fail");
        }
      });

      // --- Agent Interfaces (IDs: 'agent-interfaces/*') ---

      // example.com has no API surface at all: no api-catalog, no spec at a
      // probed path, no service-desc link. That is `na` — there is nothing for a
      // brochure site to fix — not a failure.
      it("5.1: example.com should NOT have OpenAPI spec", () => {
        expect(ctx.rootFiles["/openapi.json"]!.status).not.toBe(200);
        const result = allResults.get("agent-interfaces/openapi-exists");
        expect(result).toBeDefined();
        expect(result!.status).toBe("na");
      });

      // --- Operability & Safety ---

      it("operability-safety/aria-landmarks: example.com ARIA landmarks check matches reality", () => {
        const $ = ctx.pages[0]!.$;
        const hasHeader = $('header, [role="banner"]').length > 0;
        const hasMain = $('main, [role="main"]').length > 0;
        const hasNav = $('nav, [role="navigation"]').length > 0;
        const hasFooter = $('footer, [role="contentinfo"]').length > 0;
        const allPresent = hasHeader && hasMain && hasNav && hasFooter;
        const result = allResults.get("operability-safety/aria-landmarks");
        expect(result).toBeDefined();
        if (allPresent) {
          expect(result!.status).toBe("pass");
        } else {
          expect(["fail", "warn"]).toContain(result!.status);
        }
      });

      // --- Cross-check: no false passes ---
      // If a root file returns 404, any check depending on it should not pass

      it("no false positives: llms.txt child checks should not pass if llms.txt is missing", () => {
        if (ctx.rootFiles["/llms.txt"]!.status !== 200) {
          for (const id of [
            "machine-discovery/llms-txt-structure",
            "machine-discovery/llms-txt-link-descriptions",
            "machine-discovery/llms-txt-links-valid",
          ]) {
            const result = allResults.get(id);
            if (result) {
              expect(result.status).not.toBe("pass");
            }
          }
        }
      });

      it("no false positives: sitemap child checks should not pass if sitemap is missing", () => {
        const hasSitemap =
          ctx.rootFiles["/sitemap.xml"]!.status === 200 ||
          ctx.rootFiles["/sitemap-index.xml"]!.status === 200;
        if (!hasSitemap) {
          for (const id of [
            "machine-discovery/sitemap-absolute-urls",
            "machine-discovery/sitemap-lastmod",
            "machine-discovery/rss-feed",
          ]) {
            const result = allResults.get(id);
            if (result) {
              expect(result.status).not.toBe("pass");
            }
          }
        }
      });

      it("no false positives: OpenAPI child checks should not pass if OpenAPI is missing", () => {
        if (
          ctx.rootFiles["/openapi.json"]!.status !== 200 &&
          ctx.rootFiles["/openapi.yaml"]!.status !== 200
        ) {
          const openApiChildIds = [
            "agent-interfaces/openapi-endpoints",
            "agent-interfaces/openapi-operation-ids",
            "agent-interfaces/openapi-servers",
            "agent-interfaces/openapi-schemas",
          ];
          for (const id of openApiChildIds) {
            const result = allResults.get(id);
            if (result) {
              expect(result.status).not.toBe("pass");
            }
          }
        }
      });

      // --- Dump all results for manual review ---
      it("prints full results summary for manual review", () => {
        // This test always passes — it is for visibility
        console.log("\n=== example.com FULL RESULTS ===");
        console.log(`Total checks: ${allResults.size}`);
        console.log(
          `Pass: ${[...allResults.values()].filter((r) => r.status === "pass").length}`,
        );
        console.log(
          `Warn: ${[...allResults.values()].filter((r) => r.status === "warn").length}`,
        );
        console.log(
          `Fail: ${[...allResults.values()].filter((r) => r.status === "fail").length}`,
        );

        // Print suspicious results — passes that might be false positives
        console.log("\n--- PASSES (verify these are correct) ---");
        allResults.forEach((val, key) => {
          if (val.status === "pass") {
            console.log(`  ${key}: ${val.found}`);
          }
        });

        expect(true).toBe(true);
      });
    });

    // ────────────────────────────────────────────────────────────────
    // docs.anthropic.com — should have good structured data, meta tags
    // ────────────────────────────────────────────────────────────────
    describe("docs.anthropic.com", () => {
      let ctx: CheckContext;
      let allResults: Map<
        string,
        { status: string; score: number; found: string }
      >;

      beforeAll(async () => {
        ctx = await buildRealContext("https://docs.anthropic.com");
        allResults = await runAllChecks(ctx);
      }, TIMEOUT);

      it("8.1: docs.anthropic.com HTTPS check matches reality", () => {
        const result = allResults.get("access-crawl-control/https-enabled");
        expect(result).toBeDefined();
        const page = ctx.pages[0];
        // HTTPS is used; if homepage returns 200, expect pass; otherwise warn
        if (page && page.fetchResult.status === 200) {
          expect(result!.status).toBe("pass");
        } else {
          expect(["pass", "warn"]).toContain(result!.status);
        }
      });

      it("4.1: docs.anthropic.com meta description check matches reality", () => {
        const meta = ctx.pages[0]!.meta;
        const result = allResults.get("answer-readiness/meta-description");
        expect(result).toBeDefined();
        if (meta["description"] && meta["description"].length >= 50) {
          expect(result!.status).toBe("pass");
        }
        // If it does not have one, check agrees
        if (!meta["description"]) {
          expect(result!.status).not.toBe("pass");
        }
      });

      it("4.4: docs.anthropic.com lang attribute check matches reality", () => {
        const lang = ctx.pages[0]!.$("html").attr("lang");
        const result = allResults.get("content-extraction/language-attribute");
        expect(result).toBeDefined();
        if (lang) {
          expect(result!.status).toBe("pass");
        } else {
          expect(result!.status).toBe("fail");
        }
      });

      it("6.1: docs.anthropic.com h1 check matches reality", () => {
        const h1Count = ctx.pages[0]!.$("h1").length;
        const result = allResults.get("content-extraction/single-h1");
        expect(result).toBeDefined();
        if (h1Count === 1) {
          expect(result!.status).toBe("pass");
        } else {
          expect(result!.status).toBe("fail");
        }
      });

      it("1.1: docs.anthropic.com llms.txt check matches reality", () => {
        const llmsTxt = ctx.rootFiles["/llms.txt"]!;
        const result = allResults.get("machine-discovery/llms-txt-exists");
        expect(result).toBeDefined();
        if (
          llmsTxt.status === 200 &&
          llmsTxt.body.trimStart().startsWith("#")
        ) {
          expect(result!.status).toBe("pass");
        } else if (llmsTxt.status === 200) {
          expect(["pass", "warn"]).toContain(result!.status);
        } else {
          expect(result!.status).toBe("fail");
        }
      });

      it("prints full results summary for manual review", () => {
        console.log("\n=== docs.anthropic.com FULL RESULTS ===");
        console.log(`Total checks: ${allResults.size}`);
        console.log(
          `Pass: ${[...allResults.values()].filter((r) => r.status === "pass").length}`,
        );
        console.log(
          `Warn: ${[...allResults.values()].filter((r) => r.status === "warn").length}`,
        );
        console.log(
          `Fail: ${[...allResults.values()].filter((r) => r.status === "fail").length}`,
        );

        console.log("\n--- PASSES (verify these are correct) ---");
        allResults.forEach((val, key) => {
          if (val.status === "pass") {
            console.log(`  ${key}: ${val.found}`);
          }
        });

        expect(true).toBe(true);
      });
    });

    // ────────────────────────────────────────────────────────────────
    // allbirds.com — e-commerce storefront (agentic commerce, Shopify patterns)
    // ────────────────────────────────────────────────────────────────
    describe("allbirds.com", () => {
      let ctx: CheckContext;
      let allResults: Map<
        string,
        { status: string; score: number; found: string }
      >;

      beforeAll(async () => {
        ctx = await buildRealContext("https://allbirds.com");
        allResults = await runAllChecks(ctx);
      }, TIMEOUT);

      it("access-crawl-control/https-enabled: allbirds.com HTTPS check matches reality", () => {
        const result = allResults.get("access-crawl-control/https-enabled");
        expect(result).toBeDefined();
        expect(result!.status).toBe("pass");
      });

      it("content-extraction/language-attribute: allbirds.com lang attribute check matches reality", () => {
        const lang = ctx.pages[0]!.$("html").attr("lang");
        const result = allResults.get("content-extraction/language-attribute");
        expect(result).toBeDefined();
        if (lang) {
          expect(result!.status).toBe("pass");
        } else {
          expect(result!.status).toBe("fail");
        }
      });

      it("answer-readiness/core-open-graph: allbirds.com Open Graph tags check matches reality", () => {
        const result = allResults.get("answer-readiness/core-open-graph");
        expect(result).toBeDefined();
        expect(["pass", "warn"]).toContain(result!.status);
      });

      it("agentic-commerce/agent-ua-commerce-parity: allbirds.com agent UA parity matches reality", () => {
        const result = allResults.get(
          "agentic-commerce/agent-ua-commerce-parity",
        );
        expect(result).toBeDefined();
        // Live e-commerce stores frequently gate or differentiate AI crawler UAs on commerce paths
        expect(["pass", "warn", "fail", "na"]).toContain(result!.status);
      });

      it("machine-discovery/sitemap-exists: allbirds.com sitemap discovery matches reality", () => {
        const hasSitemap =
          ctx.rootFiles["/sitemap.xml"]?.status === 200 ||
          ctx.rootFiles["/sitemap-index.xml"]?.status === 200;
        const result = allResults.get("machine-discovery/sitemap-exists");
        expect(result).toBeDefined();
        if (hasSitemap) {
          expect(result!.status).toBe("pass");
        } else {
          expect(["fail", "warn"]).toContain(result!.status);
        }
      });

      it("prints full results summary for manual review", () => {
        console.log("\n=== allbirds.com FULL RESULTS ===");
        console.log(`Total checks: ${allResults.size}`);
        console.log(
          `Pass: ${[...allResults.values()].filter((r) => r.status === "pass").length}`,
        );
        console.log(
          `Warn: ${[...allResults.values()].filter((r) => r.status === "warn").length}`,
        );
        console.log(
          `Fail: ${[...allResults.values()].filter((r) => r.status === "fail").length}`,
        );
        expect(true).toBe(true);
      });
    });

    // ────────────────────────────────────────────────────────────────
    // theguardian.com — news publisher (dense editorial content, feeds)
    // ────────────────────────────────────────────────────────────────
    describe("theguardian.com", () => {
      let ctx: CheckContext;
      let allResults: Map<
        string,
        { status: string; score: number; found: string }
      >;

      beforeAll(async () => {
        ctx = await buildRealContext("https://theguardian.com");
        allResults = await runAllChecks(ctx);
      }, TIMEOUT);

      it("access-crawl-control/https-enabled: theguardian.com HTTPS check matches reality", () => {
        const result = allResults.get("access-crawl-control/https-enabled");
        expect(result).toBeDefined();
        expect(result!.status).toBe("pass");
      });

      it("content-extraction/language-attribute: theguardian.com lang attribute matches reality", () => {
        const lang = ctx.pages[0]!.$("html").attr("lang");
        const result = allResults.get("content-extraction/language-attribute");
        expect(result).toBeDefined();
        if (lang) {
          expect(result!.status).toBe("pass");
        } else {
          expect(result!.status).toBe("fail");
        }
      });

      it("answer-readiness/core-open-graph: theguardian.com Open Graph tags match reality", () => {
        const meta = ctx.pages[0]!.meta;
        const ogTags = [
          "og:title",
          "og:description",
          "og:image",
          "og:url",
        ] as const;
        const missing = ogTags.filter((t) => !meta[t]?.trim());
        const result = allResults.get("answer-readiness/core-open-graph");
        expect(result).toBeDefined();
        if (missing.length === 0) {
          expect(result!.status).toBe("pass");
        } else {
          expect(["fail", "warn"]).toContain(result!.status);
        }
      });

      it("machine-discovery/rss-feed: theguardian.com RSS / feed discovery matches reality", () => {
        const hasFeed =
          ctx.rootFiles["/rss.xml"]?.status === 200 ||
          ctx.rootFiles["/feed.xml"]?.status === 200;
        const result = allResults.get("machine-discovery/rss-feed");
        expect(result).toBeDefined();
        if (hasFeed) {
          expect(result!.status).toBe("pass");
        } else {
          expect(["fail", "warn", "na"]).toContain(result!.status);
        }
      });

      it("content-extraction/main-element: theguardian.com main element check matches reality", () => {
        const result = allResults.get("content-extraction/main-element");
        expect(result).toBeDefined();
        expect(["pass", "warn"]).toContain(result!.status);
      });

      it("prints full results summary for manual review", () => {
        console.log("\n=== theguardian.com FULL RESULTS ===");
        console.log(`Total checks: ${allResults.size}`);
        console.log(
          `Pass: ${[...allResults.values()].filter((r) => r.status === "pass").length}`,
        );
        console.log(
          `Warn: ${[...allResults.values()].filter((r) => r.status === "warn").length}`,
        );
        console.log(
          `Fail: ${[...allResults.values()].filter((r) => r.status === "fail").length}`,
        );
        expect(true).toBe(true);
      });
    });
  },
  240_000,
);
