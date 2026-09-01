import type {
  CheckResult,
  CategoryResult,
  EvidenceGrade,
  AuditTier,
} from "./types";
import {
  CATEGORY_NAMES,
  getScoreTier,
  TAG_SKIPPED_NO_EVIDENCE,
} from "./constants";

/**
 * Spec §4 weight law: an audit's scoring weight is a pure function of its
 * evidence grade and tier. Only the `scored` tier carries weight, and only
 * grades A and B are proven enough to move a score.
 */
export function weightForGrade(grade: EvidenceGrade, tier: AuditTier): number {
  if (tier !== "scored") return 0;
  return grade === "A" ? 1.0 : grade === "B" ? 0.6 : 0;
}

/**
 * Single source of truth for "this check is advisory only".
 *
 * Informative checks (deprecated audits / no proven consumer) are still shown
 * to the user, but they must never influence scores, recommendations, top
 * fails/passes or readiness vitals. Every surface that ranks or scores checks
 * filters through this predicate so the rule cannot drift per package.
 */
export function isInformative(
  check: Pick<CheckResult, "scoreDisplayMode">,
): boolean {
  return check.scoreDisplayMode === "informative";
}

export function calculateCategoryScore(checks: CheckResult[]): number {
  // Not-applicable checks leave the denominator entirely: "nothing to
  // assess" must not move a score in either direction. Informative checks
  // are advisory only — excluded even if one ever carried a nonzero weight.
  const scored = checks.filter((c) => c.status !== "na" && !isInformative(c));
  const totalWeight = scored.reduce((sum, c) => sum + (c.weight ?? 0), 0);
  if (totalWeight === 0) return 0;
  const weighted = scored.reduce(
    (sum, c) => sum + c.score * (c.weight ?? 0),
    0,
  );
  return Math.round((weighted / totalWeight) * 100);
}

/**
 * Assemble a category result.
 *
 * `mass` is the category's evidence mass — the summed weight of its registered
 * audits (`CATEGORY_MASS` in audit-config). It is passed in rather than looked
 * up so this module stays free of a dependency on the registry, which the
 * audits themselves import (for `weightForGrade`).
 */
export function buildCategoryResult(
  id: string,
  checks: CheckResult[],
  mass = 0,
): CategoryResult {
  const assessedMass = checks
    .filter((c) => c.status !== "na" && !isInformative(c))
    .reduce((sum, c) => sum + (c.weight ?? 0), 0);

  return {
    id,
    name: CATEGORY_NAMES[id] ?? id,
    weight: mass,
    registryMass: mass,
    assessedMass,
    score: calculateCategoryScore(checks),
    checks,
    passCount: checks.filter((c) => c.status === "pass").length,
    warnCount: checks.filter((c) => c.status === "warn").length,
    failCount: checks.filter((c) => c.status === "fail").length,
  };
}

/**
 * Overall score = mean of category scores weighted by **evidence mass**
 * (spec §4): `Σ(categoryScore · mass) / Σ(mass)`.
 *
 * No hand-tuned category percentages: `CategoryResult.weight` carries the
 * category's evidence mass, so influence follows proven audits. A category
 * with no mass (only informative/experimental audits) drops out of both sums
 * and cannot move the result; with no mass anywhere there is nothing to score,
 * which reads as 0 — the same "no data" value every other surface uses.
 *
 * A category whose every check came back notApplicable drops out too. That is
 * the rule `calculateCategoryScore` already applies to a single na check,
 * lifted one level: without it a site with no commerce surface paid the whole
 * agentic-commerce evidence mass at score 0, which reads as a penalty for not
 * being a shop.
 */
function hasAssessableCheck(cat: CategoryResult): boolean {
  // A category that reported no checks at all is left alone — callers build
  // those from a mass and a score directly, with no check list to inspect.
  if (cat.checks.length === 0) return true;
  return cat.checks.some((c) => c.status !== "na" && !isInformative(c));
}

export function calculateOverallScore(categories: CategoryResult[]): number {
  let weighted = 0;
  let totalMass = 0;
  for (const cat of categories) {
    const mass = cat.assessedMass ?? cat.weight ?? 0;
    if (mass <= 0) continue;
    if (!hasAssessableCheck(cat)) continue;
    weighted += cat.score * mass;
    totalMass += mass;
  }
  if (totalMass === 0) return 0;
  return Math.round(weighted / totalMass);
}

/**
 * The share of the registry's evidence mass the gate may remove before a scan
 * stops being scorable at all.
 *
 * Set from the calibration run (design §8.3.1), not guessed. Gating a category
 * drops its mass out of the denominator, which *raises* the score of a site
 * nobody could read — measured at +5 to +12, with a shell reaching 74 against
 * a real store's 51. Past this share the honest output is no number.
 *
 * Measured over 24 stores: every storefront that served readable pages gated
 * 0.000 of the mass, and the four shells and walls gated 0.616 to 0.691. No
 * store fell in between, so this number sits in the middle of a 62-point gap
 * and any value in (0.00, 0.61) would produce the same verdicts on that corpus.
 */
export const GATED_MASS_UNSCORED_THRESHOLD = 0.35;

/**
 * How much of the registry's evidence mass the gate removed.
 *
 * Only checks the gate itself removed count. A page-type skip is a legitimate
 * absence — a site with no blog and no products loses those audits honestly —
 * and counting that mass would mark small, well-built sites unscored.
 */
export function gatedMassShare(checks: CheckResult[]): number {
  let gated = 0;
  let total = 0;
  for (const check of checks) {
    if (isInformative(check)) continue;
    const mass = check.weight ?? 0;
    if (mass <= 0) continue;
    total += mass;
    if (check.tags?.includes(TAG_SKIPPED_NO_EVIDENCE)) gated += mass;
  }
  return total === 0 ? 0 : gated / total;
}

export { getScoreTier };
