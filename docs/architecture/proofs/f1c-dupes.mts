/** Finding 1, part 3: measure duplicate URL fetches inside one runAudits.
 * A gatherer cache that worked would make each URL be fetched once. */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const { runAudits } = await import(`${R}/audit-runner.ts`);
const { defaultConfig } = await import(`${R}/audit-config.ts`);
const { buildScanEvidence } = await import(`${R}/scan-evidence.ts`);
const { mockPageContext } = await import(`${R}/__tests__/test-utils.ts`);

const sitemapXml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: 5 }, (_, i) => `<url><loc>https://example.com/p${i}</loc><lastmod>2026-01-0${i + 1}</lastmod></url>`).join("\n")}
</urlset>`;

const html = `<!doctype html><html lang="en"><head><title>Example</title>
<meta name="description" content="An example page for the probe."></head>
<body><h1>Example</h1><p>Some body text for the extraction gatherers to read.</p>
<a href="https://example.com/p0">one</a></body></html>`;

const ok = (url: string, body: string) => ({
  url,
  status: 200,
  body,
  headers: { "content-type": "text/html" },
  ok: true,
});

const rootFiles: Record<string, unknown> = {
  "/robots.txt": ok(
    "https://example.com/robots.txt",
    "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n",
  ),
  "/sitemap.xml": ok("https://example.com/sitemap.xml", sitemapXml),
};

const calls: string[] = [];

const page = mockPageContext("https://example.com/", html, 0);
const pages = [{ ...page, pageTypeSource: "detected" }];

const evidence = buildScanEvidence({
  requestedUrl: "https://example.com/",
  homepageResult: { ...page.fetchResult, contentType: "text/html" },
  pages,
  rootFiles,
  wafProtection: null,
});

const ctx = {
  rootFiles,
  pages,
  domain: "example.com",
  baseUrl: "https://example.com",
  evidence,
  fetch: async (o: { url: string }) => {
    calls.push(o.url);
    if (o.url.includes("sitemap")) return ok(o.url, sitemapXml);
    return ok(o.url, html);
  },
};

await runAudits(ctx as never, defaultConfig as never);

const counts = new Map<string, number>();
for (const u of calls) counts.set(u, (counts.get(u) ?? 0) + 1);
const dupes = [...counts.entries()]
  .filter(([, n]) => n > 1)
  .sort((a, b) => b[1] - a[1]);
const wasted = dupes.reduce((a, [, n]) => a + n - 1, 0);

console.log(`total ctx.fetch calls          : ${calls.length}`);
console.log(`distinct URLs                  : ${counts.size}`);
console.log(`redundant calls (same URL again): ${wasted}`);
console.log(`top repeats:`);
for (const [u, n] of dupes.slice(0, 8)) console.log(`  ${n}x  ${u}`);
