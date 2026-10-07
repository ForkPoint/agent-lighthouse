import { pageOptions } from "./tool";
import type { ScanOptions } from "@forkpoint/agent-lighthouse-core";
import { runScan } from "@forkpoint/agent-lighthouse-core";
import { buildReportView } from "@forkpoint/agent-lighthouse-report";

/**
 * Programmatic helper functions powering the Agent Lighthouse MCP server and custom agent tools.
 */
export async function auditWebsite(
  url: string,
  options?: Pick<ScanOptions, "pageType" | "pages">,
) {
  const report =
    options === undefined
      ? await runScan(url)
      : await runScan(url, pageOptions(options));
  const view = buildReportView(report);

  return {
    url: report.url,
    overallScore: view.overallScore,
    scoreTier: view.scoreTier,
    ...(view.unscoredReason ? { unscoredReason: view.unscoredReason } : {}),
    durationMs: view.durationMs,
    ...(view.pageScope ? { pageScope: view.pageScope } : {}),
    categories: view.groups.flatMap((g) =>
      g.categories.map((c) => ({
        name: c.name,
        score: c.score,
        assessed: c.assessed,
        pass: c.counts.pass,
        warn: c.counts.warn,
        fail: c.counts.fail,
      })),
    ),
    topFails: report.topFails.map((f) => ({
      id: f.id,
      title: f.title,
      priority: f.priority,
      impact: f.impact,
      fix: f.fix,
    })),
  };
}
