import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { parseHtml } from "#core/parser";

const directory = "packages/core/test-data/sites";
const { brands, inputRows } = JSON.parse(
  fs.readFileSync(path.join(directory, "brands.json"), "utf8"),
);
const roleNames = ["Homepage", "PLP", "PDP", "Article"];
const shopDirectory = JSON.parse(
  fs.readFileSync(path.join(directory, "shop-directory.json"), "utf8"),
);
const researchByDomain = new Map(
  shopDirectory.brands.map((brand) => [brand.domain, brand]),
);
if (
  researchByDomain.size !== brands.length ||
  shopDirectory.brands.length !== brands.length
)
  throw new Error(
    "Shop research must cover the complete unique domain inventory",
  );
const mappings = Object.fromEntries(
  shopDirectory.brands.map((brand) => [brand.domain, brand.shops]),
);
fs.writeFileSync(
  path.join(directory, "shop-links.json"),
  JSON.stringify(mappings, null, 2) + "\n",
);
const reviewedLabels = JSON.parse(
  fs.readFileSync("packages/core/test-data/corpus/page-types.json", "utf8"),
).fixtures;
const reviewed = new Map(
  Object.entries(reviewedLabels).map(([name, label]) => {
    const record = JSON.parse(
      fs.readFileSync(
        `packages/core/test-data/corpus/real/${name}.json`,
        "utf8",
      ),
    );
    return [
      record.url,
      { expected: label.expected, knownMismatch: label.knownMismatch ?? false },
    ];
  }),
);
const reviewDomains = new Set([
  "petsmart.com",
  "belk.com",
  "ovs.it",
  "shiseido.com",
  "hardrock.com",
  "canon.no",
  "heathrow.com",
  "campingworld.com",
]);
const output = [];
for (const brand of brands) {
  const filename = `reports/brand-corpus/domains/${brand.domain}.json`;
  const result = fs.existsSync(filename)
    ? JSON.parse(fs.readFileSync(filename, "utf8"))
    : {};
  const pages = result.pages ?? [];
  const pageTypes = { ...result.pageTypes };
  const home = pages[0];
  // Record the requested entry route separately from the classifier's final-route label.
  if (
    home?.kind === "page" &&
    home.fixture &&
    pageTypes.Homepage?.status !== "machine-observed"
  ) {
    pageTypes.Homepage = {
      status: "entry-page-candidate",
      url: home.finalUrl,
      requestedUrl: home.url,
      fixture: home.fixture,
      classification: home.classification,
    };
  }
  const research = researchByDomain.get(brand.domain);
  if (!research) throw new Error(`Missing shop research: ${brand.domain}`);
  const shops = [];
  for (const role of research.shops.length ? ["PDP", "PLP"] : []) {
    const page = pageTypes[role];
    if (page?.url)
      shops.push({
        url: new URL(page.url).origin + "/",
        sourceUrl: page.url,
        status: "commerce-page-candidate",
      });
  }
  if (home?.fixture && research.shops.length && brand.domain !== "it.com") {
    const $ = parseHtml(gunzipSync(fs.readFileSync(home.fixture)).toString());
    $("a[href]").each((_index, el) => {
      try {
        const url = new URL($(el).attr("href"), home.finalUrl);
        const text = $(el).text().replace(/\s+/g, " ").trim();
        if (url.protocol !== "https:") return;
        if (
          /^(shop|store)\./i.test(url.hostname) ||
          /^(shop|store|shop now|shop online|online shop|webshop)$/i.test(text)
        ) {
          shops.push({
            url: url.origin + url.pathname,
            sourceUrl: home.finalUrl,
            linkText: text,
            status: "official-page-linked-candidate",
          });
        }
      } catch {
        /* Ignore links that are not URLs. */
      }
    });
  }
  // Candidate links remain separate from researched shop records.
  const uniqueShops = [
    ...new Map(shops.toReversed().map((shop) => [shop.url, shop])).values(),
  ];
  const roles = Object.fromEntries(
    roleNames.map((role) => {
      const page = pageTypes[role] ?? {
        status: "unresolved",
        reason:
          result.error ??
          "No supported page within bounded discovery; absence is not established",
      };
      const label = reviewed.get(page.url);
      const expected = {
        homepage: "Homepage",
        category: "PLP",
        product: "PDP",
        article: "Article",
      }[label?.expected];
      return [
        role,
        {
          ...page,
          ...(label && !label.knownMismatch && expected === role
            ? { status: "content-reviewed" }
            : {}),
          ...(label?.knownMismatch
            ? { status: "known-classifier-mismatch" }
            : {}),
        },
      ];
    }),
  );
  output.push({
    ...brand,
    nameReview: reviewDomains.has(brand.domain)
      ? "source-alias-conflict-review"
      : "unreviewed-aliases",
    discoveryStatus:
      result.discoveryVersion === 2 ? "completed-bounded-crawl" : "pending",
    checkedAt: result.checkedAt,
    sitemapDiscovery: result.sitemapDiscovery,
    shopResearch: {
      outcome: research.outcome,
      note: research.note,
      sourceUrl: research.sourceUrl,
    },
    shops: mappings[brand.domain] ?? [],
    machineShopCandidates: uniqueShops,
    pageTypes: roles,
    observedPages: pages.map((page) => ({
      requestedUrl: page.url,
      url: page.finalUrl,
      status: page.status,
      kind: page.kind,
      skipped: page.skipped,
      error: page.error,
      title: page.title,
      classification: page.classification,
      fixture: page.fixture,
      provenance: page.provenance,
    })),
  });
}
const summary = {
  inputRows,
  uniqueDomains: output.length,
  crawledDomains: output.filter(
    (brand) => brand.discoveryStatus === "completed-bounded-crawl",
  ).length,
  domainsWithShopCandidates: output.filter((brand) => brand.shops.length > 0)
    .length,
  shopResearch: shopDirectory.summary,
  pageRoles: Object.fromEntries(
    roleNames.map((role) => [
      role,
      output.filter((brand) => brand.pageTypes[role].url).length,
    ]),
  ),
  domainsWithAllFourRoleCandidates: output.filter((brand) =>
    roleNames.every((role) => brand.pageTypes[role].url),
  ).length,
  reviewedRolePages: output.reduce(
    (count, brand) =>
      count +
      Object.values(brand.pageTypes).filter(
        (page) => page.status === "content-reviewed",
      ).length,
    0,
  ),
};
const corpus = {
  generatedAt: new Date().toISOString(),
  summary,
  method:
    "Bounded discovery. URL and classifier candidates do not prove shop ownership, exhaustive coverage, or ground truth. Unresolved does not prove absence. Local captures live under ignored reports/.",
  brands: output,
};
fs.writeFileSync(
  path.join(directory, "brand-pages.json"),
  JSON.stringify(corpus, null, 2) + "\n",
);
// Research supplies exact shop routes. Closed shops and non-retail services stay out.
const benchmark = [
  ...new Set(
    shopDirectory.brands.flatMap((brand) =>
      brand.shops
        .filter(
          (shop) =>
            !["domain-registration", "order-form", "travel-booking"].includes(
              shop.commerceKind,
            ),
        )
        .map((shop) => shop.url),
    ),
  ),
].sort((a, b) => a.localeCompare(b));
fs.writeFileSync(
  path.join(directory, "benchmark-stores.json"),
  JSON.stringify(benchmark, null, 2) + "\n",
);
console.log(JSON.stringify(summary));
