/** Finding 2 proof: with pageTypeSource 'detected' (what the CLI always
 * produces, because --page-type is never forwarded), every page-typed audit
 * is demoted to informative and loses its weight. */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const { scopeAudit } = await import(`${R}/audit-runner.ts`);
const { defaultConfig } = await import(`${R}/audit-config.ts`);
const { mockPageContext } = await import(`${R}/__tests__/test-utils.ts`);

const html =
  "<!doctype html><html lang=en><head><title>P</title></head><body><h1>P</h1></body></html>";
const base = mockPageContext("https://example.com/p", html, 0);

function report(source: "declared" | "detected") {
  const ctx = {
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
    evidence: { met: {}, usablePageTypes: new Set() },
    pages: (
      [
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
      ] as const
    ).map((t) => ({ ...base, pageType: t, pageTypeSource: source })),
  };
  let typed = 0,
    demoted = 0,
    lostWeight = 0;
  for (const cat of defaultConfig.categories)
    for (const reg of defaultConfig.audits[cat.id] ?? []) {
      const pt = reg.meta.pageTypes ?? reg.meta.applicablePageTypes;
      if (!pt || pt.length === 0) continue;
      typed += 1;
      const scope = scopeAudit(ctx as never, reg.meta);
      if (!scope) continue;
      if (
        scope.scoreDisplayMode === "informative" &&
        reg.meta.scoreDisplayMode !== "informative"
      ) {
        demoted += 1;
        lostWeight += reg.meta.weight ?? 0;
      }
    }
  return { typed, demoted, lostWeight: Number(lostWeight.toFixed(2)) };
}

const declared = report("declared");
const detected = report("detected");
console.log(`page-typed audits in registry : ${declared.typed}`);
console.log(
  `--page-type given (declared)  : ${declared.demoted} demoted, ${declared.lostWeight} weight lost`,
);
console.log(
  `what the CLI does  (detected) : ${detected.demoted} demoted, ${detected.lostWeight} weight lost`,
);
console.log(
  detected.demoted > declared.demoted ? "CONFIRMED" : "NOT CONFIRMED",
);
