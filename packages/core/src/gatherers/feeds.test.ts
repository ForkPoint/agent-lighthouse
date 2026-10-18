import { describe, it, expect, vi } from "vitest";
import {
  discoverFeedUrls,
  parseFeed,
  parseFeedDate,
  probeHubHead,
  sharedCanonicalCheck,
  sharedFeed,
  sharedFeeds,
} from "./feeds";
import { mockFetchResult } from "#core/__tests__/test-utils";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import { HttpMethod } from "#core/types";

// isSafeUrl does a real DNS lookup. The offline stand-in still blocks loopback
// and private ranges, so a refusal test proves the gate rather than the mock.
vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
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

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <updated>2026-08-20T10:00:00Z</updated>
  <link rel="self" href="https://example.com/atom.xml"/>
  <link rel="hub" href="https://hub.example/"/>
  <entry>
    <id>tag:example.com,2026:1</id>
    <updated>2026-08-20T10:00:00Z</updated>
    <title>First</title>
    <summary>A summary.</summary>
    <link rel="alternate" href="/posts/1"/>
    <content type="text/html" src="/posts/1.html"/>
  </entry>
</feed>`;

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <lastBuildDate>Wed, 20 Aug 2026 10:00:00 GMT</lastBuildDate>
  <item>
    <guid>https://example.com/posts/1</guid>
    <link>https://example.com/posts/1</link>
    <pubDate>Wed, 20 Aug 2026 10:00:00 GMT</pubDate>
    <title>First</title>
    <description>A summary.</description>
  </item>
  <item>
    <guid isPermaLink="false">abc-123</guid>
    <link>https://example.com/posts/2</link>
    <pubDate>Wed, 19 Aug 2026 10:00:00 GMT</pubDate>
    <title>Second</title>
  </item>
</channel></rss>`;

function context(
  pages: Array<{
    url: string;
    headLinks: Array<{ rel: string; type: string; href: string }>;
  }>,
  bodies: Record<string, FetchResult> = {},
  rootFiles: Record<string, FetchResult> = {},
) {
  const calls: string[] = [];
  const methods: Array<string | undefined> = [];
  const ctx = {
    baseUrl: "https://example.com",
    pages,
    rootFiles,
    fetch: async (options: FetchOptions): Promise<FetchResult> => {
      calls.push(options.url);
      methods.push(options.method);
      return bodies[options.url] ?? mockFetchResult("", 404, "text/plain");
    },
  };
  return { ctx, calls, methods };
}

const page = (links: Array<{ rel: string; type: string; href: string }>) => ({
  url: "https://example.com/",
  headLinks: links,
});

describe("discoverFeedUrls", () => {
  it("returns autodiscovered feeds plus the conventional paths, deduped", () => {
    const { ctx } = context([
      page([
        { rel: "alternate", type: "application/atom+xml", href: "/atom.xml" },
      ]),
    ]);
    const urls = discoverFeedUrls(ctx);
    expect(urls[0]).toBe("https://example.com/atom.xml");
    expect(urls).toContain("https://example.com/feed");
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("drops a feed on another host", () => {
    const { ctx } = context([
      page([
        {
          rel: "alternate",
          type: "application/rss+xml",
          href: "https://other.example/rss",
        },
      ]),
    ]);
    expect(discoverFeedUrls(ctx)).not.toContain("https://other.example/rss");
  });

  it("ignores a link that is not a feed type", () => {
    const { ctx } = context([
      page([{ rel: "alternate", type: "text/html", href: "/amp" }]),
    ]);
    expect(discoverFeedUrls(ctx)).not.toContain("https://example.com/amp");
  });

  it("reads a multi-token rel and a feed type that carries parameters", () => {
    const { ctx } = context([
      page([
        {
          rel: "Alternate home",
          type: "application/rss+xml; charset=utf-8",
          href: "/blog.rss",
        },
        { rel: "alternate", type: "application/rss+xml", href: "" },
        { rel: "stylesheet", type: "application/rss+xml", href: "/x.rss" },
      ]),
    ]);
    const urls = discoverFeedUrls(ctx);
    expect(urls[0]).toBe("https://example.com/blog.rss");
    expect(urls).not.toContain("https://example.com/x.rss");
  });

  it("lists an advertised feed once when several pages carry it", () => {
    const link = {
      rel: "alternate",
      type: "application/atom+xml",
      href: "/blog.atom",
    };
    const { ctx } = context([
      page([link]),
      { url: "https://example.com/about", headLinks: [link] },
    ]);
    const urls = discoverFeedUrls(ctx);
    expect(urls.filter((u) => u === "https://example.com/blog.atom")).toEqual([
      "https://example.com/blog.atom",
    ]);
  });

  it("keeps no feed when the base URL cannot be parsed", () => {
    const { ctx } = context([
      page([
        { rel: "alternate", type: "application/atom+xml", href: "/atom.xml" },
      ]),
    ]);
    ctx.baseUrl = "not a url";
    // Without a host no advertised feed is same-origin, and no conventional
    // path resolves against an unparseable base.
    expect(discoverFeedUrls(ctx)).toEqual([]);
  });
});

describe("parseFeed", () => {
  it("reads Atom entries, self and hub links, and the feed build date", () => {
    const doc = parseFeed(
      "https://example.com/atom.xml",
      mockFetchResult(ATOM, 200, "application/atom+xml"),
    );
    expect(doc.declaredType).toBe("atom");
    expect(doc.selfLink).toBe("https://example.com/atom.xml");
    expect(doc.hubLinks).toEqual(["https://hub.example/"]);
    expect(doc.lastBuild).toBe(Date.parse("2026-08-20T10:00:00Z"));
    const [entry] = doc.entries;
    expect(entry?.id).toBe("tag:example.com,2026:1");
    expect(entry?.link).toBe("https://example.com/posts/1");
    expect(entry?.summaryPresent).toBe(true);
    expect(entry?.contentSrc).toBe("/posts/1.html");
    expect(entry?.idCount).toBe(1);
  });

  it("reads an RSS guid as a permalink unless isPermaLink says otherwise", () => {
    const doc = parseFeed(
      "https://example.com/rss.xml",
      mockFetchResult(RSS, 200, "application/rss+xml"),
    );
    expect(doc.declaredType).toBe("rss");
    expect(doc.entries[0]?.idIsPermalink).toBe(true);
    expect(doc.entries[1]?.idIsPermalink).toBe(false);
    expect(doc.lastBuild).toBe(Date.parse("Wed, 20 Aug 2026 10:00:00 GMT"));
  });

  it("prefers the Link response header over the document for self and hub", () => {
    const result = mockFetchResult(ATOM, 200, "application/atom+xml");
    result.url = "https://example.com/atom.xml";
    result.headers["link"] =
      "<https://example.com/real-self>; rel=self, <https://hub2.example/>; rel=hub";
    const doc = parseFeed("https://example.com/atom.xml", result);
    expect(doc.selfLink).toBe("https://example.com/real-self");
    expect(doc.hubLinks).toEqual(["https://hub2.example/"]);
    expect(doc.linksFromHeader).toBe(true);
  });

  it("reports a byte-order mark or leading whitespace", () => {
    const doc = parseFeed(
      "https://example.com/rss.xml",
      mockFetchResult(`﻿${RSS}`, 200, "application/rss+xml"),
    );
    expect(doc.bomOrLeadingSpace).toBe(true);
    expect(doc.parsed).toBe(true);
  });

  it("does not claim to have parsed a document that is not a feed", () => {
    const doc = parseFeed(
      "https://example.com/rss.xml",
      mockFetchResult("<html><body>no</body></html>", 200, "text/html"),
    );
    expect(doc.parsed).toBe(false);
    expect(doc.declaredType).toBe("unknown");
  });

  it("returns an unparsed document for an empty body", () => {
    const doc = parseFeed(
      "https://example.com/feed",
      mockFetchResult("   ", 200, "application/rss+xml"),
    );
    expect(doc.parsed).toBe(false);
    // Whitespace alone is not a document with leading whitespace.
    expect(doc.bomOrLeadingSpace).toBe(false);
    expect(doc.entries).toEqual([]);
  });

  it("reads a JSON Feed's items, preferring date_modified", () => {
    const json = JSON.stringify({
      version: "https://jsonfeed.org/version/1.1",
      items: [
        {
          id: "1",
          url: "/posts/1",
          title: "First",
          summary: "A summary.",
          date_published: "2026-08-19T10:00:00Z",
          date_modified: "2026-08-20T10:00:00Z",
        },
        { id: 2, date_published: "2026-08-18T10:00:00Z", summary: "" },
        { title: "No identity" },
      ],
    });
    const doc = parseFeed(
      "https://example.com/feed.json",
      mockFetchResult(json, 200, "application/feed+json"),
    );
    expect(doc.declaredType).toBe("json");
    expect(doc.parsed).toBe(true);
    const [first, second, third] = doc.entries;
    expect(first).toMatchObject({
      id: "1",
      idIsPermalink: false,
      link: "https://example.com/posts/1",
      updated: Date.parse("2026-08-20T10:00:00Z"),
      title: "First",
      summaryPresent: true,
      idCount: 1,
      updatedCount: 1,
    });
    // A numeric id is not a JSON Feed id, which must be a string.
    expect(second).toMatchObject({
      id: "",
      idCount: 0,
      link: "",
      updated: Date.parse("2026-08-18T10:00:00Z"),
      summaryPresent: false,
      updatedCount: 1,
    });
    expect(third).toMatchObject({
      updated: undefined,
      updatedCount: 0,
      title: "No identity",
    });
  });

  it("does not claim to have parsed malformed or item-less JSON", () => {
    const broken = parseFeed(
      "https://example.com/feed.json",
      mockFetchResult("{ not json", 200, "application/feed+json"),
    );
    expect(broken.declaredType).toBe("json");
    expect(broken.parsed).toBe(false);
    const empty = parseFeed(
      "https://example.com/feed.json",
      mockFetchResult('{"version":"1.1"}', 200, "application/feed+json"),
    );
    expect(empty.parsed).toBe(false);
    expect(empty.entries).toEqual([]);
  });

  it("reads RSS self and hub links only from a prefix bound to Atom", () => {
    const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:other="https://other.example/ns">
<channel>
  <other:link rel="self" href="https://example.com/wrong"/>
  <unbound:link rel="hub" href="https://unbound.example/"/>
  <atom:link rel="self" href="/rss.xml"/>
  <atom:link rel="hub" href="https://hub.example/"/>
  <atom:other rel="hub" href="https://not-a-link.example/"/>
  <item><guid>https://example.com/posts/1</guid></item>
</channel></rss>`;
    const doc = parseFeed(
      "https://example.com/rss.xml",
      mockFetchResult(rss, 200, "application/rss+xml"),
    );
    expect(doc.selfLinksRaw).toEqual(["/rss.xml"]);
    expect(doc.selfLink).toBe("https://example.com/rss.xml");
    expect(doc.hubLinksRaw).toEqual(["https://hub.example/"]);
    expect(doc.linksFromHeader).toBe(false);
  });

  it("parses RSS 1.0 (RDF) items and falls back to the channel pubDate", () => {
    const rdf = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
  <channel><pubDate>Wed, 20 Aug 2026 10:00:00 GMT</pubDate></channel>
  <item><link>https://example.com/posts/1</link><title>First</title></item>
</rdf:RDF>`;
    const doc = parseFeed(
      "https://example.com/index.rdf",
      mockFetchResult(rdf, 200, "application/rdf+xml"),
    );
    expect(doc.declaredType).toBe("rss");
    expect(doc.parsed).toBe(true);
    expect(doc.lastBuild).toBe(Date.parse("Wed, 20 Aug 2026 10:00:00 GMT"));
    // No guid means no id, and so nothing that could claim to be a permalink.
    expect(doc.entries[0]).toMatchObject({
      id: "",
      idIsPermalink: false,
      idCount: 0,
      link: "https://example.com/posts/1",
      summaryPresent: false,
      updated: undefined,
    });
  });

  it("takes an Atom entry's rel-less link as its alternate and falls back to published", () => {
    const atom = `<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>tag:example.com,2026:1</id>
    <id>tag:example.com,2026:dup</id>
    <published>2026-08-19T10:00:00Z</published>
    <link rel="enclosure" href="/audio.mp3"/>
    <link href="/posts/1"/>
  </entry>
  <entry>
    <id>tag:example.com,2026:2</id>
    <link rel="related" href="/related"/>
  </entry>
  <entry><id>tag:example.com,2026:3</id></entry>
</feed>`;
    const doc = parseFeed(
      "https://example.com/atom.xml",
      mockFetchResult(atom, 200, "application/atom+xml"),
    );
    const [first, second, third] = doc.entries;
    expect(first).toMatchObject({
      link: "https://example.com/posts/1",
      updated: Date.parse("2026-08-19T10:00:00Z"),
      idCount: 2,
      updatedCount: 0,
      contentSrc: "",
      contentType: "",
      summaryPresent: false,
    });
    // With no alternate, the first link is the best guess at the entry's page.
    expect(second?.link).toBe("https://example.com/related");
    expect(third?.link).toBe("");
    expect(doc.lastBuild).toBeUndefined();
    expect(doc.selfLink).toBe("");
    expect(doc.hubLinks).toEqual([]);
  });

  it("reads the content type from the response when the header map has none", () => {
    const result = mockFetchResult(RSS, 200, "application/rss+xml");
    delete result.headers["content-type"];
    const doc = parseFeed("https://example.com/rss.xml", result);
    expect(doc.contentType).toBe("application/rss+xml");
  });
});

describe("parseFeedDate", () => {
  it("parses a timezone-carrying ISO and RFC 822 date to UTC", () => {
    expect(parseFeedDate("2026-08-20T10:00:00Z")).toBe(
      Date.parse("2026-08-20T10:00:00Z"),
    );
    expect(parseFeedDate("Wed, 20 Aug 2026 10:00:00 +0200")).toBe(
      Date.parse("Wed, 20 Aug 2026 10:00:00 +0200"),
    );
  });

  // Guessing an offset is silently wrong for every reader in another zone.
  it("returns undefined for a timezone-less timestamp", () => {
    expect(parseFeedDate("2026-08-20T10:00:00")).toBeUndefined();
    expect(parseFeedDate("not a date")).toBeUndefined();
  });

  it("parses a bare date and rejects an empty or impossible one", () => {
    expect(parseFeedDate(" 2026-08-20 ")).toBe(Date.parse("2026-08-20"));
    expect(parseFeedDate("   ")).toBeUndefined();
    // Carries a zone, so it passes the shape test, but names no real day.
    expect(parseFeedDate("2026-13-45T10:00:00Z")).toBeUndefined();
  });
});

describe("sharedFeed", () => {
  it("fetches one URL once however many callers ask", async () => {
    const feed = mockFetchResult(ATOM, 200, "application/atom+xml");
    const { ctx, calls } = context([page([])], {
      "https://example.com/atom.xml": feed,
    });
    const [a, b] = await Promise.all([
      sharedFeed(ctx, "https://example.com/atom.xml"),
      sharedFeed(ctx, "https://example.com/atom.xml"),
    ]);
    expect(calls).toEqual(["https://example.com/atom.xml"]);
    expect(a?.entries).toHaveLength(1);
    expect(b).toBe(a);
  });

  it("refuses a URL the safety gate rejects", async () => {
    const { ctx, calls } = context([page([])]);
    expect(await sharedFeed(ctx, "http://127.0.0.1/feed")).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("sharedFeeds keeps only the feeds that fetched and parsed", async () => {
    const { ctx } = context(
      [
        page([
          { rel: "alternate", type: "application/atom+xml", href: "/atom.xml" },
        ]),
      ],
      {
        "https://example.com/atom.xml": mockFetchResult(
          ATOM,
          200,
          "application/atom+xml",
        ),
      },
    );
    const docs = await sharedFeeds(ctx);
    expect(docs.map((d) => d.url)).toEqual(["https://example.com/atom.xml"]);
  });

  it("sharedFeeds falls back to a conventional path past the probe cap", async () => {
    // Nothing advertised: the first four conventional paths 404, so the
    // fallback walks the rest and stops at the first feed that parses.
    const { ctx } = context([page([])], {
      "https://example.com/index.xml": mockFetchResult(
        RSS,
        200,
        "application/rss+xml",
      ),
    });
    const docs = await sharedFeeds(ctx);
    expect(docs.map((d) => d.url)).toEqual(["https://example.com/index.xml"]);
  });

  it("sharedFeeds returns nothing when no candidate parses", async () => {
    const { ctx } = context([page([])], {
      "https://example.com/feed": mockFetchResult(
        "<html></html>",
        200,
        "text/html",
      ),
    });
    expect(await sharedFeeds(ctx)).toEqual([]);
  });

  it("sharedFeeds fetches nothing when the base URL cannot be parsed", async () => {
    const { ctx, calls } = context([page([])]);
    ctx.baseUrl = "not a url";
    expect(await sharedFeeds(ctx)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("reads a 2xx pre-fetched root file instead of fetching again", async () => {
    const { ctx, calls } = context(
      [page([])],
      {},
      {
        "/feed.xml": mockFetchResult(RSS, 200, "application/rss+xml"),
      },
    );
    const doc = await sharedFeed(ctx, "https://example.com/feed.xml");
    expect(calls).toEqual([]);
    expect(doc?.parsed).toBe(true);
    expect(doc?.entries).toHaveLength(2);
  });

  it("prefers a live 2xx fetch over a failed pre-fetched root file", async () => {
    const { ctx, calls } = context(
      [page([])],
      {
        "https://example.com/feed.xml": mockFetchResult(
          RSS,
          200,
          "application/rss+xml",
        ),
      },
      { "/feed.xml": mockFetchResult("", 503, "text/plain") },
    );
    const doc = await sharedFeed(ctx, "https://example.com/feed.xml");
    expect(calls).toEqual(["https://example.com/feed.xml"]);
    expect(doc?.status).toBe(200);
    expect(doc?.parsed).toBe(true);
  });

  it("reports the root file's failure when the live fetch also fails", async () => {
    const { ctx } = context(
      [page([])],
      {},
      {
        "/feed.xml": mockFetchResult("", 503, "text/plain"),
      },
    );
    const doc = await sharedFeed(ctx, "https://example.com/feed.xml");
    expect(doc?.status).toBe(503);
    expect(doc?.parsed).toBe(false);
  });
});

describe("sharedCanonicalCheck", () => {
  it("fetches a URL once per scan", async () => {
    const { ctx, calls } = context([page([])], {
      "https://example.com/posts/1": mockFetchResult("ok", 200, "text/html"),
    });
    const [a, b] = await Promise.all([
      sharedCanonicalCheck(ctx, "https://example.com/posts/1"),
      sharedCanonicalCheck(ctx, "https://example.com/posts/1"),
    ]);
    expect(calls).toEqual(["https://example.com/posts/1"]);
    expect(a?.status).toBe(200);
    expect(b).toBe(a);
  });

  it("refuses an unsafe URL without fetching", async () => {
    const { ctx, calls } = context([page([])]);
    expect(
      await sharedCanonicalCheck(ctx, "http://192.168.1.1/x"),
    ).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("returns undefined when the fetch throws", async () => {
    const { ctx } = context([page([])]);
    ctx.fetch = async () => {
      throw new Error("connect timeout");
    };
    expect(
      await sharedCanonicalCheck(ctx, "https://example.com/posts/1"),
    ).toBeUndefined();
  });
});

describe("probeHubHead", () => {
  it("sends one HEAD request per hub URL per scan", async () => {
    const { ctx, calls, methods } = context([page([])], {
      "https://hub.example/": mockFetchResult("", 200, "text/plain"),
    });
    const [a, b] = await Promise.all([
      probeHubHead(ctx, "https://hub.example/"),
      probeHubHead(ctx, "https://hub.example/"),
    ]);
    expect(calls).toEqual(["https://hub.example/"]);
    expect(methods).toEqual([HttpMethod.Head]);
    expect(a?.status).toBe(200);
    expect(b).toBe(a);
  });

  it("refuses an unsafe hub and swallows a fetch error", async () => {
    const { ctx, calls } = context([page([])]);
    expect(await probeHubHead(ctx, "http://localhost/hub")).toBeUndefined();
    expect(calls).toEqual([]);
    ctx.fetch = async () => {
      throw new Error("reset");
    };
    expect(await probeHubHead(ctx, "https://hub.example/")).toBeUndefined();
  });
});
