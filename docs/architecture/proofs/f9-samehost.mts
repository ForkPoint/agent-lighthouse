/** Finding proof: sameHost accepts a PARENT domain, not only a subdomain. */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const mod = await import(`${R}/gatherers/sitemap.ts`);
const { siteSitemapTree } = mod;

// A sitemap index on foo.github.io pointing at a DIFFERENT site's sitemap.
const index = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://github.io/attacker-sitemap.xml</loc></sitemap>
</sitemapindex>`;
const child = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://github.io/not-your-page</loc></url>
</urlset>`;

const fetched: string[] = [];
const ctx = {
  baseUrl: "https://foo.github.io",
  rootFiles: {
    "/robots.txt": { url: "x", status: 404, ok: false, headers: {}, body: "" },
  },
  fetch: async (o: { url: string }) => {
    fetched.push(o.url);
    const body = o.url.includes("attacker") ? child : index;
    return { url: o.url, status: 200, ok: true, headers: {}, body };
  },
};

const tree = await siteSitemapTree(ctx as never);
console.log("scanning        : https://foo.github.io");
console.log("child sitemaps  :", tree.childSitemaps);
console.log(
  "entries         :",
  tree.entries.map((e: { loc: string }) => e.loc),
);
console.log(
  tree.childSitemaps.includes("https://github.io/attacker-sitemap.xml")
    ? "CONFIRMED: a parent-domain sitemap is accepted as same-host"
    : "NOT CONFIRMED",
);
