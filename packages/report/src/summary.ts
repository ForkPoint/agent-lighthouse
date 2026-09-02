import type { ScanReport } from "@forkpoint/agent-lighthouse-core";
import { SCORE_TIER_LABELS } from "@forkpoint/agent-lighthouse-core";

/**
 * Generates a pragmatic, rule-based summary for a scan report.
 * Provides immediate business context without LLM latency.
 *
 * Moved here from `@ucp/scanner` so every surface (web, pdf, cli, mcp) derives
 * the same summary text instead of hand-rolling its own.
 */
export function generateScanSummary(report: Partial<ScanReport>): string {
  const {
    domain,
    overallScore,
    scoreTier,
    categories = [],
    recommendations = [],
    readinessVitals = {
      commerce: 0,
      content: 0,
      botAccessibility: 0,
      technical: 0,
    },
  } = report;

  const tierLabel = scoreTier ? SCORE_TIER_LABELS[scoreTier] : "N/A";
  const criticalCount = recommendations.filter(
    (r) => r.priority === "critical",
  ).length;
  const highCount = recommendations.filter((r) => r.priority === "high").length;

  // Use the per-category counts, which already exclude `na` ("nothing to
  // assess"), so the headline reflects only what was actually evaluated.
  const passCount = categories.reduce((sum, cat) => sum + cat.passCount, 0);
  const totalChecks = categories.reduce(
    (sum, cat) => sum + cat.passCount + cat.warnCount + cat.failCount,
    0,
  );

  // Find strongest and weakest categories
  const sortedCategories = [...categories].sort((a, b) => b.score - a.score);
  const strongest =
    sortedCategories.length > 0 ? sortedCategories[0] : undefined;
  const weakest =
    sortedCategories.length > 1
      ? sortedCategories[sortedCategories.length - 1]
      : undefined;

  const v = readinessVitals;
  const summary = [
    overallScore === null || overallScore === undefined
      ? `Scan Report for ${domain}: not scored — this scan obtained too little evidence to judge the site.`
      : `Scan Report for ${domain}: Overall Readiness ${overallScore}% (${tierLabel}).`,
    `Readiness Vitals: Commerce ${v.commerce}%, Content ${v.content}%, AI Bot Accessibility ${v.botAccessibility}%, Technical Readiness ${v.technical}%.`,
    `Audit Statistics: ${passCount} of ${totalChecks} checks passed.`,
    `Key Issues: ${criticalCount} critical, ${highCount} high priority findings.`,
    strongest ? `Top Strength: ${strongest.name} (${strongest.score}%).` : null,
    weakest && strongest && weakest.id !== strongest.id
      ? `Primary Improvement Area: ${weakest.name} (${weakest.score}%).`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return summary;
}
