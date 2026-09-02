/**
 * Finding 1 proof: the per-audit context spread in audit-runner defeats every
 * gatherer WeakMap cache, because the cache is keyed on context identity.
 */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const { siteSitemapTree } = await import(`${R}/gatherers/sitemap.ts`);

let fetchCount = 0;
const body = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/a</loc></url>
</urlset>`;

const ctx = {
  baseUrl: "https://example.com",
  rootFiles: {
    "/robots.txt": {
      url: "https://example.com/robots.txt",
      status: 200,
      body: "Sitemap: https://example.com/sitemap.xml\n",
      headers: {},
      ok: true,
    },
  },
  fetch: async (o: { url: string }) => {
    fetchCount += 1;
    return { url: o.url, status: 200, body, headers: {}, ok: true };
  },
};

// Same object twice: the cache must hold.
await siteSitemapTree(ctx as never);
await siteSitemapTree(ctx as never);
const sameObject = fetchCount;

// What audit-runner.ts:330 actually does: a fresh spread per audit.
fetchCount = 0;
await siteSitemapTree({ ...ctx, pages: [] } as never);
await siteSitemapTree({ ...ctx, pages: [] } as never);
const spreadPerAudit = fetchCount;

console.log(`same ctx object, 2 calls  -> ${sameObject} fetch(es)`);
console.log(`spread ctx, 2 calls       -> ${spreadPerAudit} fetch(es)`);
console.log(
  spreadPerAudit > sameObject
    ? "CONFIRMED: the spread defeats the cache"
    : "NOT CONFIRMED",
);
