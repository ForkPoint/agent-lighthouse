import type { FetchResult } from "#core/fetcher";

export const FetchClass = {
  Ok: "ok",
  Soft404: "soft-404",
  Blocked: "blocked",
  Missing: "missing",
  Error: "error",
} as const;

export type FetchClass = (typeof FetchClass)[keyof typeof FetchClass];
export const ExpectedKind = {
  Text: "text",
  Json: "json",
  Xml: "xml",
  Html: "html",
} as const;

export type ExpectedKind = (typeof ExpectedKind)[keyof typeof ExpectedKind];

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

const HTML_SIGNATURE = /^\s*(?:<!doctype\s+html|<html[\s>])/i;
const XML_SIGNATURE =
  /^\s*(?:<\?xml|<urlset[\s>]|<sitemapindex[\s>]|<rss[\s>]|<feed[\s>])/i;

/** First 512 bytes of the body, BOM stripped — enough for a document signature. */
function head(result: FetchResult): string {
  return stripBom(result.body).slice(0, 512);
}

/** Content-Type headers are case-insensitive per RFC 9110. */
function declaresHtml(result: FetchResult): boolean {
  return result.contentType.toLowerCase().includes("text/html");
}

/**
 * Classify a fetched root file honestly. `status === 200` alone is not
 * "the file exists": SPAs and some CDNs return the HTML app shell (200)
 * for any unknown path — a soft 404 that inflated v1 scores.
 *
 * The body is the primary evidence and outranks the Content-Type header. Plenty
 * of real servers ship `/llms.txt` or `/sitemap.xml` as `text/html`; trusting
 * the header there would condemn a genuine file as a soft 404.
 */
export function classifyFetch(
  result: FetchResult | undefined,
  expected: ExpectedKind,
): FetchClass {
  if (!result) return FetchClass.Missing;
  if (result.error) return FetchClass.Error;
  if (result.status === 404 || result.status === 410) return FetchClass.Missing;
  if (result.status === 401 || result.status === 403 || result.status === 429)
    return FetchClass.Blocked;
  if (result.status >= 500 || result.status === 0) return FetchClass.Error;
  if (result.status !== 200) return FetchClass.Missing;

  if (expected === ExpectedKind.Html) return FetchClass.Ok;
  if (expected === "json") {
    // A body that parses IS the file, whatever the header claims.
    try {
      JSON.parse(stripBom(result.body));
      return FetchClass.Ok;
    } catch {
      return HTML_SIGNATURE.test(head(result)) || declaresHtml(result)
        ? FetchClass.Soft404
        : FetchClass.Error;
    }
  }

  // A real XML document wins even under a text/html header.
  if (expected === "xml" && XML_SIGNATURE.test(head(result)))
    return FetchClass.Ok;

  // text / xml: an HTML document where a machine file should be is a soft 404.
  if (HTML_SIGNATURE.test(head(result))) return FetchClass.Soft404;

  // Header-only suspicion: for xml, a non-XML body under text/html is most
  // likely an app shell. For text, any non-HTML body is a plausible plain-text
  // file (llms.txt, robots.txt), so the header alone never condemns it.
  if (expected === "xml" && declaresHtml(result)) return FetchClass.Soft404;
  return FetchClass.Ok;
}

export function isRealFile(
  result: FetchResult | undefined,
  expected: ExpectedKind,
): boolean {
  return classifyFetch(result, expected) === FetchClass.Ok;
}
