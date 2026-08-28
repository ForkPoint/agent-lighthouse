import * as fs from 'node:fs';
import * as path from 'node:path';
import { runScan } from '../packages/core/src';
import { createFetcher } from '../packages/core/src/fetcher';
import { parseRobots, groupsForBot, isBlanketBlocked } from '../packages/core/src/gatherers/robots';
import { defaultConfig } from '../packages/core/src/audit-config';
import { CheckResultSchema } from '../packages/core/src/schemas';
import { gatedMassShare, GATED_MASS_UNSCORED_THRESHOLD } from '../packages/core/src/scorer';
import { SCANNER_USER_AGENT, TAG_SCAN_ERROR } from '../packages/core/src/constants';
import type { SiteEntry } from '../packages/core/src/tests/site-list';
import type { CheckResult, ScanReport } from '../packages/core/src/types';

/**
 * Scan the site list and assert what a scan may claim.
 *
 * There is no ground truth for hundreds of third-party sites, so this cannot
 * assert verdicts. It asserts invariants: nothing threw, nothing congratulated
 * a site the scan never read, and the score was suppressed exactly when the
 * report's own evidence says it had to be.
 *
 * The concurrency and delay defaults are deliberately low. Most storefronts
 * sit behind Cloudflare, whose rate limit is scoped to the source IP: a run at
 * higher settings had 36 of 48 stores answer HTTP 429 while a single `curl`
 * carrying the same user-agent got 200 from every one of them. It was
 * measuring its own throttling.
 *
 * These are not our sites. The scanner itself ignores `robots.txt` — a site
 * owner scanning their own site is entitled to — but this job is an uninvited
 * visitor, so it reads `robots.txt` first and leaves a site alone when the
 * file tells it to.
 */

/** The `robots.txt` product token for {@link SCANNER_USER_AGENT}. */
const BOT_TOKEN = SCANNER_USER_AGENT.split('/')[0]!.toLowerCase();

/**
 * Why a site produced no scan. Kept apart from a violation: a site we chose
 * not to scan, or one that never answered its own `robots.txt`, says nothing
 * about the scanner.
 */
type SkipReason = 'robots-disallow';

interface SiteOutcome {
  domain: string;
  category: string;
  /** Absent when the site was skipped. */
  score?: number | null;
  skipped?: SkipReason;
  unscoredReason?: string;
  statusCounts: Record<string, number>;
  violations: string[];
  durationMs: number;
}

function numericFlag(name: string, fallback: number): number {
  const arg = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  const value = arg ? Number(arg.slice(name.length + 3)) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const LIMIT = numericFlag('limit', 500);
const CONCURRENCY = numericFlag('concurrency', 2);
const DELAY_MS = numericFlag('delay', 3000);

const SITES_PATH = path.resolve(__dirname, '../packages/core/test-data/sites/sites.json');
const OUT_PATH = path.resolve(__dirname, '../reports/corpus-nightly.json');

/**
 * Audits whose verdict depends on a page having served readable text, read
 * from the registry rather than listed here. The shell rule below is narrowed
 * to exactly these, and an audit that changes its `requires` moves with it.
 */
const READS_RENDERED_BODY = new Set(
  Object.values(defaultConfig.audits)
    .flat()
    .filter((r) => (r.meta.requires ?? []).includes('rendered-body'))
    .map((r) => r.meta.id),
);

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Whether `robots.txt` lets this job scan the site at all.
 *
 * Only a blanket disallow stops the run. A file that forbids one path is a
 * request about that path, and the scanner does not choose its own page
 * sample from the parts of a site an operator fences off; a `Disallow: /` is
 * the operator saying the whole origin is closed to us.
 *
 * A robots.txt that cannot be fetched is not consent withheld — most origins
 * simply have no file — so an error or a non-200 lets the scan proceed.
 */
async function robotsAllows(domain: string): Promise<boolean> {
  const result = await createFetcher().fetch({ url: `https://${domain}/robots.txt` });
  if (result.error || result.status !== 200 || !result.body) return true;
  return !isBlanketBlocked(groupsForBot(parseRobots(result.body), BOT_TOKEN), BOT_TOKEN);
}

/**
 * Everything a report must be true about itself, whatever site it describes.
 *
 * Each rule is stated over the report's own `scanValidity`, so it holds for a
 * site nobody has ground truth for. The two evidence rules are deliberately
 * different claims, and merging them produces false failures: nothing-obtained
 * forbids `pass` for every audit, while a shell forbids `pass` only for the
 * audits that declare `rendered-body`, because on a shell the root files
 * really were fetched and a robots-based audit passing is correct.
 */
function invariantViolations(report: ScanReport, checks: CheckResult[]): string[] {
  const violations: string[] = [];
  const validity = report.scanValidity;
  if (!validity) return ['the report carried no scanValidity'];

  // An audit that throws is caught by the runner and replaced with a stub, so
  // a scan that ran a broken audit still resolves. The tag is the only place
  // the failure survives; without this rule "nothing threw" is vacuous.
  const errored = checks.filter((c) => c.tags?.includes(TAG_SCAN_ERROR));
  if (errored.length > 0) {
    violations.push(`${errored.length} audit(s) threw, e.g. ${errored[0]!.id}`);
  }

  const invalid = checks.filter((c) => !CheckResultSchema.safeParse(c).success);
  if (invalid.length > 0) {
    violations.push(`${invalid.length} check(s) rejected by CheckResultSchema, e.g. ${invalid[0]!.id}`);
  }

  const passes = checks.filter((c) => c.status === 'pass');

  // Nothing obtained: the scan holds no response it can attribute to this
  // site, so no audit may congratulate it.
  if (validity.evidence['origin-reachable'] === false && passes.length > 0) {
    violations.push(
      `origin unreachable but ${passes.length} check(s) passed, e.g. ${passes[0]!.id}`,
    );
  }

  // A shell: pages arrived and carried no readable text. Only the audits that
  // said they need that text are held to it.
  if (validity.evidence['origin-reachable'] === true && validity.evidence['rendered-body'] === false) {
    const blind = passes.filter((c) => READS_RENDERED_BODY.has(c.id));
    if (blind.length > 0) {
      violations.push(
        `no page rendered text but ${blind.length} body-reading check(s) passed, e.g. ${blind[0]!.id}`,
      );
    }
  }

  // `judgeable` is defined as the first two evidence keys. A report whose flag
  // disagrees with its own evidence map is unreadable either way round.
  const expectedJudgeable =
    validity.evidence['origin-reachable'] === true && validity.evidence['unblocked-fetches'] === true;
  if (validity.judgeable !== expectedJudgeable) {
    violations.push(`judgeable is ${validity.judgeable} but the evidence says ${expectedJudgeable}`);
  }

  // The converse of the two rules above, recomputed from the checks the report
  // actually carries: a score is withheld exactly when the site was unjudgeable
  // or the gate stripped more evidence mass than a reading can survive.
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

  // The three null-carrying fields move together or the report contradicts
  // itself: a tier without a score, or a reason without a suppression.
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

async function scanOne(site: SiteEntry): Promise<SiteOutcome> {
  const started = Date.now();
  const base: SiteOutcome = {
    domain: site.domain,
    category: site.category,
    statusCounts: {},
    violations: [],
    durationMs: 0,
  };

  try {
    if (!(await robotsAllows(site.domain))) {
      base.skipped = 'robots-disallow';
      base.durationMs = Date.now() - started;
      return base;
    }

    const report = await runScan(`https://${site.domain}`);
    const checks = report.categories.flatMap((c) => c.checks);

    for (const check of checks) {
      base.statusCounts[check.status] = (base.statusCounts[check.status] ?? 0) + 1;
    }
    base.score = report.overallScore;
    base.unscoredReason = report.scanValidity?.unscoredReason;
    base.violations = invariantViolations(report, checks);
  } catch (err) {
    // `runScan` rejecting is itself the finding: every audit failure is caught
    // and stubbed inside it, so a rejection means the orchestrator broke.
    base.violations.push(`threw: ${String(err).slice(0, 200)}`);
  }

  base.durationMs = Date.now() - started;
  return base;
}

async function main(): Promise<void> {
  const all: SiteEntry[] = JSON.parse(fs.readFileSync(SITES_PATH, 'utf8'));
  const sites = all.slice(0, LIMIT);
  const queue = [...sites];
  const outcomes: SiteOutcome[] = [];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const site = queue.shift();
      if (!site) break;
      const outcome = await scanOne(site);
      outcomes.push(outcome);
      const verdict = outcome.violations.length
        ? 'VIOLATION'
        : (outcome.skipped ?? `score ${outcome.score}`);
      console.log(`[${outcomes.length}/${sites.length}] ${site.domain}: ${verdict}`);
      if (queue.length > 0) await pause(DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // A summary, not the reports: the Free plan allows 500 MB of artifact
  // storage and 500 full scan reports overrun it.
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(outcomes, null, 2)}\n`);

  const broken = outcomes.filter((o) => o.violations.length > 0);
  const skipped = outcomes.filter((o) => o.skipped).length;
  console.log(
    `\n${outcomes.length} sites, ${skipped} skipped by robots.txt, ` +
      `${broken.length} with violations`,
  );
  for (const outcome of broken.slice(0, 10)) {
    console.log(`  ${outcome.domain}: ${outcome.violations.join('; ')}`);
  }
  if (broken.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
