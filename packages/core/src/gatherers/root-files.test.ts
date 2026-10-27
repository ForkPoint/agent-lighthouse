import { describe, expect, it } from "vitest";
import { mockFetchResult } from "#core/__tests__/test-utils";
import { isHtmlDocument, isRootArtifact, rootArtifactMiss } from "./root-files";

const HOME = '<!DOCTYPE html>\n\n<html lang="fr"><body>Home</body></html>';

describe("isHtmlDocument", () => {
  it.each([
    HOME,
    "<html><body></body></html>",
    "﻿  <!doctype HTML><html>",
    "<!-- build 42 -->\n<!DOCTYPE html><html>",
    "<HTML lang=en>",
    "<!-- a --> <!-- b -->\n\n<html>",
  ])("reads %j as an HTML document", (body) => {
    expect(isHtmlDocument(body)).toBe(true);
  });

  it.each([
    "# Site\n\n> Summary\n\n- [Docs](/docs): <html> in prose",
    '{"servers":[]}',
    '<?xml version="1.0"?><urlset></urlset>',
    "<htmlish>",
    "<!-- never closed <html>",
    "",
  ])("does not read %j as an HTML document", (body) => {
    expect(isHtmlDocument(body)).toBe(false);
  });

  it("reads a body of repeated comment openers in linear time", () => {
    const started = performance.now();
    expect(isHtmlDocument("<!--".repeat(50_000))).toBe(false);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe("isRootArtifact", () => {
  it("accepts a 200 that is the file", () => {
    expect(isRootArtifact(mockFetchResult("# Site"))).toBe(true);
  });

  it("accepts an empty 200: the file is present and empty", () => {
    expect(isRootArtifact(mockFetchResult(""))).toBe(true);
  });

  it("rejects a 200 HTML page, a non-200 and a missing result", () => {
    expect(isRootArtifact(mockFetchResult(HOME, 200, "text/html"))).toBe(false);
    expect(isRootArtifact(mockFetchResult("# Site", 404))).toBe(false);
    expect(isRootArtifact(undefined)).toBe(false);
  });
});

describe("rootArtifactMiss", () => {
  it("names the redirect to an HTML page", () => {
    const result = mockFetchResult(HOME, 200, "text/html");
    result.url = "https://example.com/llms.txt";
    result.finalUrl = "https://example.com/";
    expect(rootArtifactMiss(result)).toBe(
      "HTTP 200 with an HTML page, redirected to https://example.com/, not the file",
    );
  });

  it("names an HTML page served in place", () => {
    expect(rootArtifactMiss(mockFetchResult(HOME, 200, "text/html"))).toBe(
      "HTTP 200 with an HTML page, not the file",
    );
  });

  it("names the status or the error otherwise", () => {
    expect(rootArtifactMiss(mockFetchResult("", 404))).toBe("HTTP 404");
    const failed = mockFetchResult("", 0);
    failed.error = "connect ECONNREFUSED";
    expect(rootArtifactMiss(failed)).toBe("connect ECONNREFUSED");
    expect(rootArtifactMiss(mockFetchResult("", 0))).toBe("No response");
    expect(rootArtifactMiss(undefined)).toBe("No response");
  });
});
