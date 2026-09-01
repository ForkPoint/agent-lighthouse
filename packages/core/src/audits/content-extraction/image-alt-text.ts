import type { CheerioAPI } from "cheerio";
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { extractImages } from "../../parser";
import { weightForGrade } from "../../scorer";

type ExtractedImage = ReturnType<typeof extractImages>[number];

/** Coverage at or above this warns rather than fails. */
const WARN_FLOOR = 0.8;

/** How many offending pages the message names. */
const WORST_PAGES = 3;

/**
 * The name an `aria-labelledby` list resolves to, using an id index built once
 * per page.
 *
 * Ids are author-controlled and may hold characters a CSS selector cannot
 * express, so the lookup is by attribute value rather than by an `#id`
 * selector. An id that resolves to nothing contributes nothing.
 */
function labelledbyName(value: string, ids: Map<string, string>): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => ids.get(id) ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Every element carrying an id, mapped to its trimmed text. Built once per page. */
function idTextIndex($: CheerioAPI): Map<string, string> {
  const index = new Map<string, string>();
  $("[id]").each((_, el) => {
    const id = $(el).attr("id");
    if (!id || index.has(id)) return;
    index.set(id, $(el).text().replace(/\s+/g, " ").trim());
  });
  return index;
}

export class ImageAltTextAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/image-alt-text",
    category: "content-extraction",
    title: "Image text-alternative coverage",
    failureTitle: "Images with no text alternative",
    description:
      "An image with no text alternative has no accessible name, so it is an unnamed node in the accessibility-tree snapshots agent toolkits send to a model — Playwright MCP, Claude-in-Chrome read_page, Chrome DevTools take_snapshot — and it carries no subject matter for Google Images, which states it uses alt text to understand what an image shows. A multimodal agent that fetches the image bytes can caption it without one; a text-only crawler or a snapshot-driven agent cannot.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/content-extraction/image-alt-text.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "high",
    guidance: {
      impact:
        "An image with no text alternative has no accessible name, so it is an unnamed node in the accessibility-tree snapshots agent toolkits send to a model — Playwright MCP, Claude-in-Chrome read_page, Chrome DevTools take_snapshot — and it carries no subject matter for Google Images, which states it uses alt text to understand what an image shows. A multimodal agent that fetches the image bytes can caption it without one; a text-only crawler or a snapshot-driven agent cannot.",
      fix: 'Give every image that carries meaning a text alternative: `alt` on the `<img>`, or `aria-label` / `aria-labelledby` where the name already exists elsewhere on the page. Mark a genuinely decorative image `alt=""` or `role="presentation"`, and use `aria-hidden="true"` only for an image that should be hidden from assistive technology altogether.',
      code: '<img src="product.jpg" alt="Blue running shoe, side view, with breathable mesh upper and cushioned sole">',
      effort: "moderate",
      docsUrl:
        "https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/alt",
      tags: ["images", "alt-text", "accessibility", "semantic"],
    },
  };

  /**
   * The accessible name of an image, in accname 1.1 source order:
   * `aria-labelledby` > `aria-label` > `alt` > `title`.
   *
   * Returned split, because the two halves do different work. `aria` is a
   * global ARIA name and defeats a presentational marker on the same element;
   * `alt` and `title` do not.
   */
  private imageName(
    img: ExtractedImage,
    ids: Map<string, string>,
  ): { aria: string; name: string } {
    const aria =
      (img.ariaLabelledby ? labelledbyName(img.ariaLabelledby, ids) : "") ||
      (img.ariaLabel ?? "").trim();
    return { aria, name: aria || img.alt.trim() || (img.title ?? "").trim() };
  }

  audit(ctx: CheckContext): AuditResult {
    let total = 0;
    let named = 0;
    const perPage: Array<{ url: string; total: number; named: number }> = [];

    for (const page of ctx.pages) {
      const images = extractImages(page.$);
      // Built lazily: most pages carry no aria-labelledby at all, and indexing
      // every id on a large document is wasted work when nothing reads it.
      let ids: Map<string, string> | undefined;
      let pageTotal = 0;
      let pageNamed = 0;

      for (const img of images) {
        // Not in the accessibility tree, so no snapshot consumer can see it.
        // The dossier's required fix asks for this exclusion by name.
        if ((img.ariaHidden ?? "").toLowerCase() === "true") continue;

        if (img.ariaLabelledby && !ids) ids = idTextIndex(page.$);
        const { aria, name } = this.imageName(img, ids ?? new Map());

        // Decorative markup is correct markup, so it leaves the denominator —
        // unless a global ARIA name is also present, which under ARIA's
        // presentational-role conflict resolution defeats the marker and makes
        // the image a named node again. `title` does not have that effect.
        const isExplicitlyEmptyAlt = img.hasAlt && img.alt === "";
        const isPresentationRole =
          img.role === "presentation" || img.role === "none";
        if (!aria && (isExplicitlyEmptyAlt || isPresentationRole)) continue;

        pageTotal++;
        if (name) pageNamed++;
      }

      if (pageTotal > 0)
        perPage.push({ url: page.url, total: pageTotal, named: pageNamed });
      total += pageTotal;
      named += pageNamed;
    }

    const expected =
      "Every image that appears in the accessibility tree carries a text alternative (alt, aria-label, aria-labelledby or title)";

    if (total === 0) {
      // A site with no images needing a name has nothing to measure. The old
      // rule returned a scored 1.0 here, which handed a free full mark to every
      // image-free page and to every client-rendered site whose served HTML
      // carries no <img> at all.
      return this.notApplicable(
        "No images that need a text alternative were found in the served HTML.",
        expected,
        "No images requiring a text alternative",
      );
    }

    const coverage = named / total;
    const percent = Math.round(coverage * 100);
    const worst = [...perPage]
      .sort((a, b) => b.total - b.named - (a.total - a.named))
      .filter((entry) => entry.named < entry.total)
      .slice(0, WORST_PAGES);
    const found =
      `${named}/${total} images with a text alternative (${percent}%)` +
      (worst.length
        ? ` — worst: ${worst.map((entry) => `${entry.url} (${entry.named}/${entry.total})`).join(", ")}`
        : "");

    if (coverage === 1) {
      return this.pass(
        `All ${total} image(s) that need a text alternative have one.`,
        expected,
        found,
      );
    }

    const message = `${named}/${total} image(s) that need a text alternative have one (${percent}%).`;
    const recommendation = {
      priority: "high" as const,
      code: '<img src="product.jpg" alt="Product name shown from the front, featuring key design element">',
    };

    return coverage >= WARN_FLOOR
      ? this.warn(message, expected, found, recommendation, worst[0]?.url)
      : this.fail(message, expected, found, recommendation, worst[0]?.url);
  }
}
