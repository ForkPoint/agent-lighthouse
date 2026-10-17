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

  // Only whitespace before the `=` is still no name: the jar must not send
  // a bare `=1` pair the server never named.
  it("ignores a header whose name is only whitespace", () => {
    const jar = new RedirectCookieJar();
    jar.store("  =1; Path=/", "https://example.com/");
    expect(jar.header("https://example.com/")).toBeUndefined();
  });

  it("keeps a cookie whose Expires or Max-Age lies in the future", () => {
    const jar = new RedirectCookieJar();
    jar.store(
      [
        "a=1; Expires=Fri, 01 Jan 2100 00:00:00 GMT; Path=/",
        "b=2; Max-Age=3600; Path=/",
      ],
      "https://example.com/",
    );
    expect(jar.header("https://example.com/")).toBe("a=1; b=2");
  });

  // A date the jar cannot read says nothing about expiry. Dropping the cookie
  // would end the chain's session as surely as never storing it.
  it("keeps a cookie whose Expires it cannot parse or whose Max-Age is not a number", () => {
    const jar = new RedirectCookieJar();
    jar.store(
      ["a=1; Expires=soon; Path=/", "b=2; Max-Age=never; Path=/"],
      "https://example.com/",
    );
    expect(jar.header("https://example.com/")).toBe("a=1; b=2");
  });

  // A removal names the cookie by name, domain and path. One with the same
  // name on another path is a different cookie and stays.
  it("removes only the cookie with the same name, domain and path", () => {
    const jar = new RedirectCookieJar();
    jar.store(["a=1; Path=/", "a=2; Path=/shop"], "https://example.com/");
    jar.store("a=; Max-Age=0; Path=/shop", "https://example.com/");
    expect(jar.header("https://example.com/shop/item")).toBe("a=1");
  });

  // RFC 6265 section 5.3, step 3: Max-Age wins over Expires whatever their
  // order. Read in order, a past Expires written after a positive Max-Age
  // dropped a cookie a browser keeps.
  it("lets Max-Age win over a past Expires written after it", () => {
    const jar = new RedirectCookieJar();
    jar.store(
      "a=1; Max-Age=3600; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/",
      "https://example.com/",
    );
    expect(jar.header("https://example.com/")).toBe("a=1");
  });

  it("lets a Max-Age of 0 remove a cookie whose Expires is in the future", () => {
    const jar = new RedirectCookieJar();
    jar.store("a=1; Path=/", "https://example.com/");
    jar.store(
      "a=1; Expires=Fri, 01 Jan 2100 00:00:00 GMT; Max-Age=0; Path=/",
      "https://example.com/",
    );
    expect(jar.header("https://example.com/")).toBeUndefined();
  });

  it("still removes a cookie by a past Expires when there is no Max-Age", () => {
    const jar = new RedirectCookieJar();
    jar.store("a=1; Path=/", "https://example.com/");
    jar.store(
      "a=1; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/",
      "https://example.com/",
    );
    expect(jar.header("https://example.com/")).toBeUndefined();
  });
});
