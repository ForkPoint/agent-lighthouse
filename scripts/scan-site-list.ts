import * as fs from 'node:fs';
import * as path from 'node:path';
import { runScan } from '../packages/core/src';
import { boundedDispatcher, createFetcher } from '../packages/core/src/fetcher';
import { parseRobots, groupsForBot, isBlanketBlocked } from '../packages/core/src/gatherers/robots';
import { SCANNER_USER_AGENT } from '../packages/core/src/constants';
import { invariantViolations } from '../packages/core/src/tests/scan-invariants';
import type { SiteEntry } from '../packages/core/src/tests/site-list';
import type { EvidenceKey } from '../packages/core/src/types';

/**
 * Scan a window of the site list and assert what a scan may claim.
 *
 * There is no ground truth for hundreds of third-party sites, so this cannot
 * assert verdicts. It asserts invariants, and the rules themselves live in
 * `packages/core/src/tests/scan-invariants.ts` so they can be unit-tested —
 * this file fetches, and nothing in the test suite may. Two of them are
 * load-bearing and five are tripwires; the module says which is which.
 *
 * The concurrency and delay defaults are deliberately low. Most storefronts sit
 * behind Cloudflare, whose rate limit is scoped to the source IP: a run at
 * higher settings had 36 of 48 stores answer HTTP 429 while a single `curl`
 * carrying the same user-agent got 200 from every one of them. It was measuring
 * its own throttling. Those flags pace the job between sites; `--connections`
 * is what bounds the burst inside one scan, which is what a per-IP WAF counts.
 *
 * These are not our sites. The scanner itself ignores `robots.txt` — a site
 * owner scanning their own site is entitled to — but this job is an uninvited
 * visitor, so it reads `robots.txt` first and leaves a site alone when the file
 * tells it to.
 */

/** The `robots.txt` product token for {@link SCANNER_USER_AGENT}. */
const BOT_TOKEN = SCANNER_USER_AGENT.split('/')[0]!.toLowerCase();

/**
 * Why a site produced no scan. Kept apart from a violation: a site we chose not
 * to scan says nothing about the scanner.
 */
type SkipReason = 'robots-disallow' | 'robots-refused' | 'crawl-delay';

interface SiteOutcome {
  domain: string;
  category: string;
  /** Present instead of a scan when the site was left alone. */
  skipped?: SkipReason;
  /**
   * The report's own evidence map. What the invariants are stated over, and the
   * only thing about the site the summary records beyond its status counts —
   * no score. A dated score for a domain that never asked to be scanned is not
   * this job's to publish.
   */
  evidence?: Record<EvidenceKey, boolean>;
  unscoredReason?: string;
  statusCounts: Record<string, number>;
  violations: string[];
  durationMs: number;
}

interface Summary {
  startedAt: string;
  /** False when the deadline, a signal or a crash ended the run early. */
  complete: boolean;
  windowOffset: number;
  planned: number;
  scanned: number;
  skipped: number;
  /** Sites in the window the run never got to. Non-zero means it ran out of time. */
  unreached: number;
  violations: number;
  outcomes: SiteOutcome[];
}

// ── Flags ──────────────────────────────────────────────────────

/**
 * Every flag, with its default. Unknown or malformed arguments abort: an
 * operator who typed `--limits=10` or `--limit 10` meant to scan ten sites, and
 * silently falling back to the default would send them at 500 live origins for
 * four hours.
 */
const DEFAULTS = {
  limit: 500,
  concurrency: 2,
  delay: 3000,
  connections: 2,
  'deadline-minutes': 240,
  /** Where the window starts. Defaults to the date-seeded offset below. */
  offset: Number.NaN,
} as const;

type FlagName = keyof typeof DEFAULTS;

function die(message: string): never {
  console.error(`[scan-site-list] ${message}`);
  process.exit(2);
}

function parseFlags(argv: string[]): Record<FlagName, number> {
  const values: Record<string, number> = { ...DEFAULTS };
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!match) {
      die(`unrecognised argument "${arg}". Every flag is --name=value.`);
    }
    const name = match[1]!;
    const raw = match[2]!;
    if (!Object.hasOwn(DEFAULTS, name)) {
      die(`unknown flag --${name}. Known flags: ${Object.keys(DEFAULTS).join(', ')}.`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      die(`--${name} needs a non-negative number, got "${raw}".`);
    }
    values[name] = value;
  }
  return values as Record<FlagName, number>;
}

const FLAGS = parseFlags(process.argv.slice(2));

const LIMIT = Math.floor(FLAGS.limit);
// One worker minimum. `Array.from({ length: 0 })` builds no workers, resolves
// immediately and writes an empty summary that looks exactly like a clean run.
const CONCURRENCY = Math.max(1, Math.floor(FLAGS.concurrency));
const DELAY_MS = FLAGS.delay;
const CONNECTIONS = Math.max(1, Math.floor(FLAGS.connections));
const DEADLINE_MS = FLAGS['deadline-minutes'] * 60_000;

const SITES_PATH = path.resolve(__dirname, '../packages/core/test-data/sites/sites.json');
const OUT_PATH = path.resolve(__dirname, '../reports/corpus-nightly.json');

/** How often the summary is rewritten mid-run. See {@link writeSummary}. */
const FLUSH_EVERY = 10;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One bounded dispatcher for the whole run.
 *
 * The scanner issues its ~28 root-file requests in one `Promise.all`, then up
 * to five pages in parallel, and undici's default agent puts no ceiling on
 * per-origin connections — so an unbounded run hands every origin a 28-socket
 * burst, which is what a per-IP WAF counts before it starts answering 429.
 * `--concurrency` and `--delay` pace the job between sites and do nothing about
 * this. The library keeps its unbounded default for a site owner scanning their
 * own site; this job opts out.
 */
const dispatcher = boundedDispatcher(CONNECTIONS);

// ── The site window ────────────────────────────────────────────

/** Day of the year, UTC, so a run on the same date picks the same window. */
function dayOfYear(now: Date): number {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const yearStart = Date.UTC(now.getUTCFullYear(), 0, 1);
  return Math.floor((midnight - yearStart) / 86_400_000);
}

/**
 * `size` entries starting at `offset`, wrapping past the end of the list.
 *
 * The list is sorted by domain, so a fixed `slice(0, 500)` scans the same
 * numeric-prefixed head every night and never visits the other 1413 entries.
 * A date-seeded offset covers the whole list in about four nights at identical
 * politeness, and `--offset=` makes a dispatch run reproducible.
 */
function windowOf<T>(all: T[], size: number, offset: number): T[] {
  if (all.length === 0 || size === 0) return [];
  if (size >= all.length) return [...all];
  const start = ((offset % all.length) + all.length) % all.length;
  const head = all.slice(start, start + size);
  return head.length === size ? head : [...head, ...all.slice(0, size - head.length)];
}

// ── robots.txt ─────────────────────────────────────────────────

type RobotsVerdict = { scan: true } | { scan: false; reason: SkipReason };

/**
 * Whether `robots.txt` lets this job scan the site at all.
 *
 * Only a blanket disallow stops the run on rules. A file that forbids one path
 * is a request about that path, and the scanner does not choose its page sample
 * from the parts of a site an operator fences off; a `Disallow: /` is the
 * operator saying the whole origin is closed to us.
 *
 * A `Crawl-delay` also stops it. The directive asks for a request rate, and
 * nothing outside `runScan` can space out the ~40 requests it issues — so the
 * only honest answer to an operator who asked for a rate is to leave the site
 * alone rather than to read the line and ignore it.
 *
 * 401, 403 and 429 on `robots.txt` are refusals, not silence: the origin is
 * turning away this exact user agent, and following that with ~40 more requests
 * is the behaviour a WAF exists to stop. Every other failure — 404, 5xx, a
 * connection error — lets the scan proceed. Most origins simply have no file,
 * and absence is not consent withheld.
 */
async function robotsVerdict(domain: string): Promise<RobotsVerdict> {
  const result = await createFetcher({ dispatcher }).fetch({
    url: `https://${domain}/robots.txt`,
  });
  if (result.status === 401 || result.status === 403 || result.status === 429) {
    return { scan: false, reason: 'robots-refused' };
  }
  if (result.error || result.status !== 200 || !result.body) return { scan: true };

  const groups = groupsForBot(parseRobots(result.body), BOT_TOKEN);
  if (isBlanketBlocked(groups, BOT_TOKEN)) return { scan: false, reason: 'robots-disallow' };
  if (groups.some((g) => (g.crawlDelay ?? 0) > 0)) return { scan: false, reason: 'crawl-delay' };
  return { scan: true };
}

// ── Scanning one site ──────────────────────────────────────────

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
    const verdict = await robotsVerdict(site.domain);
    if (!verdict.scan) {
      base.skipped = verdict.reason;
      base.durationMs = Date.now() - started;
      return base;
    }

    const report = await runScan(`https://${site.domain}`, { dispatcher });
    const checks = report.categories.flatMap((c) => c.checks);

    for (const check of checks) {
      base.statusCounts[check.status] = (base.statusCounts[check.status] ?? 0) + 1;
    }
    base.evidence = report.scanValidity?.evidence;
    base.unscoredReason = report.scanValidity?.unscoredReason;
    base.violations = invariantViolations(report, checks);
  } catch (err) {
    // Rule 8, and the one rule that is not a property of a report: `runScan`
    // rejecting is itself the finding, because every audit failure is caught and
    // stubbed inside it, so a rejection means the orchestrator broke.
    base.violations.push(`threw: ${String(err).slice(0, 200)}`);
  }

  base.durationMs = Date.now() - started;
  return base;
}

// ── The run ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const all: SiteEntry[] = JSON.parse(fs.readFileSync(SITES_PATH, 'utf8'));
  const offset = Number.isFinite(FLAGS.offset)
    ? Math.floor(FLAGS.offset)
    : dayOfYear(new Date()) * LIMIT;
  const planned = windowOf(all, LIMIT, offset);
  // Where the window actually starts, for the summary and the closing line.
  const windowStart = all.length === 0 ? 0 : ((offset % all.length) + all.length) % all.length;

  const startedAt = new Date();
  const startedMs = Date.now();
  const queue = [...planned];
  const outcomes: SiteOutcome[] = [];
  let complete = false;

  /**
   * Write what the run has so far.
   *
   * Called every {@link FLUSH_EVERY} sites and again on the way out, because
   * the failure this job is most likely to hit is the one that leaves no
   * artifact: a worker holding site 380 when GitHub cancels the step at the
   * job timeout, after which there is nothing to read but the fetcher log.
   * A summary, not the reports — the Free plan allows 500 MB of artifact
   * storage and 500 full scan reports overrun it.
   */
  function writeSummary(): void {
    const summary: Summary = {
      startedAt: startedAt.toISOString(),
      complete,
      windowOffset: windowStart,
      planned: planned.length,
      scanned: outcomes.filter((o) => !o.skipped).length,
      skipped: outcomes.filter((o) => o.skipped).length,
      unreached: planned.length - outcomes.length,
      violations: outcomes.filter((o) => o.violations.length > 0).length,
      outcomes,
    };
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  }

  // A cancelled step gets a signal, not an exception, so `finally` never runs.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      console.error(`\n[scan-site-list] ${signal} after ${outcomes.length} sites; flushing summary`);
      writeSummary();
      process.exit(1);
    });
  }

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      // Stop pulling new sites well before the job timeout. Crossing it means a
      // cancelled step, and a cancelled step is the one outcome with nothing to
      // read afterwards.
      if (Date.now() - startedMs >= DEADLINE_MS) return;
      const site = queue.shift();
      if (!site) return;
      const outcome = await scanOne(site);
      outcomes.push(outcome);
      // Deliberately no score, here or in the summary.
      const verdict = outcome.violations.length ? 'VIOLATION' : (outcome.skipped ?? 'ok');
      console.log(`[${outcomes.length}/${planned.length}] ${site.domain}: ${verdict}`);
      if (outcomes.length % FLUSH_EVERY === 0) writeSummary();
      if (queue.length > 0) await pause(DELAY_MS);
    }
  }

  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    complete = queue.length === 0;
  } finally {
    writeSummary();
    await dispatcher.close();
  }

  const broken = outcomes.filter((o) => o.violations.length > 0);
  const skipped = outcomes.filter((o) => o.skipped).length;
  const unreached = planned.length - outcomes.length;

  console.log(
    `\nwindow ${windowStart}..+${planned.length} of ${all.length}: ` +
      `${outcomes.length - skipped} scanned, ${skipped} skipped by robots.txt, ` +
      `${unreached} not reached, ${broken.length} with violations`,
  );
  for (const outcome of broken.slice(0, 10)) {
    console.log(`  ${outcome.domain}: ${outcome.violations.join('; ')}`);
  }

  if (LIMIT === 0) {
    console.log(
      '\nNO SITES WERE SCANNED: --limit=0 is the wiring smoke test, not a run. ' +
        'It reads the list, builds the window and writes an empty summary.',
    );
    return;
  }
  // A run that produced nothing on a non-empty window is a failure however it
  // exited: an empty summary is indistinguishable from a clean one.
  if (planned.length > 0 && outcomes.length === 0) {
    console.error('\nno site produced an outcome — the run scanned nothing');
    process.exit(1);
  }
  if (unreached > 0) {
    console.error(`\nran out of time with ${unreached} of ${planned.length} sites unscanned`);
    process.exit(1);
  }
  if (broken.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
