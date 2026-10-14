import * as fs from "node:fs";
import * as path from "node:path";
import { normalize, SiteSource } from "#core/tests/site-list";

/** Rebuild the live corpus from the supplied brand inventory, without network IO. */
const directory = path.resolve("packages/core/test-data/sites");
const input = JSON.parse(
  fs.readFileSync(path.join(directory, "brands.json"), "utf8"),
) as { brands: Array<{ domain: string }>; smoke?: string[] };
const domains = input.brands
  .map(({ domain }) => {
    if (normalize(domain) !== domain)
      throw new Error(`Invalid brand domain: ${domain}`);
    return domain;
  })
  .sort((a, b) => a.localeCompare(b));
if (new Set(domains).size !== domains.length)
  throw new Error("Duplicate brand domains");
const smoke = new Set(input.smoke ?? []);
for (const domain of smoke) {
  if (!domains.includes(domain))
    throw new Error(`Smoke domain is not in brand inventory: ${domain}`);
}
const sites = domains.map((domain) => ({
  domain,
  source: SiteSource.Seed,
  category: "brand",
  // This input carries no measured traffic rank.
  rankBucket: 100,
  ...(smoke.has(domain) ? { tier: "smoke" } : {}),
}));
for (const [filename, data] of Object.entries({
  "sites.json": sites,
  "seeds.json": {
    smoke: [...smoke],
    categories: {
      brand: {
        why: "User-supplied company domains; shop and page roles require live verification.",
        domains,
      },
    },
  },
  "candidates.json": { brand: domains },
})) {
  fs.writeFileSync(
    path.join(directory, filename),
    `${JSON.stringify(data, null, 2)}\n`,
  );
}
console.log(
  `${sites.length} brand domains -> ${path.join(directory, "sites.json")}`,
);
