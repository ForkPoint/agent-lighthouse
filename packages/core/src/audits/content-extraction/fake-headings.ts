import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { AuditMeta, AuditResult, CheckPriority } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { scanReadPageText, unreadPageTextReason } from "../../scan-evidence";

/**
 * Classes that commonly impersonate a heading in utility-CSS markup
 * (Tailwind-style text sizes / weights, or BEM-ish "heading"/"headline").
 */
const FAKE_HEADING_CLASS =
  /(text-(xl|2xl|3xl|4xl|5xl)|font-(bold|semibold|extrabold)|heading|headline)/i;

/** Inline-style thresholds that suggest heading-like visual emphasis. */
const MIN_FONT_SIZE_PX = 20;
const MIN_FONT_WEIGHT = 600;

/**
 * Heading impersonators are short — a long paragraph styled bold is emphasis,
 * not a heading. 120 chars is the cutoff (roughly a long title).
 */
const MAX_HEADING_TEXT_LENGTH = 120;

/**
 * Elements that visually contain other content are containers, not headings.
 * A fake heading holds (at most) inline children.
 */
const BLOCK_CHILDREN =
  "div, p, section, article, aside, ul, ol, dl, table, figure, blockquote, pre, form";

/** Chrome/navigation zones where large bold text is not document structure. */
const EXCLUDED_ANCESTORS = "nav, footer, button, a";

interface FakeHeading {
  tag: string;
  className?: string;
  style?: string;
  text: string;
}

function looksLikeHeading(el: AnyNode, $: CheerioAPI): FakeHeading | null {
  const $el = $(el);
  const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";

  const text = $el.text().replace(/\s+/g, " ").trim();
  if (text.length === 0 || text.length > MAX_HEADING_TEXT_LENGTH) return null;

  // A real heading nested inside means this is a wrapper, not an impersonator.
  if ($el.find("h1, h2, h3, h4, h5, h6").length > 0) return null;

  // Elements containing block-level children are containers.
  if ($el.find(BLOCK_CHILDREN).length > 0) return null;

  // Navigation chrome and links are not document structure.
  if ($el.parents(EXCLUDED_ANCESTORS).length > 0) return null;

  const className = $el.attr("class") ?? "";
  const style = $el.attr("style") ?? "";

  const classHit = FAKE_HEADING_CLASS.test(className);

  let styleHit = false;
  if (style) {
    const sizeMatch = /font-size\s*:\s*(\d+(?:\.\d+)?)px/i.exec(style);
    if (sizeMatch && parseFloat(sizeMatch[1]) >= MIN_FONT_SIZE_PX)
      styleHit = true;

    const weightMatch = /font-weight\s*:\s*(\d+|bold|bolder)/i.exec(style);
    if (weightMatch) {
      const w = weightMatch[1].toLowerCase();
      if (w === "bold" || w === "bolder" || parseInt(w, 10) >= MIN_FONT_WEIGHT)
        styleHit = true;
    }
  }

  if (!classHit && !styleHit) return null;

  return {
    tag,
    className: className || undefined,
    style: style || undefined,
    text,
  };
}

export class FakeHeadingsAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/fake-headings",
    category: "content-extraction",
    title: "No fake headings",
    failureTitle: "Fake headings detected",
    description:
      'AI agents chunk and outline page content by reading real <h1>–<h6> tags. When a page styles a <div>, <span>, <p>, or <b> to look like a heading (large text, bold weight, "heading" classes) instead of using a semantic heading element, that text is invisible to the agent\'s document outline — sections cannot be navigated, summarized, or cited correctly. This audit is distinct from the sequential-heading check (content-extraction/sequential-headings), which verifies that real headings appear in the right order, while this audit catches content that impersonates headings without using heading tags at all. Replace styled generic elements with the appropriate <h1>–<h6> level.',
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/content-extraction/fake-headings.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "medium",
    guidance: {
      impact:
        "AI agents build content outlines exclusively from <h1>–<h6> elements. Text that only looks like a heading is treated as ordinary body copy, so agents miss your section structure entirely — summaries flatten into a wall of text, section-level citations become impossible, and chunking for retrieval splits content at arbitrary points instead of at your intended section boundaries.",
      fix: "Replace generic elements styled to look like headings with real heading tags. Pick the level that reflects the content's position in the outline (h2 for major sections under the h1, h3 for subsections, and so on), and move the visual styling to CSS targeting those heading elements instead of utility classes on divs and spans.",
      code: '<!-- Before: looks like a heading, invisible to agents -->\n<div class="text-2xl font-bold">Pricing Plans</div>\n\n<!-- After: semantic and styleable -->\n<h2 class="text-2xl font-bold">Pricing Plans</h2>',
      effort: "easy",
      docsUrl:
        "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements",
      tags: ["headings", "semantic", "chunking", "structure"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const found: Array<{ url: string; heading: FakeHeading }> = [];

    for (const page of ctx.pages) {
      const $ = page.$;
      const flagged = new Set<AnyNode>();

      $("div, span, p, b, strong").each((_i, el) => {
        // Skip if an ancestor was already flagged (e.g. <b> inside a fake-heading <div>).
        if (
          $(el)
            .parents()
            .toArray()
            .some((ancestor) => flagged.has(ancestor))
        ) {
          return;
        }

        const hit = looksLikeHeading(el, $);
        if (hit) {
          flagged.add(el);
          found.push({ url: page.url, heading: hit });
        }
      });
    }

    const describe = (h: FakeHeading): string => {
      const via = h.className ? `class="${h.className}"` : `style="${h.style}"`;
      const text = h.text.length > 60 ? `${h.text.slice(0, 57)}...` : h.text;
      return `<${h.tag} ${via}> "${text}"`;
    };

    const foundSummary = found
      .slice(0, 5)
      .map((f) => `${f.url}: ${describe(f.heading)}`)
      .join("; ");

    const expected = "All heading-like text uses semantic <h1>-<h6> elements";

    if (found.length === 0) {
      // Heading-like text is body text. A page that served none carries no
      // headings, fake or real, so there is nothing to have got right.
      if (!scanReadPageText(ctx.evidence)) {
        return this.notApplicable(
          "The scanned page served no readable text, so it held no headings to judge.",
          expected,
          unreadPageTextReason(ctx.evidence),
        );
      }
      return this.pass(
        "No fake headings detected — heading-like text uses semantic heading elements.",
        expected,
        "No styled <div>/<span>/<p>/<b> elements impersonating headings",
      );
    }

    const recommendation: {
      priority: CheckPriority;
      description: string;
      code: string;
    } = {
      priority: "medium",
      description:
        "AI agents chunk and outline page content by reading real <h1>–<h6> tags. Elements styled to look like headings are invisible to that outline, so sections cannot be navigated, summarized, or cited correctly. Replace styled generic elements with the appropriate heading level.",
      code: '<!-- Before -->\n<div class="text-2xl font-bold">Pricing Plans</div>\n\n<!-- After -->\n<h2 class="text-2xl font-bold">Pricing Plans</h2>',
    };

    if (found.length >= 5) {
      return this.fail(
        `Found ${found.length} fake heading(s) — generic elements styled to look like headings instead of <h1>-<h6> tags.`,
        expected,
        foundSummary,
        recommendation,
      );
    }

    return this.warn(
      `Found ${found.length} fake heading(s) — generic elements styled to look like headings instead of <h1>-<h6> tags.`,
      expected,
      foundSummary,
      recommendation,
    );
  }
}
