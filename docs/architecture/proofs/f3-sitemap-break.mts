/** Finding 3 proof: a robots.txt declaring two sitemaps has only the first read. */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const { siteSitemapTree } = await import(`${R}/gatherers/sitemap.ts`);

const map = (locs: string[]) => `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map((l) => `<url><loc>${l}</loc></url>`).join("\n")}
</urlset>`;

const bodies: Record<string, string> = {
  "https://example.com/sitemap-posts.xml": map([
    "https://example.com/post-1",
    "https://example.com/post-2",
  ]),
  "https://example.com/sitemap-pages.xml": map([
    "https://example.com/page-1",
    "https://example.com/page-2",
  ]),
};

const fetched: string[] = [];
const ctx = {
  baseUrl: "https://example.com",
  rootFiles: {
    "/robots.txt": {
      url: "https://example.com/robots.txt",
      status: 200,
      ok: true,
      headers: {},
      body: "User-agent: *\nSitemap: https://example.com/sitemap-posts.xml\nSitemap: https://example.com/sitemap-pages.xml\n",
    },
  },
  fetch: async (o: { url: string }) => {
    fetched.push(o.url);
    return {
      url: o.url,
      status: bodies[o.url] ? 200 : 404,
      ok: !!bodies[o.url],
      headers: {},
      body: bodies[o.url] ?? "",
    };
  },
};

const tree = await siteSitemapTree(ctx as never);
console.log("robots.txt declares : sitemap-posts.xml, sitemap-pages.xml");
console.log("URLs actually fetched:", fetched);
console.log(
  "entries found       :",
  tree.entries.map((e: { loc: string }) => e.loc),
);
console.log(
  tree.entries.length === 2 &&
    !fetched.includes("https://example.com/sitemap-pages.xml")
    ? "CONFIRMED: the second declared sitemap is never read"
    : "NOT CONFIRMED",
);
