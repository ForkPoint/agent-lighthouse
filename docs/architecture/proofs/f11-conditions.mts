/** Finding proof: conditions.pageType can describe a `pages` override rather
 * than the URL named in conditions.url, when the target does not return 200. */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const { runScan } = await import(`${R}/orchestrator.ts`);

const target = "https://example.com/this-path-does-not-exist-404";
const report = await runScan(target, {
  pages: [{ url: "https://example.com/", pageType: "product" }],
});

console.log("target scanned          :", target);
console.log("conditions.url          :", report.conditions.url);
console.log(
  "conditions.pageType     :",
  JSON.stringify(report.conditions.pageType),
);
console.log("pagesScanned            :", JSON.stringify(report.pagesScanned));
console.log(
  report.conditions.pageType.type === "product" &&
    report.conditions.pageType.source === "declared" &&
    report.conditions.url === target
    ? "CONFIRMED: conditions.url is the 404 target, pageType describes the override"
    : "NOT CONFIRMED",
);
