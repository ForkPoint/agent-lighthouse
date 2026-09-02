import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { PageType } from "./types";

export function parseHtml(html: string): CheerioAPI {
  return cheerio.load(html);
}

export function extractJsonLd($: CheerioAPI): object[] {
  const blocks: object[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Some platforms (e.g. Shopify themes) emit JSON-LD containing literal
      // control characters (raw newlines/tabs inside string values), which is
      // invalid JSON and makes strict JSON.parse throw — dropping otherwise
      // valid Product/Review blocks. Retry once with control chars stripped
      // before giving up.
      try {
        // oxlint-disable-next-line no-control-regex
        blocks.push(JSON.parse(raw.replace(/[\x00-\x1F]+/g, " ")));
      } catch {
        // Genuinely malformed — left for the schema validation audit to flag.
      }
    }
  });
  return blocks;
}

/**
 * Top-level JSON-LD entities only: expands arrays and `@graph` members,
 * propagating `@context` downward. Nested property objects (an Article's
 * `publisher`, a Product's `offers`) are NOT hoisted — v1's deep flatten
 * made audits "find" entities the page never declared at top level.
 */
export function topLevelJsonLd(blocks: object[]): object[] {
  const tops: object[] = [];
  const visit = (node: unknown, inheritedContext?: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, inheritedContext);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const ctx = obj["@context"] ?? inheritedContext;
    if (!obj["@context"] && ctx) obj["@context"] = ctx;
    const graph = obj["@graph"];
    if (Array.isArray(graph)) {
      for (const member of graph) visit(member, ctx);
      return;
    }
    tops.push(obj);
  };
  for (const block of blocks) visit(block);
  return tops;
}

/**
 * Every JSON-LD node including nested ones — for audits that legitimately
 * search deep (e.g. AggregateRating nested under Product).
 *
 * Real-world JSON-LD nests the interesting types arbitrarily: a top-level
 * `[{...}]` array (common on Shopify), an `@graph` container, and properties
 * like `Product.aggregateRating`, `ProductGroup.hasVariant[].aggregateRating`,
 * `mainEntity`, `itemReviewed`, `offers`. The previous per-audit flatteners
 * only descended into `@graph`, so anything array-wrapped or nested was
 * invisible — producing false "schema not found" verdicts. This walks every
 * object and array value so type/property lookups see the whole graph.
 */
export function allJsonLdNodes(blocks: object[]): object[] {
  const flat: object[] = [];
  const visit = (node: unknown, inheritedContext?: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, inheritedContext);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const ctx = obj["@context"] ?? inheritedContext;
    if (!obj["@context"] && ctx) obj["@context"] = ctx;
    flat.push(obj);
    for (const [key, value] of Object.entries(obj)) {
      // A context is a vocabulary, not a node. When it is an object (`{
      // "@vocab": … }`), descending into it would stamp it with itself as its
      // own context, and the walk would never end.
      if (key === "@context") continue;
      if (value && typeof value === "object") visit(value, ctx);
    }
  };
  for (const block of blocks) visit(block);
  return flat;
}

/** @deprecated v1 name for the deep walk. Use topLevelJsonLd (structure) or allJsonLdNodes (deep search). Removed in v2. */
export const flattenJsonLd = allJsonLdNodes;

/**
 * Extract links from Markdown-ish text (llms.txt, READMEs).
 *
 * Real llms.txt files use many shapes the old line-anchored
 * `^-\s*\[label\](url)` regex missed entirely: inline links inside prose,
 * bare-URL bullets (`- **Privacy**: https://…`), `*`/`+`/numbered bullets, and
 * indented/nested items. Returns `{ url, label, description }`, trimming the
 * trailing punctuation/markup (backticks, brackets, periods) that otherwise
 * corrupts the URL.
 */
export function extractMarkdownLinks(
  body: string,
): Array<{ url: string; label: string; description: string }> {
  const out: Array<{ url: string; label: string; description: string }> = [];
  const seen = new Set<string>();
  const clean = (u: string) => u.replace(/[.,;:!?'")\]`>]+$/, "");
  const push = (url: string, label: string, description: string) => {
    const c = clean(url.trim());
    if (!/^https?:\/\//i.test(c) || seen.has(c)) return;
    seen.add(c);
    out.push({ url: c, label: label.trim(), description: description.trim() });
  };

  // 1. Inline Markdown links anywhere: [label](url) with optional ": desc".
  const inline = /\[([^\]]+)\]\(([^)\s]+)\)(?::\s*([^\n]+))?/g;
  let m: RegExpExecArray | null;
  while ((m = inline.exec(body)) !== null) push(m[2]!, m[1]!, m[3] ?? "");

  // 2. Bare-URL list items: "- **Label**: https://… — description".
  const bullet =
    /^\s*(?:[-*+]|\d+\.)\s+(?:\*\*([^*]+)\*\*[:\-—]?\s*)?(https?:\/\/\S+)\s*(?:[-—:]\s*(.+))?$/gm;
  while ((m = bullet.exec(body)) !== null) push(m[2]!, m[1] ?? "", m[3] ?? "");

  return out;
}

// ── Inline structured data (Microdata + RDFa) ──────────────────
//
// Many ecommerce platforms (e.g. Salesforce Commerce Cloud / Demandware)
// express schema.org Product data as HTML Microdata (itemscope/itemtype/
// itemprop) or RDFa (typeof/property) rather than JSON-LD. Search engines read
// all three; the audits historically only saw JSON-LD. These extractors
// normalize Microdata and RDFa into the same plain schema.org-shaped objects
// (`@type` + properties, nested items recursed) so the existing Product audits
// can consume them unchanged.

const TEXT_VALUE_MAX = 200;

/** Nearest ancestor element carrying `attr` (e.g. 'itemscope'), or null. */
function nearestScope(node: AnyNode, attr: string): Element | null {
  let p: AnyNode | null = node.parent as AnyNode | null;
  while (p) {
    if (p.type === "tag" && attr in (p as Element).attribs) return p as Element;
    p = p.parent as AnyNode | null;
  }
  return null;
}

/** Last path/fragment segment of each space-separated term in a type value. */
function termsFromType(raw: string): string | string[] {
  const terms = raw
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (t) =>
        t
          .replace(/[/#:]+$/, "")
          .split(/[/#:]/)
          .pop() || t,
    );
  return terms.length === 1 ? terms[0]! : terms;
}

/** First term of a property name, stripped of any vocab prefix/URL. */
function firstTerm(raw: string | undefined): string {
  if (!raw) return "";
  const t = raw.split(/\s+/).filter(Boolean)[0] ?? "";
  return t.split(/[/#:]/).pop() || t;
}

/** Resolve the value of a property element per the Microdata/RDFa value rules. */
function propValue($: CheerioAPI, el: Element): string {
  /* v8 ignore next -- domhandler elements always have `attribs`; the `?? {}` guard is unreachable. */
  const a = el.attribs ?? {};
  if (a.content) return a.content;
  /* v8 ignore next -- tag elements always have a `name`; the `?? ''` guard is unreachable. */
  switch ((el.name ?? "").toLowerCase()) {
    case "meta":
      return a.content ?? "";
    case "a":
    case "link":
    case "area":
      return a.href ?? "";
    case "img":
    case "audio":
    case "video":
    case "source":
    case "iframe":
    case "embed":
    case "track":
      return a.src ?? "";
    case "object":
      return a.data ?? "";
    case "data":
    case "meter":
      return a.value ?? "";
    case "time":
      return (
        a.datetime ??
        $(el).text().replace(/\s+/g, " ").trim().slice(0, TEXT_VALUE_MAX)
      );
    default:
      return $(el).text().replace(/\s+/g, " ").trim().slice(0, TEXT_VALUE_MAX);
  }
}

/** Assign a property, collapsing repeats into an array. Splits multi-name props. */
function addProp(
  obj: Record<string, unknown>,
  rawName: string,
  value: unknown,
): void {
  for (const name of rawName.split(/\s+/).filter(Boolean)) {
    const existing = obj[name];
    if (existing === undefined) {
      obj[name] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      obj[name] = [existing, value];
    }
  }
}

function parseMicrodataItem(
  $: CheerioAPI,
  el: Element,
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const itemtype = el.attribs?.itemtype;
  if (itemtype) {
    obj["@context"] = "https://schema.org";
    obj["@type"] = termsFromType(itemtype);
  }
  $(el)
    .find("[itemprop]")
    .each((_, raw) => {
      const propEl = raw as Element;
      // Only properties whose nearest itemscope is THIS element belong here;
      // properties of nested items are captured when that item is recursed.
      if (nearestScope(propEl, "itemscope") !== el) return;
      const name = propEl.attribs?.itemprop;
      if (!name) return;
      /* v8 ignore next 2 -- domhandler elements always have `attribs`; the `?? {}` guard is unreachable. */
      const value =
        "itemscope" in (propEl.attribs ?? {})
          ? parseMicrodataItem($, propEl)
          : propValue($, propEl);
      addProp(obj, name, value);
    });
  return obj;
}

export function extractMicrodata($: CheerioAPI): object[] {
  const items: object[] = [];
  $("[itemscope]").each((_, raw) => {
    const el = raw as Element;
    if (nearestScope(el, "itemscope")) return; // nested — handled by its parent item
    items.push(parseMicrodataItem($, el));
  });
  return items;
}

function parseRdfaItem($: CheerioAPI, el: Element): Record<string, unknown> {
  const obj: Record<string, unknown> = { "@context": "https://schema.org" };
  const typeName = el.attribs?.typeof;
  if (typeName) obj["@type"] = termsFromType(typeName);
  $(el)
    .find("[property]")
    .each((_, raw) => {
      const propEl = raw as Element;
      if (nearestScope(propEl, "typeof") !== el) return;
      const name = firstTerm(propEl.attribs?.property);
      if (!name) return;
      /* v8 ignore next 2 -- domhandler elements always have `attribs`; the `?? {}` guard is unreachable. */
      const value =
        "typeof" in (propEl.attribs ?? {})
          ? parseRdfaItem($, propEl)
          : propValue($, propEl);
      addProp(obj, name, value);
    });
  return obj;
}

export function extractRdfa($: CheerioAPI): object[] {
  const items: object[] = [];
  $("[typeof]").each((_, raw) => {
    const el = raw as Element;
    if (nearestScope(el, "typeof")) return; // nested — handled by its parent item
    items.push(parseRdfaItem($, el));
  });
  return items;
}

export function extractMetaTags($: CheerioAPI): Record<string, string> {
  const meta: Record<string, string> = {};
  $("meta").each((_, el) => {
    const name =
      $(el).attr("name") || $(el).attr("property") || $(el).attr("http-equiv");
    const content = $(el).attr("content");
    if (name && content) {
      meta[name.toLowerCase()] = content;
    }
  });
  return meta;
}

export interface HeadLink {
  rel: string;
  type: string;
  href: string;
  title: string;
}

export function extractHeadLinks($: CheerioAPI): HeadLink[] {
  const links: HeadLink[] = [];
  // Search both <head> and the full document for <link> tags.
  // Frameworks like Next.js App Router stream metadata outside the
  // initial <head> shell, so limiting to `head link` misses them.
  $("link").each((_, el) => {
    const rel = $(el).attr("rel") ?? "";
    // Skip stylesheet links outside <head> to avoid noise
    if (!rel || rel === "stylesheet" || rel === "preload") return;
    links.push({
      rel,
      type: $(el).attr("type") ?? "",
      href: $(el).attr("href") ?? "",
      title: $(el).attr("title") ?? "",
    });
  });
  return links;
}

export function extractHeadings(
  $: CheerioAPI,
): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    /* v8 ignore next -- matched heading elements always expose `tagName`; the `?? ''` guard is unreachable. */
    const tag = $(el).prop("tagName")?.toLowerCase() ?? "";
    const level = parseInt(tag.replace("h", ""), 10);
    headings.push({ level, text: $(el).text().trim() });
  });
  return headings;
}

/**
 * Collapse a subtree to its readable text.
 *
 * cheerio's .text() concatenates the bodies of <script>/<style>/<noscript>
 * tags too. On modern themes those hold megabytes of inline JSON/JS/CSS that
 * pollute every downstream content regex (dates, numbers, keywords) with
 * garbage matches. Clone the subtree (so we never mutate the shared DOM other
 * audits read) and drop non-content nodes before extracting text.
 */
function readableText(root: ReturnType<CheerioAPI>): string {
  const clone = root.clone();
  clone.find("script, style, noscript, template").remove();
  return clone.text().replace(/\s+/g, " ").trim();
}

/**
 * The text of the page's main content region.
 *
 * Answers what the main content says, so page chrome — navigation, headers,
 * footers, cookie banners — stays out of it. Among several <main> elements the
 * one holding the most text wins: themes ship empty or fragmented <main>
 * wrappers, and the first one is often a short stub. Falls back to the whole
 * <body> only when no <main> holds any text.
 *
 * For shell detection — did the server render any readable text at all — use
 * `getRenderedText` instead.
 */
export function getMainContentText($: CheerioAPI): string {
  let best = "";
  // Scope the search to <body>. A <main> inside a <template> parses into a
  // detached content fragment, which `$('main')` still matches — and the
  // largest-wins rule would let inert markup the page never renders outweigh
  // the real content region. `readableText` drops <template> everywhere else,
  // so counting one here would contradict it.
  $("body")
    .find("main")
    .each((_, el) => {
      const text = readableText($(el));
      if (text.length > best.length) best = text;
    });
  if (best) return best;
  return readableText($("body"));
}

/**
 * The text of the served HTML body, minus script/style/noscript/template.
 *
 * Answers whether the server rendered any readable text at all, so page chrome
 * counts: a shell that ships only a nav and a footer is exactly what this has
 * to see. Use `getMainContentText` when the question is what the main content
 * says rather than whether anything was served.
 */
export function getRenderedText($: CheerioAPI): string {
  return readableText($("body"));
}

export function getWordCount($: CheerioAPI): number {
  const text = getMainContentText($);
  return text.split(/\s+/).filter(Boolean).length;
}

export function extractImages($: CheerioAPI): Array<{
  src: string;
  alt: string;
  hasAlt: boolean;
  width?: string;
  height?: string;
  loading?: string;
  role?: string;
  ariaHidden?: string;
  ariaLabel?: string;
  ariaLabelledby?: string;
  title?: string;
}> {
  const images: Array<{
    src: string;
    alt: string;
    hasAlt: boolean;
    width?: string;
    height?: string;
    loading?: string;
    role?: string;
    ariaHidden?: string;
    ariaLabel?: string;
    ariaLabelledby?: string;
    title?: string;
  }> = [];
  $("img").each((_, el) => {
    const alt = $(el).attr("alt");
    images.push({
      src: $(el).attr("src") ?? "",
      alt: alt ?? "",
      // Whether the alt attribute is present at all. Distinguishes an
      // intentionally empty `alt=""` (decorative) from a missing attribute.
      hasAlt: alt !== undefined,
      width: $(el).attr("width") ?? undefined,
      height: $(el).attr("height") ?? undefined,
      loading: $(el).attr("loading") ?? undefined,
      role: $(el).attr("role") ?? undefined,
      ariaHidden: $(el).attr("aria-hidden") ?? undefined,
      // The accname 1.1 text-alternative sources that outrank `alt`, plus the
      // `title` fallback HTML-AAM maps below it.
      ariaLabel: $(el).attr("aria-label") ?? undefined,
      ariaLabelledby: $(el).attr("aria-labelledby") ?? undefined,
      title: $(el).attr("title") ?? undefined,
    });
  });
  return images;
}

/**
 * Escapes characters that have special meaning inside a CSS attribute selector value.
 * Prevents attribute values with quotes or backslashes from breaking selector parsing.
 */
export function escapeAttrValue(val: string): string {
  return val.replace(/(["\\])/g, "\\$1");
}

export function extractForms($: CheerioAPI): Array<{
  action: string;
  method: string;
  inputs: Array<{
    name: string;
    type: string;
    label?: string;
    required: boolean;
  }>;
}> {
  const forms: Array<{
    action: string;
    method: string;
    inputs: Array<{
      name: string;
      type: string;
      label?: string;
      required: boolean;
    }>;
  }> = [];
  $("form").each((_, formEl) => {
    const inputs: Array<{
      name: string;
      type: string;
      label?: string;
      required: boolean;
    }> = [];
    $(formEl)
      .find("input, select, textarea")
      .each((_j, inputEl) => {
        const id = $(inputEl).attr("id");
        let label: string | undefined;
        if (id) {
          const labelEl = $(`label[for="${escapeAttrValue(id)}"]`);
          if (labelEl.length) {
            label = labelEl.text().trim();
          }
        }
        /* v8 ignore next -- matched form controls always expose `tagName`; the `?? 'input'` guard is unreachable. */
        const tagName = $(inputEl).prop("tagName")?.toLowerCase() ?? "input";
        inputs.push({
          name: $(inputEl).attr("name") ?? "",
          type:
            tagName === "input" ? ($(inputEl).attr("type") ?? "text") : tagName,
          label,
          required: $(inputEl).attr("required") !== undefined,
        });
      });
    forms.push({
      action: $(formEl).attr("action") ?? "",
      method: ($(formEl).attr("method") ?? "GET").toUpperCase(),
      inputs,
    });
  });
  return forms;
}

export function extractInternalLinks($: CheerioAPI, domain: string): string[] {
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const url = new URL(href, `https://${domain}`);
      if (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) {
        seen.add(url.href);
      }
    } catch {
      // Ignore invalid URLs
    }
  });
  return [...seen];
}

export function extractNavLinks($: CheerioAPI): string[] {
  const links: string[] = [];
  $("nav a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      links.push(href);
    }
  });
  return links;
}

export function extractScripts($: CheerioAPI): Array<{
  src?: string;
  async: boolean;
  defer: boolean;
  type?: string;
  isModule: boolean;
  noModule: boolean;
  inline: boolean;
}> {
  const scripts: Array<{
    src?: string;
    async: boolean;
    defer: boolean;
    type?: string;
    isModule: boolean;
    noModule: boolean;
    inline: boolean;
  }> = [];
  $("script").each((_, el) => {
    const src = $(el).attr("src") ?? undefined;
    const type = $(el).attr("type") ?? undefined;
    scripts.push({
      src,
      async: $(el).attr("async") !== undefined,
      defer: $(el).attr("defer") !== undefined,
      type,
      isModule: type === "module",
      noModule: $(el).attr("nomodule") !== undefined,
      inline: src === undefined,
    });
  });
  return scripts;
}

export function extractStylesheetUrls($: CheerioAPI): string[] {
  const urls: string[] = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      urls.push(href);
    }
  });
  return urls;
}

// ── Page Type Detection ───────────────────────────────────────

/**
 * Detect whether a page is a Homepage, Category Page, Product Details Page,
 * or Content Page based on URL patterns, JSON-LD schemas, meta tags, and
 * HTML signals typical of ecommerce websites.
 */
export function detectPageType(
  url: string,
  $: CheerioAPI,
  jsonLd: object[],
  meta: Record<string, string>,
  isFirstPage: boolean,
): PageType {
  const pathname = new URL(url).pathname.toLowerCase();

  // ── 1. Homepage ─────────────────────────────────────────────
  if (isFirstPage && (pathname === "/" || pathname === "")) {
    return "homepage";
  }

  // ── 2. Product Details Page (check before category) ─────────
  if (isProductPage(pathname, $, jsonLd, meta)) {
    return "product";
  }

  // ── 3. Category / Listing Page ──────────────────────────────
  if (isCategoryPage(pathname, $, jsonLd)) {
    return "category";
  }

  // ── 4. Fallback: Content Page ───────────────────────────────
  return "content";
}

function isProductPage(
  pathname: string,
  $: CheerioAPI,
  jsonLd: object[],
  meta: Record<string, string>,
): boolean {
  // JSON-LD Product schema
  if (hasJsonLdType(jsonLd, ["Product", "IndividualProduct", "ProductModel"])) {
    return true;
  }

  // og:type = product or product.item
  const ogType = (meta["og:type"] ?? "").toLowerCase();
  if (
    ogType === "product" ||
    ogType === "product.item" ||
    ogType === "og:product"
  ) {
    return true;
  }

  // URL patterns common in ecommerce product pages
  if (
    /\/(product|products|p|item|dp|gp\/product|shop\/[^/]+\/[^/]+)\/[^/]+/i.test(
      pathname,
    ) ||
    /\/(product|item|sku)-[a-z0-9-]+/i.test(pathname)
  ) {
    return true;
  }

  // HTML signals: add-to-cart button/form, price elements
  const hasAddToCart =
    $(
      '[class*="add-to-cart"], [id*="add-to-cart"], button:contains("Add to Cart"), button:contains("Add to Bag"), [data-action="add-to-cart"]',
    ).length > 0;
  const hasPrice =
    $(
      '[class*="product-price"], [class*="product__price"], [itemprop="price"], [data-price], .price',
    ).length > 0;

  if (hasAddToCart && hasPrice) {
    return true;
  }

  return false;
}

function isCategoryPage(
  pathname: string,
  $: CheerioAPI,
  jsonLd: object[],
): boolean {
  // JSON-LD CollectionPage or ItemList schema
  if (
    hasJsonLdType(jsonLd, [
      "CollectionPage",
      "ItemList",
      "OfferCatalog",
      "ProductCollection",
    ])
  ) {
    return true;
  }

  // URL patterns common in ecommerce category/listing pages
  if (
    /^\/(category|categories|c|collections?|shop|catalog|department|browse)(\/|$)/i.test(
      pathname,
    ) ||
    /^\/(men|women|kids|sale|new-arrivals|best-sellers)(\/|$)/i.test(pathname)
  ) {
    return true;
  }

  // HTML signals: product grid/list with multiple product cards
  const productCards = $(
    '[class*="product-card"], [class*="product-item"], [class*="product-tile"], [data-product-id], [class*="product-grid"] > *, [class*="product-list"] > *',
  );
  if (productCards.length >= 3) {
    return true;
  }

  // Pagination + multiple items suggests a listing
  const hasPagination =
    $(
      '[class*="pagination"], nav[aria-label*="pagination"], .pager, [class*="load-more"]',
    ).length > 0;
  const hasFilterOrSort =
    $('[class*="filter"], [class*="facet"], [class*="sort-by"], [data-filter]')
      .length > 0;

  if (hasPagination && hasFilterOrSort) {
    return true;
  }

  return false;
}

function hasJsonLdType(jsonLd: object[], types: string[]): boolean {
  for (const block of jsonLd) {
    const b = block as Record<string, unknown>;

    // Check top-level @type
    const blockType = b["@type"];
    if (typeof blockType === "string" && types.includes(blockType)) return true;
    if (Array.isArray(blockType) && blockType.some((t) => types.includes(t)))
      return true;

    // Check inside @graph
    if (Array.isArray(b["@graph"])) {
      for (const item of b["@graph"]) {
        if (item && typeof item === "object") {
          const itemType = (item as Record<string, unknown>)["@type"];
          if (typeof itemType === "string" && types.includes(itemType))
            return true;
          if (
            Array.isArray(itemType) &&
            itemType.some((t: unknown) => types.includes(t as string))
          )
            return true;
        }
      }
    }
  }
  return false;
}
