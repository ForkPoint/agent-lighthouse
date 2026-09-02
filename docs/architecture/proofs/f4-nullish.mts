/** Finding 4 proof: the ?? chain in readSitemap never falls through, because
 * the orchestrator always puts a FetchResult (even a 404) at /sitemap.xml. */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const { readSitemap } = await import(`${R}/gatherers/sitemap.ts`);

const malformed = "<html><body>not a sitemap at all</body></html>";

// A site that serves ONLY /sitemap-index.xml, and serves it broken.
const rootFiles = {
  "/robots.txt": {
    url: "https://example.com/robots.txt",
    status: 404,
    ok: false,
    headers: {},
    body: "",
  },
  "/sitemap.xml": {
    url: "https://example.com/sitemap.xml",
    status: 404,
    ok: false,
    headers: {},
    body: "",
  },
  "/sitemap-index.xml": {
    url: "https://example.com/sitemap-index.xml",
    status: 200,
    ok: true,
    headers: {},
    body: malformed,
  },
};

const ctx = {
  baseUrl: "https://example.com",
  rootFiles,
  fetch: async (o: { url: string }) => {
    const key = new URL(o.url).pathname as keyof typeof rootFiles;
    return (
      rootFiles[key] ?? {
        url: o.url,
        status: 404,
        ok: false,
        headers: {},
        body: "",
      }
    );
  },
};

const res = await readSitemap(ctx as never);
console.log(
  "site serves: /sitemap.xml 404, /sitemap-index.xml 200 but malformed",
);
console.log("readSitemap kind :", res.kind);
console.log("reason           :", (res as { reason?: string }).reason);
console.log(
  res.kind === "absent"
    ? "CONFIRMED: a present-and-broken sitemap is reported as absent"
    : `NOT CONFIRMED (got ${res.kind})`,
);
