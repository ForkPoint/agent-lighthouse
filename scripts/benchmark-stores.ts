import * as fs from "node:fs";
import * as path from "node:path";
import { runScan, type ScanReport } from "../packages/core/src";

const BENCHMARK_STORES_PATH = path.resolve(
  __dirname,
  "../packages/core/test-data/sites/benchmark-stores.json",
);

const RAW_STORES: string[] = JSON.parse(
  fs.readFileSync(BENCHMARK_STORES_PATH, "utf-8"),
);

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, "");
}

/**
 * The stores to scan: the built-in list, or the URLs given on the command line.
 *
 * Re-running only the stores that exposed a defect is the fastest way to
 * confirm a fix against the site that found it, and the full list takes about
 * two hours.
 */
const ARG_URLS = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));

/** Read a `--name=value` flag, falling back to a default. */
function numericFlag(name: string, fallback: number): number {
  const arg = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  const value = arg ? Number(arg.slice(name.length + 3)) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * How hard to push, and how long to wait between stores.
 *
 * Most Shopify storefronts sit behind Cloudflare, whose rate limit is scoped to
 * the source IP rather than to the site. One scan opens up to
 * `MAX_CONCURRENT_REQUESTS` connections, so four stores at once put forty in
 * flight from one address: a run at the old defaults had 36 of 48 stores answer
 * HTTP 429, while a single `curl` carrying the same user-agent got 200 from
 * every one of them. The benchmark was measuring its own throttling.
 */
const CONCURRENCY = numericFlag("concurrency", 2);
const DELAY_MS = numericFlag("delay", 3000);

/**
 * Run with the scan evidence gate on (`--gate`).
 *
 * Calibration compares a gated run against an ungated one over the same
 * stores, so the flag has to reach `runScan` rather than being set in code.
 */
const ENFORCE_GATE = process.argv.slice(2).includes("--gate");

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const UNIQUE_URLS = Array.from(
  new Set((ARG_URLS.length > 0 ? ARG_URLS : RAW_STORES).map(normalizeUrl)),
);

interface StoreResult {
  url: string;
  status: "success" | "error" | "bot_blocked";
  score?: number | null;
  tier?: string | null;
  report?: ScanReport;
  error?: string;
  waf?: string;
  durationMs: number;
}

const outDir = path.resolve(__dirname, "../reports/investigation");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
// A subset run writes beside the full run rather than over it: the full data
// file is the published benchmark, and a five-store re-check is not that.
const outPath = path.join(
  outDir,
  `${ARG_URLS.length > 0 ? "benchmark-subset-data" : "benchmark-stores-data"}${
    ENFORCE_GATE ? "-gated" : ""
  }.json`,
);

async function auditStore(
  targetUrl: string,
  index: number,
  total: number,
): Promise<StoreResult> {
  const startTime = Date.now();
  const domain = new URL(targetUrl).hostname;
  console.log(`[${index + 1}/${total}] Auditing: ${domain} (${targetUrl})`);

  try {
    const report = await runScan(targetUrl, {
      enforceEvidenceGate: ENFORCE_GATE,
    });

    const durationMs = Date.now() - startTime;
    const isBlocked = report.wafProtection?.isBlocked;
    const wafName = report.wafProtection?.name;

    if (isBlocked) {
      console.log(
        `  🛑 [${index + 1}/${total}] ${domain}: BOT WALL DETECTED (${wafName}) in ${(durationMs / 1000).toFixed(1)}s`,
      );
      return {
        url: targetUrl,
        status: "bot_blocked",
        waf: wafName,
        score: report.overallScore,
        tier: report.scoreTier,
        report,
        durationMs,
      };
    }

    const verdict =
      report.overallScore === null
        ? `NOT SCORED — ${report.scanValidity?.unscoredReason ?? "too little evidence"}`
        : `Score ${report.overallScore}/100 (${report.scoreTier})`;
    console.log(
      `  ✓ [${index + 1}/${total}] ${domain}: ${verdict} in ${(durationMs / 1000).toFixed(1)}s`,
    );
    return {
      url: targetUrl,
      status: "success",
      score: report.overallScore,
      tier: report.scoreTier,
      report,
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error(
      `  ✗ [${index + 1}/${total}] ${domain}: ERROR - ${err.message}`,
    );
    return {
      url: targetUrl,
      status: "error",
      error: err.message,
      durationMs,
    };
  }
}

async function runBatch() {
  console.log(`\n======================================================`);
  console.log(
    `LAUNCHING BENCHMARK AUDIT ON ${UNIQUE_URLS.length} E-COMMERCE STORES`,
  );
  console.log(
    `concurrency ${CONCURRENCY}, ${DELAY_MS}ms between stores per worker`,
  );
  console.log(`======================================================\n`);

  const results: Record<string, StoreResult> = {};
  const queue = [...UNIQUE_URLS];
  let completed = 0;

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      const index = completed++;
      const res = await auditStore(url, index, UNIQUE_URLS.length);
      const domain = new URL(url).hostname;
      results[domain] = res;

      // Save incremental results
      fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

      if (queue.length > 0) await pause(DELAY_MS);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log(`\n======================================================`);
  console.log(
    `BENCHMARK COMPLETED: ${Object.keys(results).length} stores processed`,
  );
  console.log(`Results saved to: ${outPath}`);
  console.log(`======================================================\n`);
}

runBatch().catch(console.error);
