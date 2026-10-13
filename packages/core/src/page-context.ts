import type { DomPageContext } from "./check-context";
import type { PageType } from "./contracts";
import {
  parseHtml,
  extractJsonLd,
  extractMicrodata,
  extractRdfa,
  extractMetaTags,
  extractHeadLinks,
  classifyPage,
  declaredPageClassification,
} from "./parser";

/** Parse inert HTML using the same extraction and classification for both sources. */
export function parsePageContext(
  url: string,
  html: string,
  forcedType?: PageType,
): DomPageContext {
  const $ = parseHtml(html);
  const jsonLd = extractJsonLd($);
  const structuredData = [...jsonLd, ...extractMicrodata($), ...extractRdfa($)];
  const meta = extractMetaTags($);
  const classification = forcedType
    ? declaredPageClassification(forcedType)
    : classifyPage(url, $, structuredData, meta);
  return {
    url,
    pageType: classification.type,
    pageTypeSource: classification.source,
    classification,
    $,
    jsonLd,
    structuredData,
    meta,
    headLinks: extractHeadLinks($),
  };
}
