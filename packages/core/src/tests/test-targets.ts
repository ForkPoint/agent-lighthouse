import categoriesJson from "../../test-data/sites/categories.json";
import benchmarkStoresJson from "../../test-data/sites/benchmark-stores.json";

export type TestSiteRole = "live-smoke" | "benchmark-store" | "fixture";

export interface TestSiteTarget {
  domain: string;
  url: string;
  category: string;
  roles: TestSiteRole[];
  description: string;
  fixtureSlug?: string;
}

/**
 * The canonical live test targets evaluated during online integration tests.
 * Covers 4 core archetypes:
 * 1. Minimal / negative baseline (example.com)
 * 2. AI developer docs with llms.txt (docs.anthropic.com)
 * 3. E-commerce / retail storefront with agentic commerce (allbirds.com)
 * 4. News publisher with high-density editorial content & RSS (theguardian.com)
 */
export const LIVE_TEST_SITES: readonly TestSiteTarget[] = [
  {
    domain: "example.com",
    url: "https://example.com",
    category: "minimal",
    roles: ["live-smoke"],
    description:
      "Minimal reference domain without robots, sitemap, or structured data (negative-case baseline)",
  },
  {
    domain: "docs.anthropic.com",
    url: "https://docs.anthropic.com",
    category: "docs",
    roles: ["live-smoke"],
    description:
      "AI vendor documentation site with valid llms.txt and OpenGraph metadata",
  },
  {
    domain: "allbirds.com",
    url: "https://allbirds.com",
    category: "storefront",
    roles: ["live-smoke", "benchmark-store", "fixture"],
    description:
      "D2C retail storefront with Shopify root files, product schema, and shopping bot governance",
    fixtureSlug: "allbirds-com-collection",
  },
  {
    domain: "theguardian.com",
    url: "https://theguardian.com",
    category: "news",
    roles: ["live-smoke", "fixture"],
    description:
      "Major news publisher with rich semantic HTML, RSS feeds, and granular AI training vs retrieval policies",
    fixtureSlug: "theguardian-com-article",
  },
];

/** Return all live test targets for integration suites. */
export function getLiveTestSites(): readonly TestSiteTarget[] {
  return LIVE_TEST_SITES;
}

/** Return the normalized list of benchmark storefront domains. */
export function getBenchmarkStorefronts(): readonly string[] {
  return benchmarkStoresJson as readonly string[];
}

/** Return the curated category map from categories.json. */
export function getCategories(): Record<string, string[]> {
  return categoriesJson as Record<string, string[]>;
}

/** Return all site domains belonging to a specific category. */
export function getSitesByCategory(category: string): string[] {
  const categories = getCategories();
  return categories[category] ?? [];
}
