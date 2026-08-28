import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildSiteList,
  normalize,
  type SiteEntry,
} from '../packages/core/src/tests/site-list';

/**
 * Build the site list from two public ranked sources.
 *
 * Neither source carries categories, so `categories.json` is a hand-maintained
 * seed map and everything unmatched stays `'unknown'`. Saying `'unknown'` is
 * honest; guessing a category from a domain name is not.
 *
 * Both inputs are local files, downloaded by hand:
 *
 *   mkdir -p /tmp/site-lists
 *   curl -sL https://tranco-list.eu/top-1m.csv.zip -o /tmp/site-lists/tranco.zip
 *   unzip -p /tmp/site-lists/tranco.zip > /tmp/site-lists/tranco.csv
 *   curl -sL https://raw.githubusercontent.com/zakird/crux-top-lists/main/data/global/current.csv.gz \
 *     | gunzip > /tmp/site-lists/crux.csv
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
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => normalize(line.split(',')[domainColumn] ?? ''))
    .filter(Boolean);
}

const rawLimit = flag('limit', '1000');
const limit = Number(rawLimit);
// Without this, `--limit=abc` yields NaN, `slice(0, NaN)` yields [], and the
// committed list is silently overwritten with nothing but seed fallbacks.
if (!Number.isInteger(limit) || limit <= 0) {
  console.error(`--limit must be a positive integer, got: ${rawLimit}`);
  process.exit(1);
}

const TRANCO = flag('tranco', '/tmp/site-lists/tranco.csv');
const CRUX = flag('crux', '/tmp/site-lists/crux.csv');
const OUT = flag('out', 'packages/core/test-data/sites/sites.json');
const CATEGORIES = flag('categories', 'packages/core/test-data/sites/categories.json');

const seed: Record<string, string[]> = JSON.parse(fs.readFileSync(CATEGORIES, 'utf8'));
const categoryOf = new Map<string, string>();
for (const [category, domains] of Object.entries(seed)) {
  for (const domain of domains) categoryOf.set(normalize(domain), category);
}

const sites = buildSiteList(
  [
    { domains: readRanked(TRANCO, 1), source: 'tranco' },
    { domains: readRanked(CRUX, 0), source: 'crux' },
  ],
  categoryOf,
  limit,
);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(sites, null, 2)}\n`);

const count = (source: SiteEntry['source']) => sites.filter((s) => s.source === source).length;
const unknown = sites.filter((s) => s.category === 'unknown').length;
console.log(
  `${sites.length} sites -> ${OUT} (tranco ${count('tranco')}, crux ${count('crux')}, ` +
    `seed ${count('seed')}, unknown category ${unknown})`,
);
