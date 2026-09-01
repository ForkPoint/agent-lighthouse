import { defaultConfig } from '../audit-config';
import { TAG_SCAN_ERROR } from '../constants';
import { CheckResultSchema } from '../schemas';
import { gatedMassShare, GATED_MASS_UNSCORED_THRESHOLD } from '../scorer';
import type { CheckResult, ScanReport } from '../types';

/**
 * Everything a scan report must be true about itself, whatever site it describes.
 *
 * The nightly corpus job (`scripts/scan-site-list.ts`) scans hundreds of
 * third-party sites nobody holds ground truth for, so it cannot assert a
 * verdict. It asserts these instead, because they hold for any site.
 *
 * The rules live here, beside the hostile-state contract, rather than in the
 * script, so that they can be unit-tested: the script fetches, and nothing in
 * the test suite may. `scan-invariants.test.ts` proves each rule both fires and
 * stays quiet.
 *
 * Two of the seven rules are load-bearing and five are tripwires:
 *
 * | # | Rule | Kind |
 * | :- | :- | :- |
 * | 1 | no check carries the `scan-error` tag | load-bearing |
 * | 2 | every check parses through `CheckResultSchema` | load-bearing |
 * | 3 | `origin-reachable === false` implies no `pass` | tripwire |
 * | 4 | a shell implies no `pass` from a `rendered-body` audit | tripwire |
 * | 5 | `judgeable` equals its own two evidence keys | tripwire |
 * | 6 | the score is withheld exactly when the gate says so | tripwire |
 * | 7 | score, tier and `unscoredReason` move together | tripwire |
 *
 * A tripwire restates an identity production already computes, so on today's
 * code it can fire only if a refactor breaks that identity. Keeping it is cheap
 * and it does guard the refactor — but a green nightly is not evidence that
 * seven independent properties hold on 500 live sites. It means rule 1 found no
 * audit that threw and rule 2 found no check the schema rejects. Each tripwire
 * below names the production code it mirrors.
 *
 * The script adds one more rule that cannot live here: that `runScan` resolves
 * at all. It is a property of the call, not of a report.
 */

/**
 * Audits whose verdict depends on a page having served readable text, read from
 * the registry rather than listed here, so an audit that changes its `requires`
 * moves with it.
 */
export const READS_RENDERED_BODY = new Set(
  Object.values(defaultConfig.audits)
    .flat()
    .filter((r) => (r.meta.requires ?? []).includes('rendered-body'))
    .map((r) => r.meta.id),
);

/**
 * Every invariant the report breaks, as one line each. Empty means the report
 * is self-consistent — not that the site was judged correctly, which no rule
 * here can know.
 */
export function invariantViolations(report: ScanReport, checks: CheckResult[]): string[] {
  const violations: string[] = [];
  const validity = report.scanValidity;
  if (!validity) return ['the report carried no scanValidity'];

  // Rule 1, load-bearing. An audit that throws is caught by the runner
  // (`audit-runner.ts`) and replaced with a stub, so a scan that ran a broken
  // audit still resolves. The tag is the only place the failure survives;
  // without this rule "nothing threw" is vacuous.
  const errored = checks.filter((c) => c.tags?.includes(TAG_SCAN_ERROR));
  if (errored.length > 0) {
    violations.push(`${errored.length} audit(s) threw, e.g. ${errored[0]!.id}`);
  }

  // Rule 2, load-bearing. The schema is the contract with every consumer, and
  // an audit reaches it only through the runner — a unit test calling
  // `audit.audit(ctx)` never does. A `details` value that is an array of
  // objects passes every unit test and is rejected here.
  const invalid = checks.filter((c) => !CheckResultSchema.safeParse(c).success);
  if (invalid.length > 0) {
    violations.push(
      `${invalid.length} check(s) rejected by CheckResultSchema, e.g. ${invalid[0]!.id}`,
    );
  }

  const passes = checks.filter((c) => c.status === 'pass');

  // Rule 3, tripwire. Nothing obtained: the scan holds no response it can
  // attribute to this site, so no audit may congratulate it. Mirrors
  // `hostile-state-contract.test.ts`, which asserts the same thing per audit on
  // a synthetic state. The runner's unread-scan guard skips all 215 audits to
  // `na` before any audit runs. On a live scan this fires only if that guard
  // regresses or another path constructs an inconsistent report.
  if (validity.evidence['origin-reachable'] === false && passes.length > 0) {
    violations.push(
      `origin unreachable but ${passes.length} check(s) passed, e.g. ${passes[0]!.id}`,
    );
  }

  // Rule 4, tripwire. A shell is not an empty scan: pages arrived and carried
  // no readable text, so the root files really were fetched and a robots-based
  // audit passing here is correct. Only audits declaring `rendered-body` are
  // held to it — the same split, and the same narrowing by `requires`, that
  // `hostile-state-contract.test.ts` makes. Those audits are exactly the ones
  // the evidence gate skips on a shell, so this too fires only if the gate
  // regresses. Merging rules 3 and 4 would produce false failures on every
  // client-rendered site in the list.
  if (
    validity.evidence['origin-reachable'] === true &&
    validity.evidence['rendered-body'] === false
  ) {
    const blind = passes.filter((c) => READS_RENDERED_BODY.has(c.id));
    if (blind.length > 0) {
      violations.push(
        `no page rendered text but ${blind.length} body-reading check(s) passed, e.g. ${blind[0]!.id}`,
      );
    }
  }

  // Rule 5, tripwire. Mirrors `judgeable: met['origin-reachable'] &&
  // met['unblocked-fetches']` in `scan-evidence.ts`, which the orchestrator
  // copies into `scanValidity` beside the evidence map it was computed from.
  // A report whose flag disagrees with its own evidence is unreadable either
  // way round.
  const expectedJudgeable =
    validity.evidence['origin-reachable'] === true &&
    validity.evidence['unblocked-fetches'] === true;
  if (validity.judgeable !== expectedJudgeable) {
    violations.push(
      `judgeable is ${validity.judgeable} but the evidence says ${expectedJudgeable}`,
    );
  }

  // Rule 6, tripwire. Mirrors the `escalated` / `unscoredReason` computation in
  // `orchestrator.ts`, recomputed from the checks the report actually carries
  // rather than from the orchestrator's own `allChecks`. Because both call
  // `gatedMassShare` against the same threshold, the only disagreement it can
  // catch is a report whose categories no longer hold the checks that were
  // scored.
  const gatedShare = gatedMassShare(checks);
  const mustBeUnscored = !validity.judgeable || gatedShare > GATED_MASS_UNSCORED_THRESHOLD;
  if (mustBeUnscored && report.overallScore !== null) {
    violations.push(
      `scored ${report.overallScore} on a scan that must be unscored ` +
        `(judgeable ${validity.judgeable}, ${Math.round(gatedShare * 100)}% of mass gated)`,
    );
  }
  if (!mustBeUnscored && report.overallScore === null) {
    violations.push(
      `withheld a score from a judgeable scan with only ${Math.round(gatedShare * 100)}% of mass gated`,
    );
  }

  // Rule 7, tripwire. Mirrors the three `scored ? … : null` ternaries in
  // `orchestrator.ts`. The three null-carrying fields move together or the
  // report contradicts itself: a tier without a score, or a reason without a
  // suppression.
  if ((report.overallScore === null) !== (report.scoreTier === null)) {
    violations.push(`score ${report.overallScore} but tier ${report.scoreTier}`);
  }
  if ((report.overallScore === null) !== (validity.unscoredReason !== undefined)) {
    violations.push(
      `score ${report.overallScore} but unscoredReason ${validity.unscoredReason ? 'set' : 'absent'}`,
    );
  }

  return violations;
}
