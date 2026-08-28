import * as fs from 'node:fs';
import * as path from 'node:path';

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
 */

interface SiteEntry {
  domain: string;
  category: string;
  source: 'tranco' | 'crux';
  rankBucket: number;
}

/** Read a `--name=value` flag, falling back to a default. */
function flag(name: string, fallback: string): string {
  const arg = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : fallback;
}

const LIMIT = Number(flag('limit', '1000'));
const TRANCO = flag('tranco', '/tmp/site-lists/tranco.csv');
const CRUX = flag('crux', '/tmp/site-lists/crux.csv');
const OUT = flag('out', 'packages/core/test-data/sites/sites.json');
const CATEGORIES = flag('categories', 'packages/core/test-data/sites/categories.json');

/** A bare lowercase hostname, or '' when the field is not one. */
function normalize(raw: string): string {
  const trimmed = raw
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const host = trimmed.toLowerCase().replace(/^www\./, '');
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : '';
}

/**
 * Read one ranked source, best-ranked first.
 *
 * Tranco rows are `rank,domain` with no header. CrUX rows are `origin,rank`
 * behind an `origin,rank` header line, which `normalize` drops for us because
 * the literal word `origin` is not a hostname.
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

const seed: Record<string, string[]> = JSON.parse(fs.readFileSync(CATEGORIES, 'utf8'));
const categoryOf = new Map<string, string>();
for (const [category, domains] of Object.entries(seed)) {
  for (const domain of domains) categoryOf.set(normalize(domain), category);
}

const byDomain = new Map<string, SiteEntry>();

function add(domains: string[], source: SiteEntry['source']): void {
  domains.slice(0, LIMIT).forEach((domain, index) => {
    // First writer wins: the sources are added best-ranked first, so a domain
    // already present is already recorded at its better rank.
    if (byDomain.has(domain)) return;
    byDomain.set(domain, {
      domain,
      category: categoryOf.get(domain) ?? 'unknown',
      source,
      rankBucket: Math.floor(index / 1000) * 1000,
    });
  });
}

add(readRanked(TRANCO, 1), 'tranco');
add(readRanked(CRUX, 0), 'crux');

// Seeded domains are the reason the list reaches past storefronts, so they are
// kept even when they fall outside the rank cut.
for (const [domain, category] of categoryOf) {
  if (!byDomain.has(domain)) {
    byDomain.set(domain, { domain, category, source: 'tranco', rankBucket: 0 });
  }
}

const sites = [...byDomain.values()].sort((a, b) => a.rankBucket - b.rankBucket);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(sites, null, 2)}\n`);

const unknown = sites.filter((s) => s.category === 'unknown').length;
const tranco = sites.filter((s) => s.source === 'tranco').length;
console.log(
  `${sites.length} sites -> ${OUT} (tranco ${tranco}, ` +
    `crux ${sites.length - tranco}, unknown category ${unknown})`,
);
