import * as fs from "node:fs";
import * as path from "node:path";
import {
  buildSiteList,
  normalize,
  readSeeds,
  type SeedFile,
  type Seeds,
  type SiteEntry,
} from "../packages/core/src/tests/site-list";
import {
  excludedDomains,
  type CorpusStatus,
} from "../packages/core/src/tests/corpus-status";

/**
 * Build the site list from two public ranked sources.
 *
 * `seeds.json` is the hand-maintained source of truth: every seeded domain
 * carries its category, and everything unmatched in the ranked slice stays
 * `'unknown'`. `status.json`, when present, keeps dead and blocked domains
 * out of the ranked slice.
 *
 * Both inputs are local files, downloaded by hand:
 *
 *   mkdir -p /tmp/site-lists
 *   curl -sL https://tranco-list.eu/top-1m.csv.zip -o /tmp/site-lists/tranco.zip
 *   unzip -p /tmp/site-lists/tranco.zip > /tmp/site-lists/tranco.csv
 *   curl -sL https://raw.githubusercontent.com/zakird/crux-top-lists/main/data/global/current.csv.gz \
 *     | gunzip > /tmp/site-lists/crux.csv
 *
 * `--limit` is the ranked slice size, default 50.
 *
 * A generator that fetches cannot be re-run to the same output, and this one is
 * meant to be.
 *
 * This file is only flags and file I/O. The merge logic it calls lives in
 * `packages/core/src/tests/site-list.ts`, where a test can reach it without
 * running a generator that overwrites the committed list.
 */

/** Read a `--name=value` flag, falling back to a default. */
function flag(name: string, fallback: string): string {
  const arg = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : fallback;
}

/**
 * Read one ranked source, best-ranked first.
 *
 * Tranco rows are `rank,domain` with no header. CrUX rows are `origin,rank`
 * behind an `origin,rank` header line, which `normalize` drops for us because
 * the literal word `origin` is not a hostname. CrUX origins also carry a
 * scheme (`https://example.com`), which `normalize` strips.
 */
function readRanked(file: string, domainColumn: number): string[] {
  if (!fs.existsSync(file)) {
    console.error(`missing input: ${file} — see the download step`);
    process.exit(1);
  }
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((line) => normalize(line.split(",")[domainColumn] ?? ""))
    .filter(Boolean);
}

const rawLimit = flag("limit", "50");
const limit = Number(rawLimit);
// Without this, `--limit=abc` yields NaN and the ranked slice is empty.
if (!Number.isInteger(limit) || limit < 0) {
  console.error(`--limit must be a non-negative integer, got: ${rawLimit}`);
  process.exit(1);
}

const TRANCO = flag("tranco", "/tmp/site-lists/tranco.csv");
const CRUX = flag("crux", "/tmp/site-lists/crux.csv");
const OUT = flag("out", "packages/core/test-data/sites/sites.json");
const SEEDS = flag("seeds", "packages/core/test-data/sites/seeds.json");
const STATUS = flag("status", "packages/core/test-data/sites/status.json");

let seeds: Seeds;
try {
  seeds = readSeeds(JSON.parse(fs.readFileSync(SEEDS, "utf8")) as SeedFile);
} catch (err) {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
}

const status: CorpusStatus | undefined = fs.existsSync(STATUS)
  ? (JSON.parse(fs.readFileSync(STATUS, "utf8")) as CorpusStatus)
  : undefined;
const exclude = excludedDomains(status, {});

const sites = buildSiteList(
  [
    { domains: readRanked(TRANCO, 1), source: "tranco" },
    { domains: readRanked(CRUX, 0), source: "crux" },
  ],
  seeds,
  { limit, exclude },
);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(sites, null, 2)}\n`);

// A seed the status file calls dead or blocked is still emitted. It is a
// person's decision to drop it, and the file that records that decision is
// seeds.json — so it is said out loud here rather than silently dropped.
const seededButExcluded = sites.filter(
  (s) => seeds.categoryOf.has(s.domain) && exclude.has(s.domain),
);
for (const s of seededButExcluded) {
  console.warn(
    `warning: ${s.domain} (${s.category}) is ${status?.domains[s.domain]?.state} in status.json but stays seeded`,
  );
}

const count = (source: SiteEntry["source"]) =>
  sites.filter((s) => s.source === source).length;
const byCategory = new Map<string, number>();
for (const s of sites)
  byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + 1);
console.log(
  `${sites.length} sites -> ${OUT} (tranco ${count("tranco")}, crux ${count("crux")}, ` +
    `seed ${count("seed")}; excluded ${exclude.size} by status)`,
);
for (const [category, n] of [...byCategory.entries()].sort()) {
  console.log(`  ${category.padEnd(12)} ${n}`);
}
