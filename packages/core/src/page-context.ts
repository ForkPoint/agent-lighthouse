import { parseBoundedHtml } from "./dom-work";
import type { DomPageContext } from "./check-context";
import type { PageClassification, PageType } from "./contracts";
import {
  extractJsonLd,
  extractMicrodata,
  extractRdfa,
  extractMetaTags,
  extractHeadLinks,
  classifyPage,
  declaredPageClassification,
} from "./parser";

/**
 * Parse inert HTML using the same extraction and classification for both sources.
 * Throws `DomWorkLimitError` when the page exceeds the DOM work limits.
 */
export function parsePageContext(
  url: string,
  html: string,
  forcedType?: PageType,
  maxAncestorSteps?: number,
): DomPageContext & { classification: PageClassification } {
  const $ = parseBoundedHtml(html, maxAncestorSteps);
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
