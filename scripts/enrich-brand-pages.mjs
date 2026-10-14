import fs from "node:fs";
import {
  capture,
  roleFor,
  permitted,
  fetcher,
} from "./discover-brand-pages.mjs";

const brands = JSON.parse(
  fs.readFileSync("packages/core/test-data/sites/brands.json", "utf8"),
).brands;
const patterns = {
  Article: /\/(blogs?|articles?|news|stories|journal|magazine)\/[^/?]+/i,
  PLP: /\/(collections?|categor(?:y|ies)|c)\/[^/?]+/i,
  PDP: /\/(products?|p|pd)\/[^/?]+|\.html$/i,
};
function locations(body) {
  return [
    ...body.matchAll(
      /<loc\b[^>]*>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/gs,
    ),
  ].map((match) => match[1].replace(/&amp;/g, "&").trim());
}
async function sitemap(url) {
  if (await permitted(url)) return undefined;
  const result = await fetcher.fetch({ url, timeout: 10000 });
  if (
    result.error ||
    result.status !== 200 ||
    !/<(?:sitemapindex|urlset)\b/i.test(result.body)
  )
    return undefined;
  return {
    url: result.finalUrl,
    index: /<sitemapindex\b/i.test(result.body),
    urls: locations(result.body),
  };
}
async function enrich(brand) {
  const filename = `reports/brand-corpus/domains/${brand.domain}.json`;
  if (!fs.existsSync(filename)) return;
  const result = JSON.parse(fs.readFileSync(filename, "utf8"));
  if (result.sitemapDiscovery) return;
  const home = result.pages?.[0];
  const missing = Object.keys(patterns).filter(
    (role) => !result.pageTypes?.[role]?.url,
  );
  if (home?.kind !== "page" || !missing.length) {
    result.sitemapDiscovery = {
      status: "not-needed-or-home-unreadable",
      checkedAt: new Date().toISOString(),
    };
    fs.writeFileSync(filename, JSON.stringify(result, null, 2) + "\n");
    return;
  }
  const origin = new URL(home.finalUrl).origin;
  const root = await sitemap(`${origin}/sitemap.xml`);
  const sources = root ? [root] : [];
  const urls = root && !root.index ? root.urls : [];
  if (root?.index) {
    const children = root.urls.filter((url) => {
      try {
        return new URL(url).origin === origin;
      } catch {
        return false;
      }
    });
    children.sort(
      (a, b) =>
        Number(/blog|article|news|product|categor|collection/i.test(b)) -
        Number(/blog|article|news|product|categor|collection/i.test(a)),
    );
    for (const url of children.slice(0, 3)) {
      const child = await sitemap(url);
      if (!child) continue;
      sources.push(child);
      if (!child.index) urls.push(...child.urls);
    }
  }
  const visited = new Set(result.pages.map((page) => page.url));
  const attempts = [];
  for (const role of missing) {
    const candidates = [...new Set(urls)].filter((url) => {
      try {
        const parsed = new URL(url);
        return (
          parsed.origin === origin &&
          patterns[role].test(parsed.pathname) &&
          !visited.has(url)
        );
      } catch {
        return false;
      }
    });
    for (const url of candidates.slice(0, 2)) {
      visited.add(url);
      const page = await capture(url, brand.domain);
      const observed = roleFor(page);
      const { links: _links, ...record } = page;
      result.pages.push(record);
      attempts.push({
        url,
        requestedRole: role,
        observedRole: observed,
        kind: page.kind,
        skipped: page.skipped,
      });
      if (observed && !result.pageTypes[observed]?.url)
        result.pageTypes[observed] = {
          url: page.finalUrl,
          requestedUrl: page.url,
          fixture: page.fixture,
          classification: page.classification,
          status: "machine-observed",
          discoverySource: "sitemap",
        };
      if (result.pageTypes[role]?.url) break;
    }
  }
  result.sitemapDiscovery = {
    status: root ? "checked" : "unavailable",
    checkedAt: new Date().toISOString(),
    sources: sources.map((source) => ({
      url: source.url,
      locationCount: source.urls.length,
    })),
    attempts,
  };
  fs.writeFileSync(filename, JSON.stringify(result, null, 2) + "\n");
  console.log(
    `${brand.domain}: sitemap ${result.sitemapDiscovery.status}, ${attempts.length} page probes`,
  );
}
let index = 0;
await Promise.all(
  Array.from({ length: 16 }, async () => {
    while (index < brands.length) {
      const brand = brands[index++];
      try {
        await enrich(brand);
      } catch (error) {
        console.log(`${brand.domain}: ${String(error)}`);
      }
    }
  }),
);
