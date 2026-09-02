import type {
  CategoryResult,
  CheckRecommendation,
  CheckResult,
  PageType,
  ReadinessVitals,
  ScanReport,
  ScoreTier,
} from "@forkpoint/agent-lighthouse-core";
import {
  CATEGORY_MASS,
  CATEGORY_NAMES,
  isInformative,
} from "@forkpoint/agent-lighthouse-core";
import { CATEGORY_ORDER } from "./sections";
import { generateScanSummary } from "./summary";

/**
 * Structural view of a persisted `scans` row. Kept dependency-free (no drizzle
 * import) so this lib stays client-safe and pure.
 */
export interface PersistedScanRow {
  id: string;
  url: string;
  domain: string;
  overallScore: number | null;
  scoreTier: string | null;
  categoryScores: Record<string, number> | null;
  checkResults: CheckResult[] | null;
  recommendations: CheckRecommendation[] | null;
  pagesData: Array<{ url: string; pageType: PageType }> | null;
  durationMs: number | null;
  readinessScore: number | null;
  readinessVitals: ReadinessVitals | null;
  productFields?: ScanReport["productFields"] | null;
  originEvidence?: ScanReport["originEvidence"] | null;
  conditions?: import("@forkpoint/agent-lighthouse-core").ScanConditions | null;
  previousScore?: number | null;
  scoreDelta?: number | null;
  createdAt?: Date | string | null;
  completedAt?: Date | string | null;
}

function countBy(checks: CheckResult[], status: CheckResult["status"]): number {
  return checks.filter((c) => c.status === status).length;
}

/**
 * Reconstruct the canonical nested `ScanReport` from the flattened DB row.
 *
 * The DB stores `checkResults` flat plus a `categoryScores` map; previously each
 * web surface (report page, pdf, shared report) re-grouped these by hand. This
 * helper does it once so they can all go through `buildReportView`.
 */
export function hydrateReport(row: PersistedScanRow): ScanReport {
  const checkResults = row.checkResults ?? [];
  const categoryScores = row.categoryScores ?? {};

  const present = new Set(checkResults.map((c) => c.category));
  // Canonical order first, then any unexpected categories not in the map.
  const orderedIds = [
    ...CATEGORY_ORDER.filter((id) => present.has(id) || id in categoryScores),
    ...[...present].filter((id) => !CATEGORY_ORDER.includes(id)),
  ];

  const categories: CategoryResult[] = orderedIds.map((id) => {
    const checks = checkResults.filter((c) => c.category === id);
    return {
      id,
      name: CATEGORY_NAMES[id] ?? id,
      weight: CATEGORY_MASS[id] ?? 0,
      score: categoryScores[id] ?? 0,
      checks,
      passCount: countBy(checks, "pass"),
      warnCount: countBy(checks, "warn"),
      failCount: countBy(checks, "fail"),
    };
  });

  const recommendations = row.recommendations ?? [];
  const order: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  // Informative checks are advisory-only: they never rank as a top fail or pass.
  const topFails = checkResults
    .filter(
      (c) => (c.status === "fail" || c.status === "warn") && !isInformative(c),
    )
    .slice()
    .sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3))
    .slice(0, 10);
  const topPasses = checkResults
    .filter((c) => c.status === "pass" && !isInformative(c))
    .slice()
    .sort(
      (a, b) =>
        (CATEGORY_MASS[b.category] ?? 0) - (CATEGORY_MASS[a.category] ?? 0),
    )
    .slice(0, 10);

  const report: ScanReport = {
    scanId: row.id,
    url: row.url,
    domain: row.domain,
    // A stored row with no score is a scan that was not judgeable, not a scan
    // that scored zero. Keep the null; the renderers have a shape for it.
    overallScore: row.overallScore ?? null,
    scoreTier: (row.scoreTier as ScoreTier | null) ?? null,
    summary: "",
    categories,
    topPasses,
    topFails,
    categoryScores,
    checkResults,
    recommendations,
    pagesScanned: row.pagesData ?? [],
    pagesData: row.pagesData ?? [],
    scannedAt:
      (row.completedAt instanceof Date
        ? row.completedAt.toISOString()
        : row.completedAt) ?? "",
    createdAt:
      (row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : row.createdAt) ?? undefined,
    durationMs: row.durationMs ?? 0,
    previousScore: row.previousScore ?? undefined,
    scoreDelta: row.scoreDelta ?? undefined,
    readinessScore: row.readinessScore ?? undefined,
    readinessVitals: row.readinessVitals ?? undefined,
    productFields: row.productFields ?? undefined,
    originEvidence: row.originEvidence ?? undefined,
    conditions: row.conditions ?? undefined,
  };

  report.summary = generateScanSummary(report);
  return report;
}
