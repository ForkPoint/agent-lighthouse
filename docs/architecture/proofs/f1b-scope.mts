/** Finding 1, part 2: scopeAudit never returns an undefined `pages`, so the
 * spread at audit-runner.ts:330 runs for every audit on every scan. */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const { scopeAudit } = await import(`${R}/audit-runner.ts`);
const { defaultConfig } = await import(`${R}/audit-config.ts`);

const ctx = {
  rootFiles: {},
  pages: [
    {
      url: "https://example.com/",
      pageType: "homepage",
      pageTypeSource: "detected",
      html: "<html></html>",
      status: 200,
    },
  ],
  domain: "example.com",
  baseUrl: "https://example.com",
  fetch: async () => ({
    url: "",
    status: 200,
    body: "",
    headers: {},
    ok: true,
  }),
  evidence: { met: {}, usablePageTypes: new Set(["homepage"]) },
};

let total = 0;
let undefinedPages = 0;
let nullScope = 0;
for (const cat of defaultConfig.categories) {
  for (const reg of defaultConfig.audits[cat.id] ?? []) {
    total += 1;
    const scope = scopeAudit(ctx as never, reg.meta);
    if (scope === null) {
      nullScope += 1;
      continue;
    }
    if (scope.pages === undefined) undefinedPages += 1;
  }
}
console.log(`registered audits            : ${total}`);
console.log(`scopeAudit returned null     : ${nullScope}`);
console.log(`scope.pages === undefined    : ${undefinedPages}`);
console.log(
  undefinedPages === 0
    ? "CONFIRMED: every runnable audit takes the spread branch"
    : "NOT CONFIRMED",
);
