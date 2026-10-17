import { describe, it, expect } from "vitest";
import { UnreachableHosts, isConnectFailure } from "./unreachable-hosts";
import { mockFetchResult } from "#core/__tests__/test-utils";
import type { FetchResult } from "#core/fetcher";

function failed(error: string): FetchResult {
  return { ...mockFetchResult("", 0, ""), error };
}

const TIMEOUT =
  "Connect Timeout Error (attempted addresses: 203.0.113.9:443, timeout: 10000ms) (UND_ERR_CONNECT_TIMEOUT)";

describe("UnreachableHosts", () => {
  it("refuses a host after a connect timeout", () => {
    const hosts = new UnreachableHosts(["https://example.com/"]);
    hosts.record("https://lb.dead.test/a", failed(TIMEOUT));
    expect(hosts.refusal("https://lb.dead.test/b")).toContain(
      "UND_ERR_CONNECT_TIMEOUT",
    );
    expect(hosts.refusal("https://other.test/")).toBeUndefined();
  });

  it.each(["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH", "ENETUNREACH"])(
    "counts %s as a connect failure",
    (code) => {
      const hosts = new UnreachableHosts(["https://example.com/"]);
      hosts.record("https://dead.test/", failed(`fetch failed (${code})`));
      expect(hosts.refusal("https://dead.test/x")).toBeDefined();
    },
  );

  it.each([
    "The operation was aborted due to timeout",
    "other side closed (UND_ERR_SOCKET)",
    "Stream closed with error code NGHTTP2_INTERNAL_ERROR (ERR_HTTP2_STREAM_ERROR)",
    "TLS error, wrong version number (ERR_SSL_WRONG_VERSION_NUMBER)",
  ])("never records a host that answered something: %s", (error) => {
    const hosts = new UnreachableHosts(["https://example.com/"]);
    hosts.record("https://slow.test/", failed(error));
    expect(hosts.refusal("https://slow.test/")).toBeUndefined();
  });

  it("never records a response with a status", () => {
    const hosts = new UnreachableHosts(["https://example.com/"]);
    hosts.record("https://a.test/", {
      ...mockFetchResult("", 503, ""),
      error: TIMEOUT,
    });
    expect(hosts.refusal("https://a.test/")).toBeUndefined();
  });

  it("never records the scanned site, its www twin or its subdomains", () => {
    const hosts = new UnreachableHosts([
      "https://example.com/",
      "https://www.example.com/en/",
    ]);
    for (const url of [
      "https://example.com/",
      "https://www.example.com/x",
      "https://shop.example.com/y",
    ]) {
      hosts.record(url, failed(TIMEOUT));
      expect(hosts.refusal(url)).toBeUndefined();
    }
  });

  it("does not take a host that only ends with the site's name as its own", () => {
    const hosts = new UnreachableHosts(["https://example.com/"]);
    hosts.record("https://notexample.com/", failed(TIMEOUT));
    expect(hosts.refusal("https://notexample.com/")).toBeDefined();
  });

  // Audits fetch URLs read out of the site, and some do not parse. Such a URL
  // has no host to refuse, so it is neither recorded nor refused, and the
  // fetch reports its own error.
  it("neither records nor refuses a URL it cannot parse", () => {
    const hosts = new UnreachableHosts(["https://example.com/", "not a url"]);
    expect(() => hosts.record("not a url", failed(TIMEOUT))).not.toThrow();
    expect(hosts.refusal("not a url")).toBeUndefined();
    // The unparseable site URL did not make every host the site's own.
    hosts.record("https://dead.test/", failed(TIMEOUT));
    expect(hosts.refusal("https://dead.test/")).toBeDefined();
  });

  it("keeps the first error it saw for a host", () => {
    const hosts = new UnreachableHosts(["https://example.com/"]);
    hosts.record("https://dead.test/a", failed(TIMEOUT));
    hosts.record("https://dead.test/b", failed("fetch failed (ECONNREFUSED)"));
    const refusal = hosts.refusal("https://dead.test/c");
    expect(refusal).toContain("UND_ERR_CONNECT_TIMEOUT");
    expect(refusal).toContain("dead.test refused a connection earlier");
  });

  it("starts every scan empty", () => {
    const first = new UnreachableHosts(["https://example.com/"]);
    first.record("https://dead.test/", failed(TIMEOUT));
    const second = new UnreachableHosts(["https://example.com/"]);
    expect(second.refusal("https://dead.test/")).toBeUndefined();
  });
});

describe("isConnectFailure", () => {
  it("is true for a failure before the connection opened", () => {
    expect(isConnectFailure(failed(TIMEOUT))).toBe(true);
    expect(isConnectFailure(failed("fetch failed (ENOTFOUND)"))).toBe(true);
  });

  it.each([
    "The operation was aborted due to timeout",
    "other side closed (UND_ERR_SOCKET)",
  ])("is false once the connection opened: %s", (error) => {
    expect(isConnectFailure(failed(error))).toBe(false);
  });

  it("is false for any HTTP answer", () => {
    expect(isConnectFailure(mockFetchResult("", 404))).toBe(false);
  });
});
