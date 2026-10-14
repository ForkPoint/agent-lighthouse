import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import {
  parseHtml,
  classifyPage,
  extractJsonLd,
  extractMicrodata,
  extractRdfa,
  extractMetaTags,
} from "#core/parser";
import {
  capture,
  roleFor,
  permitted,
  fetcher,
} from "./discover-brand-pages.mjs";

const directory = "packages/core/test-data/sites";
const root = "reports/brand-corpus/shop-page-links";
const research = JSON.parse(
  fs.readFileSync(`${directory}/shop-directory.json`, "utf8"),
);
const roles = ["PLP", "PDP", "Article"];
const target = 3;
const offline = process.env.SHOP_PAGE_OFFLINE === "1";
const budget = offline ? 0 : Number(process.env.SHOP_PAGE_BUDGET ?? 36);
const cache = new Map();
const linkCache = new Map();
const sitemapCache = new Map();
const reviewFile = `${directory}/page-link-reviews.json`;
const reviewed = new Map(
  (fs.existsSync(reviewFile)
    ? JSON.parse(fs.readFileSync(reviewFile, "utf8"))
    : []
  ).map((review) => [review.url, review]),
);
const reviewedCheckedAt = new Map();
const reviewedRevisions = new Map();
for (const review of reviewed.values()) {
  const domain = review.fixture.match(
    /\/(?:browser-captures|captures)\/([^/]+)\//,
  )?.[1];
  if (domain)
    reviewedCheckedAt.set(
      domain,
      Math.max(
        reviewedCheckedAt.get(domain) ?? 0,
        Date.parse(review.checkedAt),
      ),
    );
  if (domain)
    reviewedRevisions.set(
      domain,
      createHash("sha256")
        .update(
          JSON.stringify(
            [...reviewed.values()].filter((value) =>
              value.fixture.includes(`/${domain}/`),
            ),
          ),
        )
        .digest("hex"),
    );
}
const rolePatterns = {
  PLP: /\/(collections?|categor(?:y|ies)|c|shop|catalog|catalogue|women|woman|men|man|womens|mens|damen|herren|femme|homme|mujer|hombre|donna|uomo|brands|products)(\/|$)|\/l\/|clothing|footwear|accessories|new-arrivals/i,
  PDP: /\/(products?|p|pd|produkt|producto|produto|articolo)\/[^/?]+|\.html$|\/shop\/[^/]+|\d{5,}/i,
  Article:
    /\/(blogs?|articles?|news|stories|story|journal|magazin[e]?|learn|inspiration|inspire|advice|guides?|recipes?|recettes|ricette|noticias|actualites|notizie|nachrichten|consejos|tips|editorial|lifestyle|expertise|world|discover|explore|culture|heritage|experiences?)(\/|[-.]|$)/i,
};
const reject =
  /\.(pdf|png|jpe?g|svg|webp|gif|avif|zip|gz|mp3|mp4|m4a|wav|woff2?)(\?|$)|\/(login|signin|logout|account|checkout|cart|basket|wishlist|privacy|terms|legal|careers|contact|returns?|faq|store-locator|storefinder|stores|support)(\/|\.|$)|demandware\.(static|store)|[?&](storeId|StoreID)=/i;
function normal(url) {
  const u = new URL(url);
  if (!/^#(?:\/|!)/.test(u.hash)) u.hash = "";
  // Snapshot keys because deleting while iterating can skip adjacent tracking params.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const key of [...u.searchParams.keys()]) {
    if (
      /^(utm_.+|srsltid|gclid|fbclid|msclkid|mc_cid|mc_eid|cjevent|cjdata|refCodeCTV)$/i.test(
        key,
      )
    )
      u.searchParams.delete(key);
  }
  u.searchParams.sort();
  return u.href;
}
function linksFor(page) {
  if (!page.fixture || page.kind !== "page" || !fs.existsSync(page.fixture))
    return [];
  const key = `${page.fixture}\n${page.finalUrl}`;
  if (linkCache.has(key)) return linkCache.get(key);
  const $ = parseHtml(gunzipSync(fs.readFileSync(page.fixture)).toString());
  const links = $("a[href]")
    .toArray()
    .flatMap((element) => {
      try {
        return [
          {
            url: normal(new URL($(element).attr("href"), page.finalUrl).href),
            text: $(element).text().replace(/\s+/g, " ").trim().slice(0, 160),
          },
        ];
      } catch {
        return [];
      }
    });
  linkCache.set(key, links);
  return links;
}
function remember(page) {
  if (!page.url) return;
  page.finalUrl ??= page.url;
  if (page.provenance && fs.existsSync(page.provenance)) {
    const provenance = JSON.parse(fs.readFileSync(page.provenance, "utf8"));
    page.finalUrl = provenance.url;
    page.url = provenance.requestedUrl ?? provenance.url;
  }
  const key = normal(page.url);
  if (
    !cache.has(key) ||
    (page.kind === "page" && cache.get(key)?.kind !== "page")
  )
    cache.set(key, page);
}
for (const filename of fs.readdirSync("reports/brand-corpus/domains")) {
  const result = JSON.parse(
    fs.readFileSync(`reports/brand-corpus/domains/${filename}`, "utf8"),
  );
  for (const page of result.pages ?? []) remember(page);
}
for (const brand of research.brands)
  for (const shop of brand.shops)
    remember({ url: shop.url, ...shop.verification });
if (fs.existsSync(root)) {
  for (const filename of fs.readdirSync(root)) {
    const result = JSON.parse(
      fs.readFileSync(path.join(root, filename), "utf8"),
    );
    for (const page of Object.values(result.pageTypes ?? {}).flat())
      remember({ ...page, status: 200, kind: "page" });
    for (const page of result.attempts ?? []) remember(page);
  }
}
// Manual reviews must remain discoverable even when no earlier run selected them.
for (const review of reviewed.values()) {
  const provenance = review.fixture.replace(/\.html\.gz$/, ".json");
  if (!fs.existsSync(review.fixture) || !fs.existsSync(provenance)) continue;
  const metadata = JSON.parse(fs.readFileSync(provenance, "utf8"));
  const capturedHash = createHash("sha256")
    .update(gunzipSync(fs.readFileSync(review.fixture)))
    .digest("hex");
  if (capturedHash !== review.sha256) continue;
  if (
    metadata.status !== 200 ||
    metadata.kind !== "page" ||
    metadata.sha256 !== review.sha256
  )
    continue;
  remember({
    url: metadata.requestedUrl ?? metadata.url,
    finalUrl: metadata.url,
    status: metadata.status,
    kind: metadata.kind,
    fixture: review.fixture,
    provenance,
  });
}
const browserRoot = "reports/brand-corpus/browser-captures";
const browserCheckedAt = new Map();
const browserObservations = new Map();
if (fs.existsSync(browserRoot)) {
  for (const domain of fs.readdirSync(browserRoot)) {
    for (const filename of fs
      .readdirSync(path.join(browserRoot, domain))
      .filter((name) => name.endsWith(".record.json"))) {
      const page = JSON.parse(
        fs.readFileSync(path.join(browserRoot, domain, filename), "utf8"),
      );
      browserCheckedAt.set(
        domain,
        Math.max(
          browserCheckedAt.get(domain) ?? 0,
          Date.parse(page.capturedAt),
        ),
      );
      const observations = browserObservations.get(domain) ?? [];
      observations.push({
        url: page.finalUrl ?? page.url,
        status: page.status,
        kind: page.kind,
        accessReason: page.accessReason,
        provenance: page.provenance,
      });
      browserObservations.set(domain, observations);
      if (page.kind === "page") cache.set(normal(page.url), page);
    }
  }
}
async function readPage(url, domain) {
  const key = normal(url);
  let page = cache.get(key);
  if (
    !offline &&
    (page?.skipped === "crawl-delay" ||
      page?.skipped?.startsWith("robots-unavailable:"))
  )
    page = undefined;
  if (!page) {
    if (offline)
      return {
        url: key,
        finalUrl: key,
        skipped: "not-captured-in-offline-pass",
        links: [],
      };
    const promise = capture(key, domain);
    cache.set(key, promise);
    page = await promise;
    cache.set(key, page);
  } else page = await page;
  // A robots refusal has no response URL. Keep the requested URL for gap records.
  page.finalUrl ??= page.url;
  if (page.kind === "page" && !page.classification && page.fixture) {
    const $ = parseHtml(gunzipSync(fs.readFileSync(page.fixture)).toString());
    page.classification = classifyPage(
      page.finalUrl,
      $,
      [...extractJsonLd($), ...extractMicrodata($), ...extractRdfa($)],
      extractMetaTags($),
    );
    page.title ??= $("title").first().text().trim();
  }
  if (page.kind === "page" && page.fixture) {
    const $ = parseHtml(gunzipSync(fs.readFileSync(page.fixture)).toString());
    $(
      "nav,header,footer,aside,[hidden],[aria-hidden=true],[class*=carousel],[class*=swiper],[class*=related],[class*=recommend]",
    ).remove();
    const primary = $("main").first().length
      ? $("main").first()
      : $("#maincontent,#main-content,#MainContent").first();
    const cards = primary
      .find(
        "li.product-item,.product-item-info,.product-card,.product-tile,.producttile",
      )
      .toArray();
    const products = new Set();
    for (const card of cards) {
      const item = $(card);
      const link = item.find("a[href]").first().attr("href");
      const price = item
        .find(
          ".price,.product-card__price,[itemprop=price],[class*=product-price],[data-price]",
        )
        .first()
        .text()
        .trim();
      if (link && price) {
        try {
          products.add(normal(new URL(link, page.finalUrl).href));
        } catch {
          /* Ignore non-URL card links. */
        }
      }
    }
    const sorting =
      primary.find(
        ".toolbar-sorter,select[name*=sort],[id*=sorter],[class*=sort-options],.pager,[class*=pagination]",
      ).length > 0;
    const namedProductGrid =
      new URL(page.finalUrl).pathname.startsWith("/w/") &&
      primary.find(".product-grid__card").length >= 3;
    if (products.size >= 3 && (sorting || namedProductGrid))
      page.listingContent = {
        distinctPricedCards: products.size,
        sortingOrPagination: sorting,
        namedProductGrid,
      };
  }
  const pathname = new URL(page.finalUrl).pathname;
  const editorialDetail =
    /\/(blogs?|journal|stories|bb-world|magazine|recipes?|recettes|ricette|expert-advice|news(?:-and-events)?)(\/[^/]+|[-_][^/]+\.html)/i.test(
      pathname,
    ) &&
    !/(?:blog|journal|stories|news)(?:-homepage|-home|-index)?\.html$/i.test(
      pathname,
    );
  if (
    page.kind === "page" &&
    page.fixture &&
    (rolePatterns.Article.test(new URL(page.finalUrl).pathname) ||
      page.classification?.signals.includes("article-open-graph")) &&
    (editorialDetail ||
      !page.classification?.signals.some(
        (signal) =>
          signal === "product-schema-primary" || signal === "purchase-controls",
      ))
  ) {
    const $ = parseHtml(gunzipSync(fs.readFileSync(page.fixture)).toString());
    $(
      "nav,header,footer,aside,script,style,noscript,form,[hidden],[aria-hidden=true],[class*=related],[class*=recommend],[class*=carousel],.product-card,.product-tile,.producttile",
    ).remove();
    const primary = $("main").first().length
      ? $("main").first()
      : $(
          "#maincontent,#main-content,#MainContent,#main,[role=main],article,.blog-post",
        ).first();
    const heading =
      primary.find("h1").first().text().trim() ||
      (editorialDetail
        ? primary.find("h2").first().text().trim() || page.title
        : "");
    const paragraphs = primary
      .find("p")
      .toArray()
      .map((element) => $(element).text().trim())
      .filter((text) => text.length >= 40);
    const prose = paragraphs.join(" ");
    const sectionedText = primary.text().replace(/\s+/g, " ").trim();
    if (
      heading &&
      !/^(blog|news|stories|journal|magazine|articles|inspiration|learn)$/i.test(
        heading,
      ) &&
      ((paragraphs.length >= 3 && prose.length >= 500) ||
        (editorialDetail &&
          primary.find("h2,h3").length >= 2 &&
          sectionedText.length >= 1000)) &&
      !/\/(blogs?|stories|journal|news|magazine|learn|recipes)\/?$/i.test(
        pathname,
      ) &&
      (editorialDetail ||
        !page.classification?.signals.includes("product-grid"))
    ) {
      page.editorialContent = {
        heading,
        paragraphs: paragraphs.length,
        textChars: Math.max(prose.length, sectionedText.length),
        proseChars: prose.length,
        editorialDetail,
      };
    }
  }
  return { ...page, links: linksFor(page) };
}
async function sitemapUrls(origin, allowed) {
  if (sitemapCache.has(origin)) return sitemapCache.get(origin);
  const promise = (async () => {
    const seeds = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
    const robotsAllowed = await permitted(`${origin}/robots.txt`);
    const robots = robotsAllowed
      ? undefined
      : await fetcher.fetch({
          url: `${origin}/robots.txt`,
          timeout: 10000,
        });
    if (robots?.status === 200)
      seeds.unshift(
        ...[...robots.body.matchAll(/^sitemap:\s*(\S+)/gim)].map(
          (match) => match[1],
        ),
      );
    const pending = [...new Set(seeds)];
    const visited = new Set();
    const urls = new Set();
    const sources = [];
    while (pending.length && visited.size < 8) {
      const url = pending.shift();
      if (visited.has(url) || !allowed(url)) continue;
      visited.add(url);
      const refused = await permitted(url);
      if (refused) {
        sources.push({ url, skipped: refused });
        continue;
      }
      const result = await fetcher.fetch({ url, timeout: 10000 });
      if (
        result.error ||
        result.status !== 200 ||
        !/<(?:sitemapindex|urlset)\b/i.test(result.body)
      )
        continue;
      const locations = [
        ...result.body.matchAll(
          /<loc\b[^>]*>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/gs,
        ),
      ]
        .map((match) => match[1].replace(/&amp;/g, "&").trim())
        .filter(allowed);
      sources.push({ url: result.finalUrl, locationCount: locations.length });
      if (/<sitemapindex\b/i.test(result.body)) {
        const editorial = locations.filter((location) =>
          /blog|article|news|stor|journal|content/i.test(location),
        );
        const listings = locations.filter((location) =>
          /categor|collection|catalog/i.test(location),
        );
        const products = locations.filter(
          (location) => /product/i.test(location) && !/image/i.test(location),
        );
        const diverse = [
          ...new Set([
            ...editorial.slice(0, 2),
            ...listings.slice(0, 1),
            ...products.slice(0, 2),
            ...locations,
          ]),
        ];
        pending.unshift(...diverse.slice(0, 6));
      } else for (const location of locations) urls.add(normal(location));
    }
    return { urls: [...urls], sources };
  })();
  sitemapCache.set(origin, promise);
  return promise;
}
function contentReviewFor(page) {
  const review = reviewed.get(normal(page.finalUrl ?? page.url));
  if (!review || review.fixture !== page.fixture || !page.provenance)
    return undefined;
  const metadata = JSON.parse(fs.readFileSync(page.provenance, "utf8"));
  return metadata.sha256 === review.sha256 ? review : undefined;
}
function hasCurrentContentReviews(record) {
  return Object.entries(record.pageTypes).every(([role, pages]) =>
    pages.every((page) => {
      if (!page.contentReview) return true;
      const review = contentReviewFor(page);
      return (
        review?.role === role &&
        page.contentReview.fixture === page.fixture &&
        page.contentReview.sha256 === review.sha256
      );
    }),
  );
}
function evidenceRole(page) {
  const finalUrl = new URL(page.finalUrl ?? page.url);
  const editorialPath =
    /\/(blogs?|journal|bb-world|stories|news|articles)(\/|$)/i.test(
      finalUrl.pathname,
    );
  if (
    page.status !== 200 ||
    page.kind !== "page" ||
    /client challenge|access.{0,40}denied|robot check|just a moment|captcha|^GDPR$/i.test(
      page.title ?? "",
    ) ||
    /(?:create|manage|my)[-_]account|sign[-_]in|log[-_]in/i.test(
      finalUrl.pathname,
    ) ||
    reject.test(finalUrl.href) ||
    /(?:^|[.-])(uat|ccuat|dev|stg|stage|staging|test)(?:[.-]|$)/i.test(
      finalUrl.hostname,
    ) ||
    /\/UAT[_/]/i.test(finalUrl.pathname)
  )
    return undefined;
  const review = contentReviewFor(page);
  if (review) return review.role;
  if (page.listingContent) return "PLP";
  const role = page.editorialContent ? "Article" : roleFor(page);
  if (role === "PDP" && editorialPath) return undefined;
  const hostname = finalUrl.hostname.replace(/^www\./, "");
  // Reviewed brand templates: an editorial index and a course/tour directory.
  if (
    role === "Article" &&
    ((hostname === "diesel.com" &&
      finalUrl.pathname.endsWith("/editorial/home.html")) ||
      (hostname === "dainese.com" &&
        finalUrl.pathname.endsWith("/experience.html")))
  )
    return undefined;
  if (
    role === "Article" &&
    (/\/(blogs?|stories|journal|news|magazine|learn|recipes)\/?$/i.test(
      finalUrl.pathname,
    ) ||
      /\barchives(?:\s*[-|]|$)/i.test(page.title ?? ""))
  )
    return undefined;
  // Archive pages collect article previews rather than one complete article.
  if (
    role === "Article" &&
    /\/(category|categories|categorias|tags?|archive)\/[^/]+\/?$/i.test(
      finalUrl.pathname,
    )
  )
    return undefined;
  // Commerce templates can declare Article markup on an empty product category.
  if (
    role === "Article" &&
    /\/(categoria-producto|product-category|collections?|products?|producto|produto)(\/|$)/i.test(
      finalUrl.pathname,
    ) &&
    !page.editorialContent
  )
    return undefined;
  if (
    role === "Article" &&
    /sizechart|size-chart|corporate-wholesale|quality-guarantee|warranty|verifica-recensioni|privacy|terms|cookie|shipping|delivery|payment|refund|returns|faq|conditions|polic|accessibility|legal|loyalty|membership|newsletter|subscribe|signup|registration/i.test(
      page.finalUrl,
    )
  )
    return undefined;
  return role;
}
async function discover(brand, shop) {
  const requestedShopHost = new URL(shop.url).hostname.replace(/^www\./, "");
  const needsMappedBrandEditorial =
    brand.domain === "it.com" ||
    (requestedShopHost !== brand.domain &&
      !requestedShopHost.endsWith(`.${brand.domain}`));
  const id = createHash("sha256").update(shop.url).digest("hex").slice(0, 16);
  const filename = path.join(root, `${brand.domain}-${id}.json`);
  if (fs.existsSync(filename)) {
    const previous = JSON.parse(fs.readFileSync(filename, "utf8"));
    if (
      previous.discoveryVersion === 26 &&
      (!needsMappedBrandEditorial ||
        previous.mappedBrandEditorialDomain === brand.domain) &&
      hasCurrentContentReviews(previous) &&
      (offline ||
        previous.status === "nine-links-found" ||
        previous.probeBudget >= budget) &&
      previous.contentReviewRevision === reviewedRevisions.get(brand.domain) &&
      Math.max(
        browserCheckedAt.get(brand.domain) ?? 0,
        reviewedCheckedAt.get(brand.domain) ?? 0,
      ) <= Date.parse(previous.checkedAt)
    )
      return previous;
  }
  const entry = await readPage(shop.url, brand.domain);
  const hosts = new Set(
    [
      new URL(shop.url).hostname,
      new URL(entry.finalUrl ?? shop.url).hostname,
    ].map((host) => host.replace(/^www\./, "")),
  );
  const ownedDomain =
    brand.domain !== "it.com" &&
    [...hosts].some(
      (host) => host === brand.domain || host.endsWith(`.${brand.domain}`),
    )
      ? brand.domain
      : undefined;
  const editorialHosts = new Map();
  const editorialScopes = new Map();
  if (needsMappedBrandEditorial && !ownedDomain) {
    // The supplied brand domain owns editorial content; its mapped shop may
    // use another domain. This scope supplies Article examples only.
    editorialHosts.set(brand.domain, `https://${brand.domain}/`);
    editorialScopes.set(brand.domain, ["/"]);
  }
  const editorialLink =
    /blog|journal|stories|magazine|news|press|editorial|inspiration|presse|notizie|nieuws|nyheter|noticias/i;
  const allowed = (url) => {
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol === "https:" &&
        !/^(intranet|admin|staff|employee|auth|cdn|assets|static)\./i.test(
          parsed.hostname,
        ) &&
        !/(?:^|[.-])(uat|ccuat|dev|stg|stage|staging|test)(?:[.-]|$)/i.test(
          parsed.hostname,
        ) &&
        (hosts.has(parsed.hostname.replace(/^www\./, "")) ||
          (editorialHosts.has(parsed.hostname.replace(/^www\./, "")) &&
            editorialScopes
              .get(parsed.hostname.replace(/^www\./, ""))
              .some(
                (scope) =>
                  scope === "/" ||
                  parsed.pathname === scope ||
                  parsed.pathname.startsWith(scope + "/"),
              )) ||
          (ownedDomain &&
            (parsed.hostname === ownedDomain ||
              parsed.hostname.endsWith(`.${ownedDomain}`)))) &&
        !reject.test(url)
      );
    } catch {
      return false;
    }
  };
  const found = Object.fromEntries(roles.map((role) => [role, []]));
  const identities = Object.fromEntries(roles.map((role) => [role, new Set()]));
  const attempted = new Set();
  const candidates = new Map();
  const attempts = [];
  const addCandidate = (url, text, sourceUrl, source, requestedRole) => {
    if (!allowed(url)) return;
    const key = normal(url);
    if (!attempted.has(key) && !candidates.has(key))
      candidates.set(key, { url: key, text, sourceUrl, source, requestedRole });
  };
  function ingest(page, source) {
    const url = normal(page.url);
    attempted.add(url);
    const host = new URL(page.finalUrl ?? page.url).hostname.replace(
      /^www\./,
      "",
    );
    const mainHost =
      hosts.has(host) ||
      (ownedDomain &&
        (host === ownedDomain || host.endsWith(`.${ownedDomain}`)));
    const observed = evidenceRole(page);
    const role =
      mainHost || (observed === "Article" && allowed(page.finalUrl))
        ? observed
        : undefined;
    if (roles.includes(role) && found[role].length < target) {
      const canonical = normal(page.finalUrl);
      // Regional translations and tracking variants do not supply distinct examples.
      const pathname = new URL(canonical).pathname;
      const itemId =
        role === "PDP"
          ? pathname
              .split("/")
              .at(-1)
              ?.match(/\d{5,}(?:\.\d+)?/)?.[0]
          : undefined;
      const identity =
        (itemId ??
          pathname
            .replace(/^\/(?:[a-z]{2}(?:[-_][a-z]{2})?|[A-Z]{3})(?=\/|$)/g, "")
            .replace(/^\/(?:[a-z]{2}(?:[-_][a-z]{2})?)(?=\/|$)/, "")) +
        [...new URL(canonical).searchParams]
          .filter(([key]) =>
            /^(id|pid|productid|product_id|sku|item_id|articleid|article_id|storyid|post|cid|cat|category|categoryid|cgid|collection|q)$/i.test(
              key,
            ),
          )
          .map(([key, value]) => `${key}=${value}`)
          .join("&");
      if (!identities[role].has(identity)) {
        identities[role].add(identity);
        found[role].push({
          url: canonical,
          title: page.title,
          status: "content-signals-observed",
          sourceUrl: source?.sourceUrl ?? shop.url,
          discoverySource: source?.source ?? "entry",
          fixture: page.fixture,
          provenance: page.provenance,
          classification: page.classification,
          editorialContent: page.editorialContent,
          listingContent: page.listingContent,
          captureMode: page.captureMode ?? "http-response",
          contentReview: contentReviewFor(page),
        });
      }
    }
    for (const link of page.links ?? []) {
      try {
        const targetHost = new URL(link.url).hostname.replace(/^www\./, "");
        if (
          mainHost &&
          editorialLink.test(link.text) &&
          !/^(?:facebook|instagram|twitter|x|youtube|linkedin|tiktok|pinterest|medium)\.com$/i.test(
            targetHost,
          )
        ) {
          const target = new URL(link.url);
          const stem = (ownedDomain ?? [...hosts][0])
            .split(".")
            .find(
              (part) => !/^(shop|store|www|blog|news|[a-z]{2})$/i.test(part),
            );
          // A specific editorial hub permits its descendants. An external root needs a brand-specific host too.
          if (target.pathname !== "/" || (stem && targetHost.includes(stem))) {
            editorialHosts.set(targetHost, page.finalUrl);
            editorialScopes.set(targetHost, [
              ...new Set([
                ...(editorialScopes.get(targetHost) ?? []),
                target.pathname.replace(/\/$/, ""),
              ]),
            ]);
          }
        }
      } catch {
        /* Ignore non-URL links. */
      }
      addCandidate(link.url, link.text, page.finalUrl, "page-link");
    }
    attempts.push({
      url: page.url,
      finalUrl: page.finalUrl,
      status: page.status,
      kind: page.kind,
      skipped: page.skipped,
      error: page.error,
      observedRole: role,
      title: page.title,
      fixture: page.fixture,
      provenance: page.provenance,
      classification: page.classification,
      captureMode: page.captureMode ?? "http-response",
    });
  }
  ingest(entry);
  const initialOrigin = new URL(entry.finalUrl ?? shop.url).origin;
  if (
    ((ownedDomain &&
      new URL(initialOrigin).hostname.replace(/^www\./, "") !== ownedDomain) ||
      needsMappedBrandEditorial) &&
    found.Article.length < target
  ) {
    const brandHomepage = await readPage(
      `https://${brand.domain}/`,
      brand.domain,
    );
    if (allowed(brandHomepage.finalUrl))
      ingest(brandHomepage, {
        sourceUrl: `https://${brand.domain}/`,
        source: needsMappedBrandEditorial
          ? "mapped-brand-homepage"
          : "brand-homepage",
      });
  }
  addCandidate(`${initialOrigin}/`, "Homepage", shop.url, "origin-entry");
  const indexedFile = `reports/brand-corpus/shop-research/${brand.domain}.json`;
  if (fs.existsSync(indexedFile)) {
    const indexed = JSON.parse(fs.readFileSync(indexedFile, "utf8"));
    for (const source of indexed.sources ?? [])
      addCandidate(
        source.url,
        source.title ?? "",
        source.url,
        "official-indexed-lead",
      );
  }
  const pageSearchFile = `reports/brand-corpus/shop-page-searches/${brand.domain}-${id}.json`;
  if (fs.existsSync(pageSearchFile)) {
    const indexed = JSON.parse(fs.readFileSync(pageSearchFile, "utf8"));
    for (const source of indexed.sources ?? [])
      addCandidate(
        source.url,
        source.title ?? "",
        source.url,
        "page-role-indexed-lead",
        source.requestedRole,
      );
  }
  // Cached observations can supply further examples without another network request.
  for (const [url, cached] of cache) {
    if (!allowed(url) || attempted.has(url) || cached instanceof Promise)
      continue;
    if (cached.kind === "page") {
      // Inspect content before deciding whether an older classifier found a role.
      const inspected = await readPage(url, brand.domain);
      ingest(inspected, { sourceUrl: cached.url, source: "existing-capture" });
      // Let pending network requests progress between cached DOM inspections.
      await new Promise((resolve) => setImmediate(resolve));
      if (roles.every((role) => found[role].length >= target)) break;
    }
  }
  const complete = () => roles.every((role) => found[role].length >= target);
  let sitemaps;
  let requested = 0;
  while (!complete() && requested < budget) {
    if (!sitemaps && (requested >= 6 || candidates.size < 3)) {
      sitemaps = await sitemapUrls(initialOrigin, allowed);
      for (const url of sitemaps.urls)
        addCandidate(url, "", sitemaps.sources[0]?.url, "sitemap");
    }
    const score = (candidate) => {
      const parsed = new URL(candidate.url);
      let value = candidate.source === "origin-entry" ? 9 : 0;
      if (
        candidate.requestedRole &&
        found[candidate.requestedRole]?.length < target
      )
        value += candidate.requestedRole === "Article" ? 12 : 8;
      for (const role of roles)
        if (
          found[role].length < target &&
          rolePatterns[role].test(parsed.pathname)
        )
          value += role === "Article" ? 12 : 8;
      if (
        /^(shop|store|blog|journal|stories|news|magazine|learn|recipes|collections)$/i.test(
          candidate.text,
        )
      )
        value += 6;
      if (
        /\/(blogs?|stories|journal|news|magazine|learn|recipes)\/?$/i.test(
          parsed.pathname,
        ) &&
        found.Article.length < target
      )
        value += 10;
      if (candidate.source === "page-link") value += 2;
      if (
        candidate.source === "page-link" &&
        found.PLP.length < target &&
        candidate.text.length > 0 &&
        candidate.text.length < 100
      )
        value += 3;
      if (
        found.Article.length < target &&
        /blog|journal|stories|story|inspiration|magazine|news|editorial|our world|discover|culture/i.test(
          candidate.text,
        )
      )
        value += 6;
      return value;
    };
    const next = [...candidates.values()]
      .filter((candidate) => !attempted.has(candidate.url))
      .sort((a, b) => score(b) - score(a))[0];
    if (!next || score(next) <= 2) break;
    candidates.delete(next.url);
    const page = await readPage(next.url, brand.domain);
    ingest(page, next);
    requested++;
    // Do not spend a full crawl budget on repeated transport walls.
    if (
      attempts.slice(-4).every((attempt) => attempt.kind !== "page") &&
      requested >= 4
    )
      break;
  }
  const result = {
    discoveryVersion: 26,
    contentReviewRevision: reviewedRevisions.get(brand.domain),
    mappedBrandEditorialDomain: needsMappedBrandEditorial
      ? brand.domain
      : undefined,
    domain: brand.domain,
    companyName: brand.companyName,
    shopUrl: shop.url,
    commerceKind: shop.commerceKind,
    checkedAt: new Date().toISOString(),
    targetPerRole: target,
    probeBudget: budget,
    inspectionMode: offline
      ? "existing-captures"
      : "live-and-existing-captures",
    furtherProbes: requested,
    entryAccess: {
      status: entry.status,
      kind: entry.kind,
      skipped: entry.skipped,
      error: entry.error,
    },
    browserAccess: (browserObservations.get(brand.domain) ?? []).filter(
      (observation) => allowed(observation.url),
    ),
    linkedEditorialHosts: Object.fromEntries(editorialHosts),
    linkedEditorialScopes: Object.fromEntries(editorialScopes),
    status: complete() ? "nine-links-found" : "gaps-recorded",
    pageTypes: found,
    gaps: roles
      .filter((role) => found[role].length < target)
      .map((role) => ({
        role,
        found: found[role].length,
        missing: target - found[role].length,
        reason:
          entry.skipped ??
          entry.error ??
          "No further supported page within link and sitemap discovery; this does not prove absence",
      })),
    sitemapSources: sitemaps?.sources ?? [],
    attempts,
  };
  fs.writeFileSync(filename, JSON.stringify(result, null, 2) + "\n");
  return result;
}
fs.mkdirSync(root, { recursive: true });
const tasks = research.brands.flatMap((brand) =>
  brand.shops.map((shop) => ({ brand, shop })),
);
const results = [];
let completed = 0;
await Promise.all(
  Array.from(
    { length: Number(process.env.SHOP_PAGE_WORKERS ?? 4) },
    async () => {
      while (tasks.length) {
        const { brand, shop } = tasks.shift();
        try {
          results.push(await discover(brand, shop));
        } catch (error) {
          console.error(`${brand.domain}: ${error.stack ?? String(error)}`);
          results.push({
            domain: brand.domain,
            shopUrl: shop.url,
            status: "discovery-error",
            error: String(error),
            pageTypes: Object.fromEntries(roles.map((role) => [role, []])),
          });
        }
        completed++;
        if (completed % 20 === 0)
          console.log(
            `${completed} shops inspected; ${results.filter((result) => result.status === "nine-links-found").length} complete sets`,
          );
      }
    },
  ),
);
results.sort(
  (a, b) =>
    a.domain.localeCompare(b.domain) || a.shopUrl.localeCompare(b.shopUrl),
);
const summary = {
  inputDomains: research.brands.length,
  shopsInspected: results.length,
  discoveryErrors: results.filter(
    (result) => result.status === "discovery-error",
  ).length,
  shopsWithNineLinks: results.filter(
    (result) => result.status === "nine-links-found",
  ).length,
  roleLinks: Object.fromEntries(
    roles.map((role) => [
      role,
      results.reduce((sum, result) => sum + result.pageTypes[role].length, 0),
    ]),
  ),
};
fs.writeFileSync(
  `${directory}/shop-page-links.json`,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      method:
        "Three distinct examples per role and shop. Captured content signals establish page candidates, not independent classifier ground truth. Gaps preserve access limits and bounded discovery outcomes. No purchase or form action.",
      summary,
      noShopDomains: research.brands
        .filter((brand) => !brand.shops.length)
        .map(({ domain, outcome, note, sourceUrl }) => ({
          domain,
          outcome,
          note,
          sourceUrl,
        })),
      shops: results.map(({ attempts, ...result }) => ({
        ...result,
        inspectionRecord: path.join(
          root,
          `${result.domain}-${createHash("sha256").update(result.shopUrl).digest("hex").slice(0, 16)}.json`,
        ),
        attemptSummary: {
          observations: attempts?.length ?? 0,
          readablePages:
            attempts?.filter(
              (attempt) => attempt.kind === "page" && attempt.status === 200,
            ).length ?? 0,
        },
      })),
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(summary));
