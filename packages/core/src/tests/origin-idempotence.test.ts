import { describe, it, expect, vi } from "vitest";
import { runScan } from "../orchestrator";
import {
  OriginCache,
  computeOriginCacheKey,
  shouldBypassOriginCache,
} from "../origin-cache";
import type { FetchResult } from "../fetcher";

const h = vi.hoisted(() => ({ map: new Map<string, FetchResult>() }));

function mockFetch(
  url: string,
  body = "",
  contentType = "text/html",
): FetchResult {
  return {
    url,
    finalUrl: url,
    status: 200,
    headers: { "content-type": contentType },
    body,
    ttfbMs: 1,
    totalMs: 2,
    contentType,
    contentLength: body.length,
  };
}

const fetchedUrls: string[] = [];

vi.mock("../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../fetcher")>();
  return {
    ...actual,
    isSafeUrl: async () => true,
    createFetcher: () => ({
      fetch: async ({ url }: { url: string }) => {
        fetchedUrls.push(url);
        const found = h.map.get(url);
        if (found) return found;
        if (url.endsWith("/robots.txt")) {
          return mockFetch(
            url,
            "User-agent: *\nDisallow: /admin\n",
            "text/plain",
          );
        }
        return mockFetch(
          url,
          `<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Content for ${url}</h1></body></html>`,
        );
      },
    }),
  };
});

describe("Phase 5 Origin Evidence & Cache Gates", () => {
  describe("Gate 1: Origin Idempotence & Anonymous Cache Reuse", () => {
    it("shares cached origin evidence across different page URLs on the same domain", async () => {
      const originCache = new OriginCache();

      // First scan: /articles/post-1
      const report1 = await runScan(
        "https://idempotent.example.org/articles/post-1",
        {
          originCache,
        },
      );

      expect(report1.originEvidence?.cached).toBe(false);
      expect(report1.pagesScanned).toHaveLength(1);
      expect(report1.pagesScanned[0]?.url).toBe(
        "https://idempotent.example.org/articles/post-1",
      );

      const initialRootFetchCount = fetchedUrls.filter(
        (u) => u.includes("idempotent.example.org") && u.includes(".txt"),
      ).length;
      expect(initialRootFetchCount).toBeGreaterThan(0);

      // Second scan: /pricing (different page on same origin)
      const report2 = await runScan("https://idempotent.example.org/pricing", {
        originCache,
      });

      expect(report2.originEvidence?.cached).toBe(true);
      expect(report2.originEvidence?.origin).toBe(
        "https://idempotent.example.org",
      );
      expect(report2.pagesScanned).toHaveLength(1);
      expect(report2.pagesScanned[0]?.url).toBe(
        "https://idempotent.example.org/pricing",
      );

      // Origin-level checks must produce identical verdicts between the two scans
      const originChecks1 = report1.categories
        .flatMap((c) => c.checks)
        .filter(
          (c) =>
            c.id.startsWith("access-crawl-control/") ||
            c.id.startsWith("machine-discovery/"),
        );
      const originChecks2 = report2.categories
        .flatMap((c) => c.checks)
        .filter(
          (c) =>
            c.id.startsWith("access-crawl-control/") ||
            c.id.startsWith("machine-discovery/"),
        );

      for (const check1 of originChecks1) {
        const check2 = originChecks2.find((c) => c.id === check1.id);
        if (check2) {
          expect(check2.status).toBe(check1.status);
        }
      }
    });
  });

  describe("Gate 2: Cache Isolation & Credential Protection", () => {
    it("bypasses cache when authorization headers or basic-auth credentials are present", () => {
      expect(shouldBypassOriginCache("https://example.com/")).toBe(false);
      expect(shouldBypassOriginCache("https://user:secret@example.com/")).toBe(
        true,
      );
      expect(
        shouldBypassOriginCache("https://example.com/", {
          headers: { Authorization: "Bearer token-123" },
        }),
      ).toBe(true);
      expect(
        shouldBypassOriginCache("https://example.com/", {
          headers: { Cookie: "session=secret" },
        }),
      ).toBe(true);
      expect(
        shouldBypassOriginCache("https://example.com/", {
          bypassOriginCache: true,
        }),
      ).toBe(true);
    });

    it("strips user credentials from computed cache keys to prevent secret leaks", () => {
      const keyWithSecret = computeOriginCacheKey(
        "https://admin:supersecret@example.com/path",
        "v1",
      );
      expect(keyWithSecret).toBe("https://example.com|v1");
      expect(keyWithSecret).not.toContain("admin");
      expect(keyWithSecret).not.toContain("supersecret");
    });

    it("does not store or reuse cached evidence for authenticated scans", async () => {
      const originCache = new OriginCache();

      const reportAuth = await runScan("https://auth.example.org/dashboard", {
        headers: { Authorization: "Bearer test" },
        originCache,
      });

      expect(reportAuth.originEvidence?.cached).toBe(false);
      expect(originCache.size).toBe(0); // Nothing stored in shared anonymous cache
    });
  });

  describe("Gate 3: Version Invalidation", () => {
    it("forces cache miss when ORIGIN_EVIDENCE_VERSION changes", () => {
      const cache = new OriginCache();
      const origin = "https://versioned.example.org";

      const keyV1 = computeOriginCacheKey(origin, "v1");
      const keyV2 = computeOriginCacheKey(origin, "v2");

      cache.set(keyV1, {
        origin,
        version: "v1",
        readAt: new Date().toISOString(),
        rootFiles: {},
      });

      expect(cache.get(keyV1)).toBeDefined();
      expect(cache.get(keyV2)).toBeUndefined(); // Version mismatch yields cache miss
    });
  });
});
