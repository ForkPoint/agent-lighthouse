#!/usr/bin/env node
/**
 * test-live-sites — Standalone test runner for live site scanning.
 *
 * Scans an arbitrary slice of real-world domains from packages/core/test-data/sites/sites.json
 * (or user-specified domains), verifies all scan invariants, and outputs a formatted report.
 *
 * Usage:
 *   pnpm test:live
 *   pnpm test:live --limit=10 --concurrency=3
 *   pnpm test:live --category=storefront --limit=5
 *   pnpm test:live --domain=lobste.rs
 *   pnpm test:live --domains=theguardian.com,stripe.com,bbc.com
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { runScan } from "../packages/core/src";
import { boundedDispatcher, createFetcher } from "../packages/core/src/fetcher";
import {
  parseRobots,
  groupsForBot,
  isBlanketBlocked,
} from "../packages/core/src/gatherers/robots";
import { SCANNER_USER_AGENT } from "../packages/core/src/constants";
import { AI_CRAWLER_UAS } from "../packages/core/src/gatherers/ua-parity";
import { invariantViolations } from "../packages/core/src/tests/scan-invariants";
import type { SiteEntry } from "../packages/core/src/tests/site-list";
import type { FetchResult } from "../packages/core/src/fetcher";
import type { EvidenceKey } from "../packages/core/src/types";
import {
  excludedDomains,
  type CorpusStatus,
} from "../packages/core/src/tests/corpus-status";

const SITES_PATH = path.resolve(
  process.cwd(),
  "packages/core/test-data/sites/sites.json",
);

const BOT_TOKEN = SCANNER_USER_AGENT.split("/")[0]!.toLowerCase();
const PROBED_TOKENS: readonly string[] = [
  BOT_TOKEN,
  ...AI_CRAWLER_UAS.map((u) => u.token),
];

interface CliOptions {
  limit: number;
  offset: number;
  concurrency: number;
  delayMs: number;
  category?: string;
  domains?: string[];
  outPath: string;
  verbose: boolean;
  help: boolean;
  ignoreRobots: boolean;
  stratified: boolean;
  shuffle: boolean;
  loop: number;
  tier?: "smoke";
  includeDead: boolean;
  includeBlocked: boolean;
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    limit: 5,
    offset: 0,
    concurrency: 2,
    delayMs: 1000,
    outPath: path.resolve(process.cwd(), "reports/live-sites-test.json"),
    verbose: false,
    help: false,
    ignoreRobots: false,
    stratified: false,
    shuffle: false,
    loop: 1,
    includeDead: false,
    includeBlocked: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
      continue;
    }
    if (arg === "--ignore-robots") {
      options.ignoreRobots = true;
      continue;
    }
    if (arg === "--stratified" || arg === "-s") {
      options.stratified = true;
      continue;
    }
    if (arg === "--shuffle" || arg === "--random" || arg === "-r") {
      options.shuffle = true;
      continue;
    }
    if (arg === "--include-dead") {
      options.includeDead = true;
      continue;
    }
    if (arg === "--include-blocked") {
      options.includeBlocked = true;
      continue;
    }
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!match) continue;
    const [, name, val] = match;
    switch (name) {
      case "limit":
        options.limit = Math.max(0, parseInt(val, 10) || 0);
        break;
      case "offset":
        options.offset = Math.max(0, parseInt(val, 10) || 0);
        break;
      case "concurrency":
        options.concurrency = Math.max(1, parseInt(val, 10) || 1);
        break;
      case "delay":
        options.delayMs = Math.max(0, parseInt(val, 10) || 0);
        break;
      case "loop":
        options.loop = Math.max(1, parseInt(val, 10) || 1);
        break;
      case "category":
        options.category = val.trim().toLowerCase();
        break;
      case "domain":
        options.domains = [
          val
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, ""),
        ];
        break;
      case "domains":
        options.domains = val
          .split(",")
          .map((d) =>
            d
              .trim()
              .toLowerCase()
              .replace(/^https?:\/\//, ""),
          )
          .filter(Boolean);
        break;
      case "out":
        options.outPath = path.resolve(process.cwd(), val.trim());
        break;
      case "tier":
        if (val.trim().toLowerCase() !== "smoke") {
          console.error(`--tier accepts "smoke", got "${val}"`);
          process.exit(2);
        }
        options.tier = "smoke";
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Agent Lighthouse - Live Sites Scan Test Runner

Usage:
  pnpm test:live [options]

Options:
  --limit=<n>         Number of sites to scan (default: 5)
  --offset=<n>        Starting index in the sites list (default: 0)
  --concurrency=<n>   Concurrent site scans (default: 2)
  --delay=<ms>        Delay in milliseconds between requests (default: 1000)
  --category=<name>   Filter by category (e.g. storefront, saas, news, docs, etc.)
  --domain=<domain>   Test a single domain (e.g. --domain=lobste.rs)
  --domains=<list>    Test comma-separated domains (e.g. --domains=stripe.com,bbc.com)
  --stratified, -s    Sample evenly across all available site categories
  --tier=smoke        Only the smoke tier: two seeded sites per category, about five minutes
  --include-dead      Also scan domains status.json calls dead
  --include-blocked   Also scan domains status.json calls blocked (robots)
  --loop=<n>          Repeat the selection n times (default: 1)
  --shuffle, -r       Shuffle the pool before selecting
  --ignore-robots     Proceed with scan even if third-party robots.txt disallows crawlers
  --out=<path>        Output JSON file path (default: reports/live-sites-test.json)
  --verbose, -v       Print detailed per-check breakdown
  --help, -h          Show this help message

Examples:
  pnpm test:live --limit=3
  pnpm test:live --stratified --limit=30 --concurrency=4
  pnpm test:live --category=storefront --limit=5 --concurrency=2
  pnpm test:live --domain=theguardian.com --ignore-robots
  pnpm test:live --domain=theguardian.com --verbose
  pnpm test:live --tier=smoke --limit=100 --concurrency=4
`);
}

type SkipReason = "robots-disallow" | "robots-refused" | "crawl-delay";

interface TestSiteOutcome {
  domain: string;
  category: string;
  skipped?: SkipReason;
  score?: number | null;
  scoreTier?: string | null;
  evidence?: Record<EvidenceKey, boolean>;
  unscoredReason?: string;
  statusCounts: Record<string, number>;
  violations: string[];
  durationMs: number;
}

interface TestReportSummary {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalPlanned: number;
  scanned: number;
  skipped: number;
  violationsCount: number;
  averageDurationMs: number;
  averageScore: number | null;
  outcomes: TestSiteOutcome[];
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  console.log("─────────────────────────────────────────────────────────────");
  console.log("🚀 Agent Lighthouse - Live Sites List Scan Test");
  console.log("─────────────────────────────────────────────────────────────");

  const allSites: SiteEntry[] = JSON.parse(fs.readFileSync(SITES_PATH, "utf8"));
  const STATUS_PATH = path.resolve(
    process.cwd(),
    "packages/core/test-data/sites/status.json",
  );
  const status: CorpusStatus | undefined = fs.existsSync(STATUS_PATH)
    ? (JSON.parse(fs.readFileSync(STATUS_PATH, "utf8")) as CorpusStatus)
    : undefined;
  const excluded = excludedDomains(status, {
    dead: options.includeDead,
    blocked: options.includeBlocked,
  });
  const pool = allSites.filter((s) => {
    if (options.tier && s.tier !== options.tier) return false;
    return !excluded.has(s.domain);
  });
  // Count list entries removed, not the exclusion set: status.json remembers
  // domains the list no longer carries.
  const leftOut = allSites.filter(
    (s) => (!options.tier || s.tier === options.tier) && excluded.has(s.domain),
  ).length;
  if (leftOut > 0) {
    console.log(
      `Status file: ${leftOut} dead or blocked domain(s) left out (--include-dead, --include-blocked to add them)`,
    );
  }
  if (options.tier) console.log(`Tier: ${options.tier} (${pool.length} sites)`);
  const grandStartTime = Date.now();
  const allOutcomes: TestSiteOutcome[] = [];
  let totalViolations = 0;

  for (let loopRound = 1; loopRound <= options.loop; loopRound++) {
    if (options.loop > 1) {
      console.log(
        `\n=============================================================`,
      );
      console.log(`🔄 Round ${loopRound} of ${options.loop}`);
      console.log(
        `=============================================================`,
      );
    }

    let targetSites: SiteEntry[] = [];

    if (options.domains && options.domains.length > 0) {
      const specified = new Set(options.domains);
      targetSites = pool.filter((s) => specified.has(s.domain));
      for (const d of options.domains) {
        // A domain outside the list is scanned ad hoc, unless a tier was
        // asked for: `--tier` intersects, it does not add.
        if (options.tier) break;
        if (!targetSites.some((s) => s.domain === d)) {
          targetSites.push({
            domain: d,
            source: "seed",
            category: "custom",
            rankBucket: 0,
          });
        }
      }
    } else if (options.category && options.category !== "all") {
      targetSites = pool.filter(
        (s) => s.category.toLowerCase() === options.category,
      );
      console.log(
        `Filtered by category: "${options.category}" (${targetSites.length} available)`,
      );
    } else {
      targetSites = pool.slice();
    }

    if (options.shuffle) {
      for (let i = targetSites.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [targetSites[i], targetSites[j]] = [targetSites[j]!, targetSites[i]!];
      }
    }

    let selected: SiteEntry[] = [];
    if (
      options.stratified &&
      (!options.domains || options.domains.length === 0)
    ) {
      const byCategory = new Map<string, SiteEntry[]>();
      for (const site of targetSites) {
        const list = byCategory.get(site.category) ?? [];
        list.push(site);
        byCategory.set(site.category, list);
      }
      const categories = Array.from(byCategory.keys()).sort();
      let added = 0;
      let r = 0;
      while (added < options.limit && r < 1000) {
        for (const cat of categories) {
          const list = byCategory.get(cat);
          if (list && list[r]) {
            selected.push(list[r]);
            added++;
            if (added >= options.limit) break;
          }
        }
        r++;
      }
      console.log(
        `Stratified sampling: selected ${selected.length} sites across ${categories.length} categories`,
      );
    } else {
      selected = targetSites.slice(
        options.offset,
        options.offset + options.limit,
      );
    }

    if (selected.length === 0) {
      // An empty round is not the end of the run: later rounds may still
      // select sites, and the summary must be written either way.
      console.log("⚠️ No sites matched the selection criteria.");
      continue;
    }

    console.log(
      `Running scan across ${selected.length} sites (concurrency: ${options.concurrency}, delay: ${options.delayMs}ms)...\n`,
    );

    const dispatcher = boundedDispatcher(options.concurrency);

    async function checkRobots(domain: string): Promise<{
      scan: boolean;
      reason?: SkipReason;
      robotsTxt?: FetchResult;
    }> {
      try {
        const result = await createFetcher({
          dispatcher,
          maxConcurrent: options.concurrency,
        }).fetch({
          url: `https://${domain}/robots.txt`,
        });

        if (
          result.status === 401 ||
          result.status === 403 ||
          result.status === 429
        ) {
          return { scan: false, reason: "robots-refused" };
        }

        if (result.error || result.status !== 200 || !result.body) {
          return { scan: true, robotsTxt: result };
        }

        const parsed = parseRobots(result.body);
        for (const token of PROBED_TOKENS) {
          const groups = groupsForBot(parsed, token);
          if (isBlanketBlocked(groups, token)) {
            return { scan: false, reason: "robots-disallow" };
          }
          if (groups.some((g) => (g.crawlDelay ?? 0) > 0)) {
            return { scan: false, reason: "crawl-delay" };
          }
        }

        return { scan: true, robotsTxt: result };
      } catch {
        return { scan: true };
      }
    }

    async function scanSingleSite(
      site: SiteEntry,
      index: number,
    ): Promise<TestSiteOutcome> {
      const started = Date.now();
      const outcome: TestSiteOutcome = {
        domain: site.domain,
        category: site.category,
        statusCounts: {},
        violations: [],
        durationMs: 0,
      };

      const prefix = `[${index + 1}/${selected.length}] ${site.domain} (${site.category})`;

      try {
        let robotsTxtResult: FetchResult | undefined;
        if (!options.ignoreRobots) {
          const robots = await checkRobots(site.domain);
          if (!robots.scan) {
            outcome.skipped = robots.reason;
            outcome.durationMs = Date.now() - started;
            console.log(`⚪ ${prefix}: SKIPPED (robots.txt: ${robots.reason})`);
            return outcome;
          }
          robotsTxtResult = robots.robotsTxt;
        }

        const report = await runScan(`https://${site.domain}`, {
          dispatcher,
          maxConcurrent: options.concurrency,
          robotsTxt: robotsTxtResult,
        });

        outcome.score = report.overallScore;
        outcome.scoreTier = report.scoreTier;
        outcome.evidence = report.scanValidity?.evidence;
        outcome.unscoredReason = report.scanValidity?.unscoredReason;

        const checks = report.categories.flatMap((c) => c.checks);
        for (const check of checks) {
          outcome.statusCounts[check.status] =
            (outcome.statusCounts[check.status] ?? 0) + 1;
        }

        outcome.violations = invariantViolations(report, checks);
        outcome.durationMs = Date.now() - started;

        const durationSec = (outcome.durationMs / 1000).toFixed(1);
        const scoreDisplay =
          outcome.score !== null && outcome.score !== undefined
            ? `${outcome.score}/100 (${outcome.scoreTier})`
            : `unscored (${outcome.unscoredReason ?? "gated"})`;

        const countsDisplay = `${outcome.statusCounts.pass ?? 0} pass, ${outcome.statusCounts.warn ?? 0} warn, ${outcome.statusCounts.fail ?? 0} fail, ${outcome.statusCounts.na ?? 0} na`;

        if (outcome.violations.length === 0) {
          console.log(
            `✅ ${prefix}: ${scoreDisplay} | ${countsDisplay} | ${durationSec}s | OK`,
          );
        } else {
          console.log(
            `❌ ${prefix}: ${scoreDisplay} | ${outcome.violations.length} VIOLATION(S):`,
          );
          for (const v of outcome.violations) {
            console.log(`   ⚠️  ${v}`);
          }
        }

        if (options.verbose) {
          console.log(`   Evidence: ${JSON.stringify(outcome.evidence)}`);
        }
      } catch (err) {
        outcome.durationMs = Date.now() - started;
        outcome.violations.push(`Threw: ${String(err).slice(0, 250)}`);
        console.log(`❌ ${prefix}: CRASHED - ${String(err).slice(0, 200)}`);
      }

      if (options.delayMs > 0) {
        await pause(options.delayMs);
      }

      return outcome;
    }

    // Bounded worker queue execution
    const queue = selected.map((site, i) => ({ site, index: i }));
    const outcomes: TestSiteOutcome[] = [];

    const workers = Array.from({ length: options.concurrency }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const outcome = await scanSingleSite(item.site, item.index);
        outcomes.push(outcome);
      }
    });

    await Promise.all(workers);

    const roundViolations = outcomes.reduce(
      (acc, o) => acc + o.violations.length,
      0,
    );
    totalViolations += roundViolations;
    allOutcomes.push(...outcomes);

    if (roundViolations > 0) {
      console.error(
        `\n❌ Round ${loopRound} encountered ${roundViolations} invariant violation(s). Halting loop.`,
      );
      break;
    }
  }

  const totalDurationMs = Date.now() - grandStartTime;
  const scannedOutcomes = allOutcomes.filter((o) => !o.skipped);

  const scores = scannedOutcomes
    .map((o) => o.score)
    .filter((s): s is number => typeof s === "number");

  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

  const avgDurationMs =
    allOutcomes.length > 0
      ? Math.round(
          allOutcomes.reduce((a, o) => a + o.durationMs, 0) /
            allOutcomes.length,
        )
      : 0;

  const summary: TestReportSummary = {
    startedAt: new Date(grandStartTime).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: totalDurationMs,
    totalPlanned: allOutcomes.length,
    scanned: scannedOutcomes.length,
    skipped: allOutcomes.length - scannedOutcomes.length,
    violationsCount: totalViolations,
    averageDurationMs: avgDurationMs,
    averageScore: avgScore,
    outcomes: allOutcomes.sort((a, b) => a.domain.localeCompare(b.domain)),
  };

  // Ensure output directory exists and write summary
  fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
  fs.writeFileSync(options.outPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(
    "\n─────────────────────────────────────────────────────────────",
  );
  console.log("📊 Live Sites Scan Summary");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(
    `Total Planned:       ${summary.totalPlanned} across ${options.loop} round(s)`,
  );
  console.log(`Successfully Scanned:${summary.scanned}`);
  console.log(`Skipped (robots):    ${summary.skipped}`);
  console.log(`Invariant Violations:${summary.violationsCount}`);
  if (summary.averageScore !== null) {
    console.log(`Average Score:       ${summary.averageScore}/100`);
  }
  console.log(
    `Average Scan Time:   ${(summary.averageDurationMs / 1000).toFixed(1)}s`,
  );
  console.log(
    `Total Elapsed Time:  ${(summary.durationMs / 1000).toFixed(1)}s`,
  );
  console.log(`Results File:        ${options.outPath}`);
  console.log("─────────────────────────────────────────────────────────────");

  if (summary.violationsCount > 0) {
    console.error(
      `\n❌ FAILED: ${summary.violationsCount} invariant violation(s) detected.`,
    );
    process.exit(1);
  } else {
    console.log(
      `\n✅ PASSED: All ${summary.scanned} scanned sites satisfied scan invariants.`,
    );
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("\n💥 Runner exception:", err);
  process.exit(1);
});
