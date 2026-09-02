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

    it("strips username-only credentials from URL", () => {
      const key = computeOriginCacheKey("https://user@example.com/path", "v1");
      expect(key).toBe("https://example.com|v1");
      expect(key).not.toContain("user");
    });

    it("strips password-only credentials from URL", () => {
      const key = computeOriginCacheKey(
        "https://:secret@example.com/path",
        "v1",
      );
      expect(key).toBe("https://example.com|v1");
      expect(key).not.toContain("secret");
    });

    it("handles IPv4 loopback and local addresses with and without ports", () => {
      const ipKey = computeOriginCacheKey("http://127.0.0.1:8080/path", "v1");
      expect(ipKey).toBe("http://127.0.0.1:8080|v1");

      const defaultPortIp = computeOriginCacheKey(
        "http://192.168.1.1:80/status",
        "v1",
      );
      expect(defaultPortIp).toBe("http://192.168.1.1|v1");
    });

    it("handles IPv6 bracketed addresses with and without credentials", () => {
      const ipv6Key = computeOriginCacheKey("http://[::1]:8080/path", "v1");
      expect(ipv6Key).toBe("http://[::1]:8080|v1");

      const ipv6Creds = computeOriginCacheKey(
        "http://user:pass@[2001:db8::1]:8080/path",
        "v1",
      );
      expect(ipv6Creds).toBe("http://[2001:db8::1]:8080|v1");
      expect(ipv6Creds).not.toContain("user");
      expect(ipv6Creds).not.toContain("pass");
    });

    it("isolates different subdomains on the same root domain", () => {
      const key1 = computeOriginCacheKey("https://api.example.com/v1", "v1");
      const key2 = computeOriginCacheKey("https://www.example.com/", "v1");
      const key3 = computeOriginCacheKey("https://example.com/", "v1");

      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });

    it("isolates http from https on the same host", () => {
      const httpKey = computeOriginCacheKey("http://example.com/", "v1");
      const httpsKey = computeOriginCacheKey("https://example.com/", "v1");
      expect(httpKey).not.toBe(httpsKey);
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
      expect(shouldBypassOriginCache("https://user@example.com")).toBe(true);
      expect(shouldBypassOriginCache("https://:secret@example.com")).toBe(true);
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
      expect(
        shouldBypassOriginCache("https://example.com", {
          headers: { "Authorization": "Token 123" },
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
      expect(
        shouldBypassOriginCache("https://example.com", {
          headers: { "Cookie": "session=xyz" },
        }),
      ).toBe(true);
    });

    it("returns true for case-insensitive Proxy-Authorization header", () => {
      expect(
        shouldBypassOriginCache("https://example.com", {
          headers: { "proxy-authorization": "Basic proxy123" },
        }),
      ).toBe(true);
      expect(
        shouldBypassOriginCache("https://example.com", {
          headers: { "PROXY-AUTHORIZATION": "Basic proxy123" },
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

      // Deleting a non-existent key returns false
      expect(cache.delete("nonexistent")).toBe(false);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has("k2")).toBe(false);
    });

    it("allows overriding TTL per set() call", async () => {
      const cache = new OriginCache(1000); // default 1 second
      const shortKey = "https://short.com|v1";
      const longKey = "https://long.com|v1";

      cache.set(shortKey, mockEvidence, 20); // 20ms custom TTL
      cache.set(longKey, mockEvidence, 500); // 500ms custom TTL

      expect(cache.has(shortKey)).toBe(true);
      expect(cache.has(longKey)).toBe(true);

      await new Promise((r) => setTimeout(r, 35));

      expect(cache.has(shortKey)).toBe(false);
      expect(cache.get(shortKey)).toBeUndefined();
      expect(cache.has(longKey)).toBe(true);
      expect(cache.get(longKey)).toBeDefined();
    });

    it("evicts expired entries according to TTL", async () => {
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

    it("handles zero or negative TTL by expiring immediately", () => {
      const cache = new OriginCache();
      cache.set("immediate-expire", mockEvidence, 0);
      expect(cache.get("immediate-expire")).toBeUndefined();
      expect(cache.has("immediate-expire")).toBe(false);
    });

    it("overwriting a key updates evidence and resets TTL", async () => {
      const cache = new OriginCache(40);
      const key = "https://overwrite.com|v1";

      const evidenceA: OriginEvidence = {
        origin: "https://overwrite.com",
        version: "v1",
        readAt: "2026-09-02T08:00:00.000Z",
        rootFiles: {},
      };
      const evidenceB: OriginEvidence = {
        origin: "https://overwrite.com",
        version: "v1",
        readAt: "2026-09-02T09:00:00.000Z",
        rootFiles: {},
      };

      cache.set(key, evidenceA);
      expect(cache.get(key)?.readAt).toBe("2026-09-02T08:00:00.000Z");

      await new Promise((r) => setTimeout(r, 20));

      // Overwrite with fresh evidence and fresh TTL
      cache.set(key, evidenceB, 50);
      expect(cache.get(key)?.readAt).toBe("2026-09-02T09:00:00.000Z");

      // Wait another 30ms (50ms since first set, but only 30ms since second set)
      await new Promise((r) => setTimeout(r, 30));

      expect(cache.has(key)).toBe(true);
      expect(cache.get(key)?.readAt).toBe("2026-09-02T09:00:00.000Z");
    });
  });
});
