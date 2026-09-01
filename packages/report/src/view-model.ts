import type {
  CategoryResult,
  CheckRecommendation,
  CheckResult,
  ReadinessVitals,
  ScanReport,
  ScoreTier,
} from "@forkpoint/agent-lighthouse-core";
import { isInformative } from "@forkpoint/agent-lighthouse-core";
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
  /** 0–100 */
  score: number;
  weight: number;
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
  /** Weighted roll-up score of the group's categories (0–100). */
  score: number;
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
  pagesScanned: Array<{ url: string; pageType: string }>;
  durationMs: number;
  wafProtection?: import("@forkpoint/agent-lighthouse-core").WafProtection;
}

export interface BuildReportViewOptions {
  /** Limit for topFixes / topPasses (default 10). */
  topN?: number;
  /** Filter all checks to a single priority (used by the MCP tool). */
  priority?: "critical" | "high" | "medium" | "low";
}

// ── Derivation ──────────────────────────────────────────────────

function countChecks(checks: CheckResult[]): CheckCounts {
  const pass = checks.filter((c) => c.status === "pass").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  const fail = checks.filter((c) => c.status === "fail").length;
  const na = checks.filter((c) => c.status === "na").length;
  // Tier is not a status: an advisory check passes or fails like any other, it
  // just never moves a score. Counting it separately is what stops a deliberate
  // advisory from reading as a defect.
  const advisory = checks.filter(
    (c) => c.status !== "na" && c.tier !== undefined && c.tier !== "scored",
  ).length;
  return { pass, warn, fail, na, advisory, total: pass + warn + fail };
}

function toCategoryView(cat: CategoryResult): CategoryView {
  const assessed = cat.checks.filter((c) => c.status !== "na");
  const notApplicable = cat.checks.filter((c) => c.status === "na");
  return {
    id: cat.id,
    name: cat.name,
    score: cat.score,
    weight: cat.weight,
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

  // Categories in canonical order; include only those present in the report.
  const categoryViews: CategoryView[] = CATEGORY_ORDER.map((id) => byId.get(id))
    .filter((c): c is CategoryResult => c !== undefined)
    .map(toCategoryView);

  const viewById = new Map(categoryViews.map((c) => [c.id, c] as const));

  const groups: GroupView[] = SECTION_GROUPS.map((def) => {
    const cats = def.categoryIds
      .map((id) => viewById.get(id))
      .filter((c): c is CategoryView => c !== undefined);
    let weighted = 0;
    let weightSum = 0;
    for (const c of cats) {
      weighted += c.score * c.weight;
      weightSum += c.weight;
    }
    return {
      key: def.key,
      label: SECTION_GROUP_LABELS[def.key] ?? def.key,
      score: weightSum > 0 ? Math.round(weighted / weightSum) : 0,
      categories: cats,
    };
  }).filter((g) => g.categories.length > 0);

  // Coverage — bucket every check, attributing na checks by their tag.
  const allChecks = categories.flatMap((c) => c.checks);
  const naChecks = allChecks.filter((c) => c.status === "na");
  const erroredChecks = naChecks.filter((c) => hasTag(c, TAG_SCAN_ERROR));
  const skippedChecks = naChecks.filter((c) =>
    hasTag(c, TAG_SKIPPED_PAGE_TYPE),
  );
  const gatedChecks = naChecks.filter((c) =>
    hasTag(c, TAG_SKIPPED_NO_EVIDENCE),
  );
  const coverage: CoverageView = {
    ran: allChecks.filter((c) => c.status !== "na").length,
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
      (c) => (c.status === "fail" || c.status === "warn") && !isInformative(c),
    )
    .slice()
    .sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3))
    .slice(0, topN);

  // Top passes: highest category-weight passing checks.
  const topPasses = allChecks
    .filter((c) => c.status === "pass" && !isInformative(c))
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
    durationMs: report.durationMs ?? 0,
    wafProtection: report.wafProtection,
  };
}
