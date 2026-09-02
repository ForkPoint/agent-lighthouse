/** Finding 2, realistic shape: one page per scan (MAX_PAGES_PER_SCAN = 1).
 * Per page type, how much scored weight the CLI loses by never declaring it. */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const { scopeAudit } = await import(`${R}/audit-runner.ts`);
const { defaultConfig } = await import(`${R}/audit-config.ts`);
const { mockPageContext } = await import(`${R}/__tests__/test-utils.ts`);

const html =
  "<!doctype html><html lang=en><head><title>P</title></head><body><h1>P</h1></body></html>";
const base = mockPageContext("https://example.com/p", html, 0);

const types = [
  "homepage",
  "product",
  "article",
  "category",
  "docs",
  "contact",
  "about",
  "collection",
  "checkout",
  "search",
] as const;

for (const t of types) {
  const mk = (source: "declared" | "detected") => ({
    rootFiles: {},
    domain: "example.com",
    baseUrl: "https://example.com",
    fetch: async () => ({
      url: "",
      status: 200,
      body: "",
      headers: {},
      ok: true,
    }),
    evidence: { met: {}, usablePageTypes: new Set([t]) },
    pages: [{ ...base, pageType: t, pageTypeSource: source }],
  });
  let demoted = 0,
    lost = 0;
  for (const cat of defaultConfig.categories)
    for (const reg of defaultConfig.audits[cat.id] ?? []) {
      const pt = reg.meta.pageTypes ?? reg.meta.applicablePageTypes;
      if (!pt?.length) continue;
      const s = scopeAudit(mk("detected") as never, reg.meta);
      const d = scopeAudit(mk("declared") as never, reg.meta);
      if (s && d && s.scoreDisplayMode !== d.scoreDisplayMode) {
        demoted += 1;
        lost += reg.meta.weight ?? 0;
      }
    }
  if (demoted)
    console.log(
      `  --page-type=${t.padEnd(10)} : ${String(demoted).padStart(2)} audits demoted, ${lost.toFixed(1)} weight unscored`,
    );
}
