import { describe, it, expect } from "vitest";
import { normalizeUrl, joinUrl, extractDomain, isPrivateIp } from "./url-utils";

/**
 * URL handling, including the SSRF guard.
 *
 * `isPrivateIp` is what stops a scan of an operator-supplied URL from reaching
 * the loopback interface or a cloud metadata service, so its edges are worth
 * pinning explicitly rather than inferring from the audits that call it.
 */

describe("normalizeUrl", () => {
  it("adds https:// to a bare hostname", () => {
    expect(normalizeUrl("shop.test")).toBe("https://shop.test");
  });

  it("keeps an explicit http:// scheme", () => {
    expect(normalizeUrl("http://shop.test")).toBe("http://shop.test");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUrl("  shop.test  ")).toBe("https://shop.test");
  });

  it("lowercases the hostname but not the path", () => {
    expect(normalizeUrl("https://SHOP.TEST/Products/Hat")).toBe(
      "https://shop.test/Products/Hat",
    );
  });

  // So two scans of the same storefront produce one domain key, not two.
  it("drops the trailing slash on a root URL", () => {
    expect(normalizeUrl("https://shop.test/")).toBe("https://shop.test");
  });

  it("keeps the trailing slash on a directory path", () => {
    expect(normalizeUrl("https://shop.test/collections/")).toBe(
      "https://shop.test/collections/",
    );
  });

  it("keeps the query string and port", () => {
    expect(normalizeUrl("https://shop.test:8443/search?q=hat")).toBe(
      "https://shop.test:8443/search?q=hat",
    );
  });

  it("throws on a string no URL parser accepts", () => {
    expect(() => normalizeUrl("http://")).toThrow("Invalid URL: http://");
  });
});

describe("joinUrl", () => {
  it("joins a base and a path", () => {
    expect(joinUrl("https://shop.test", "robots.txt")).toBe(
      "https://shop.test/robots.txt",
    );
  });

  it("does not double the slash when both sides carry one", () => {
    expect(joinUrl("https://shop.test/", "/robots.txt")).toBe(
      "https://shop.test/robots.txt",
    );
  });

  it("adds the slash when neither side carries one", () => {
    expect(joinUrl("https://shop.test/a", "b")).toBe("https://shop.test/a/b");
  });
});

describe("extractDomain", () => {
  it("returns the hostname without the port", () => {
    expect(extractDomain("https://shop.test:8443/x")).toBe("shop.test");
  });

  it("throws on a value that is not an absolute URL", () => {
    expect(() => extractDomain("shop.test")).toThrow("Invalid URL: shop.test");
  });
});

describe("isPrivateIp", () => {
  it.each([
    ["10.0.0.1", "RFC1918 /8"],
    ["172.16.0.1", "RFC1918 /12 lower bound"],
    ["172.31.255.254", "RFC1918 /12 upper bound"],
    ["192.168.1.1", "RFC1918 /16"],
    ["127.0.0.1", "loopback"],
    ["169.254.169.254", "cloud metadata"],
    ["0.0.0.0", "unspecified"],
  ])("blocks %s (%s)", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each([
    ["::1", "IPv6 loopback"],
    ["fd00::1", "IPv6 unique local"],
    ["fc00::1", "IPv6 unique local"],
    ["fe80::1", "IPv6 link local"],
  ])("blocks %s (%s)", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  // Without unwrapping the ::ffff: prefix, the metadata address reaches the
  // fetcher wearing an IPv6 costume.
  it("blocks an IPv4-mapped IPv6 address", () => {
    expect(isPrivateIp("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateIp("::FFFF:127.0.0.1")).toBe(true);
  });

  it("blocks an address padded with whitespace", () => {
    expect(isPrivateIp("  127.0.0.1  ")).toBe(true);
  });

  it.each([
    ["8.8.8.8", "public resolver"],
    ["172.15.0.1", "just below the RFC1918 /12"],
    ["172.32.0.1", "just above the RFC1918 /12"],
    ["11.0.0.1", "adjacent to the /8"],
    ["2606:4700::1111", "public IPv6"],
  ])("allows %s (%s)", (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });

  it("allows a hostname, which is resolved elsewhere", () => {
    expect(isPrivateIp("shop.test")).toBe(false);
  });
});
