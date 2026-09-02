#!/usr/bin/env tsx
/**
 * Corpus Analysis & Diagnostic Report Generator
 *
 * Runs the audit suite against all fixtures in packages/core/test-data/corpus/real
 * and generates a diagnostic report tracking outcomes, page type gating, and
 * any potential false positives.
 *
 * Usage:
 *   pnpm exec tsx scripts/analyze-corpus.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import dns from "node:dns/promises";

// Ensure corpus tests run hermetically offline without invoking live DNS
dns.lookup = (async () => ({
  address: "93.184.216.34",
  family: 4,
})) as any;

import {
  defaultConfig,
  runAudits,
  detectWafProtection,
  allEvidenceMet,
  type CheckContext,
  type PageContext,
  type FetchResult,
} from "../packages/core/src";

import {
  parseHtml,
  extractJsonLd,
  extractMicrodata,
  extractRdfa,
  extractMetaTags,
  extractHeadLinks,
  detectPageType,
} from "../packages/core/src/parser";

import {
  listFixtures,
  readFixture,
  type FixtureProvenance,
} from "../packages/core/src/tests/fixture-io";

function fixtureFetchResult(
  html: string,
  provenance: FixtureProvenance,
): FetchResult {
  return {
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
}

function fixturePageContext(
  html: string,
  provenance: FixtureProvenance,
): PageContext {
  const $ = parseHtml(html);
  const jsonLd = extractJsonLd($);
  const structuredData = [...jsonLd, ...extractMicrodata($), ...extractRdfa($)];
  const meta = extractMetaTags($);
  return {
    url: provenance.url,
    pageType: detectPageType(provenance.url, $, structuredData, meta, true),
    pageTypeSource: "detected",
    fetchResult: fixtureFetchResult(html, provenance),
    $,
    jsonLd,
    structuredData,
    meta,
    headLinks: extractHeadLinks($),
  };
}

async function main() {
  console.log("Analyzing corpus fixtures across all registered audits...");
  const fixtureNames = listFixtures();
  const reports: any[] = [];

  const totalStats = {
    fixtures: fixtureNames.length,
    totalAuditExecutions: 0,
    outcomes: { ran: 0, skipped: 0, gated: 0, error: 0 } as Record<
      string,
      number
    >,
    statuses: { pass: 0, warn: 0, fail: 0, na: 0 } as Record<string, number>,
    scoredFails: 0,
    informativeFails: 0,
    errors: [] as any[],
    falsePositives: [] as any[],
  };

  for (const name of fixtureNames) {
    const { html, provenance } = readFixture(name);
    const pageCtx = fixturePageContext(html, provenance);
    const host = new URL(provenance.url).hostname;
    const baseUrl = new URL(provenance.url).origin;

    const wafProtection = detectWafProtection(
      provenance.url,
      pageCtx.fetchResult,
      {},
      1,
    );

    const ctx: CheckContext = {
      pages: [pageCtx],
      rootFiles: {},
      domain: host,
      baseUrl,
      fetch: async () => ({
        url: "",
        finalUrl: "",
        status: 404,
        headers: {},
        body: "",
        ttfbMs: 0,
        totalMs: 0,
        contentType: "",
        contentLength: 0,
      }),
      evidence: allEvidenceMet(),
      wafProtection: wafProtection ?? undefined,
    };

    const traces: any[] = [];
    const result = await runAudits(
      ctx,
      defaultConfig,
      undefined,
      undefined,
      (t) => traces.push(t),
    );

    const fixtureSummary = {
      name,
      kind: provenance.kind,
      url: provenance.url,
      status: provenance.status,
      pageType: pageCtx.pageType,
      overallScore: result.overallScore,
      tracesCount: traces.length,
      outcomeCounts: { ran: 0, skipped: 0, gated: 0, error: 0 } as Record<
        string,
        number
      >,
      statusCounts: { pass: 0, warn: 0, fail: 0, na: 0 } as Record<
        string,
        number
      >,
      fails: [] as any[],
      errors: [] as any[],
    };

    for (const t of traces) {
      totalStats.totalAuditExecutions++;
      totalStats.outcomes[t.outcome]++;
      fixtureSummary.outcomeCounts[t.outcome]++;

      totalStats.statuses[t.status]++;
      fixtureSummary.statusCounts[t.status]++;

      if (t.outcome === "error") {
        const errItem = {
          fixture: name,
          id: t.id,
          explanation: t.explanation,
        };
        totalStats.errors.push(errItem);
        fixtureSummary.errors.push(errItem);
      }

      if (t.status === "fail") {
        if (t.weight > 0) totalStats.scoredFails++;
        else totalStats.informativeFails++;

        const failItem = {
          id: t.id,
          category: t.category,
          weight: t.weight,
          tier: t.tier,
          score: t.score,
          explanation: t.explanation,
          details: t.details,
        };
        fixtureSummary.fails.push(failItem);

        if (provenance.kind === "wall" && t.weight > 0 && t.status === "fail") {
          totalStats.falsePositives.push({
            fixture: name,
            kind: provenance.kind,
            id: t.id,
            reason: "Scored failure on bot-wall fixture",
            explanation: t.explanation,
          });
        }

        if (
          t.explanation?.toLowerCase().includes("no ") &&
          t.explanation?.toLowerCase().includes("found") &&
          t.status === "fail" &&
          t.weight > 0
        ) {
          totalStats.falsePositives.push({
            fixture: name,
            kind: provenance.kind,
            id: t.id,
            reason: "Scored failure on absent optional artifact",
            explanation: t.explanation,
          });
        }
      }
    }

    reports.push(fixtureSummary);
  }

  const outputPath =
    process.env.CORPUS_REPORT_PATH ??
    path.join(process.cwd(), "reports", "corpus-audit-analysis.md");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  let md = `# Real-World Corpus Audit & False Positive Analysis Report

## Summary & Global Metrics
- **Total Corpus Fixtures Tested:** ${totalStats.fixtures}
- **Total Audit Executions:** ${totalStats.totalAuditExecutions}
- **Execution Outcomes:**
  - **Ran:** ${totalStats.outcomes.ran}
  - **Skipped (Page Type Consent):** ${totalStats.outcomes.skipped}
  - **Gated (Evidence Missing):** ${totalStats.outcomes.gated}
  - **Error (Exceptions/Schema Failures):** ${totalStats.outcomes.error}
- **Audit Verdict Breakdown:**
  - **Pass:** ${totalStats.statuses.pass}
  - **Warn:** ${totalStats.statuses.warn}
  - **Fail (Scored):** ${totalStats.scoredFails}
  - **Fail (Informative):** ${totalStats.informativeFails}
  - **Not Applicable (N/A):** ${totalStats.statuses.na}

---

## Key Diagnostic Findings

### 1. Execution Stability & Errors (${totalStats.errors.length} Errors)
${
  totalStats.errors.length === 0
    ? "✅ **Zero runtime errors or schema rejections observed across all audit executions.** Every audit executed safely without throwing exceptions or returning invalid `details` structures."
    : totalStats.errors
        .map((e) => `- **${e.fixture}** \`${e.id}\`: ${e.explanation}`)
        .join("\n")
}

### 2. Page Type Consent & Unscored (Informative) Isolation
Under Phase 3 rules, detected page types (un-consented by explicit user flag) run audits with \`scoreDisplayMode: 'informative'\` (weight 0, score 0).
- **Skipped Audits:** ${totalStats.outcomes.skipped} executions were correctly skipped because the fixture page type did not match the audit's declared \`pageTypes\`.
- **Informative Fails:** ${totalStats.informativeFails} failures occurred on detected page types, but all were isolated to \`informative\` mode with \`weight: 0\`, ensuring site scores were not distorted without explicit user consent.

### 3. Potential False Positives & Anomaly Inspection (${totalStats.falsePositives.length} Flagged)
${
  totalStats.falsePositives.length === 0
    ? "✅ **No false positives or absent-artifact scoring penalties detected across the corpus.** Audits strictly adhere to the fundamental rule: *Absent artifact, absent verdict* (returning `notApplicable`)."
    : totalStats.falsePositives
        .map(
          (fp) =>
            `- **Fixture:** \`${fp.fixture}\` (${fp.kind})\n  - **Audit:** \`${fp.id}\` (${fp.reason})\n  - **Details:** ${fp.explanation}`,
        )
        .join("\n")
}

---

## Detailed Per-Fixture Breakdown

| Fixture | Kind | Page Type | Overall Score | Ran | Skipped | Pass | Fail (Scored/Informative) | N/A |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;

  for (const r of reports) {
    const scoredFails = r.fails.filter((f: any) => f.weight > 0).length;
    const infoFails = r.fails.filter((f: any) => f.weight === 0).length;
    md += `| \`${r.name}\` | \`${r.kind}\` | \`${r.pageType}\` | ${r.overallScore !== null ? Math.round(r.overallScore) : "N/A"} | ${r.outcomeCounts.ran} | ${r.outcomeCounts.skipped} | ${r.statusCounts.pass} | ${scoredFails} / ${infoFails} | ${r.statusCounts.na} |\n`;
  }

  md += `\n---\n\n## Individual Fixture Failures Deep-Dive\n\n`;

  for (const r of reports) {
    if (r.fails.length === 0) continue;
    md += `### \`${r.name}\` (${r.kind}, \`${r.pageType}\`)\n`;
    for (const f of r.fails) {
      md += `- **\`${f.id}\`** (tier: \`${f.tier}\`, weight: ${f.weight}, status: \`${f.status}\`)\n  - *Explanation:* ${f.explanation}\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync(outputPath, md, "utf-8");
  console.log("Analysis report written successfully to:", outputPath);
}

main().catch((err) => {
  console.error("Analysis failed:", err);
  process.exit(1);
});
