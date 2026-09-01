/**
 * The pure half of the site-list generator.
 *
 * It lives here rather than in `scripts/build-site-list.ts` so a test can
 * exercise it directly: the script reads two 20 MB CSVs and overwrites the
 * committed list, and `packages/core`'s `rootDir` is `src`, so a test cannot
 * import across into `scripts/` at all. The script keeps the flags and the
 * file I/O and imports what is below.
 */

export interface SiteEntry {
  domain: string;
  /**
   * Where the domain came from. `'seed'` means it appears in `categories.json`
   * but in neither source's rank cut, so it carries no measured rank — a
   * consumer picking "real top-traffic sites" must exclude it.
   */
  source: "tranco" | "crux" | "seed";
  category: string;
  /**
   * Rank rounded down to a multiple of `BUCKET_WIDTH`. Seed carry-overs take
   * the first bucket past the cut, which is a true lower bound on their rank:
   * they are ranked worse than everything that made the cut.
   */
  rankBucket: number;
}

/**
 * Rank bucket granularity.
 *
 * Fixed at 100 rather than derived from the limit. A width equal to the limit
 * collapses every entry into bucket 0, which silently turns a consumer's
 * "scan the top slice" filter into "scan everything" — the bucket has to stay
 * narrower than the smallest slice anyone would select.
 */
export const BUCKET_WIDTH = 100;

/**
 * What counts as a bare hostname.
 *
 * The TLD alternation accepts punycode as well as letters: both sources carry
 * IDN domains such as `xn--80asehdb.xn--p1ai`, and a letters-only TLD test
 * drops all 1400-odd of them.
 *
 * Exported so the committed list is checked against the same pattern that
 * produced it. Kept as two copies, a loosening here would be caught only by
 * the next regeneration.
 */
export const HOSTNAME = /^[a-z0-9.-]+\.([a-z]{2,}|xn--[a-z0-9]+)$/;

/** A bare lowercase hostname, or '' when the field is not one. */
export function normalize(raw: string): string {
  const trimmed = raw
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const host = trimmed.toLowerCase().replace(/^www\./, "");
  return HOSTNAME.test(host) ? host : "";
}

/** The bucket a zero-based rank index falls in. */
export function bucketOf(index: number): number {
  return Math.floor(index / BUCKET_WIDTH) * BUCKET_WIDTH;
}

/**
 * Merge the ranked sources and the seed map into the committed list.
 *
 * Pure: callers pass the parsed rows, so a test can exercise the merge without
 * touching the filesystem.
 */
export function buildSiteList(
  ranked: ReadonlyArray<{
    domains: readonly string[];
    source: "tranco" | "crux";
  }>,
  categoryOf: ReadonlyMap<string, string>,
  limit: number,
): SiteEntry[] {
  const byDomain = new Map<string, SiteEntry>();

  for (const { domains, source } of ranked) {
    domains.slice(0, limit).forEach((domain, index) => {
      // First writer wins: the sources are added best-ranked first, so a domain
      // already present is already recorded at its better rank.
      if (byDomain.has(domain)) return;
      byDomain.set(domain, {
        domain,
        source,
        category: categoryOf.get(domain) ?? "unknown",
        rankBucket: bucketOf(index),
      });
    });
  }

  // Seeded domains are the reason the list reaches past storefronts, so they
  // are kept even when they fall outside the rank cut. They are marked
  // `'seed'`, not `'tranco'`: claiming a source that never listed them would
  // let a consumer scan a hand-picked storefront believing it is top-ranked.
  for (const [domain, category] of categoryOf) {
    // `normalize` answers '' for anything that is not a bare hostname, and the
    // seed map is keyed by its output, so one malformed entry in the
    // hand-maintained `categories.json` would be carried into the committed
    // list as `{ domain: '' }` — and the nightly would request
    // `https:///robots.txt` for it. The generator refuses such an entry
    // outright; this is the second door.
    if (domain === "") continue;
    if (!byDomain.has(domain)) {
      byDomain.set(domain, {
        domain,
        source: "seed",
        category,
        // One bucket past the worst RANKED index, which is `limit - 1` — not
        // `bucketOf(limit)`, which collides with the last ranked bucket at any
        // limit that is not a multiple of the width. At limit 10 that put a
        // hand-seeded domain in bucket 0 beside rank #1.
        rankBucket: bucketOf(limit - 1) + BUCKET_WIDTH,
      });
    }
  }

  // Sorted by domain, not by rank: Tranco reorders daily, so a rank-ordered
  // file reshuffles a thousand unchanged lines on every regeneration and the
  // diff stops showing which sites actually joined or left.
  return [...byDomain.values()].sort((a, b) =>
    a.domain.localeCompare(b.domain),
  );
}
