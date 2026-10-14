import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { createFetcher } from "#core/fetcher";
import {
  parseHtml,
  classifyPage,
  extractJsonLd,
  extractMicrodata,
  extractRdfa,
  extractMetaTags,
} from "#core/parser";
import {
  parseRobots,
  isPathAllowed,
  groupsForBot,
} from "#core/gatherers/robots";
import { SCANNER_USER_AGENT } from "#core/constants";
import { classifyCapture } from "#core/tests/fixture-io";

// Discovery labels are machine observations, not independent ground truth.
const root = "reports/brand-corpus";
const brands = JSON.parse(
  fs.readFileSync("packages/core/test-data/sites/brands.json", "utf8"),
).brands;
const fetcher = createFetcher({ maxConcurrent: 12 });
const token = SCANNER_USER_AGENT.split("/")[0].toLowerCase();
const robots = new Map();
const pageKinds = {
  homepage: "Homepage",
  category: "PLP",
  product: "PDP",
  article: "Article",
};
const patterns = {
  PDP: /\/products?\/[^/?]+|\.html$|\/p\/|\/pd\/|\/productdetails\//i,
  PLP: /\/collections?\/|\/categor(?:y|ies)\/|\/c\/|\/shop\/?$|\/women\/?$|\/men\/?$|\/catalog/i,
  Article:
    /\/blogs?\/[^/]+\/[^/]+|\/articles?\/|\/stories\/[^/]+|\/news\/[^/]+|\/journal\/[^/]+|\/magazine\/[^/]+/i,
  hub: /\/(shop|store|blog|news|journal|stories|magazine)(\/|$)/i,
};
async function permitted(url) {
  const u = new URL(url);
  if (!robots.has(u.origin)) {
    const r = await fetcher.fetch({
      url: `${u.origin}/robots.txt`,
      timeout: 10000,
    });
    robots.set(
      u.origin,
      r.status === 200
        ? { groups: parseRobots(r.body) }
        : {
            groups: [],
            refused: [401, 403, 429].includes(r.status),
            error: r.error,
          },
    );
  }
  const r = robots.get(u.origin);
  if (r.refused) return "robots-refused";
  if (r.error) return `robots-unavailable: ${r.error}`;
  if (groupsForBot(r.groups, token).some((g) => (g.crawlDelay ?? 0) > 0))
    return "crawl-delay";
  return isPathAllowed(r.groups, token, u.pathname + u.search)
    ? undefined
    : "robots-disallow";
}
async function capture(url, domain) {
  const skipped = await permitted(url);
  if (skipped) return { url, skipped, links: [] };
  const r = await fetcher.fetch({ url, timeout: 12000 });
  const record = {
    url,
    finalUrl: r.finalUrl,
    status: r.status,
    error: r.error,
    capturedAt: new Date().toISOString(),
    links: [],
  };
  if (r.error || !r.status) return record;
  const id = createHash("sha256").update(url).digest("hex").slice(0, 16);
  const dir = path.join(root, "captures", domain);
  fs.mkdirSync(dir, { recursive: true });
  const kind = classifyCapture(r);
  const provenance = {
    url: r.finalUrl,
    requestedUrl: url,
    capturedAt: record.capturedAt,
    sha256: createHash("sha256").update(r.body).digest("hex"),
    status: r.status,
    kind,
    headers: r.headers,
    contentType: r.contentType,
    ttfbMs: r.ttfbMs,
    totalMs: r.totalMs,
    contentLength: r.contentLength,
    redirectChain: r.redirectChain,
  };
  fs.writeFileSync(path.join(dir, `${id}.html.gz`), gzipSync(r.body));
  fs.writeFileSync(
    path.join(dir, `${id}.json`),
    JSON.stringify(provenance, null, 2) + "\n",
  );
  Object.assign(record, {
    kind,
    fixture: path.join(dir, `${id}.html.gz`),
    provenance: path.join(dir, `${id}.json`),
  });
  if (kind !== "page" || !r.contentType.includes("html")) return record;
  const $ = parseHtml(r.body);
  const classification = classifyPage(
    r.finalUrl,
    $,
    [...extractJsonLd($), ...extractMicrodata($), ...extractRdfa($)],
    extractMetaTags($),
  );
  record.classification = classification;
  record.pageType = pageKinds[classification.type];
  record.title = $("title").first().text().trim();
  record.h1 = $("h1").first().text().trim();
  $("a[href]").each((_, el) => {
    try {
      const u = new URL($(el).attr("href"), r.finalUrl);
      u.hash = "";
      if (
        u.protocol !== "https:" ||
        /\.(pdf|jpg|png|zip|svg|mp4)(\?|$)/i.test(u.href)
      )
        return;
      if (/(login|signin|checkout|cart|logout|account)/i.test(u.pathname))
        return;
      record.links.push({
        url: u.href,
        text: $(el).text().replace(/\s+/g, " ").trim().slice(0, 120),
      });
    } catch {}
  });
  record.links = [
    ...new Map(record.links.map((l) => [l.url, l])).values(),
  ].slice(0, 1500);
  return record;
}
function roleFor(p) {
  if (p.kind !== "page" || !p.classification) return undefined;
  const signals = p.classification.signals;
  const pathname = new URL(p.finalUrl).pathname;
  if (p.classification.type === "homepage") return "Homepage";
  const editorialHub =
    /\/(blogs?|articles?|stories|news|journal|magazine)\/?$/i.test(pathname);
  if (
    p.classification.type === "article" &&
    !editorialHub &&
    signals.some(
      (s) => s === "article-schema-hint" || s === "primary-article-prose",
    )
  )
    return "Article";
  if (
    !/\/(blogs?|articles?|stories|news|journal|magazine)(\/|$)/i.test(
      pathname,
    ) &&
    (signals.includes("product-grid") ||
      signals.includes("listing-schema-hint") ||
      (/\/(c|collections?|categor(?:y|ies))\//i.test(pathname) &&
        signals.includes("purchase-controls")))
  )
    return "PLP";
  if (
    signals.includes("product-schema-primary") ||
    (signals.includes("purchase-controls") &&
      signals.includes("product-url-hint"))
  )
    return "PDP";
  return undefined;
}
async function discover(brand) {
  const file = path.join(root, "domains", `${brand.domain}.json`);
  const previous = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : undefined;
  if (previous?.discoveryVersion === 2) return;
  const pages = previous?.pages ?? [];
  const candidates = new Map(
    (previous?.candidates ?? []).map((c) => [c.url, c]),
  );
  const visited = new Set(pages.map((p) => p.url));
  const types = {};
  const shops = [];
  const allowedHost = (h) =>
    h.replace(/^www\./, "") === brand.domain || h.endsWith(`.${brand.domain}`);
  const home =
    pages[0] ?? (await capture(`https://${brand.domain}/`, brand.domain));
  if (!pages.length) pages.push(home);
  visited.add(home.url);
  function ingest(p) {
    p.pageType = roleFor(p);
    if (p.pageType && !types[p.pageType])
      types[p.pageType] = {
        url: p.finalUrl,
        requestedUrl: p.url,
        fixture: p.fixture,
        classification: p.classification,
        status: "machine-observed",
      };
    for (const l of p.links ?? []) {
      const u = new URL(l.url);
      const internal = allowedHost(u.hostname);
      const explicitShop =
        /^(shop|store|online shop|shop now|shop online|webshop|buy now)$/i.test(
          l.text,
        ) || /^(shop|store)\./i.test(u.hostname);
      if (!internal && !explicitShop) continue;
      const wanted = Object.entries(patterns)
        .filter((entry) => entry[1].test(u.pathname))
        .map(([k]) => k);
      if (explicitShop) {
        wanted.push("hub");
        shops.push({
          url: u.origin + "/",
          sourceUrl: p.finalUrl,
          linkText: l.text,
          status: "linked-candidate",
        });
      }
      if (wanted.length && !visited.has(l.url))
        candidates.set(l.url, { ...l, wanted });
    }
  }
  for (const page of pages) ingest(page);
  const budget = previous ? 4 : 12;
  for (let i = 0; i < budget; i++) {
    const choices = [...candidates.values()].filter((l) => !visited.has(l.url));
    choices.sort((a, b) => score(b) - score(a));
    function score(l) {
      return l.wanted.reduce(
        (s, k) => s + (k === "hub" ? 1 : types[k] ? 0 : 4),
        0,
      );
    }
    const next = choices.find((l) => score(l) > 0);
    if (!next) break;
    visited.add(next.url);
    const p = await capture(next.url, brand.domain);
    pages.push(p);
    ingest(p);
    if (Object.keys(types).length === 4) break;
  }
  const confirmedShop = types.PDP || types.PLP;
  const result = {
    ...brand,
    discoveryVersion: 2,
    checkedAt: new Date().toISOString(),
    shopStatus: confirmedShop ? "commerce-candidate" : "unresolved",
    shopUrl: confirmedShop ? new URL(confirmedShop.url).origin : undefined,
    shops: [...new Map(shops.map((s) => [s.url, s])).values()],
    pageTypes: Object.fromEntries(
      ["Homepage", "PLP", "PDP", "Article"].map((t) => [
        t,
        types[t] ?? {
          status: "unresolved",
          reason:
            home.skipped ??
            "No supported page within bounded discovery; this does not prove absence",
        },
      ]),
    ),
    pages: pages.map(({ links: _links, ...p }) => p),
    candidates: [...candidates.values()],
  };
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
  console.log(
    `${brand.domain}: ${Object.keys(types).join(",") || home.skipped || home.error || `HTTP ${home.status}`}`,
  );
}
export { capture, roleFor, permitted, fetcher };

if (process.argv[1]?.endsWith("discover-brand-pages.mjs")) {
  fs.mkdirSync(path.join(root, "domains"), { recursive: true });
  let index = 0;
  await Promise.all(
    Array.from({ length: 16 }, async () => {
      while (index < brands.length) {
        const b = brands[index++];
        try {
          await discover(b);
        } catch (e) {
          fs.writeFileSync(
            path.join(root, "domains", `${b.domain}.json`),
            JSON.stringify({ ...b, error: String(e) }) + "\n",
          );
          console.log(`${b.domain}: ERROR ${String(e)}`);
        }
      }
    }),
  );
  const results = brands.map((b) =>
    JSON.parse(
      fs.readFileSync(path.join(root, "domains", `${b.domain}.json`), "utf8"),
    ),
  );
  fs.writeFileSync(
    path.join(root, "manifest.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        method:
          "Bounded link discovery; machine labels require review before use as classifier ground truth",
        brands: results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Done: ${results.length} domains`);
}
