import { describe, it, expect } from "vitest";
import { RedirectCookieJar } from "./redirect-cookies";

describe("RedirectCookieJar", () => {
  it("returns no header before any cookie is stored", () => {
    expect(new RedirectCookieJar().header("https://example.com/")).toBe(
      undefined,
    );
  });

  it("keeps a host-only cookie on its own host", () => {
    const jar = new RedirectCookieJar();
    jar.store("a=1; Path=/", "https://example.com/start");
    expect(jar.header("https://example.com/next")).toBe("a=1");
    expect(jar.header("https://www.example.com/next")).toBeUndefined();
  });

  it("sends a Domain cookie to subdomains", () => {
    const jar = new RedirectCookieJar();
    jar.store("a=1; Domain=.example.com; Path=/", "https://example.com/");
    expect(jar.header("https://www.example.com/")).toBe("a=1");
  });

  it("refuses a Domain for another site or a bare suffix", () => {
    const jar = new RedirectCookieJar();
    jar.store(
      ["a=1; Domain=other.test", "b=2; Domain=com"],
      "https://example.com/",
    );
    expect(jar.header("https://other.test/")).toBeUndefined();
    expect(jar.header("https://example.com/")).toBeUndefined();
  });

  it("scopes by path and puts longer paths first", () => {
    const jar = new RedirectCookieJar();
    jar.store(["root=1; Path=/", "shop=2; Path=/shop"], "https://example.com/");
    expect(jar.header("https://example.com/shop/item")).toBe("shop=2; root=1");
    expect(jar.header("https://example.com/shopping")).toBe("root=1");
  });

  it("defaults the path to the directory of the setting URL", () => {
    const jar = new RedirectCookieJar();
    jar.store("a=1", "https://example.com/en/start");
    expect(jar.header("https://example.com/en/home")).toBe("a=1");
    expect(jar.header("https://example.com/")).toBeUndefined();
  });

  it("does not send a Secure cookie over http", () => {
    const jar = new RedirectCookieJar();
    jar.store("a=1; Secure; Path=/", "https://example.com/");
    expect(jar.header("http://example.com/")).toBeUndefined();
  });

  it("replaces a cookie and removes an expired one", () => {
    const jar = new RedirectCookieJar();
    jar.store(["a=1; Path=/", "b=1; Path=/"], "https://example.com/");
    jar.store(["a=2; Path=/", "b=; Max-Age=0; Path=/"], "https://example.com/");
    expect(jar.header("https://example.com/")).toBe("a=2");
    jar.store(
      "a=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/",
      "https://example.com/",
    );
    expect(jar.header("https://example.com/")).toBeUndefined();
  });

  it("ignores a header without a name", () => {
    const jar = new RedirectCookieJar();
    jar.store(["=1", "novalue"], "https://example.com/");
    expect(jar.header("https://example.com/")).toBeUndefined();
  });
});
