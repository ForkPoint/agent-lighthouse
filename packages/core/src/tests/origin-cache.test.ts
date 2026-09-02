import { describe, it, expect } from "vitest";
import {
  OriginCache,
  computeOriginCacheKey,
  shouldBypassOriginCache,
  type OriginEvidence,
} from "../origin-cache";

describe("Phase 5: Origin Cache Architecture", () => {
  describe("computeOriginCacheKey", () => {
    it("normalizes scheme and hostname to lowercase", () => {
      const key = computeOriginCacheKey("HTTPS://EXAMPLE.COM/Path", "v1");
      expect(key).toBe("https://example.com|v1");
    });

    it("strips standard HTTP (80) and HTTPS (443) default ports", () => {
      const httpsKey = computeOriginCacheKey(
        "https://example.com:443/some/path",
        "v1",
      );
      expect(httpsKey).toBe("https://example.com|v1");

      const httpKey = computeOriginCacheKey(
        "http://example.com:80/some/path",
        "v1",
      );
      expect(httpKey).toBe("http://example.com|v1");
    });

    it("preserves non-standard ports", () => {
      const customPortKey = computeOriginCacheKey(
        "https://example.com:8443/path",
        "v1",
      );
      expect(customPortKey).toBe("https://example.com:8443|v1");
    });

    it("strips query parameters and hashes", () => {
      const key = computeOriginCacheKey(
        "https://example.com/page?foo=bar#section",
        "v1",
      );
      expect(key).toBe("https://example.com|v1");
    });

    it("strips credentials from URL authority", () => {
      const key = computeOriginCacheKey(
        "https://admin:supersecret@example.com:443/dashboard",
        "v1",
      );
      expect(key).toBe("https://example.com|v1");
      expect(key).not.toContain("admin");
      expect(key).not.toContain("supersecret");
    });

    it("falls back gracefully when given a raw hostname or invalid URL", () => {
      const key = computeOriginCacheKey("not a url", "v1");
      expect(key).toBe("not a url|v1");
    });
  });

  describe("shouldBypassOriginCache", () => {
    it("returns false for standard anonymous requests", () => {
      expect(shouldBypassOriginCache("https://example.com")).toBe(false);
      expect(
        shouldBypassOriginCache("https://example.com", {
          headers: { "Accept-Language": "en-US" },
        }),
      ).toBe(false);
    });

    it("returns true when bypassOriginCache option is explicitly set", () => {
      expect(
        shouldBypassOriginCache("https://example.com", {
          bypassOriginCache: true,
        }),
      ).toBe(true);
    });

    it("returns true when basic auth credentials exist in the URL", () => {
      expect(shouldBypassOriginCache("https://user:pass@example.com")).toBe(
        true,
      );
    });

    it("returns true for case-insensitive Authorization header", () => {
      expect(
        shouldBypassOriginCache("https://example.com", {
          headers: { authorization: "Bearer secret" },
        }),
      ).toBe(true);
      expect(
        shouldBypassOriginCache("https://example.com", {
          headers: { AUTHORIZATION: "Basic dXNlcjpwYXNz" },
        }),
      ).toBe(true);
    });

    it("returns true for case-insensitive Cookie header", () => {
      expect(
        shouldBypassOriginCache("https://example.com", {
          headers: { cookie: "sid=123" },
        }),
      ).toBe(true);
      expect(
        shouldBypassOriginCache("https://example.com", {
          headers: { COOKIE: "token=abc" },
        }),
      ).toBe(true);
    });
  });

  describe("OriginCache Class & Lifecycle", () => {
    const mockEvidence: OriginEvidence = {
      origin: "https://example.com",
      version: "v1",
      readAt: "2026-09-02T08:00:00.000Z",
      rootFiles: {},
    };

    it("sets, gets, and checks existence of entries", () => {
      const cache = new OriginCache();
      const key = "https://example.com|v1";

      expect(cache.get(key)).toBeUndefined();
      expect(cache.has(key)).toBe(false);

      cache.set(key, mockEvidence);

      expect(cache.has(key)).toBe(true);
      expect(cache.get(key)).toEqual(mockEvidence);
      expect(cache.size).toBe(1);
    });

    it("deletes entries and clears all cache", () => {
      const cache = new OriginCache();
      cache.set("k1", mockEvidence);
      cache.set("k2", mockEvidence);
      expect(cache.size).toBe(2);

      expect(cache.delete("k1")).toBe(true);
      expect(cache.has("k1")).toBe(false);
      expect(cache.size).toBe(1);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has("k2")).toBe(false);
    });

    it("evicts expired entries according to TTL", async () => {
      // 30ms TTL
      const cache = new OriginCache(30);
      const key = "https://short-lived.com|v1";

      cache.set(key, mockEvidence);
      expect(cache.get(key)).toBeDefined();

      // Wait 40ms for expiration
      await new Promise((r) => setTimeout(r, 40));

      expect(cache.get(key)).toBeUndefined();
      expect(cache.has(key)).toBe(false);
      expect(cache.size).toBe(0);
    });
  });
});
