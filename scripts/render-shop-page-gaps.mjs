import fs from "node:fs";
import { createHash } from "node:crypto";
import { captureBrowser } from "./capture-shop-browser.mjs";

const directory = JSON.parse(
  fs.readFileSync("packages/core/test-data/sites/shop-directory.json", "utf8"),
);
const roles = {
  PLP: /collections?|categor|\/c\/|\/shop|women|men|clothing|footwear/i,
  PDP: /\/(products?|p|pd|produkt|producto)\/[^/]+|\d{5,}/i,
  Article:
    /\/(blogs?|articles?|stories|story|journal|magazine|news|recipes?|recettes|ricette|resource-center-articles|inspiration|expert-advice|advice|editorial|bb-world|baby-talk|demonerosso)(?:\/|[-.]|$)/i,
};
const reject =
  /\.(pdf|mp3)(?:$|\?)|(?:^|\/)(account|checkout|cart|basket|login|signup|privacy|terms|cookies?|polic(?:y|ies)|returns?|shipping|payment|contact|careers?|formulario|client-services|help|support)(?:\/|\.|$)|newsletter|size-guide|sizechart|warranty|accessibility|loyalty|membership/i;
function identity(url) {
  const parsed = new URL(url);
  return (
    parsed.pathname
      .replace(/^\/(?:[a-z]{2}(?:[-_][a-z]{2})?|[A-Z]{3})(?=\/|$)/, "")
      .replace(/^\/(?:[a-z]{2}(?:[-_][a-z]{2})?)(?=\/|$)/, "") +
    [...parsed.searchParams]
      .filter(([key]) =>
        /^(id|pid|sku|articleid|article_id|cid|cgid|aid|q)$/i.test(key),
      )
      .map(([key, value]) => `${key}=${value}`)
      .join("&")
  );
}
const output = "reports/brand-corpus/browser-gap-results.json";
const results = fs.existsSync(output)
  ? JSON.parse(fs.readFileSync(output, "utf8"))
  : [];
const tried = new Set(results.map((x) => x.url));
const triedIdentities = new Set(
  results.map((x) => `${x.domain}\n${identity(x.url)}`),
);
const browserLinks = new Map();
const browserRoot = "reports/brand-corpus/browser-captures";
for (const domain of fs.readdirSync(browserRoot)) {
  const links = [];
  for (const file of fs
    .readdirSync(`${browserRoot}/${domain}`)
    .filter((name) => name.endsWith(".record.json"))) {
    const page = JSON.parse(
      fs.readFileSync(`${browserRoot}/${domain}/${file}`, "utf8"),
    );
    if (page.kind === "page")
      links.push(
        ...(page.links ?? []).map((link) => ({
          ...link,
          sourceUrl: page.finalUrl,
        })),
      );
  }
  browserLinks.set(domain, links);
}
const stopped = new Set(
  results
    .filter(
      (x) =>
        (x.kind === "wall-or-error" && ![404, 410].includes(x.status)) ||
        (x.error &&
          !results.some(
            (later) =>
              later.domain === x.domain &&
              later.url === x.url &&
              later.kind === "page" &&
              Date.parse(later.checkedAt) > Date.parse(x.checkedAt),
          )),
    )
    .map((x) => x.domain),
);
stopped.add("asics.com"); // The earlier browser sample returned 429.
let inspected = 0;
const dryRun = process.env.SHOP_BROWSER_DRY_RUN === "1";
const planned = [];
async function inspectBrand(brand, session) {
  if (stopped.has(brand.domain)) return;
  for (const shop of brand.shops) {
    const id = createHash("sha256").update(shop.url).digest("hex").slice(0, 16);
    const file = `reports/brand-corpus/shop-page-links/${brand.domain}-${id}.json`;
    if (!fs.existsSync(file)) continue;
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    if (record.status === "nine-links-found") continue;
    const host = new URL(shop.url).hostname.replace(/^www\./, "");
    const ownedBrand =
      host === brand.domain || host.endsWith(`.${brand.domain}`);
    const mappedEditorialHost = record.mappedBrandEditorialDomain;
    const candidates =
      record.attempts?.filter((p) => {
        const parsed = new URL(p.url);
        if (
          p.status !== 200 ||
          !["page", "shell"].includes(p.kind) ||
          /DSR_FORM_URL/i.test(p.url) ||
          reject.test(parsed.pathname) ||
          /(?:^|[.-])(uat|ccuat|dev|stg|stage|staging|test)(?:[.-]|$)/i.test(
            parsed.hostname,
          )
        )
          return false;
        const h = new URL(p.url).hostname.replace(/^www\./, "");
        return (
          h === host ||
          (ownedBrand &&
            (h === brand.domain || h.endsWith(`.${brand.domain}`))) ||
          (h === mappedEditorialHost && roles.Article.test(parsed.pathname))
        );
      }) ?? [];
    for (const link of browserLinks.get(brand.domain) ?? []) {
      try {
        const parsed = new URL(link.url);
        const linkedHost = parsed.hostname.replace(/^www\./, "");
        if (
          parsed.protocol !== "https:" ||
          parsed.username ||
          parsed.password ||
          /DSR_FORM_URL/i.test(link.url) ||
          reject.test(parsed.pathname) ||
          /[?&](add[-_]?to[-_]?cart|action=(add|remove|subscribe))/i.test(
            parsed.search,
          )
        )
          continue;
        if (
          /(?:^|[.-])(uat|ccuat|dev|stg|stage|staging|test)(?:[.-]|$)/i.test(
            parsed.hostname,
          )
        )
          continue;
        if (
          linkedHost === host ||
          (ownedBrand &&
            (linkedHost === brand.domain ||
              linkedHost.endsWith(`.${brand.domain}`))) ||
          (linkedHost === mappedEditorialHost &&
            roles.Article.test(parsed.pathname))
        )
          candidates.push({ ...link, linkedLead: true });
      } catch {
        /* Ignore malformed links. */
      }
    }
    const selected = new Set();
    for (const [role, pattern] of Object.entries(roles)) {
      if (record.pageTypes?.[role]?.length === 3) continue;
      const seen = new Set();
      const ranked = candidates
        .filter(
          (p) =>
            !tried.has(p.url) &&
            !triedIdentities.has(`${brand.domain}\n${identity(p.url)}`) &&
            (pattern.test(new URL(p.url).pathname) ||
              (role === "PDP" &&
                p.classification?.signals?.includes(
                  "product-schema-primary",
                ))) &&
            !(role === "PDP" && roles.Article.test(new URL(p.url).pathname)),
        )
        .sort((a, b) => {
          const hub = (p) =>
            role === "Article" &&
            /(?:\/(?:blogs?|journal|news|stories|magazine)\/?$|\/editorial\/home\.html$|(?:blog|journal|news|stories)(?:-homepage)?\.html$)/i.test(
              new URL(p.url).pathname,
            );
          return Number(hub(a)) - Number(hub(b));
        });
      for (const page of ranked) {
        const key = identity(page.url);
        if (seen.has(key)) continue;
        seen.add(key);
        selected.add(page.url);
        if (seen.size >= 3) break;
      }
    }
    for (const url of selected) {
      if (tried.has(url)) continue;
      if (dryRun) {
        planned.push({ domain: brand.domain, shopUrl: shop.url, url });
        continue;
      }
      tried.add(url);
      triedIdentities.add(`${brand.domain}\n${identity(url)}`);
      let result;
      try {
        const page = await captureBrowser(url, brand.domain, session);
        result = {
          domain: brand.domain,
          url,
          kind: page.kind,
          status: page.status,
          classification: page.classification,
          fixture: page.fixture,
          checkedAt: new Date().toISOString(),
        };
      } catch (error) {
        result = {
          domain: brand.domain,
          url,
          error: String(error),
          checkedAt: new Date().toISOString(),
        };
      }
      results.push(result);
      fs.writeFileSync(output, JSON.stringify(results, null, 2) + "\n");
      inspected++;
      console.log(
        JSON.stringify({
          domain: brand.domain,
          url,
          kind: result.kind,
          status: result.status,
          error: result.error,
          type: result.classification?.type,
          inspected,
        }),
      );
      if (
        (result.kind === "wall-or-error" &&
          ![404, 410].includes(result.status)) ||
        result.error
      ) {
        stopped.add(brand.domain);
        break;
      }
    }
    if (stopped.has(brand.domain)) break;
  }
}
const pending = [...directory.brands];
await Promise.all(
  Array.from({ length: 3 }, async (_, worker) => {
    const session = `brand-corpus-pages-${worker + 2}`;
    while (pending.length) await inspectBrand(pending.shift(), session);
  }),
);
if (dryRun)
  fs.writeFileSync(
    "reports/brand-corpus/browser-gap-plan.json",
    JSON.stringify(planned, null, 2) + "\n",
  );
console.log(
  JSON.stringify({ inspected, total: results.length, planned: planned.length }),
);
