import type { FetchResult } from "#core/fetcher";

/**
 * Whether a root file the scan fetched is the artifact its path names.
 *
 * The scan fetches `/llms.txt`, `/.well-known/mcp/servers.json` and the other
 * root files once, and audits read them from `ctx.rootFiles`. HTTP 200 alone
 * does not show the file is there. Many sites redirect every unknown path to
 * the homepage, or answer it with their single-page app shell, both as 200.
 * An audit that read that HTML as the artifact graded a file the site never
 * published: "llms.txt missing markdown heading" for a homepage, 1,960
 * trust.txt attributes read out of `<html lang=...>`.
 *
 * None of these artifacts is HTML: they are Markdown, plain text, JSON, YAML
 * or XML. A body that opens as an HTML document is the site's answer for a
 * path it does not serve, so the artifact is absent. Only the opening is
 * read. A Markdown file that quotes HTML further down still counts.
 *
 * `/robots.txt` and the about pages do not go through this: robots readers
 * already treat an unparseable body as no rules, and an about page is HTML.
 */

/** Bytes read from the start of a body when looking for an HTML document. */
const SNIFF_BYTES = 1024;

/** Optional BOM and whitespace, any comments, then a doctype or `<html>`. */
const HTML_START =
  /^﻿?\s*(?:<!--[\s\S]*?-->\s*)*<(?:!doctype\s+html|html[\s>])/i;

/** True when a body opens as an HTML document. */
export function isHtmlDocument(body: string): boolean {
  return HTML_START.test(body.slice(0, SNIFF_BYTES));
}

/**
 * True when the fetched file is the artifact: HTTP 200 and not an HTML
 * document. False when it is absent, failed, or answered by a page. An empty
 * 200 is a file that is present and empty; callers that need content check
 * the body themselves.
 */
export function isRootArtifact<T extends Pick<FetchResult, "status" | "body">>(
  result: T | undefined,
): result is T {
  return (
    result !== undefined &&
    result.status === 200 &&
    !isHtmlDocument(result.body)
  );
}

/**
 * What the scan got instead of the artifact, for an audit's `found` text.
 * Names the HTML stand-in, because "HTTP 200" alone reads as a served file.
 */
export function rootArtifactMiss(result: FetchResult | undefined): string {
  if (!result) return "No response";
  if (result.status === 0) return result.error ?? "No response";
  if (result.status === 200 && isHtmlDocument(result.body)) {
    const landed =
      result.finalUrl && result.finalUrl !== result.url
        ? `, redirected to ${result.finalUrl}`
        : "";
    return `HTTP 200 with an HTML page${landed}, not the file`;
  }
  return `HTTP ${result.status}`;
}
