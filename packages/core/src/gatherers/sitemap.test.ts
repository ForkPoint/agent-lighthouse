import { describe, it, expect, vi } from "vitest";
import {
  collectSitemapEntries,
  sampleEntries,
  isW3CDateTime,
  siteSitemapTree,
  readSitemap,
  NO_SITEMAP,
  sitemapSiteRoot,
} from "./sitemap";

import { mockFetchResult } from "../__tests__/test-utils";
import type { FetchOptions, FetchResult } from "../fetcher";
import { PageType } from "../types";

// isSafeUrl performs a real DNS lookup before the gatherer follows a URL it
// read out of a site-controlled sitemap. Stub it with an offline stand-in that
// still blocks loopback and private ranges, so the refusal tests prove the gate
// rather than the mock.
vi.mock("../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== "http:" && protocol !== "https:") return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

const xml = (body: string) => mockFetchResult(body, 200, "application/xml");

const urlset = (urls: Array<[string, string?]>) =>
  xml(
    `<?xml version="1.0"?><urlset>${urls
      .map(
        ([loc, lastmod]) =>
          `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
      )
      .join("")}</urlset>`,
  );

const index = (locs: string[]) =>
  xml(
    `<?xml version="1.0"?><sitemapindex>${locs
      .map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`)
      .join("")}</sitemapindex>`,
  );

function fetcher(pages: Record<string, ReturnType<typeof xml>>) {
  const seen: string[] = [];
  return {
    seen,
    fetch: async (o: FetchOptions) => {
      seen.push(o.url);
      return pages[o.url] ?? mockFetchResult("", 404);
    },
  };
}

describe("collectSitemapEntries", () => {
  it.each([
    mockFetchResult("", 503),
    mockFetchResult("not a sitemap", 200),
    index(["https://a.test/deep.xml"]),
  ])(
    "marks unread children incomplete while keeping readable entries",
    async (unread) => {
      const f = fetcher({
        "https://a.test/sitemap.xml": index([
          "https://a.test/good.xml",
          "https://a.test/unread.xml",
        ]),
        "https://a.test/good.xml": urlset([["https://a.test/product"]]),
        "https://a.test/unread.xml": unread,
      });
      const tree = await collectSitemapEntries(f.fetch, [
        "https://a.test/sitemap.xml",
      ]);
      expect(tree.scopeIncomplete).toBe(true);
      expect(tree.entries).toEqual([{ loc: "https://a.test/product" }]);
      expect(f.seen).not.toContain("https://a.test/deep.xml");
    },
  );

  it("marks a child that already failed as a root incomplete", async () => {
    const f = fetcher({
      "https://a.test/sitemap-posts.xml": mockFetchResult("", 503),
      "https://a.test/sitemap_index.xml": index([
        "https://a.test/good.xml",
        "https://a.test/sitemap-posts.xml",
      ]),
      "https://a.test/good.xml": urlset([["https://a.test/product"]]),
    });
    const tree = await collectSitemapEntries(f.fetch, [
      "https://a.test/sitemap-posts.xml",
      "https://a.test/sitemap_index.xml",
    ]);
    expect(tree.scopeIncomplete).toBe(true);
    expect(tree.entries).toEqual([{ loc: "https://a.test/product" }]);
  });

  it("does not mark a repeated readable child as incomplete", async () => {
    const f = fetcher({
      "https://a.test/sitemap.xml": index([
        "https://a.test/good.xml",
        "https://a.test/good.xml",
      ]),
      "https://a.test/good.xml": urlset([["https://a.test/product"]]),
    });
    const tree = await collectSitemapEntries(f.fetch, [
      "https://a.test/sitemap.xml",
    ]);
    expect(tree.scopeIncomplete).toBeUndefined();
    expect(tree.entries).toEqual([{ loc: "https://a.test/product" }]);
  });
  it("reads loc and lastmod out of a flat urlset", async () => {
    const f = fetcher({
      "https://a.test/sitemap.xml": urlset([
        ["https://a.test/one", "2026-08-01"],
        ["https://a.test/two"],
      ]),
    });
    const tree = await collectSitemapEntries(f.fetch, [
      "https://a.test/sitemap.xml",
    ]);
    expect(tree.entries).toEqual([
      { loc: "https://a.test/one", lastmod: "2026-08-01" },
      { loc: "https://a.test/two" },
    ]);
    expect(tree.childSitemaps).toEqual([]);
    expect(f.seen).toEqual(["https://a.test/sitemap.xml"]);
  });

  // One level only. A sitemapindex nested inside a child is a shape whose depth
  // the scanned site controls, so recursion stops rather than trusting the file
  // to terminate.
  it("recurses a sitemapindex exactly one level", async () => {
    const f = fetcher({
      "https://a.test/sitemap.xml": index([
        "https://a.test/c1.xml",
        "https://a.test/c2.xml",
      ]),
      "https://a.test/c1.xml": urlset([["https://a.test/one"]]),
      "https://a.test/c2.xml": index(["https://a.test/deep.xml"]),
    });
    const tree = await collectSitemapEntries(f.fetch, [
      "https://a.test/sitemap.xml",
    ]);
    expect(tree.entries).toEqual([{ loc: "https://a.test/one" }]);
    expect(f.seen).not.toContain("https://a.test/deep.xml");
  });

  it("caps child sitemaps at maxChildren and reports truncated", async () => {
    const children = Array.from(
      { length: 8 },
      (_, i) => `https://a.test/c${i}.xml`,
    );
    const pages: Record<string, ReturnType<typeof xml>> = {
      "https://a.test/sitemap.xml": index(children),
    };
    for (const c of children) pages[c] = urlset([[`${c}#u`]]);
    const f = fetcher(pages);
    const tree = await collectSitemapEntries(
      f.fetch,
      ["https://a.test/sitemap.xml"],
      {
        maxChildren: 5,
      },
    );
    expect(tree.childSitemaps).toHaveLength(5);
    expect(tree.truncated).toBe(true);
  });

  it("caps total entries at maxEntries and reports truncated", async () => {
    const urls: Array<[string, string?]> = Array.from(
      { length: 20 },
      (_, i) => [`https://a.test/${i}`] as [string],
    );
    const f = fetcher({ "https://a.test/sitemap.xml": urlset(urls) });
    const tree = await collectSitemapEntries(
      f.fetch,
      ["https://a.test/sitemap.xml"],
      {
        maxEntries: 6,
      },
    );
    expect(tree.entries).toHaveLength(6);
    expect(tree.truncated).toBe(true);
  });

  it("counts lastmod values that are not W3C Datetime", async () => {
    const f = fetcher({
      "https://a.test/sitemap.xml": urlset([
        ["https://a.test/one", "yesterday"],
        ["https://a.test/two", "2026-08-01"],
      ]),
    });
    const tree = await collectSitemapEntries(f.fetch, [
      "https://a.test/sitemap.xml",
    ]);
    expect(tree.malformedLastmod).toBe(1);
  });

  it("skips a child sitemap on a different host", async () => {
    const f = fetcher({
      "https://a.test/sitemap.xml": index(["https://evil.test/c.xml"]),
    });
    const tree = await collectSitemapEntries(f.fetch, [
      "https://a.test/sitemap.xml",
    ]);
    expect(f.seen).toEqual(["https://a.test/sitemap.xml"]);
    expect(tree.entries).toEqual([]);
  });

  it("deduplicates a root listed twice", async () => {
    const f = fetcher({
      "https://a.test/s.xml": urlset([["https://a.test/one"]]),
    });
    const tree = await collectSitemapEntries(f.fetch, [
      "https://a.test/s.xml",
      "https://a.test/s.xml",
    ]);
    expect(f.seen).toEqual(["https://a.test/s.xml"]);
    expect(tree.entries).toEqual([{ loc: "https://a.test/one" }]);
  });

  it("returns an empty tree when every root 404s", async () => {
    const f = fetcher({});
    const tree = await collectSitemapEntries(f.fetch, [
      "https://a.test/sitemap.xml",
    ]);
    expect(tree.entries).toEqual([]);
    expect(tree.truncated).toBe(false);
  });

  it("ignores a body that is not a sitemap", async () => {
    const f = fetcher({
      "https://a.test/sitemap.xml": mockFetchResult(
        "<html><body>hi</body></html>",
        200,
        "text/html",
      ),
    });
    const tree = await collectSitemapEntries(f.fetch, [
      "https://a.test/sitemap.xml",
    ]);
    expect(tree.entries).toEqual([]);
  });
});

describe("collectSitemapEntries — every declared root", () => {
  it("reads every root it is given, not only the first", async () => {
    const f = fetcher({
      "https://example.com/sitemap-posts.xml": urlset([
        ["https://example.com/post-1"],
      ]),
      "https://example.com/sitemap-pages.xml": urlset([
        ["https://example.com/page-1"],
      ]),
    });
    const tree = await collectSitemapEntries(f.fetch, [
      "https://example.com/sitemap-posts.xml",
      "https://example.com/sitemap-pages.xml",
    ]);
    expect(f.seen).toEqual([
      "https://example.com/sitemap-posts.xml",
      "https://example.com/sitemap-pages.xml",
    ]);
    expect(tree.entries.map((e) => e.loc)).toEqual([
      "https://example.com/post-1",
      "https://example.com/page-1",
    ]);
    expect(tree.readableFiles).toHaveLength(2);
  });

  it("probes fallback roots only when no declared root parsed", async () => {
    const f = fetcher({
      "https://example.com/sitemap.xml": urlset([["https://example.com/a"]]),
    });
    const tree = await collectSitemapEntries(
      f.fetch,
      ["https://example.com/declared-but-missing.xml"],
      { fallbackRoots: ["https://example.com/sitemap.xml"] },
    );
    expect(f.seen).toEqual([
      "https://example.com/declared-but-missing.xml",
      "https://example.com/sitemap.xml",
    ]);
    expect(tree.entries).toHaveLength(1);
  });

  it("leaves fallback roots alone once a declared root parsed", async () => {
    const f = fetcher({
      "https://example.com/declared.xml": urlset([["https://example.com/a"]]),
      "https://example.com/sitemap.xml": urlset([["https://example.com/b"]]),
    });
    await collectSitemapEntries(f.fetch, ["https://example.com/declared.xml"], {
      fallbackRoots: ["https://example.com/sitemap.xml"],
    });
    expect(f.seen).toEqual(["https://example.com/declared.xml"]);
  });

  it("stops at the first fallback root that parses", async () => {
    const f = fetcher({
      "https://example.com/sitemap.xml": urlset([["https://example.com/a"]]),
      "https://example.com/sitemap-index.xml": urlset([
        ["https://example.com/b"],
      ]),
    });
    const tree = await collectSitemapEntries(f.fetch, [], {
      fallbackRoots: [
        "https://example.com/sitemap.xml",
        "https://example.com/sitemap-index.xml",
      ],
    });
    expect(f.seen).toEqual(["https://example.com/sitemap.xml"]);
    expect(tree.entries).toHaveLength(1);
  });

  it("records a file that answered 200 but is not a sitemap", async () => {
    const f = fetcher({
      "https://example.com/sitemap.xml": mockFetchResult(
        "<html>soft 404</html>",
        200,
        "text/html",
      ),
    });
    const tree = await collectSitemapEntries(f.fetch, [
      "https://example.com/sitemap.xml",
    ]);
    expect(tree.malformedFiles).toEqual(["https://example.com/sitemap.xml"]);
    expect(tree.readableFiles).toEqual([]);
  });

  // github.io is not foo.github.io's site: a sitemap there belongs to
  // another party, and its URLs must not be judged as this site's own.
  it("skips a child sitemap on the parent domain", async () => {
    const f = fetcher({
      "https://foo.github.io/sitemap.xml": index([
        "https://github.io/attacker-sitemap.xml",
        "https://foo.github.io/child.xml",
      ]),
      "https://github.io/attacker-sitemap.xml": urlset([
        ["https://github.io/not-your-page"],
      ]),
      "https://foo.github.io/child.xml": urlset([
        ["https://foo.github.io/mine"],
      ]),
    });
    const tree = await collectSitemapEntries(f.fetch, [
      "https://foo.github.io/sitemap.xml",
    ]);
    expect(tree.childSitemaps).toEqual(["https://foo.github.io/child.xml"]);
    expect(tree.entries.map((e) => e.loc)).toEqual([
      "https://foo.github.io/mine",
    ]);
    expect(f.seen).not.toContain("https://github.io/attacker-sitemap.xml");
  });
});

describe("sampleEntries", () => {
  it("returns every entry when n exceeds the population", () => {
    const entries = [{ loc: "https://a.test/0" }, { loc: "https://a.test/1" }];
    expect(sampleEntries(entries, 10)).toEqual(entries);
  });

  // Deterministic on purpose: two audits sampling the same tree must probe the
  // same URLs, or their findings cannot be compared against each other.
  it("is deterministic and evenly strided", () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      loc: `https://a.test/${i}`,
    }));
    expect(sampleEntries(entries, 5).map((e) => e.loc)).toEqual([
      "https://a.test/0",
      "https://a.test/2",
      "https://a.test/4",
      "https://a.test/6",
      "https://a.test/8",
    ]);
  });

  it("returns nothing for a non-positive n", () => {
    expect(sampleEntries([{ loc: "https://a.test/0" }], 0)).toEqual([]);
  });
});

describe("isW3CDateTime", () => {
  it("accepts YYYY-MM-DD and full RFC 3339", () => {
    expect(isW3CDateTime("2026-08-22")).toBe(true);
    expect(isW3CDateTime("2026-08-22T10:30:00+02:00")).toBe(true);
    expect(isW3CDateTime("2026-08-22T10:30:00Z")).toBe(true);
  });

  it("rejects prose, epoch seconds and impossible dates", () => {
    expect(isW3CDateTime("yesterday")).toBe(false);
    expect(isW3CDateTime("1755859200")).toBe(false);
    expect(isW3CDateTime("2026-13-01")).toBe(false);
    expect(isW3CDateTime("")).toBe(false);
  });
});

describe("siteSitemapTree", () => {
  const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/a</loc></url></urlset>`;

  function ctx(robots?: string) {
    const calls: string[] = [];
    const rootFiles: Record<string, FetchResult> = robots
      ? { "/robots.txt": mockFetchResult(robots, 200, "text/plain") }
      : {};
    return {
      calls,
      baseUrl: "https://example.com",
      rootFiles,
      fetch: async (o: FetchOptions): Promise<FetchResult> => {
        calls.push(o.url);
        return new URL(o.url).pathname === "/sitemap.xml"
          ? mockFetchResult(xml, 200, "application/xml")
          : mockFetchResult("", 404);
      },
    };
  }

  it("walks the sitemap once per scan", async () => {
    const scan = ctx();
    const first = await siteSitemapTree(scan);
    const second = await siteSitemapTree(scan);
    expect(second).toBe(first);
    expect(first.entries).toHaveLength(1);
    expect(
      scan.calls.filter((url) => url.endsWith("/sitemap.xml")),
    ).toHaveLength(1);
  });

  it("walks the roots robots.txt advertises", async () => {
    const scan = ctx("Sitemap: https://example.com/sitemap.xml\n");
    await siteSitemapTree(scan);
    expect(scan.calls[0]).toBe("https://example.com/sitemap.xml");
  });

  it("reads every sitemap robots.txt declares", async () => {
    const calls: string[] = [];
    const posts = `<?xml version="1.0"?><urlset><url><loc>https://example.com/post-1</loc></url></urlset>`;
    const pages = `<?xml version="1.0"?><urlset><url><loc>https://example.com/page-1</loc></url></urlset>`;
    const scan = {
      baseUrl: "https://example.com",
      rootFiles: {
        "/robots.txt": mockFetchResult(
          "Sitemap: https://example.com/sitemap-posts.xml\nSitemap: https://example.com/sitemap-pages.xml\n",
          200,
          "text/plain",
        ),
      },
      fetch: async (o: FetchOptions): Promise<FetchResult> => {
        calls.push(o.url);
        const path = new URL(o.url).pathname;
        if (path === "/sitemap-posts.xml")
          return mockFetchResult(posts, 200, "application/xml");
        if (path === "/sitemap-pages.xml")
          return mockFetchResult(pages, 200, "application/xml");
        return mockFetchResult("", 404);
      },
    };
    const tree = await siteSitemapTree(scan);
    expect(calls).toEqual([
      "https://example.com/sitemap-posts.xml",
      "https://example.com/sitemap-pages.xml",
    ]);
    expect(tree.entries.map((e) => e.loc)).toEqual([
      "https://example.com/post-1",
      "https://example.com/page-1",
    ]);
  });

  // An off-site Sitemap: value is not this site's to walk, and following it
  // would turn a site-scoped scan into a crawl of another host.
  it("drops an off-site Sitemap directive", async () => {
    const scan = ctx("Sitemap: https://other.test/sitemap.xml\n");
    await siteSitemapTree(scan);
    expect(scan.calls.some((url) => url.startsWith("https://other.test"))).toBe(
      false,
    );
  });
});

describe("readSitemap", () => {
  it("returns absent when no sitemap is served", async () => {
    const scan = {
      baseUrl: "https://example.com",
      rootFiles: {},
      fetch: async () => mockFetchResult("", 404),
    };
    const res = await readSitemap(scan);
    expect(res.kind).toBe("absent");
    if (res.kind === "absent") {
      expect(res.reason).toBe(NO_SITEMAP);
    }
  });

  it("returns malformed when sitemap file is HTTP 200 but lacks valid XML", async () => {
    const scan = {
      baseUrl: "https://example.com",
      rootFiles: {
        "/sitemap.xml": mockFetchResult("<html>not xml</html>", 200),
      },
      fetch: async () => mockFetchResult("<html>not xml</html>", 200),
    };
    const res = await readSitemap(scan);
    expect(res.kind).toBe("malformed");
    if (res.kind === "malformed") {
      expect(res.reason).toContain("valid <urlset> or <sitemapindex>");
    }
  });

  // The orchestrator fetches /sitemap.xml on every scan, so a 404 for it is
  // still a present result. The verdict must follow what the walk found, not
  // whether the first root file exists.
  it("returns malformed when only /sitemap-index.xml is served, and it is broken", async () => {
    const broken = mockFetchResult("<html>not xml</html>", 200, "text/html");
    const scan = {
      baseUrl: "https://example.com",
      rootFiles: {
        "/sitemap.xml": mockFetchResult("", 404),
        "/sitemap-index.xml": broken,
      },
      fetch: async (o: FetchOptions): Promise<FetchResult> =>
        new URL(o.url).pathname === "/sitemap-index.xml"
          ? broken
          : mockFetchResult("", 404),
    };
    const res = await readSitemap(scan);
    expect(res.kind).toBe("malformed");
    if (res.kind === "malformed") {
      expect(res.result).toBe(broken);
    }
  });

  it("returns malformed when the only sitemap robots.txt declares is broken", async () => {
    const scan = {
      baseUrl: "https://example.com",
      rootFiles: {
        "/robots.txt": mockFetchResult(
          "Sitemap: https://example.com/wp-sitemap.xml\n",
          200,
          "text/plain",
        ),
        "/sitemap.xml": mockFetchResult("", 404),
      },
      fetch: async (o: FetchOptions): Promise<FetchResult> =>
        new URL(o.url).pathname === "/wp-sitemap.xml"
          ? mockFetchResult("<html>not xml</html>", 200, "text/html")
          : mockFetchResult("", 404),
    };
    const res = await readSitemap(scan);
    expect(res.kind).toBe("malformed");
    if (res.kind === "malformed") {
      expect(res.result).toBeUndefined();
    }
  });

  it("returns empty when sitemap exists but has 0 entries", async () => {
    const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;
    const scan = {
      baseUrl: "https://example.com",
      rootFiles: { "/sitemap.xml": mockFetchResult(xml, 200) },
      fetch: async () => mockFetchResult(xml, 200),
    };
    const res = await readSitemap(scan);
    expect(res.kind).toBe("empty");
    if (res.kind === "empty") {
      expect(res.reason).toBe(NO_SITEMAP);
    }
  });

  it("returns readable when valid entries exist", async () => {
    const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/a</loc></url></urlset>`;
    const scan = {
      baseUrl: "https://example.com",
      rootFiles: { "/sitemap.xml": mockFetchResult(xml, 200) },
      fetch: async () => mockFetchResult(xml, 200),
    };
    const res = await readSitemap(scan);
    expect(res.kind).toBe("readable");
    if (res.kind === "readable") {
      expect(res.tree.entries).toHaveLength(1);
    }
  });
});

describe("sitemaps for a subpath site", () => {
  function scoped(files: Record<string, FetchResult>, robots = "") {
    const f = fetcher(files);
    return {
      ...f,
      baseUrl: "https://a.test",
      siteRootUrl: "https://a.test/project/",
      rootFiles: { "/robots.txt": mockFetchResult(robots, 200, "text/plain") },
    };
  }

  it("finds a sitemap under the mounted site's root", async () => {
    const ctx = scoped({
      "https://a.test/project/sitemap.xml": urlset([
        ["https://a.test/project/a"],
      ]),
    });
    const tree = await siteSitemapTree(ctx);
    expect(tree.entries.map((e) => e.loc)).toEqual([
      "https://a.test/project/a",
    ]);
    expect(ctx.seen).toEqual(["https://a.test/project/sitemap.xml"]);
    expect((await readSitemap(ctx)).kind).toBe("readable");
  });

  it("filters shared sitemap entries before the 500-entry cap", async () => {
    const other: Array<[string, string?]> = Array.from(
      { length: 510 },
      (_, i) => [`https://a.test/other/${i}`, "bad-date"],
    );
    const ctx = scoped(
      {
        "https://a.test/shared.xml": urlset([
          ...other,
          ["https://a.test/project/a", "2026-01-01"],
          ["https://a.test/project-two/a"],
          ["https://else.test/project/a"],
        ]),
      },
      "Sitemap: https://a.test/shared.xml",
    );
    const tree = await siteSitemapTree(ctx);
    expect(tree.entries).toEqual([
      { loc: "https://a.test/project/a", lastmod: "2026-01-01" },
    ]);
    expect(tree.malformedLastmod).toBe(0);
    expect(tree.truncated).toBe(false);
  });

  it("continues to local fallbacks when a declared sitemap only covers siblings", async () => {
    const ctx = scoped(
      {
        "https://a.test/shared.xml": urlset([["https://a.test/other/a"]]),
        "https://a.test/project/sitemap_index.xml": index([
          "https://a.test/project/pages.xml",
        ]),
        "https://a.test/project/pages.xml": urlset([
          ["https://a.test/project/a"],
        ]),
      },
      "Sitemap: https://a.test/shared.xml",
    );
    const tree = await siteSitemapTree(ctx);
    expect(tree.entries.map((e) => e.loc)).toEqual([
      "https://a.test/project/a",
    ]);
    expect(tree.readableFiles).not.toContain("https://a.test/shared.xml");
  });

  it("falls back to an origin sitemap that lists the mounted site", async () => {
    const ctx = scoped({
      "https://a.test/sitemap.xml": urlset([
        ["https://a.test/project/a"],
        ["https://a.test/other/a"],
      ]),
    });
    expect((await siteSitemapTree(ctx)).entries.map((e) => e.loc)).toEqual([
      "https://a.test/project/a",
    ]);
  });

  it("does not count a sibling-only index as this site's sitemap", async () => {
    const ctx = scoped({
      "https://a.test/sitemap.xml": index(["https://a.test/other/pages.xml"]),
      "https://a.test/other/pages.xml": urlset([["https://a.test/other/a"]]),
    });
    expect((await readSitemap(ctx)).kind).toBe("absent");
  });

  it("retains malformed relative URLs in a local sitemap for content audits", async () => {
    const ctx = scoped({
      "https://a.test/project/sitemap.xml": urlset([
        ["relative-page"],
        ["/outside"],
      ]),
    });
    const tree = await siteSitemapTree(ctx);
    expect(tree.entries.map((e) => e.loc)).toEqual([
      "relative-page",
      "/outside",
    ]);
  });

  it("reports a broken local sitemap as malformed despite an unrelated origin sitemap", async () => {
    const ctx = scoped({
      "https://a.test/project/sitemap.xml": mockFetchResult(
        "<html>broken</html>",
        200,
      ),
      "https://a.test/sitemap.xml": urlset([["https://a.test/other/a"]]),
    });
    expect((await readSitemap(ctx)).kind).toBe("malformed");
  });

  it("keeps a valid empty local sitemap distinct from absence", async () => {
    const ctx = scoped({ "https://a.test/project/sitemap.xml": urlset([]) });
    expect((await readSitemap(ctx)).kind).toBe("empty");
  });

  it("does not fetch unsafe declared sitemaps", async () => {
    const ctx = scoped({}, "Sitemap: http://127.0.0.1/project/sitemap.xml");
    await siteSitemapTree(ctx);
    expect(ctx.seen.some((url) => url.includes("127.0.0.1"))).toBe(false);
  });
});

describe("sitemapSiteRoot", () => {
  it("scopes only homepage directories and removes query and fragment", () => {
    expect(
      sitemapSiteRoot({
        url: "https://a.test/project/index.html?q=1#top",
        pageType: PageType.Homepage,
      }),
    ).toBe("https://a.test/project/");
    expect(
      sitemapSiteRoot({
        url: "https://a.test/project/",
        pageType: PageType.Content,
      }),
    ).toBeUndefined();
    expect(
      sitemapSiteRoot({ url: "https://a.test/", pageType: PageType.Homepage }),
    ).toBeUndefined();
    expect(
      sitemapSiteRoot({
        url: "https://a.test/project",
        pageType: PageType.Homepage,
      }),
    ).toBeUndefined();
    expect(sitemapSiteRoot(undefined)).toBeUndefined();
  });
});

it("keeps the child-fetch cap when all children cover siblings", async () => {
  const children = Array.from(
    { length: 12 },
    (_, i) => `https://a.test/other/${i}.xml`,
  );
  const files = Object.fromEntries(
    children.map((url) => [url, urlset([[url.replace(".xml", "/page")]])]),
  );
  const f = fetcher({
    ...files,
    "https://a.test/sitemap.xml": index(children),
  });
  const ctx = {
    ...f,
    baseUrl: "https://a.test",
    siteRootUrl: "https://a.test/project/",
    rootFiles: {},
  };
  const result = await readSitemap(ctx);
  expect(result).toMatchObject({ kind: "absent", incomplete: true });
  expect(f.seen.filter((url) => children.includes(url))).toHaveLength(10);
});

it("does not prove absence from unreadable children of a shared index", async () => {
  const f = fetcher({
    "https://a.test/sitemap.xml": index([
      "https://a.test/sitemaps/project.xml.gz",
    ]),
    "https://a.test/sitemaps/project.xml.gz": mockFetchResult(
      "compressed bytes",
      200,
      "application/gzip",
    ),
  });
  const result = await readSitemap({
    ...f,
    baseUrl: "https://a.test",
    siteRootUrl: "https://a.test/project/",
    rootFiles: {},
  });
  expect(result).toMatchObject({ kind: "absent", incomplete: true });
});
