import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BUCKET_WIDTH,
  HOSTNAME,
  bucketOf,
  buildSiteList,
  normalize,
  readSeeds,
  type SeedFile,
  tenantSuffixOf,
  type SiteEntry,
  SiteSource,
} from "./site-list";

const sites: SiteEntry[] = JSON.parse(
  readFileSync(resolve(__dirname, "../../test-data/sites/sites.json"), "utf8"),
);
const seedFile: SeedFile = JSON.parse(
  readFileSync(resolve(__dirname, "../../test-data/sites/seeds.json"), "utf8"),
);

describe("the brand site list", () => {
  it("contains each supplied brand domain exactly once", () => {
    const brands = JSON.parse(
      readFileSync(
        resolve(__dirname, "../../test-data/sites/brands.json"),
        "utf8",
      ),
    ) as { brands: Array<{ domain: string }> };
    expect(sites.map((s) => s.domain)).toEqual(
      brands.brands.map((b) => b.domain).sort((a, b) => a.localeCompare(b)),
    );
    expect(new Set(sites.map((s) => s.domain)).size).toBe(sites.length);
    for (const site of sites) {
      expect(site.domain).toMatch(HOSTNAME);
      expect(site.source).toBe(SiteSource.Seed);
      expect(site.category).toBe("brand");
    }
    expect([...readSeeds(seedFile).categoryOf.keys()].sort()).toEqual(
      sites.map((s) => s.domain).sort(),
    );
  });
});

describe("normalize", () => {
  it("strips a scheme from a CrUX origin", () => {
    expect(normalize("https://playhop.com")).toBe("playhop.com");
    expect(normalize("http://example.com")).toBe("example.com");
  });

  it("strips a trailing path and a www prefix", () => {
    expect(normalize("https://www.bbc.co.uk/news")).toBe("bbc.co.uk");
    expect(normalize("www.example.com")).toBe("example.com");
  });

  it("lowercases a host", () => {
    expect(normalize("WWW.Example.COM")).toBe("example.com");
  });

  it("keeps punycode TLDs, which both sources carry", () => {
    expect(normalize("xn--80asehdb.xn--p1ai")).toBe("xn--80asehdb.xn--p1ai");
    expect(normalize("https://xn--12c1ezaww.com")).toBe("xn--12c1ezaww.com");
  });

  it("rejects the CrUX header row and anything else that is not a host", () => {
    expect(normalize("origin")).toBe("");
    expect(normalize("")).toBe("");
    expect(normalize("   ")).toBe("");
    expect(normalize("localhost")).toBe("");
  });
});

describe("bucketOf", () => {
  it("rounds a rank index down to the bucket width", () => {
    expect(bucketOf(0)).toBe(0);
    expect(bucketOf(BUCKET_WIDTH - 1)).toBe(0);
    expect(bucketOf(BUCKET_WIDTH)).toBe(BUCKET_WIDTH);
    expect(bucketOf(999)).toBe(900);
  });
});

describe("readSeeds", () => {
  it("maps every seeded domain to its category and keeps the smoke set", () => {
    const seeds = readSeeds({
      smoke: ["a.com"],
      categories: {
        news: { why: "x", domains: ["a.com", "B.com"] },
        forum: { why: "y", domains: ["offlist.com"] },
      },
    });
    expect(seeds.categoryOf.get("a.com")).toBe("news");
    expect(seeds.categoryOf.get("b.com")).toBe("news");
    expect(seeds.categoryOf.get("offlist.com")).toBe("forum");
    expect([...seeds.smoke]).toEqual(["a.com"]);
  });

  it("refuses a domain that is not a bare hostname, naming it", () => {
    expect(() =>
      readSeeds({
        smoke: [],
        categories: { news: { why: "x", domains: ["https://a.com/path"] } },
      }),
    ).toThrow(/news: "https:\/\/a.com\/path"/);
  });

  it("refuses a smoke domain that no category lists", () => {
    expect(() =>
      readSeeds({
        smoke: ["ghost.com"],
        categories: { news: { why: "x", domains: ["a.com"] } },
      }),
    ).toThrow(/smoke: "ghost.com"/);
  });

  it("refuses a domain seeded under two categories", () => {
    expect(() =>
      readSeeds({
        smoke: [],
        categories: {
          news: { why: "x", domains: ["a.com"] },
          docs: { why: "y", domains: ["a.com"] },
        },
      }),
    ).toThrow(/a.com.*news.*docs/);
  });
});

describe("tenantSuffixOf", () => {
  it("names the platform a tenant hostname sits on", () => {
    expect(tenantSuffixOf("foo.github.io")).toBe("github.io");
    expect(tenantSuffixOf("shop.myshopify.com")).toBe("myshopify.com");
    expect(tenantSuffixOf("docs.example.pages.dev")).toBe("pages.dev");
  });

  it("does not match the platform apex itself or an unrelated host", () => {
    expect(tenantSuffixOf("github.io")).toBeUndefined();
    expect(tenantSuffixOf("github.com")).toBeUndefined();
    expect(tenantSuffixOf("example.com")).toBeUndefined();
  });
});

describe("buildSiteList", () => {
  const seeds = readSeeds({
    smoke: ["a.com"],
    categories: {
      news: { why: "x", domains: ["a.com"] },
      forum: { why: "y", domains: ["offlist.com"] },
    },
  });

  it("prefers the better-ranked source when a domain appears in both", () => {
    const built = buildSiteList(
      [
        { domains: ["a.com", "b.com"], source: "tranco" },
        { domains: ["b.com", "c.com"], source: "crux" },
      ],
      seeds,
      { limit: 10 },
    );
    expect(built.find((s) => s.domain === "b.com")?.source).toBe("tranco");
    expect(built.find((s) => s.domain === "c.com")?.source).toBe("crux");
  });

  it("marks a seed carry-over 'seed' and ranks it past the cut", () => {
    const built = buildSiteList(
      [{ domains: ["a.com"], source: "tranco" }],
      seeds,
      { limit: 10 },
    );
    const carried = built.find((s) => s.domain === "offlist.com");
    expect(carried?.source).toBe("seed");
    expect(built.find((s) => s.domain === "a.com")?.source).toBe("tranco");
  });

  it("stamps the smoke tier on a seeded domain, ranked or not", () => {
    const built = buildSiteList(
      [{ domains: ["a.com"], source: "tranco" }],
      seeds,
      { limit: 10 },
    );
    expect(built.find((s) => s.domain === "a.com")?.tier).toBe("smoke");
    expect(built.find((s) => s.domain === "offlist.com")?.tier).toBeUndefined();
  });

  it("never emits an excluded ranked domain, and does not let it eat a slot", () => {
    const built = buildSiteList(
      [{ domains: ["dead.com", "b.com", "c.com"], source: "tranco" }],
      seeds,
      { limit: 2, exclude: new Set(["dead.com"]) },
    );
    const ranked = built
      .filter((s) => s.source !== SiteSource.Seed)
      .map((s) => s.domain);
    expect(ranked).toEqual(["b.com", "c.com"]);
  });

  it("keeps the ranked source of an excluded domain that is seeded", () => {
    const built = buildSiteList(
      [{ domains: ["a.com", "b.com"], source: "tranco" }],
      seeds,
      { limit: 1, exclude: new Set(["a.com"]) },
    );
    const a = built.find((s) => s.domain === "a.com");
    expect(a?.source).toBe("tranco");
    expect(a?.rankBucket).toBe(0);
    expect(built.find((s) => s.domain === "b.com")?.source).toBe("tranco");
  });

  it("still emits an excluded domain when it is seeded", () => {
    const built = buildSiteList([], seeds, {
      limit: 0,
      exclude: new Set(["offlist.com"]),
    });
    expect(built.find((s) => s.domain === "offlist.com")?.source).toBe("seed");
  });

  it("files a ranked tenant hostname under tenant, up to tenantLimit, outside the slice", () => {
    const built = buildSiteList(
      [
        {
          domains: [
            "one.github.io",
            "b.com",
            "two.pages.dev",
            "three.vercel.app",
            "c.com",
          ],
          source: "crux",
        },
      ],
      seeds,
      { limit: 2, tenantLimit: 2 },
    );
    const tenants = built
      .filter((s) => s.category === "tenant")
      .map((s) => s.domain);
    expect(tenants).toEqual(["one.github.io", "two.pages.dev"]);
    const unknown = built
      .filter((s) => s.category === "unknown")
      .map((s) => s.domain);
    expect(unknown).toEqual(["b.com", "c.com"]);
  });

  it("spends one slice budget across both sources, not one per source", () => {
    const built = buildSiteList(
      [
        { domains: ["b.com", "c.com"], source: "tranco" },
        { domains: ["d.com", "e.com"], source: "crux" },
      ],
      seeds,
      { limit: 3 },
    );
    const unknown = built
      .filter((s) => s.category === "unknown")
      .map((s) => s.domain);
    expect(unknown).toEqual(["b.com", "c.com", "d.com"]);
  });

  it("counts seeded tenants against tenantLimit", () => {
    const seededTenant = readSeeds({
      smoke: [],
      categories: {
        tenant: { why: "t", domains: ["home.github.io"] },
      },
    });
    const built = buildSiteList(
      [{ domains: ["one.pages.dev", "two.vercel.app"], source: "tranco" }],
      seededTenant,
      { limit: 0, tenantLimit: 2 },
    );
    const tenants = built
      .filter((s) => s.category === "tenant")
      .map((s) => s.domain);
    expect(tenants).toEqual(["home.github.io", "one.pages.dev"]);
  });

  it.each([10, 99, 100, 150, 1000])(
    "keeps the seed bucket clear of every ranked bucket at limit %i",
    (limit) => {
      const ranked = Array.from(
        { length: limit },
        (_, i) => `r${String(i).padStart(5, "0")}.com`,
      );
      const built = buildSiteList(
        [{ domains: ranked, source: "tranco" }],
        seeds,
        { limit },
      );
      const seeded = built.filter((s) => s.source === SiteSource.Seed);
      const worstRanked = Math.max(
        ...built
          .filter((s) => s.source !== SiteSource.Seed)
          .map((s) => s.rankBucket),
      );
      expect(seeded.length).toBeGreaterThan(0);
      for (const site of seeded) {
        expect(
          site.rankBucket,
          `limit ${limit}, ${site.domain}`,
        ).toBeGreaterThan(worstRanked);
      }
    },
  );

  it("spreads ranked entries across more than one bucket", () => {
    const ranked = Array.from(
      { length: 250 },
      (_, i) => `r${String(i).padStart(5, "0")}.com`,
    );
    const built = buildSiteList(
      [{ domains: ranked, source: "tranco" }],
      readSeeds({ smoke: [], categories: {} }),
      { limit: 250 },
    );
    const buckets = [...new Set(built.map((s) => s.rankBucket))].sort(
      (a, b) => a - b,
    );
    expect(buckets).toEqual([0, 100, 200]);
  });

  it("returns entries ordered by domain, whatever order the sources arrive in", () => {
    const built = buildSiteList(
      [{ domains: ["z.com", "m.com", "a.com"], source: "tranco" }],
      readSeeds({ smoke: [], categories: {} }),
      { limit: 10 },
    );
    expect(built.map((s) => s.domain)).toEqual(["a.com", "m.com", "z.com"]);
  });
});
