import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from "../../check-context";
import { weightForGrade } from "../../scorer";

/**
 * One comparison key per URL: host without `www.`, lower-cased path with no
 * trailing slash, no query and no fragment.
 *
 * Both v1 audits compared raw strings (or did not compare at all), so
 * `https://example.com/Page/` and `https://www.example.com/Page` looked like
 * two different targets.
 */
function key(url: URL): string {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "").toLowerCase();
  return `${host}${path}`;
}

function isRoot(url: URL): boolean {
  return url.pathname.replace(/\/+$/, "") === "";
}

function sameSite(url: URL, domain: string): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const site = domain.toLowerCase().replace(/^www\./, "");
  return host === site || host.endsWith(`.${site}`);
}

/**
 * Canonical hrefs declared in `<head>`.
 *
 * `rel` is matched token-wise and case-insensitively — v1's `[rel="canonical"]`
 * selector and `l.rel === 'canonical'` comparison both reported "no canonical"
 * on `rel="Canonical"`, `rel=" canonical "` and `rel="shortlink canonical"`.
 */
function headCanonicals(page: PageContext): string[] {
  const $ = page.$;
  const hrefs: string[] = [];
  $("head link[rel]").each((_, el) => {
    const rel = ($(el).attr("rel") ?? "").trim().toLowerCase().split(/\s+/);
    if (!rel.includes("canonical")) return;
    const href = ($(el).attr("href") ?? "").trim();
    if (href) hrefs.push(href);
  });
  return hrefs;
}

/** Does a canonical live outside `<head>`, where crawlers ignore it? */
function hasCanonicalOutsideHead(page: PageContext): boolean {
  const $ = page.$;
  let found = false;
  $("body link[rel]").each((_, el) => {
    const rel = ($(el).attr("rel") ?? "").trim().toLowerCase().split(/\s+/);
    if (rel.includes("canonical")) found = true;
  });
  return found;
}

interface PageCanonical {
  url: string;
  /** Targets that resolved to an http(s) URL, de-duplicated by comparison key. */
  targets: URL[];
  /** Hrefs that could not be resolved, or resolved to a non-HTTP scheme. */
  invalid: string[];
  hasBodyOnly: boolean;
}

function readCanonical(page: PageContext): PageCanonical {
  const hrefs = headCanonicals(page);
  const targets: URL[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const href of hrefs) {
    let resolved: URL;
    try {
      // Resolution is the point of the rewrite: it makes a relative canonical
      // unambiguous, and it replaces v1's `href.startsWith('http')` prefix
      // test, which accepted `httpfoo` as an absolute URL.
      resolved = new URL(href, page.url);
    } catch {
      invalid.push(href);
      continue;
    }
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") {
      invalid.push(href);
      continue;
    }
    const k = key(resolved);
    if (seen.has(k)) continue;
    seen.add(k);
    targets.push(resolved);
  }

  return {
    url: page.url,
    targets,
    invalid,
    hasBodyOnly: hrefs.length === 0 && hasCanonicalOutsideHead(page),
  };
}

export class CanonicalLinksAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/canonical",
    category: "access-crawl-control",
    title: "Canonical URLs point at the right page",
    failureTitle: "Canonical URLs point at the wrong page",
    description:
      'A `<link rel="canonical">` tells crawlers which URL is the authoritative version of a page, and the URL they pick is the one eligible to be shown — and cited — in AI answers. The value matters more than the presence: pages that all canonicalize onto the homepage remove themselves from the index.',
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/access-crawl-control/canonical.md",
    // Gate exemption: being refused is what this category reports.
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "medium",
    guidance: {
      impact:
        "A canonical pointing at the wrong URL is worse than no canonical at all: when every page canonicalizes onto the homepage — a common CMS and SPA template bug — the pages consolidate onto one URL and drop out of the index that AI Overviews and AI Mode draw on. A canonical pointing at another domain hands the attribution there.",
      fix: "Give each page a self-referential <link rel=\"canonical\"> in <head> holding that page's own preferred URL. Check templates that emit a hard-coded canonical, and make sure client-side routing updates the tag rather than leaving the shell's value in place.",
      code: '<link rel="canonical" href="https://yoursite.com/this-page" />',
      effort: "easy",
      docsUrl:
        "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
      tags: ["canonical", "seo", "discoverability"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected = "Each page declares a canonical URL that points at itself";

    if (ctx.pages.length === 0) {
      return this.notApplicable(
        "No pages were scanned, so no canonical links could be read.",
        expected,
        "No pages scanned",
      );
    }

    const read = ctx.pages.map(readCanonical);
    const domain = ctx.domain;

    const invalid = read.filter((p) => p.invalid.length > 0);
    const conflicting = read.filter((p) => p.targets.length > 1);
    const missing = read.filter(
      (p) => p.targets.length === 0 && p.invalid.length === 0,
    );
    const offSite = read.filter(
      (p) => p.targets.length > 0 && !sameSite(p.targets[0]!, domain),
    );

    // Homepage collapse: pages that are not the site root declaring the site
    // root as their canonical. Two is already a pattern, not a coincidence.
    const collapsedOnRoot = read.filter((p) => {
      const target = p.targets[0];
      if (!target || !isRoot(target)) return false;
      try {
        return key(new URL(p.url)) !== key(target);
      } catch {
        return false;
      }
    });

    if (collapsedOnRoot.length >= 2) {
      return this.fail(
        `${collapsedOnRoot.length} page(s) declare the homepage as their canonical URL.`,
        expected,
        collapsedOnRoot
          .map((p) => `${p.url} → ${p.targets[0]!.href}`)
          .join(" | "),
        {
          priority: "high",
          description:
            "Every one of these pages tells crawlers that the homepage is the authoritative version of its content, so their own URLs are consolidated away and stop being eligible to appear — or be cited — in AI answers. This is usually a template emitting one hard-coded canonical for every route.",
          code: '<link rel="canonical" href="https://yoursite.com/this-page" />',
        },
        collapsedOnRoot[0]!.url,
      );
    }

    if (invalid.length > 0) {
      return this.fail(
        `${invalid.length} page(s) declare a canonical that is not a valid http(s) URL.`,
        expected,
        invalid.map((p) => `${p.url} → ${p.invalid.join(", ")}`).join(" | "),
        {
          priority: "high",
          description:
            "A canonical that does not resolve to an http(s) URL is ignored, so the page falls back to whatever URL the crawler happened to fetch — and any duplicate variants of it stay unconsolidated.",
          code: '<link rel="canonical" href="https://yoursite.com/this-page" />',
        },
        invalid[0]!.url,
      );
    }

    // A single page pointing elsewhere is ordinary (pagination, filtered
    // variants); the same non-root target held by most declaring pages is the
    // same collapse bug at a different address.
    const declaring = read.filter((p) => p.targets.length > 0);
    const nonSelf = declaring.filter((p) => {
      try {
        return key(new URL(p.url)) !== key(p.targets[0]!);
      } catch {
        return false;
      }
    });
    const byTarget = new Map<string, PageCanonical[]>();
    for (const p of nonSelf) {
      const k = key(p.targets[0]!);
      byTarget.set(k, [...(byTarget.get(k) ?? []), p]);
    }
    const shared = [...byTarget.entries()].find(
      ([, pages]) => pages.length >= 2 && pages.length >= declaring.length / 2,
    );

    if (shared) {
      const [target, pages] = shared;
      return this.warn(
        `${pages.length} of ${declaring.length} page(s) with a canonical collapse onto one URL (${target}).`,
        expected,
        pages.map((p) => `${p.url} → ${p.targets[0]!.href}`).join(" | "),
        {
          priority: "high",
          description:
            "When most scanned pages name the same other URL as canonical, their own URLs are consolidated away. Pagination and filtered variants legitimately do this for a page or two; a site-wide pattern is a template bug.",
          code: '<link rel="canonical" href="https://yoursite.com/this-page" />',
        },
        pages[0]!.url,
      );
    }

    if (conflicting.length > 0) {
      return this.warn(
        `${conflicting.length} page(s) carry conflicting canonical links.`,
        expected,
        conflicting
          .map((p) => `${p.url} → ${p.targets.map((t) => t.href).join(" vs ")}`)
          .join(" | "),
        {
          priority: "medium",
          description:
            "A page with two canonical elements naming different URLs gives crawlers no usable preference — Google may ignore both and pick its own canonical. Emit exactly one.",
          code: '<link rel="canonical" href="https://yoursite.com/this-page" />',
        },
        conflicting[0]!.url,
      );
    }

    if (offSite.length > 0) {
      return this.warn(
        `${offSite.length} page(s) name another domain as their canonical URL.`,
        expected,
        offSite.map((p) => `${p.url} → ${p.targets[0]!.href}`).join(" | "),
        {
          priority: "medium",
          description:
            "A cross-domain canonical hands consolidation — and the citation — to the other domain. That is correct for content you syndicated from elsewhere and a serious defect otherwise.",
          code: '<link rel="canonical" href="https://yoursite.com/this-page" />',
        },
        offSite[0]!.url,
      );
    }

    if (missing.length > 0) {
      const bodyOnly = missing.filter((p) => p.hasBodyOnly);
      const detail =
        missing
          .map((p) => p.url)
          .slice(0, 5)
          .join(", ") +
        (missing.length > 5 ? ` (+${missing.length - 5} more)` : "") +
        (bodyOnly.length > 0
          ? ` — ${bodyOnly.length} page(s) declare a canonical outside <head>, where crawlers ignore it`
          : "");
      const all = missing.length === ctx.pages.length;
      return this.warn(
        all
          ? "No scanned page declares a canonical URL."
          : `${missing.length}/${ctx.pages.length} page(s) do not declare a canonical URL.`,
        expected,
        detail,
        {
          priority: all ? "medium" : "low",
          description:
            'Google states a site "will likely do just fine without specifying a canonical preference" and will choose a canonical itself, so this is a missed opportunity rather than a defect: a self-referential canonical is how you make that choice yourself and keep parameterized and trailing-slash variants consolidated onto one citable URL.',
          code: '<link rel="canonical" href="https://yoursite.com/this-page" />',
        },
        missing[0]!.url,
      );
    }

    return this.pass(
      `All ${ctx.pages.length} page(s) declare a canonical URL that resolves to themselves.`,
      expected,
      `${ctx.pages.length} page(s) checked — resolved and compared against each page's own URL`,
    );
  }
}
