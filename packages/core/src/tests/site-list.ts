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
  /** Present on the two domains per category the smoke run scans. */
  tier?: "smoke";
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

/** The shape of `packages/core/test-data/sites/seeds.json`. */
export interface SeedFile {
  smoke: string[];
  categories: Record<string, { why: string; domains: string[] }>;
}

/** The seed file, parsed and checked. */
export interface Seeds {
  categoryOf: Map<string, string>;
  smoke: Set<string>;
}

/**
 * Parse the seed file, refusing what the generator must not carry forward.
 *
 * A malformed hostname would be scanned as `https:///robots.txt`; a smoke
 * domain no category lists would be a tier with no category; one domain under
 * two categories would be counted twice by a stratified sample. Each is a
 * typo in a hand-maintained file, so all of them are named in one error.
 */
export function readSeeds(file: SeedFile): Seeds {
  const categoryOf = new Map<string, string>();
  const problems: string[] = [];
  for (const [category, { domains }] of Object.entries(file.categories)) {
    for (const raw of domains) {
      const lowered = raw
        .trim()
        .toLowerCase()
        .replace(/^www\./, "");
      if (!HOSTNAME.test(lowered)) {
        problems.push(
          `${category}: ${JSON.stringify(raw)} is not a bare hostname`,
        );
        continue;
      }
      const host = normalize(raw);
      const seen = categoryOf.get(host);
      if (seen && seen !== category) {
        problems.push(`${host} is seeded under both ${seen} and ${category}`);
        continue;
      }
      categoryOf.set(host, category);
    }
  }
  const smoke = new Set<string>();
  for (const raw of file.smoke) {
    const host = normalize(raw);
    if (!categoryOf.has(host)) {
      problems.push(
        `smoke: ${JSON.stringify(raw)} is not seeded under any category`,
      );
      continue;
    }
    smoke.add(host);
  }
  if (problems.length > 0) {
    throw new Error(`seeds.json:\n  ${problems.join("\n  ")}`);
  }
  return { categoryOf, smoke };
}

/**
 * Platforms whose tenants share a public suffix.
 *
 * A hostname under one of these is a `tenant` by definition, not by guess:
 * the suffix is what the category means. The apex itself is the platform,
 * not a tenant.
 */
export const TENANT_SUFFIXES: readonly string[] = [
  "github.io",
  "pages.dev",
  "vercel.app",
  "netlify.app",
  "myshopify.com",
  "wixsite.com",
  "squarespace.com",
  "webflow.io",
  "notion.site",
  "gitbook.io",
  "readthedocs.io",
  "substack.com",
  "blogspot.com",
  "wordpress.com",
];

/** The platform suffix a tenant hostname sits on, if any. */
export function tenantSuffixOf(domain: string): string | undefined {
  return TENANT_SUFFIXES.find((suffix) => domain.endsWith(`.${suffix}`));
}

/**
 * Merge the ranked sources and the seeds into the committed list.
 *
 * `limit` is the size of the ranked `unknown` slice across both sources, not
 * the total: seeds are always carried, and ranked tenant hostnames are filed
 * under `tenant` outside the slice until the category holds `tenantLimit`
 * domains, seeded ones included. `exclude` names ranked domains a
 * previous run found dead or blocked; they neither appear nor consume a slot.
 * A seeded domain is emitted even when excluded — removing it is a decision
 * made in `seeds.json`, and the generator reports it.
 *
 * Pure: callers pass the parsed rows, so a test can exercise the merge without
 * touching the filesystem.
 */
export function buildSiteList(
  ranked: ReadonlyArray<{
    domains: readonly string[];
    source: "tranco" | "crux";
  }>,
  seeds: Seeds,
  options: {
    limit: number;
    exclude?: ReadonlySet<string>;
    tenantLimit?: number;
  },
): SiteEntry[] {
  const { limit } = options;
  const exclude = options.exclude ?? new Set<string>();
  const tenantLimit = options.tenantLimit ?? 30;
  const byDomain = new Map<string, SiteEntry>();
  // Both counters span the sources: the slice is one budget, and the tenant
  // cap is the category's size, so seeded tenants spend it first.
  let taken = 0;
  let tenants = 0;
  for (const category of seeds.categoryOf.values()) {
    if (category === "tenant") tenants += 1;
  }

  for (const { domains, source } of ranked) {
    for (const domain of domains) {
      if (taken >= limit && tenants >= tenantLimit) break;
      // First writer wins: the sources are added best-ranked first, so a domain
      // already present is already recorded at its better rank.
      if (byDomain.has(domain) || exclude.has(domain)) continue;
      const seeded = seeds.categoryOf.get(domain);
      const tenant =
        seeded === undefined && tenantSuffixOf(domain) !== undefined;
      if (tenant) {
        if (tenants >= tenantLimit) continue;
        tenants += 1;
      } else if (seeded === undefined) {
        if (taken >= limit) continue;
      }
      const entry: SiteEntry = {
        domain,
        source,
        category: seeded ?? (tenant ? "tenant" : "unknown"),
        rankBucket: bucketOf(seeded === undefined && !tenant ? taken : 0),
      };
      if (seeds.smoke.has(domain)) entry.tier = "smoke";
      byDomain.set(domain, entry);
      if (seeded === undefined && !tenant) taken += 1;
    }
  }

  // Seeded domains are the reason the list reaches past storefronts, so they
  // are kept even when they fall outside the rank cut. They are marked
  // `'seed'`, not `'tranco'`: claiming a source that never listed them would
  // let a consumer scan a hand-picked storefront believing it is top-ranked.
  for (const [domain, category] of seeds.categoryOf) {
    if (byDomain.has(domain)) continue;
    const entry: SiteEntry = {
      domain,
      source: "seed",
      category,
      // One bucket past the worst RANKED index, which is `limit - 1` — not
      // `bucketOf(limit)`, which collides with the last ranked bucket at any
      // limit that is not a multiple of the width.
      rankBucket: bucketOf(Math.max(limit, 1) - 1) + BUCKET_WIDTH,
    };
    if (seeds.smoke.has(domain)) entry.tier = "smoke";
    byDomain.set(domain, entry);
  }

  // Sorted by domain, not by rank: Tranco reorders daily, so a rank-ordered
  // file reshuffles unchanged lines on every regeneration and the diff stops
  // showing which sites actually joined or left.
  return [...byDomain.values()].sort((a, b) =>
    a.domain.localeCompare(b.domain),
  );
}
