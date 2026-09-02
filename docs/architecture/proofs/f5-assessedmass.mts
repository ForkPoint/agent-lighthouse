/** Finding 5 proof: assessedMass never reaches the scorer on the scan path. */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const runner = await import(`${R}/audit-runner.ts`);
const scorer = await import(`${R}/scorer.ts`);
const { defaultConfig } = await import(`${R}/audit-config.ts`);
const { mockPageContext } = await import(`${R}/__tests__/test-utils.ts`);
const { buildScanEvidence } = await import(`${R}/scan-evidence.ts`);

const html =
  "<!doctype html><html lang=en><head><title>P</title><meta name=description content='d'></head><body><h1>P</h1><p>text</p></body></html>";
const page = mockPageContext("https://example.com/", html, 0);
const ctx = {
  rootFiles: {},
  domain: "example.com",
  baseUrl: "https://example.com",
  pages: [{ ...page, pageTypeSource: "detected" }],
  fetch: async (o: { url: string }) => ({
    url: o.url,
    status: 404,
    ok: false,
    headers: {},
    body: "",
  }),
  evidence: buildScanEvidence({
    requestedUrl: "https://example.com/",
    homepageResult: { ...page.fetchResult, contentType: "text/html" },
    pages: [page],
    rootFiles: {},
    wafProtection: null,
  }),
};

const { categories } = await runner.runAudits(
  ctx as never,
  defaultConfig as never,
);
const withAssessed = categories.filter(
  (c: { assessedMass?: number }) => c.assessedMass !== undefined,
);
const withRegistry = categories.filter(
  (c: { registryMass?: number }) => c.registryMass !== undefined,
);

console.log(`categories produced by runAudits    : ${categories.length}`);
console.log(`  with assessedMass set             : ${withAssessed.length}`);
console.log(`  with registryMass set             : ${withRegistry.length}`);
console.log(
  `createCategoryResult exported?      : ${typeof scorer.createCategoryResult}`,
);
console.log(
  withAssessed.length === 0
    ? "CONFIRMED: scorer.ts:109 always falls back to cat.weight"
    : "NOT CONFIRMED",
);
