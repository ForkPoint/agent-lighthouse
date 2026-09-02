import { describe, it, expect, vi } from "vitest";

// Ensure tests run hermetically offline without invoking live DNS
vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn().mockResolvedValue({ address: "93.184.216.34", family: 4 }),
  },
}));

import { defaultConfig } from "../audit-config";
import { planAudits } from "../audit-runner";
import { buildScanEvidence } from "../scan-evidence";
import { detectWafProtection } from "../waf-detector";
import {
  parseHtml,
  extractJsonLd,
  extractMicrodata,
  extractRdfa,
  extractMetaTags,
  extractHeadLinks,
  detectPageType,
} from "../parser";
import {
  listFixtures,
  readFixture,
  type FixtureProvenance,
} from "./fixture-io";
import type { CheckContext, PageContext } from "../check-context";
import type { FetchResult } from "../fetcher";
import { mockFetchResult } from "../__tests__/test-utils";

/**
 * Proves that the evidence gate (`buildScanEvidence` + `planAudits`) correctly
 * evaluates real-world corpus pages, resolving Debt Item 1.
 *
 * In `real-page-corpus.test.ts`, the harness held the evidence gate open
 * (`allEvidenceMet()`) to test audit DOM logic directly. This suite tests the
 * complementary path: taking real-world responses and proving that the gate
 * correctly classifies bot walls, JavaScript shells, and readable content pages.
 */

const WALL_FIXTURES = new Set([
  "ebay-com-category-wall",
  "reuters-com",
  "stackoverflow-thread-wall",
  "tirerack-com-soft-block-200",
  "vercel-com-wall-200",
]);

const SHELL_FIXTURES = new Set([
  "atlassian-com-pricing-shell",
  "gymshark-com-shell",
  "myfritz-net",
  "quitenice-co-shell",
  "reddit-r-programming-shell",
  "tattly-com-shell",
]);

function buildCorpusPageContext(
  html: string,
  provenance: FixtureProvenance,
): PageContext {
  const $ = parseHtml(html);
  const jsonLd = extractJsonLd($);
  const structuredData = [...jsonLd, ...extractMicrodata($), ...extractRdfa($)];
  const meta = extractMetaTags($);
  const fetchResult: FetchResult = {
    url: provenance.redirectChain?.[0]?.from ?? provenance.url,
    finalUrl: provenance.url,
    status: provenance.status,
    headers: provenance.headers,
    body: html,
    ttfbMs: provenance.ttfbMs,
    totalMs: provenance.totalMs,
    contentType: provenance.contentType,
    contentLength: provenance.contentLength,
    ...(provenance.redirectChain
      ? { redirectChain: provenance.redirectChain }
      : {}),
  };

  return {
    url: provenance.url,
    pageType: detectPageType(provenance.url, $, structuredData, meta, true),
    pageTypeSource: "declared",
    fetchResult,
    $,
    jsonLd,
    structuredData,
    meta,
    headLinks: extractHeadLinks($),
  };
}

describe("corpus evidence gating", () => {
  const fixtures = listFixtures();

  it("evaluates all 41 real-page fixtures", () => {
    expect(fixtures).toHaveLength(41);
  });

  it("correctly partitions the corpus into walls, shells, and content pages", () => {
    const walls: string[] = [];
    const shells: string[] = [];
    const content: string[] = [];

    for (const name of fixtures) {
      const { html, provenance } = readFixture(name);
      const page = buildCorpusPageContext(html, provenance);
      const waf = detectWafProtection(provenance.url, page.fetchResult, {}, 1);
      const evidence = buildScanEvidence({
        requestedUrl: provenance.url,
        homepageResult: page.fetchResult,
        pages: [page],
        rootFiles: {},
        wafProtection: waf,
      });

      if (!evidence.judgeable) {
        walls.push(name);
      } else if (!evidence.met["rendered-body"]) {
        shells.push(name);
      } else {
        content.push(name);
      }
    }

    expect([...walls].sort()).toEqual([...WALL_FIXTURES].sort());
    expect([...shells].sort()).toEqual([...SHELL_FIXTURES].sort());
    expect(content).toHaveLength(30);
  });

  for (const name of fixtures) {
    it(`${name}: plans audits consistent with real scan evidence`, () => {
      const { html, provenance } = readFixture(name);
      const page = buildCorpusPageContext(html, provenance);
      const parsed = new URL(provenance.url);
      const waf = detectWafProtection(provenance.url, page.fetchResult, {}, 1);
      const evidence = buildScanEvidence({
        requestedUrl: provenance.url,
        homepageResult: page.fetchResult,
        pages: [page],
        rootFiles: {},
        wafProtection: waf,
      });

      const ctx: CheckContext = {
        pages: [page],
        rootFiles: {},
        domain: parsed.hostname,
        baseUrl: parsed.origin,
        evidence,
        fetch: async () => mockFetchResult("", 404),
        ...(waf ? { wafProtection: waf } : {}),
      };

      const plan = planAudits(ctx, defaultConfig);

      if (WALL_FIXTURES.has(name)) {
        // Wall fixtures must be declared unjudgeable and run zero page-fed audits
        expect(evidence.judgeable, `${name} must not be judgeable`).toBe(false);
        expect(plan.runnable.length, `${name} must run 0 page-fed audits`).toBe(
          0,
        );

        // Every skipped audit must provide an explanatory explanation
        for (const skipped of plan.skipped) {
          expect(skipped.status).toBe("na");
          expect(skipped.explanation).toMatch(/^Not assessed: /);
        }
      } else if (SHELL_FIXTURES.has(name)) {
        // Shell fixtures are judgeable but do not clear rendered-body
        expect(evidence.judgeable, `${name} must be judgeable`).toBe(true);
        expect(evidence.met["rendered-body"], `${name} rendered-body`).toBe(
          false,
        );

        // Audits requiring rendered-body must be skipped as na
        const skippedIds = new Set(plan.skipped.map((s) => s.id));
        expect(skippedIds.has("content-extraction/token-ratio")).toBe(true);
        expect(skippedIds.has("content-extraction/content-depth")).toBe(true);
      } else {
        // Readable content pages clear all basic gates and schedule runnable audits
        expect(evidence.judgeable, `${name} must be judgeable`).toBe(true);
        expect(evidence.met["rendered-body"], `${name} rendered-body`).toBe(
          true,
        );
        expect(evidence.met["origin-reachable"]).toBe(true);
        expect(evidence.met["unblocked-fetches"]).toBe(true);
        expect(plan.runnable.length).toBeGreaterThan(0);
      }
    });
  }
});
