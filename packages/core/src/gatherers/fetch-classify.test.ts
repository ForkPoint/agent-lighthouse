import { describe, it, expect } from "vitest";
import {
  classifyFetch,
  isRealFile,
  stripBom,
  normalizeNewlines,
  ExpectedKind,
} from "./fetch-classify";
import type { FetchResult } from "../fetcher";

const fr = (over: Partial<FetchResult>): FetchResult => ({
  url: "https://x.test/robots.txt",
  finalUrl: "https://x.test/robots.txt",
  status: 200,
  headers: {},
  body: "User-agent: *\nAllow: /",
  ttfbMs: 10,
  totalMs: 20,
  contentType: "text/plain",
  contentLength: 22,
  ...over,
});

describe("classifyFetch", () => {
  it("classifies a plain text file as ok", () => {
    expect(classifyFetch(fr({}), ExpectedKind.Text)).toBe("ok");
  });
  it("classifies an HTML body served for a text file as soft-404", () => {
    const spa = fr({
      body: '<!doctype html><html><head><title>App</title></head><body><div id="root"></div></body></html>',
      contentType: "text/html",
    });
    expect(classifyFetch(spa, ExpectedKind.Text)).toBe("soft-404");
    expect(isRealFile(spa, ExpectedKind.Text)).toBe(false);
  });
  it("classifies HTML content-type with JSON expectation as soft-404", () => {
    const spa = fr({
      contentType: "text/html",
      body: "<!doctype html><p>not found</p>",
    });
    expect(classifyFetch(spa, ExpectedKind.Json)).toBe("soft-404");
  });
  it("accepts JSON that parses when json expected, regardless of loose content-type", () => {
    const j = fr({ contentType: "application/octet-stream", body: '{"a":1}' });
    expect(classifyFetch(j, ExpectedKind.Json)).toBe("ok");
  });
  it("classifies 401/403/429 as blocked", () => {
    expect(classifyFetch(fr({ status: 403 }), ExpectedKind.Text)).toBe(
      "blocked",
    );
    expect(classifyFetch(fr({ status: 429 }), ExpectedKind.Text)).toBe(
      "blocked",
    );
  });
  it("classifies 404/410 and undefined as missing", () => {
    expect(classifyFetch(fr({ status: 404 }), ExpectedKind.Text)).toBe(
      "missing",
    );
    expect(classifyFetch(undefined, ExpectedKind.Text)).toBe("missing");
  });
  it("classifies 5xx and fetch errors as error", () => {
    expect(classifyFetch(fr({ status: 503 }), ExpectedKind.Text)).toBe("error");
    expect(
      classifyFetch(fr({ status: 0, error: "ENOTFOUND" }), ExpectedKind.Text),
    ).toBe("error");
  });
  it("accepts a real llms.txt mis-served as text/html (body evidence wins)", () => {
    const llms = fr({
      contentType: "text/html; charset=utf-8",
      body: "# Acme\n\n> Widgets.\n\n## Docs\n- [Guide](https://x.test/guide)\n",
    });
    expect(classifyFetch(llms, ExpectedKind.Text)).toBe("ok");
    expect(isRealFile(llms, ExpectedKind.Text)).toBe(true);
  });
  it("accepts a real sitemap.xml mis-served as text/html (body evidence wins)", () => {
    const sitemap = fr({
      contentType: "text/html",
      body: '<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://x.test/</loc></url></urlset>',
    });
    expect(classifyFetch(sitemap, ExpectedKind.Xml)).toBe("ok");
    const rss = fr({
      contentType: "text/html",
      body: '<rss version="2.0"><channel/></rss>',
    });
    expect(classifyFetch(rss, ExpectedKind.Xml)).toBe("ok");
    const atom = fr({
      contentType: "text/html",
      body: '﻿  <feed xmlns="http://www.w3.org/2005/Atom"/>',
    });
    expect(classifyFetch(atom, ExpectedKind.Xml)).toBe("ok");
  });
  it("still calls an HTML shell served at a .txt path a soft-404", () => {
    const shell = fr({
      contentType: "text/plain",
      body: '<!doctype html><html><head><title>App</title></head><body><div id="root"></div></body></html>',
    });
    expect(classifyFetch(shell, ExpectedKind.Text)).toBe("soft-404");
  });
  it("matches an uppercase TEXT/HTML content-type case-insensitively", () => {
    const shell = fr({
      contentType: "TEXT/HTML; charset=UTF-8",
      body: "<!DOCTYPE HTML><html><body>x</body></html>",
    });
    expect(classifyFetch(shell, ExpectedKind.Text)).toBe("soft-404");
    // Non-XML body under an uppercase text/html header → header decides for xml.
    const notXml = fr({ contentType: "TEXT/HTML", body: "Not found, sorry." });
    expect(classifyFetch(notXml, ExpectedKind.Xml)).toBe("soft-404");
  });
  it("html expectation accepts an HTML body as ok", () => {
    expect(
      classifyFetch(
        fr({ contentType: "text/html", body: "<!doctype html><p>hi</p>" }),
        ExpectedKind.Html,
      ),
    ).toBe("ok");
  });
});

describe("stripBom / normalizeNewlines", () => {
  it("strips UTF-8 BOM", () => {
    expect(stripBom("﻿User-agent: *")).toBe("User-agent: *");
  });
  it("leaves BOM-free text alone", () => {
    expect(stripBom("abc")).toBe("abc");
  });
  it("normalizes CRLF and CR to LF", () => {
    expect(normalizeNewlines("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });
});
