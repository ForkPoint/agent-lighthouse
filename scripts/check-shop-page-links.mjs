import fs from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

const directory = "packages/core/test-data/sites";
const directoryData = JSON.parse(
  fs.readFileSync(`${directory}/shop-directory.json`, "utf8"),
);
const data = JSON.parse(
  fs.readFileSync(`${directory}/shop-page-links.json`, "utf8"),
);
const expected = new Set(
  directoryData.brands.flatMap((brand) =>
    brand.shops.map((shop) => `${brand.domain}\n${shop.url}`),
  ),
);
const actual = new Set();
const checkedFiles = new Set();
const totals = { PLP: 0, PDP: 0, Article: 0 };
let complete = 0;
for (const shop of data.shops) {
  if (shop.status === "discovery-error")
    throw new Error(
      `Unresolved discovery error: ${shop.domain}: ${shop.error}`,
    );
  const key = `${shop.domain}\n${shop.shopUrl}`;
  if (!expected.has(key) || actual.has(key))
    throw new Error(`Unexpected or duplicate shop: ${key}`);
  actual.add(key);
  if (!shop.inspectionRecord || !fs.existsSync(shop.inspectionRecord))
    throw new Error(`Missing inspection record: ${key}`);
  const inspection = JSON.parse(fs.readFileSync(shop.inspectionRecord, "utf8"));
  if (inspection.domain !== shop.domain || inspection.shopUrl !== shop.shopUrl)
    throw new Error(`Inspection record does not match shop: ${key}`);
  const urls = new Set();
  for (const role of Object.keys(totals)) {
    const pages = shop.pageTypes[role];
    if (pages.length > 3) throw new Error(`More than 3 ${role} links: ${key}`);
    totals[role] += pages.length;
    for (const page of pages) {
      const url = new URL(page.url);
      if (url.protocol !== "https:" || urls.has(page.url))
        throw new Error(`Invalid or repeated role URL: ${page.url}`);
      if (
        /create-account|manage-account|my-account|sign-in|log-in/i.test(
          url.pathname,
        )
      )
        throw new Error(
          `Account page cannot supply a role example: ${page.url}`,
        );
      urls.add(page.url);
      if (!page.fixture || !page.provenance || !page.sourceUrl)
        throw new Error(`Missing provenance: ${page.url}`);
      const source = JSON.parse(fs.readFileSync(page.provenance, "utf8"));
      if (
        page.contentReview &&
        (page.contentReview.fixture !== page.fixture ||
          page.contentReview.sha256 !== source.sha256 ||
          page.contentReview.role !== role)
      )
        throw new Error(
          `Content review does not match captured bytes: ${page.url}`,
        );
      const capturedUrl = new URL(source.url);
      if (
        capturedUrl.origin !== url.origin ||
        capturedUrl.pathname !== url.pathname
      )
        throw new Error(`Exported URL does not match its capture: ${page.url}`);
      for (const [key, value] of capturedUrl.searchParams) {
        if (
          /^(id|pid|productid|product_id|sku|item_id|articleid|article_id|cid|cat|category|categoryid|cgid|collection|q)$/i.test(
            key,
          ) &&
          url.searchParams.get(key) !== value
        )
          throw new Error(`Required query value lost: ${page.url} (${key})`);
      }
      if (!checkedFiles.has(page.fixture)) {
        const provenance = source;
        const body = gunzipSync(fs.readFileSync(page.fixture));
        if (
          provenance.kind !== "page" ||
          provenance.status !== 200 ||
          createHash("sha256").update(body).digest("hex") !== provenance.sha256
        )
          throw new Error(
            `Capture is not an intact readable page: ${page.url}`,
          );
        checkedFiles.add(page.fixture);
      }
    }
  }
  const full = Object.keys(totals).every(
    (role) => shop.pageTypes[role].length === 3,
  );
  if (full) complete++;
  if ((shop.status === "nine-links-found") !== full)
    throw new Error(`Completion status disagrees with role counts: ${key}`);
  if (!full && shop.status !== "discovery-error" && !shop.gaps?.length)
    throw new Error(`Missing gap record: ${key}`);
}
if (actual.size !== expected.size)
  throw new Error(`Incomplete shop coverage: ${actual.size}/${expected.size}`);
if (
  complete !== data.summary.shopsWithNineLinks ||
  Object.keys(totals).some(
    (role) => totals[role] !== data.summary.roleLinks[role],
  )
)
  throw new Error("Summary disagrees with the role records");
console.log(
  JSON.stringify({
    shops: actual.size,
    completeSets: complete,
    verifiedCaptureHashes: checkedFiles.size,
    roleLinks: totals,
  }),
);
