// Graduated from proposal 2026-08-23 (Plan 5b, Wave A, Task 6).
// Evidence dossier: docs/evidence/audits/operability-safety/url-addressable-state-and-pagination-fallback.md
//
// Scope note (non-double-counting): `machine-discovery/discovery-index-coverage`
// asks whether the sitemap names every page. This audit asks whether the pages
// a listing holds can be reached at all by URL, which is a different question:
// a listing whose items only appear after a scroll is fully covered by a
// sitemap and still unreachable from the listing itself.
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext, PageContext } from "../../check-context";
import { pagesOfType } from "../../gatherers/pages";
import { fetchSampledPage } from "../../gatherers/sampled-pages";
import { allJsonLdNodes, parseHtml } from "../../parser";

/** Selectors that identify a repeated item in a listing. */
const ITEM_SELECTOR =
  '[class*="product-card"], [class*="product-item"], [class*="product-tile"], [data-product-id], [class*="product-grid"] > *, [class*="product-list"] > *, ul[class*="products"] > li, [class*="results-list"] > li';

/** Query parameters that carry a page offset. */
const PAGE_PARAM = /^(page|p|offset|start|from|skip)$/i;

/** Paths that carry a page offset without a query string. */
const PAGE_PATH = /\/page\/(\d+)/i;

/** Class or text that marks a discrete "give me more" control. */
const LOAD_MORE = /load.?more|show.?more|view.?more/i;

/** Class that marks scroll machinery with no control of its own. */
const SENTINEL = /infinite|sentinel|scroll-trigger|auto-load/i;

/** Class or attribute that marks a facet control. */
const FACET = /facet|filter|refine/i;

/** How many facet links to probe per scan. */
const MAX_FACET_PROBES = 2;

/** A declared total this much larger than the rendered items is a gap. */
const TOTAL_TOLERANCE = 1.5;

type Affordance = "href" | "link-next" | "load-more" | "sentinel" | "none";

interface Listing {
  pageUrl: string;
  items: number;
  declaredTotal: number | null;
  affordance: Affordance;
  /** Items reachable by changing the URL alone, as far as the page admits. */
  deepestIndex: number;
  clientOnlyFacets: string[];
  probedFacets: number;
}

/** Distinct item elements, so two matching selectors do not count one card twice. */
function countItems(page: PageContext): number {
  const seen = new Set<unknown>();
  page.$(ITEM_SELECTOR).each((_i, node) => {
    seen.add(node);
  });
  return seen.size;
}

/** Every page number an anchor or a rel=next link addresses. */
function pageNumbers(page: PageContext): number[] {
  const $ = page.$;
  const numbers: number[] = [];
  const consider = (href: string) => {
    let url: URL;
    try {
      url = new URL(href, page.url);
    } catch {
      return;
    }
    for (const [key, value] of url.searchParams) {
      if (!PAGE_PARAM.test(key)) continue;
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) numbers.push(n);
    }
    const path = PAGE_PATH.exec(url.pathname);
    if (path) numbers.push(Number(path[1]));
  };
  $("a[href]").each((_i, node) =>
    consider($(node as never).attr("href") ?? ""),
  );
  $('link[rel="next"], link[rel="prev"]').each((_i, node) =>
    consider($(node as never).attr("href") ?? ""),
  );
  return numbers;
}

/** The total the page claims it holds, from schema.org or from result-count copy. */
function declaredTotal(page: PageContext): number | null {
  for (const node of allJsonLdNodes(page.jsonLd)) {
    const value = (node as Record<string, unknown>)["numberOfItems"];
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const text = page.$("body").text().replace(/\s+/g, " ");
  const match = /\b([\d,]{1,12})\s+(?:results?|items?|products?)\b/i.exec(text);
  if (match) {
    const n = Number(match[1]!.replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Which of the four affordances the listing offers, best one first. */
function affordanceOf(page: PageContext, pages: number[]): Affordance {
  const $ = page.$;
  if (pages.length > 0 && $("a[href]").length > 0) {
    const hrefPaged = $("a[href]")
      .toArray()
      .some((node) => {
        const href = $(node as never).attr("href") ?? "";
        try {
          const url = new URL(href, page.url);
          if (PAGE_PATH.test(url.pathname)) return true;
          for (const key of url.searchParams.keys())
            if (PAGE_PARAM.test(key)) return true;
        } catch {
          return false;
        }
        return false;
      });
    if (hrefPaged) return "href";
  }
  if ($('link[rel="next"]').length > 0) return "link-next";

  let loadMore = false;
  $('button, a[href], [role="button"]').each((_i, node) => {
    const $n = $(node as never);
    if (LOAD_MORE.test(`${$n.attr("class") ?? ""} ${$n.text()}`))
      loadMore = true;
  });
  if (loadMore) return "load-more";

  let sentinel = false;
  $("[class]").each((_i, node) => {
    if (SENTINEL.test($(node as never).attr("class") ?? "")) sentinel = true;
  });
  if (sentinel) return "sentinel";

  return "none";
}

/** Facet links whose parameter can be tested by fetching the URL. */
function facetLinks(page: PageContext): string[] {
  const $ = page.$;
  const out: string[] = [];
  $("a[href]").each((_i, node) => {
    const $n = $(node as never);
    const href = $n.attr("href") ?? "";
    if (!href.includes("?") && !href.includes("&")) return;
    const context = `${$n.attr("class") ?? ""} ${$n.attr("data-filter") ?? ""} ${$n.parent().attr("class") ?? ""}`;
    if (!FACET.test(context)) return;
    let url: URL;
    try {
      url = new URL(href, page.url);
    } catch {
      return;
    }
    // A page parameter is pagination, already measured above.
    if ([...url.searchParams.keys()].some((key) => PAGE_PARAM.test(key)))
      return;
    if (url.origin !== new URL(page.url).origin) return;
    out.push(url.toString());
  });
  return [...new Set(out)];
}

async function surveyListing(
  ctx: CheckContext,
  page: PageContext,
): Promise<Listing> {
  const items = countItems(page);
  const pages = pageNumbers(page);
  const affordance = affordanceOf(page, pages);
  const deepest =
    affordance === "href" && pages.length > 0
      ? items * Math.max(...pages)
      : items;

  const listing: Listing = {
    pageUrl: page.url,
    items,
    declaredTotal: declaredTotal(page),
    affordance,
    deepestIndex: deepest,
    clientOnlyFacets: [],
    probedFacets: 0,
  };

  const baseline = page.fetchResult.body ?? "";
  for (const url of facetLinks(page).slice(0, MAX_FACET_PROBES)) {
    const result = await fetchSampledPage(ctx, url);
    if (!result?.body) continue;
    listing.probedFacets += 1;
    // Byte-identical means the server ignored the parameter entirely. A
    // different item count means it filtered, which is the whole question.
    const filteredItems = new Set<unknown>();
    const $filtered = parseHtml(result.body);
    $filtered(ITEM_SELECTOR).each((_i, node) => {
      filteredItems.add(node);
    });
    if (result.body === baseline || filteredItems.size === items) {
      listing.clientOnlyFacets.push(url);
    }
  }

  return listing;
}

const EXPECTED =
  "Every listing can be walked by URL alone: page 2 and beyond are reachable through an `href`, and each facet changes what the server returns rather than only what the browser shows";

const SAMPLE = `<!-- The scroll can stay. The href is what an agent walks. -->
<nav class="pagination" aria-label="Pagination">
  <a href="/collections/mugs?page=2" rel="next">Page 2</a>
  <a href="/collections/mugs?page=3">Page 3</a>
</nav>
<link rel="next" href="/collections/mugs?page=2">

<!-- Facets that the server honours, so the filtered view has its own URL. -->
<a class="facet" href="/collections/mugs?colour=red">Red</a>`;

export class UrlAddressableStateAndPaginationFallbackAudit extends Audit {
  static override meta: AuditMeta = {
    id: "operability-safety/url-addressable-state-and-pagination-fallback",
    category: "operability-safety",
    title: "Listings walkable by URL: pagination and facet fallback",
    failureTitle: "Listings walkable by URL: pagination and facet fallback",
    description:
      'Checks that a listing exposes its later pages through real `href` pagination or a `rel="next"` link rather than infinite-scroll machinery alone, and that each facet changes what the server returns rather than only what the browser shows. Reports the deepest item index reachable by URL alone, and any facet that turns out to be client-only.',
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier:
      "docs/evidence/audits/operability-safety/url-addressable-state-and-pagination-fallback.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "high",
    applicablePageTypes: ["category"],
    guidance: {
      impact:
        'An agent reaches a listing by URL and reads what the server sent. Items that only arrive after an IntersectionObserver fires are not in that response, so a catalogue of 5,000 products presents as the 20 that were server-rendered — and the agent answers "we only carry 20" without ever knowing it was wrong. A "Load more" button is better because it is a discrete, verifiable action, but it still costs one click per page and gives the agent no way to jump. Real `href` pagination costs nothing to add beside the scroll, and it is also what a crawler needs to index the catalogue at all. The same holds for facets: a filter applied only in the browser has no URL, so the filtered view cannot be linked, cited, or returned to.',
      fix: 'Keep the infinite scroll and put real links underneath it. Render `<a href="?page=2">` for each page, or at minimum a `<link rel="next">` in the head, so the whole listing can be walked without running scripts. Make every facet a real query parameter the server honours, and have the server return the filtered set for that URL. Where a total is declared — `numberOfItems` or a "1,240 results" line — make sure that many items are actually reachable by following the links you rendered.',
      code: SAMPLE,
      effort: "complex",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/url-addressable-state-and-pagination-fallback/",
      tags: ["agent-operability", "navigation", "pagination", "facets"],
    },
  };

  private recommendation() {
    return {
      priority: "high" as const,
      description:
        UrlAddressableStateAndPaginationFallbackAudit.meta.description,
      code: SAMPLE,
    };
  }

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const pages = pagesOfType(ctx, "category");
    if (pages.length === 0) {
      return {
        ...this.notApplicable(
          "No listing or category page was scanned, so there is no pagination to walk.",
          EXPECTED,
          "No listing page on the scanned site",
        ),
        details: { listings: 0, clientOnlyFacets: 0 },
      };
    }

    const listings: Listing[] = [];
    for (const page of pages) listings.push(await surveyListing(ctx, page));

    const clientOnly = listings.flatMap((l) => l.clientOnlyFacets);
    const truncated = listings.filter(
      (l) =>
        l.declaredTotal !== null &&
        l.declaredTotal > l.items * TOTAL_TOLERANCE &&
        l.affordance !== "href" &&
        l.affordance !== "link-next",
    );
    const sentinelOnly = listings.filter((l) => l.affordance === "sentinel");
    const buttonOnly = listings.filter((l) => l.affordance === "load-more");
    const deepest = Math.max(...listings.map((l) => l.deepestIndex));

    const found = `${listings.length} listing(s); deepest item index reachable by URL: ${deepest}; ${sentinelOnly.length} scroll-only, ${buttonOnly.length} button-only, ${clientOnly.length} client-only facet(s)`;
    const details = {
      listings: listings.length,
      clientOnlyFacets: clientOnly.length,
      scrollOnly: sentinelOnly.length,
      buttonOnly: buttonOnly.length,
      deepestIndex: deepest,
    };

    if (truncated.length > 0) {
      const worst = truncated[0]!;
      return {
        ...this.fail(
          `A listing declares ${worst.declaredTotal} item(s) and renders ${worst.items} in the HTML the server sent, with no \`href\` pagination to reach the rest. An agent reads the ${worst.items} it was given and answers as if that were the catalogue.`,
          EXPECTED,
          found,
          this.recommendation(),
          worst.pageUrl,
        ),
        displayValue: found,
        details,
      };
    }

    if (sentinelOnly.length > 0) {
      const worst = sentinelOnly[0]!;
      return {
        ...this.fail(
          `${sentinelOnly.length} listing(s) reveal their later items only through scroll machinery, with no \`href\` and no \`rel="next"\`. Nothing past the first ${worst.items} item(s) exists in any response an agent can fetch.`,
          EXPECTED,
          found,
          this.recommendation(),
          worst.pageUrl,
        ),
        displayValue: found,
        details,
      };
    }

    if (buttonOnly.length > 0 || clientOnly.length > 0) {
      const parts: string[] = [];
      if (buttonOnly.length > 0) {
        parts.push(
          `${buttonOnly.length} listing(s) page only through a "Load more" button — a discrete action an agent can take, but one click per page and no way to jump`,
        );
      }
      if (clientOnly.length > 0) {
        parts.push(
          `${clientOnly.length} facet(s) return the unfiltered page when their URL is fetched, so the filtered view has no address of its own`,
        );
      }
      return {
        ...this.warn(
          parts.join("; ") + ".",
          EXPECTED,
          found,
          this.recommendation(),
          listings[0]!.pageUrl,
        ),
        displayValue: found,
        details,
      };
    }

    return {
      ...this.pass(
        `Every listing can be walked by URL: ${deepest} item(s) are reachable without running a script, and every probed facet is honoured by the server.`,
        EXPECTED,
        found,
        listings[0]!.pageUrl,
      ),
      displayValue: found,
      details,
    };
  }
}
