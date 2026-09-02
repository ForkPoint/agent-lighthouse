import { describe, it, expect, vi } from "vitest";
import { ConditionalRequestSupportAudit } from "./conditional-request-support";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { FetchOptions, FetchResult } from "../../fetcher";
import type { AuditResult } from "../../types";

vi.mock("../../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fetcher")>();
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

const SITEMAP =
  '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/a</loc></url></urlset>';
const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];

interface SurfaceBehaviour {
  etag?: string;
  /** A second ETag, returned on the second identical request. */
  etagAfter?: string;
  lastModified?: string;
  cacheControl?: string;
  /** Answer conditional requests 200 instead of 304. */
  ignoreConditionals?: boolean;
}

function run(
  behaviour: SurfaceBehaviour = {
    etag: '"v1"',
    lastModified: "Wed, 20 Aug 2026 10:00:00 GMT",
  },
) {
  const audit = new ConditionalRequestSupportAudit();
  const ctx = mockCheckContext(
    [
      mockPageContext(
        "https://example.com/",
        "<html><body><p>Hi.</p></body></html>",
      ),
    ],
    {
      "/robots.txt": mockFetchResult(
        "User-agent: *\nAllow: /\n",
        200,
        "text/plain",
      ),
    },
  );

  const seen = new Map<string, number>();
  const requests: FetchOptions[] = [];
  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    const path = new URL(o.url).pathname;
    const conditional =
      o.headers?.["If-None-Match"] !== undefined ||
      o.headers?.["If-Modified-Since"] !== undefined;
    if (conditional && !behaviour.ignoreConditionals)
      return mockFetchResult("", 304, "text/plain");

    const count = (seen.get(o.url) ?? 0) + 1;
    seen.set(o.url, count);
    const body = path === "/robots.txt" ? "User-agent: *\nAllow: /\n" : SITEMAP;
    const result = mockFetchResult(
      body,
      path === "/sitemap.xml" || path === "/robots.txt" ? 200 : 404,
      "text/plain",
    );
    if (result.status !== 200) return result;
    const etag =
      count > 1 && behaviour.etagAfter ? behaviour.etagAfter : behaviour.etag;
    if (etag) result.headers["etag"] = etag;
    if (behaviour.lastModified)
      result.headers["last-modified"] = behaviour.lastModified;
    if (behaviour.cacheControl)
      result.headers["cache-control"] = behaviour.cacheControl;
    return result;
  };
  return { result: audit.audit(ctx), requests };
}

describe("ConditionalRequestSupportAudit", () => {
  const audit = new ConditionalRequestSupportAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("passes when every surface carries a stable validator and answers 304", async () => {
    const { result } = run();
    const r = await result;
    expect(r.status).toBe("pass");
    expect(r.details?.["revalidatingSurfaces"]).toBeGreaterThan(0);
    expect(strings(r, "perSurface")[0]).toContain("ETag+Last-Modified");
  });

  it("fails an unstable validator, quoting both ETags in the finding", async () => {
    const { result } = run({ etag: '"a"', etagAfter: '"b"' });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(strings(r, "failures").join(" ")).toContain("the ETag did");
  });

  it("fails a 200 answer to If-None-Match and to If-Modified-Since", async () => {
    const { result } = run({
      etag: '"v1"',
      lastModified: "Wed, 20 Aug 2026 10:00:00 GMT",
      ignoreConditionals: true,
    });
    const failures = strings(await result, "failures").join(" ");
    expect(failures).toContain("answered If-None-Match with 200");
    expect(failures).toContain("answered If-Modified-Since with 200");
  });

  it("fails a surface with no validator at all, and reports what a poll costs", async () => {
    const { result } = run({});
    const r = await result;
    expect(r.status).toBe("fail");
    expect(strings(r, "failures")[0]).toContain(
      "neither ETag nor Last-Modified",
    );
    expect(r.details?.["bytesPerPoll"]).toBeGreaterThan(0);
  });

  it("warns on no-store or private on a public discovery surface", async () => {
    const { result } = run({ etag: '"v1"', cacheControl: "no-store" });
    const r = await result;
    expect(r.status).toBe("warn");
    expect(strings(r, "warnings")[0]).toContain("no-store");
  });

  it("names Googlebot as the documented consumer and the check as HTTP conformance", async () => {
    const { result } = run();
    expect((await result).found).toContain("generalized here by analogy");
  });

  // The revalidation probe is four requests per surface: two identical, then
  // one per validator. The sitemap gets a fifth because the sitemap gatherer
  // walked it first, and that request belongs to the walk, not to this audit.
  it("adds at most four requests per surface, at most two of them conditional", async () => {
    const { result, requests } = run();
    await result;
    const perUrl = new Map<string, number>();
    const conditionalPerUrl = new Map<string, number>();
    for (const request of requests) {
      perUrl.set(request.url, (perUrl.get(request.url) ?? 0) + 1);
      if (
        request.headers?.["If-None-Match"] !== undefined ||
        request.headers?.["If-Modified-Since"] !== undefined
      ) {
        conditionalPerUrl.set(
          request.url,
          (conditionalPerUrl.get(request.url) ?? 0) + 1,
        );
      }
    }
    expect(perUrl.get("https://example.com/robots.txt")).toBe(4);
    expect(perUrl.get("https://example.com/sitemap.xml")).toBe(5);
    for (const [url, count] of conditionalPerUrl) expect(count, url).toBe(2);
  });

  it("is a scored grade B audit with an id inside the cap", () => {
    const { meta } = ConditionalRequestSupportAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
