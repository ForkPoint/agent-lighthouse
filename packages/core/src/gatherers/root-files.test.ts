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
  ])("reads %j as an HTML document", (body) => {
    expect(isHtmlDocument(body)).toBe(true);
  });

  it.each([
    "# Site\n\n> Summary\n\n- [Docs](/docs): <html> in prose",
    '{"servers":[]}',
    '<?xml version="1.0"?><urlset></urlset>',
    "<htmlish>",
    "",
  ])("does not read %j as an HTML document", (body) => {
    expect(isHtmlDocument(body)).toBe(false);
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
    expect(rootArtifactMiss(undefined)).toBe("No response");
  });
});
