import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { capture } from "./discover-brand-pages.mjs";
import { parseHtml } from "#core/parser";

const directory = "packages/core/test-data/sites";
const research = JSON.parse(
  fs.readFileSync(`${directory}/shop-directory.json`, "utf8"),
);
const root = "reports/brand-corpus/shop-verification";
fs.mkdirSync(root, { recursive: true });
const queue = research.brands.filter((brand) => brand.shops.length);
let completed = 0;
await Promise.all(
  Array.from({ length: 12 }, async () => {
    while (queue.length) {
      const brand = queue.shift();
      const filename = `${root}/${brand.domain}.json`;
      const previous = fs.existsSync(filename)
        ? JSON.parse(fs.readFileSync(filename, "utf8"))
        : undefined;
      if (
        JSON.stringify(previous?.pages.map((page) => page.url)) !==
        JSON.stringify(brand.shops.map((shop) => shop.url))
      ) {
        const pages = [];
        for (const shop of brand.shops) {
          const page = await capture(shop.url, brand.domain);
          if (page.kind === "page" && page.fixture) {
            const $ = parseHtml(
              gunzipSync(fs.readFileSync(page.fixture)).toString(),
            );
            $("script,style,noscript").remove();
            const body = $("body").text().replace(/\s+/g, " ");
            page.commerceSignals = [
              ...new Set(
                body.match(
                  /add to (?:cart|bag|basket)|shopping (?:bag|cart)|buy now|ajouter au panier|añadir al carrito|adicionar ao carrinho|aggiungi al carrello|in den warenkorb|comprar|checkout/gi,
                ) ?? [],
              ),
            ];
          }
          delete page.links;
          pages.push(page);
        }
        fs.writeFileSync(
          filename,
          JSON.stringify(
            {
              domain: brand.domain,
              checkedAt: new Date().toISOString(),
              pages,
            },
            null,
            2,
          ) + "\n",
        );
      }
      completed++;
      if (completed % 50 === 0)
        console.log(
          `${completed}/${research.summary.domainsWithShopLinks} shop domains checked`,
        );
    }
  }),
);
console.log(`${completed} shop domains checked`);
const summary = {
  "accessible-page": 0,
  pagesWithCommerceText: 0,
  "access-limited-or-failed": 0,
};
for (const brand of research.brands) {
  if (!brand.shops.length) continue;
  const record = JSON.parse(
    fs.readFileSync(`${root}/${brand.domain}.json`, "utf8"),
  );
  for (const shop of brand.shops) {
    const page = record.pages.find((candidate) => candidate.url === shop.url);
    if (!page) throw new Error(`Missing fetch outcome for ${shop.url}`);
    shop.verification = Object.fromEntries(
      [
        "finalUrl",
        "status",
        "skipped",
        "error",
        "capturedAt",
        "kind",
        "title",
        "fixture",
        "provenance",
        "commerceSignals",
      ]
        .filter((key) => page[key] !== undefined)
        .map((key) => [key, page[key]]),
    );
    summary[
      page.kind === "page" ? "accessible-page" : "access-limited-or-failed"
    ]++;
    if (page.commerceSignals?.length) summary.pagesWithCommerceText++;
  }
}
research.summary.verification = summary;
fs.writeFileSync(
  `${directory}/shop-directory.json`,
  JSON.stringify(research, null, 2) + "\n",
);
console.log(JSON.stringify(summary));
