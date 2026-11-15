import type { ScanConfig } from "./audit-config";
import { defaultConfig } from "./audit-config";
import { evidenceUrl } from "./audit";
import { READINESS_WEIGHTS } from "./constants";
import { getScoreTier } from "./contracts";
import type {
  CategoryResult,
  CheckRecommendation,
  CheckResult,
  PortableCheckResult,
  PortableScanReport,
  ScanReport,
} from "./contracts";
import { CORE_VERSION } from "./registry-summary";
import {
  assessedMassOf,
  calculateCategoryScore,
  calculateOverallScore,
  calculateReadinessVitals,
  countCategoryStatuses,
  isInformative,
} from "./scorer";
import { generateScanSummary } from "./summary";
import {
  type AuditMeta,
  CheckPriority,
  CheckStatus,
  ScoreDisplayMode,
} from "./types";

/**
 * Convert a complete ScanReport into a lightweight, portable representation.
 * All static audit metadata (titles, descriptions, impact, guidance fix,
 * docsUrl, evidenceUrl, effort, weights, tiers, grades) and derived aggregations
 * (categories, topPasses, topFails, recommendations, summary, readiness vitals)
 * are omitted.
 */
export function toPortableReport(
  report: ScanReport,
  config: ScanConfig = defaultConfig,
): PortableScanReport {
  const auditMap = new Map<string, AuditMeta>();
  for (const audits of Object.values(config.audits)) {
    for (const reg of audits) {
      auditMap.set(reg.meta.id, reg.meta);
    }
  }

  function extractPortableCheck(
    check: CheckResult,
    meta?: AuditMeta,
  ): PortableCheckResult {
    const portable: PortableCheckResult = {
      id: check.id,
      status: check.status,
      score: check.score,
    };

    if (check.displayValue !== undefined) {
      portable.displayValue = check.displayValue;
    }
    if (check.explanation !== undefined) {
      portable.explanation = check.explanation;
    }
    if (check.pageUrl !== undefined) {
      portable.pageUrl = check.pageUrl;
    }

    if (meta && check.priority !== meta.defaultPriority) {
      portable.priority = check.priority;
    } else if (!meta && check.priority !== CheckPriority.Medium) {
      portable.priority = check.priority;
    }

    if (meta?.guidance && check.fix !== meta.guidance.fix) {
      portable.remediation = check.fix;
    }

    if (check.details) {
      const {
        docsUrl: _docsUrl,
        evidenceUrl: _evidenceUrl,
        effort: _effort,
        ...dynamicDetails
      } = check.details;
      if (meta?.guidance?.code && dynamicDetails.code === meta.guidance.code) {
        delete dynamicDetails.code;
      }
      if (Object.keys(dynamicDetails).length > 0) {
        portable.details = dynamicDetails;
      }
    }

    if (check.tags && check.tags.length > 0) {
      const staticTags = new Set(meta?.guidance?.tags ?? []);
      const dynamicTags = check.tags.filter((t) => !staticTags.has(t));
      if (dynamicTags.length > 0) {
        portable.tags = dynamicTags;
      }
    }

    if (check.coverage) {
      portable.coverage = check.coverage;
    }

    if (check.advisoryResults && check.advisoryResults.length > 0) {
      portable.advisoryResults = check.advisoryResults.map((adv) =>
        extractPortableCheck(adv as CheckResult, meta),
      );
    }

    return portable;
  }

  const sourceChecks =
    report.checkResults ?? report.categories.flatMap((c) => c.checks);
  const checks = sourceChecks.map((check) =>
    extractPortableCheck(check, auditMap.get(check.id)),
  );

  return {
    schemaVersion: 1,
    coreVersion: CORE_VERSION,
    scanId: report.scanId,
    url: report.url,
    domain: report.domain,
    overallScore: report.overallScore,
    scoreTier: report.scoreTier,
    scannedAt: report.scannedAt,
    durationMs: report.durationMs,
    pagesScanned: report.pagesScanned,
    ...(report.pageAttempts ? { pageAttempts: report.pageAttempts } : {}),
    checks,
    ...(report.scanValidity ? { scanValidity: report.scanValidity } : {}),
    ...(report.originEvidence ? { originEvidence: report.originEvidence } : {}),
    ...(report.conditions ? { conditions: report.conditions } : {}),
    ...(report.wafProtection ? { wafProtection: report.wafProtection } : {}),
    ...(report.productFields ? { productFields: report.productFields } : {}),
    ...(report.browserAssessment
      ? { browserAssessment: report.browserAssessment }
      : {}),
    ...(report.pageIdentity ? { pageIdentity: report.pageIdentity } : {}),
    ...(report.previousScore !== undefined
      ? { previousScore: report.previousScore }
      : {}),
    ...(report.scoreDelta !== undefined
      ? { scoreDelta: report.scoreDelta }
      : {}),
    ...(report.createdAt ? { createdAt: report.createdAt } : {}),
  };
}

/**
 * Losslessly reconstruct a canonical ScanReport from a PortableScanReport.
 * Resolves static audit definitions from the registry, re-runs category and
 * overall scoring, slices top passes/fails, derives recommendations, and
 * synthesizes the report summary.
 */
export function hydratePortableReport(
  portable: PortableScanReport,
  config: ScanConfig = defaultConfig,
): ScanReport {
  const auditMap = new Map<string, AuditMeta>();
  for (const audits of Object.values(config.audits)) {
    for (const reg of audits) {
      auditMap.set(reg.meta.id, reg.meta);
    }
  }

  function inflateCheck(p: PortableCheckResult): CheckResult {
    const meta = auditMap.get(p.id);
    if (!meta) {
      const category = p.id.includes("/") ? p.id.split("/")[0]! : "unknown";
      return {
        id: p.id,
        category,
        title: p.id,
        description: "",
        status: p.status,
        score: p.score,
        weight: 0,
        scoreDisplayMode: ScoreDisplayMode.Informative,
        priority: p.priority ?? CheckPriority.Medium,
        impact: "",
        fix: p.remediation ?? "",
        ...(p.displayValue !== undefined && { displayValue: p.displayValue }),
        ...(p.explanation !== undefined && { explanation: p.explanation }),
        ...(p.pageUrl !== undefined && { pageUrl: p.pageUrl }),
        ...(p.details !== undefined && { details: p.details }),
        ...(p.tags !== undefined && { tags: p.tags }),
        ...(p.coverage !== undefined && { coverage: p.coverage }),
        ...(p.advisoryResults !== undefined && {
          advisoryResults: p.advisoryResults.map(inflateCheck),
        }),
      };
    }

    const isInf = isInformative({ scoreDisplayMode: meta.scoreDisplayMode });
    const isPassOrNa =
      p.status === CheckStatus.Pass || p.status === CheckStatus.NotApplicable;
    const title = isPassOrNa ? meta.title : meta.failureTitle;

    const hasDetails =
      (p.details && Object.keys(p.details).length > 0) ||
      p.status !== CheckStatus.NotApplicable;
    let details: CheckResult["details"];
    if (hasDetails) {
      const code = p.details?.code ?? meta.guidance?.code;
      details = {
        ...p.details,
        ...(code !== undefined && { code }),
        ...(meta.guidance?.docsUrl !== undefined && {
          docsUrl: meta.guidance.docsUrl,
        }),
        evidenceUrl: evidenceUrl(meta.id),
        ...(meta.guidance?.effort !== undefined && {
          effort: meta.guidance.effort,
        }),
      };
    }

    const isSkippedStub = p.tags?.some((t) => t.startsWith("skipped:"));
    const tags = isSkippedStub
      ? p.tags
      : [...(meta.guidance?.tags ?? []), ...(p.tags ?? [])];

    return {
      id: meta.id,
      category: meta.category,
      title,
      description: meta.description,
      status: p.status,
      score: p.score,
      weight: isInf ? 0 : meta.weight,
      scoreDisplayMode: meta.scoreDisplayMode,
      ...(p.displayValue !== undefined && { displayValue: p.displayValue }),
      ...(p.explanation !== undefined && { explanation: p.explanation }),
      ...(p.pageUrl !== undefined && { pageUrl: p.pageUrl }),
      priority: p.priority ?? meta.defaultPriority,
      impact: meta.guidance?.impact ?? meta.description,
      fix:
        p.remediation ?? meta.guidance?.fix ?? "No fix instructions available.",
      ...(details !== undefined && { details }),
      ...(tags && tags.length > 0 && { tags }),
      ...(meta.deprecated !== undefined && { deprecated: meta.deprecated }),
      ...(meta.evidenceGrade !== undefined && {
        evidenceGrade: meta.evidenceGrade,
      }),
      ...(meta.tier !== undefined && { tier: meta.tier }),
      ...(p.coverage !== undefined && { coverage: p.coverage }),
      ...(p.advisoryResults !== undefined && {
        advisoryResults: p.advisoryResults.map(inflateCheck),
      }),
    };
  }

  const checkResults = portable.checks.map(inflateCheck);

  const presentCategories = new Set(checkResults.map((c) => c.category));
  const categoryScores: Record<string, number> = {};

  const categories: CategoryResult[] = config.categories
    .filter((cat) => presentCategories.has(cat.id))
    .map((cat) => {
      const catChecks = checkResults.filter((c) => c.category === cat.id);
      const score = calculateCategoryScore(catChecks);
      categoryScores[cat.id] = score;
      return {
        id: cat.id,
        name: cat.name,
        weight: cat.weight,
        registryMass: cat.weight,
        assessedMass: assessedMassOf(catChecks),
        score,
        checks: catChecks,
        ...countCategoryStatuses(catChecks),
      };
    });

  for (const catId of presentCategories) {
    if (!config.categories.some((c) => c.id === catId)) {
      const catChecks = checkResults.filter((c) => c.category === catId);
      const score = calculateCategoryScore(catChecks);
      categoryScores[catId] = score;
      categories.push({
        id: catId,
        name: catId,
        weight: 0,
        registryMass: 0,
        assessedMass: assessedMassOf(catChecks),
        score,
        checks: catChecks,
        ...countCategoryStatuses(catChecks),
      });
    }
  }

  const computedOverallScore = calculateOverallScore(categories);
  const overallScore =
    portable.overallScore !== undefined
      ? portable.overallScore
      : computedOverallScore;
  const scoreTier =
    portable.scoreTier !== undefined
      ? portable.scoreTier
      : overallScore !== null
        ? getScoreTier(overallScore)
        : null;

  const priorityOrder: Record<string, number> = {
    [CheckPriority.Critical]: 0,
    [CheckPriority.High]: 1,
    [CheckPriority.Medium]: 2,
    [CheckPriority.Low]: 3,
  };

  const recommendations: CheckRecommendation[] = checkResults
    .filter(
      (c) =>
        (c.status === CheckStatus.Fail || c.status === CheckStatus.Warn) &&
        !isInformative(c),
    )
    .slice()
    .sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3),
    )
    .map((c) => ({
      priority: c.priority,
      description: `${c.title}: ${c.fix}`,
      ...(c.details?.code ? { code: c.details.code } : {}),
      ...(c.details?.docsUrl ? { docsUrl: c.details.docsUrl } : {}),
    }));

  const topFails = checkResults
    .filter(
      (c) =>
        (c.status === CheckStatus.Fail || c.status === CheckStatus.Warn) &&
        !isInformative(c),
    )
    .slice()
    .sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3),
    )
    .slice(0, 10);

  const topPasses = checkResults
    .filter((c) => c.status === CheckStatus.Pass && !isInformative(c))
    .slice()
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 10);

  const readinessVitals = calculateReadinessVitals(
    checkResults.filter((c) => !isInformative(c)),
  );
  const readinessScore = Math.round(
    readinessVitals.commerce * READINESS_WEIGHTS.commerce +
      readinessVitals.content * READINESS_WEIGHTS.content +
      readinessVitals.botAccessibility * READINESS_WEIGHTS.botAccessibility +
      readinessVitals.technical * READINESS_WEIGHTS.technical,
  );

  const report: ScanReport = {
    scanId: portable.scanId,
    url: portable.url,
    domain: portable.domain,
    overallScore,
    scoreTier,
    summary: "",
    categories,
    topPasses,
    topFails,
    categoryScores,
    checkResults,
    recommendations,
    pagesScanned: portable.pagesScanned,
    pagesData: portable.pagesScanned,
    ...(portable.pageAttempts ? { pageAttempts: portable.pageAttempts } : {}),
    scannedAt: portable.scannedAt,
    durationMs: portable.durationMs,
    readinessScore,
    readinessVitals,
    ...(portable.scanValidity ? { scanValidity: portable.scanValidity } : {}),
    ...(portable.originEvidence
      ? { originEvidence: portable.originEvidence }
      : {}),
    ...(portable.conditions ? { conditions: portable.conditions } : {}),
    ...(portable.wafProtection
      ? { wafProtection: portable.wafProtection }
      : {}),
    ...(portable.productFields
      ? { productFields: portable.productFields }
      : {}),
    ...(portable.browserAssessment
      ? { browserAssessment: portable.browserAssessment }
      : {}),
    ...(portable.pageIdentity ? { pageIdentity: portable.pageIdentity } : {}),
    ...(portable.previousScore !== undefined
      ? { previousScore: portable.previousScore }
      : {}),
    ...(portable.scoreDelta !== undefined
      ? { scoreDelta: portable.scoreDelta }
      : {}),
    ...(portable.createdAt ? { createdAt: portable.createdAt } : {}),
  };

  report.summary = generateScanSummary(report);
  return report;
}
