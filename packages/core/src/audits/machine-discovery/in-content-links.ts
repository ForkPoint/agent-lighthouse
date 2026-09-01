import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from "../../check-context";
import { weightForGrade } from "../../scorer";

/** Template chrome: links here say the site has a layout, not that it interlinks. */
const CHROME_SELECTOR =
  'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]';

/** Distinct in-content destinations a page needs to count as interlinked. */
const LINK_BAR = 2;

/** `/blog/page/2`-style pagination is navigation, not a topical cross-link. */
const PAGINATION = /\/(page|pagina|seite)\/\d+$/;

/**
 * One comparison key per destination: host without `www.`, lower-cased path
 * with no trailing slash, no query and no fragment.
 *
 * Without it, `/about`, `/about/` and `/about?utm_source=nav` counted as three
 * distinct destinations, and a site scanned as `www.example.com` treated its
 * own bare-host links as external (review findings 1.15 and 10.11).
 */
function destinationKey(url: URL): string {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "").toLowerCase();
  return `${host}${path}`;
}

function isSameSite(url: URL, domain: string): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const site = domain.toLowerCase().replace(/^www\./, "");
  return host === site || host.endsWith(`.${site}`);
}

/**
 * Distinct internal destinations linked from a page's own content.
 *
 * Anchors are read from `<main>`/`<article>` when present (otherwise the whole
 * body) and any anchor with a chrome ancestor is dropped, so the count measures
 * editorial linking rather than the presence of a template.
 */
function inContentDestinations(page: PageContext, domain: string): Set<string> {
  const $ = page.$;
  const scope = $("main, article").length > 0 ? $("main, article") : $("body");
  const selfKey = (() => {
    try {
      return destinationKey(new URL(page.url));
    } catch {
      return null;
    }
  })();

  const destinations = new Set<string>();
  scope.find("a[href]").each((_, el) => {
    if ($(el).closest(CHROME_SELECTOR).length > 0) return;
    const href = ($(el).attr("href") ?? "").trim();
    // A '#main' skip-link resolves to the page's own URL, so a page whose only
    // anchor is an accessibility affordance used to look well-interlinked.
    if (!href || href.startsWith("#")) return;

    let url: URL;
    try {
      url = new URL(href, page.url);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (!isSameSite(url, domain)) return;

    const key = destinationKey(url);
    // The site root is the logo's destination on every page; a self-link is not
    // a cross-link; pagination is navigation.
    if (key === selfKey) return;
    if (!key.includes("/")) return;
    if (PAGINATION.test(key)) return;

    destinations.add(key);
  });

  return destinations;
}

export class InContentLinksAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/in-content-links",
    category: "machine-discovery",
    title: "In-content internal links",
    failureTitle: "In-content internal links",
    description:
      "Contextual links inside the page body — not the nav or footer — are how AI crawlers discover related pages and read the relationships between them. Crawlers that do not execute JavaScript see only the links present as <a href> in the served HTML.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/machine-discovery/in-content-links.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Google can only crawl a link that is an <a> element with an href, and the measured behaviour of GPTBot and ClaudeBot is that they do not execute JavaScript — so a page whose only links are in a client-rendered nav is a dead end for them. Links inside the body copy also tell an agent which pages belong together, which template chrome (identical on every page) cannot.",
      fix: "Link to related pages from within the body copy, with anchor text that names the destination. Aim for at least two distinct in-content destinations per page (the nav and footer do not count), and make sure they are server-rendered <a href> elements.",
      code: '<main>\n  <p>Our <a href="/guide/getting-started">getting-started guide</a> walks through setup, and the <a href="/api">API reference</a> documents every endpoint.</p>\n</main>',
      effort: "easy",
      tags: ["internal-links", "in-content", "discoverability"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected = `Each page links to ${LINK_BAR}+ other internal pages from its own content`;

    if (ctx.pages.length === 0) {
      return this.notApplicable(
        "No pages scanned.",
        expected,
        "No pages scanned",
      );
    }

    const linkless: string[] = [];
    const thin: string[] = [];
    let totalDestinations = 0;

    for (const page of ctx.pages) {
      const destinations = inContentDestinations(page, ctx.domain);
      totalDestinations += destinations.size;
      if (destinations.size === 0) linkless.push(page.url);
      else if (destinations.size < LINK_BAR) thin.push(page.url);
    }

    const below = [...linkless, ...thin];
    const found = `${totalDestinations} distinct in-content destination(s) across ${ctx.pages.length} page(s)`;

    if (linkless.length === ctx.pages.length) {
      return this.fail(
        "Every scanned page has no in-content internal links — every internal link sits in the nav, header or footer.",
        expected,
        found,
        {
          priority: "medium",
          description:
            "Template chrome is identical on every page, so it tells an agent nothing about which pages belong together — and if your navigation is client-rendered, the crawlers that do not execute JavaScript see no links at all. Add contextual links from the body copy of each page to related pages.",
          code: `<p>See our <a href="/guide">guide</a> and the <a href="/api">API reference</a>.</p>`,
        },
        linkless[0],
      );
    }

    if (below.length > 0) {
      const shown = `${below.slice(0, 5).join(", ")}${below.length > 5 ? ` (+${below.length - 5} more)` : ""}`;
      return this.warn(
        `${below.length}/${ctx.pages.length} page(s) have thin in-content linking (fewer than ${LINK_BAR} distinct internal destinations in the body).`,
        expected,
        `${found}. Thin pages: ${shown}`,
        {
          priority: "low",
          description:
            "Some pages link to fewer than two other pages from their own content, so an agent reading them learns little about what else is relevant. Add contextual links to related pages.",
          code: `<p>See our <a href="/guide">guide</a> and the <a href="/api">API reference</a>.</p>`,
        },
        below[0],
      );
    }

    return this.pass(
      `All ${ctx.pages.length} page(s) have ${LINK_BAR}+ in-content internal links to other pages.`,
      expected,
      found,
    );
  }
}
