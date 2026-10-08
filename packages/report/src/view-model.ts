import { buildPageScope, type PageScopeView } from "./page-scope";
import type {
  CategoryResult,
  CheckRecommendation,
  CheckResult,
  ReadinessVitals,
  ScanReport,
  ScanConditions,
  ScoreTier,
} from "@forkpoint/agent-lighthouse-core";
import {
  categoryAssessedMass,
  isCategoryAssessed,
  isInformative,
  AuditTier,
  CheckPriority,
  CheckStatus,
} from "@forkpoint/agent-lighthouse-core";
import {
  CATEGORY_ORDER,
  SECTION_GROUPS,
  SECTION_GROUP_LABELS,
  TAG_SCAN_ERROR,
  TAG_SKIPPED_NO_EVIDENCE,
  TAG_SKIPPED_PAGE_TYPE,
} from "./sections";

// ── View types — the single shape every surface renders ─────────

export interface CheckCounts {
  pass: number;
  warn: number;
  fail: number;
  /** Not-applicable (page-type skips, scan errors, audit-declared na). */
  na: number;
  /** Assessed checks whose tier is not `scored` — reported, never scored. */
  advisory: number;
  /** Assessed checks only: pass + warn + fail. */
  total: number;
}

export interface CategoryView {
  id: string;
  name: string;
  /** 0–100. Meaningless when `assessed` is false: core reports 0 for "no data". */
  score: number;
  /**
   * False when no scored check reached a verdict, so the category has no score
   * to show. Renderers print "Not assessed" instead of a 0 that would read as
   * a failing grade.
   */
  assessed: boolean;
  weight: number;
  /** Summed weight of the scored checks that reached a verdict. */
  assessedMass: number;
  counts: CheckCounts;
  /** Assessed checks (pass/warn/fail), in report order. */
  checks: CheckResult[];
  /** Not-applicable checks (skipped/errored/na), kept for transparency. */
  notApplicable: CheckResult[];
}

export interface GroupView {
  key: string;
  /** English fallback label; surfaces with i18n resolve `key` themselves. */
  label: string;
  /**
   * Roll-up of the group's assessed categories (0–100), weighted by assessed
   * mass the way the overall score is. Meaningless when `assessed` is false.
   */
  score: number;
  /** True when at least one of the group's categories was assessed. */
  assessed: boolean;
  categories: CategoryView[];
}

export interface CoverageView {
  /** Audits that produced a real pass/warn/fail verdict. */
  ran: number;
  /** Audits skipped because no scanned page matched their page types. */
  skippedByPageType: number;
  /** Audits the scan could not feed: it never obtained the evidence they need. */
  skippedNoEvidence: number;
  /**
   * Why, one sentence per missing evidence class.
   *
   * "154 audits not assessed" needs the sentence that says why, or the number
   * reads as a defect in the scanner rather than as a fact about the scan.
   */
  noEvidenceReasons: string[];
  /** Audits that threw and were recorded instead of silently dropped. */
  errored: number;
  /** Audits that self-declared not-applicable (precondition unmet). */
  notApplicable: number;
  /** The errored checks, for surfacing detail. */
  erroredChecks: CheckResult[];
}

export interface ReportView {
  url: string;
  domain: string;
  /** Null when the scan saw too little to judge the site. Never rendered as 0. */
  overallScore: number | null;
  /** Null exactly when `overallScore` is. */
  scoreTier: ScoreTier | null;
  /** Present when the score was suppressed: what is missing, in one sentence. */
  unscoredReason?: string;
  summary: string;
  vitals: ReadinessVitals;
  readinessScore: number;
  /** The 3 section groups, each with nested category views. */
  groups: GroupView[];
  /** All categories flat, in canonical order. */
  categories: CategoryView[];
  /** Highest-priority failing checks (a.k.a. topFails). */
  topFixes: CheckResult[];
  /** Highest-weight passing checks. */
  topPasses: CheckResult[];
  recommendations: CheckRecommendation[];
  coverage: CoverageView;
  pagesScanned: ScanReport["pagesScanned"];
  pageScope?: PageScopeView;
  durationMs: number;
  wafProtection?: import("@forkpoint/agent-lighthouse-core").WafProtection;
  conditions?: ScanConditions;
}

export interface BuildReportViewOptions {
  /** Limit for topFixes / topPasses (default 10). */
  topN?: number;
  /** Filter all checks to a single priority (used by the MCP tool). */
  priority?: CheckPriority;
}

// ── Derivation ──────────────────────────────────────────────────

function countChecks(checks: CheckResult[]): CheckCounts {
  const pass = checks.filter((c) => c.status === CheckStatus.Pass).length;
  const warn = checks.filter((c) => c.status === CheckStatus.Warn).length;
  const fail = checks.filter((c) => c.status === CheckStatus.Fail).length;
  const na = checks.filter(
    (c) => c.status === CheckStatus.NotApplicable,
  ).length;
  // Tier is not a status: an advisory check passes or fails like any other, it
  // just never moves a score. Counting it separately is what stops a deliberate
  // advisory from reading as a defect. A scored-tier check the scan ran as
  // informative — a page-typed audit on a detected, undeclared page type —
  // moves no score either, so it counts here too.
  const advisory = checks.filter(
    (c) =>
      c.status !== CheckStatus.NotApplicable &&
      ((c.tier !== undefined && c.tier !== AuditTier.Scored) ||
        isInformative(c)),
  ).length;
  return { pass, warn, fail, na, advisory, total: pass + warn + fail };
}

function toCategoryView(
  cat: CategoryResult,
  original: CategoryResult = cat,
): CategoryView {
  const assessed = cat.checks.filter(
    (c) => c.status !== CheckStatus.NotApplicable,
  );
  const notApplicable = cat.checks.filter(
    (c) => c.status === CheckStatus.NotApplicable,
  );
  return {
    id: cat.id,
    name: cat.name,
    score: cat.score,
    // Judged on the unfiltered category: a priority filter narrows the checks
    // shown, not whether the category's score exists.
    assessed: isCategoryAssessed(original),
    weight: cat.weight,
    assessedMass: categoryAssessedMass(original),
    counts: countChecks(cat.checks),
    checks: assessed,
    notApplicable,
  };
}

function hasTag(check: CheckResult, tag: string): boolean {
  return Array.isArray(check.tags) && check.tags.includes(tag);
}

/**
 * Build the unified presentation view-model from a canonical scan report.
 *
 * Pure: no IO, depends only on `@forkpoint/agent-lighthouse-core`. Consumed by web, pdf, cli and
 * mcp renderers so derived structures (grouping, counts, vitals, top fixes,
 * coverage) have exactly one implementation.
 */
export function buildReportView(
  report: ScanReport,
  opts: BuildReportViewOptions = {},
): ReportView {
  const topN = opts.topN ?? 10;

  // Optionally narrow every check to a single priority (MCP priority filter).
  let categories = report.categories;
  if (opts.priority) {
    categories = categories
      .map((cat) => ({
        ...cat,
        checks: cat.checks.filter((c) => c.priority === opts.priority),
      }))
      .filter((cat) => cat.checks.length > 0);
  }

  const byId = new Map(categories.map((c) => [c.id, c] as const));
  const originalById = new Map(
    report.categories.map((c) => [c.id, c] as const),
  );

  // Categories in canonical order; include only those present in the report.
  const categoryViews: CategoryView[] = CATEGORY_ORDER.map((id) => byId.get(id))
    .filter((c): c is CategoryResult => c !== undefined)
    .map((c) => toCategoryView(c, originalById.get(c.id)));

  const viewById = new Map(categoryViews.map((c) => [c.id, c] as const));

  const groups: GroupView[] = SECTION_GROUPS.map((def) => {
    const cats = def.categoryIds
      .map((id) => viewById.get(id))
      .filter((c): c is CategoryView => c !== undefined);
    // Same rule as core's overall score: weight by assessed mass and leave an
    // unassessed category out, so its "no data" 0 cannot drag the group down.
    let weighted = 0;
    let weightSum = 0;
    for (const c of cats) {
      if (!c.assessed) continue;
      weighted += c.score * c.assessedMass;
      weightSum += c.assessedMass;
    }
    return {
      key: def.key,
      label: SECTION_GROUP_LABELS[def.key] ?? def.key,
      score: weightSum > 0 ? Math.round(weighted / weightSum) : 0,
      assessed: weightSum > 0,
      categories: cats,
    };
  }).filter((g) => g.categories.length > 0);

  // Coverage — bucket every check, attributing na checks by their tag.
  const allChecks = categories.flatMap((c) => c.checks);
  const naChecks = allChecks.filter(
    (c) => c.status === CheckStatus.NotApplicable,
  );
  const erroredChecks = naChecks.filter((c) => hasTag(c, TAG_SCAN_ERROR));
  const skippedChecks = naChecks.filter((c) =>
    hasTag(c, TAG_SKIPPED_PAGE_TYPE),
  );
  const gatedChecks = naChecks.filter((c) =>
    hasTag(c, TAG_SKIPPED_NO_EVIDENCE),
  );
  const coverage: CoverageView = {
    ran: allChecks.filter((c) => c.status !== CheckStatus.NotApplicable).length,
    skippedByPageType: skippedChecks.length,
    skippedNoEvidence: gatedChecks.length,
    noEvidenceReasons: Object.values(report.scanValidity?.reasons ?? {}).filter(
      (reason): reason is string => Boolean(reason),
    ),
    errored: erroredChecks.length,
    notApplicable:
      naChecks.length -
      erroredChecks.length -
      skippedChecks.length -
      gatedChecks.length,
    erroredChecks,
  };

  // Top fixes: highest-priority non-passing assessed checks. Informative checks
  // are advisory-only and never surface as a fix or a highlighted pass.
  const order: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const topFixes = allChecks
    .filter(
      (c) =>
        (c.status === CheckStatus.Fail || c.status === CheckStatus.Warn) &&
        !isInformative(c),
    )
    .slice()
    .sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3))
    .slice(0, topN);

  // Top passes: highest category-weight passing checks.
  const topPasses = allChecks
    .filter((c) => c.status === CheckStatus.Pass && !isInformative(c))
    .slice()
    .sort(
      (a, b) =>
        (viewById.get(b.category)?.weight ?? 0) -
        (viewById.get(a.category)?.weight ?? 0),
    )
    .slice(0, topN);

  let recommendations = report.recommendations ?? [];
  if (opts.priority) {
    recommendations = recommendations.filter(
      (r) => r.priority === opts.priority,
    );
  }

  const vitals = report.readinessVitals ?? {
    commerce: 0,
    content: 0,
    botAccessibility: 0,
    technical: 0,
  };

  return {
    url: report.url,
    domain: report.domain,
    overallScore: report.overallScore,
    scoreTier: report.scoreTier,
    summary: report.summary ?? "",
    ...(report.scanValidity?.unscoredReason
      ? { unscoredReason: report.scanValidity.unscoredReason }
      : {}),
    vitals,
    readinessScore: report.readinessScore ?? report.overallScore ?? 0,
    groups,
    categories: categoryViews,
    topFixes,
    topPasses,
    recommendations,
    coverage,
    pagesScanned: report.pagesScanned ?? [],
    pageScope: buildPageScope(report, allChecks),
    durationMs: report.durationMs ?? 0,
    wafProtection: report.wafProtection,
    conditions: report.conditions,
  };
}
