import type { CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext, PageContext } from "#core/check-context";
import { inPageChrome } from "#core/page-chrome";
import { hiddenFromReaders } from "#core/dom-visibility";
import { PRODUCT_CARD_SELECTOR } from "#core/parser";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

/**
 * Class/id tokens that name a supplementary-content container.
 *
 * These are the same string families the extractors themselves key on when a
 * page has no landmarks to go by: Readability's `unlikelyCandidates` regex
 * matches `sidebar|skyscraper|supplemental|related` and its negative
 * class-weight regex penalises `sidebar`. Matching them here is how the audit
 * decides a page *has* supplementary content in the first place.
 *
 * A hint word followed by `-tag`, `-badge` and similar names a badge. One
 * followed by `-bar`, `-strip`, `-banner` or `-ticker` names a site-wide
 * announcement strip: page banner content, whose home is the `<header>`,
 * not content tangential to the main flow that `<aside>` describes.
 */
const SUPPLEMENTARY_HINT =
  /(?:^|[^a-z])(sidebar|side-bar|supplemental|complementary|related|recirc|promo|newsletter|subscribe-box|advert|ad-slot|sponsored)(?![-_](?:tag|badge|label|price|code|icon|bar|strip|banner|ticker)(?:[^a-z]|$))(?:[^a-z]|$)/i;

/**
 * Hint words that name a position rather than a role. A product template's
 * buy box is often a `sidebar`; a `related` or `promo` block is supplementary
 * whatever it holds.
 */
const POSITIONAL_HINT = /(?:^|[^a-z])side-?bar(?:[^a-z]|$)/i;

/** An `<aside>` or an explicit `role="complementary"` — the marked forms. */
const MARKED_SELECTOR = 'aside, [role="complementary"]';

/** Elements that can stand in for `<aside>` when authors reach for a `<div>`. */
const CANDIDATE_SELECTOR = "div, section, ul";

/**
 * Purchase controls mark a block as primary content. Product templates often
 * name the buy box `sidebar` or `product-sidebar`; that block must not be
 * asked to become an `<aside>`, which extractors delete.
 */
const PURCHASE_CONTROL =
  '[itemprop="offers"], [itemprop="price"], form[action*="cart" i], input[name="quantity"], input[name="qty"], [name="add-to-cart"]';
const PURCHASE_LABEL =
  /\b(?:add to (?:cart|bag|basket|trolley)|buy (?:now|it now)|proceed to checkout)\b|^checkout$/i;

/**
 * Whether a positionally named block is one product's buy box. Buttons, cart
 * forms and quantity fields repeat inside a single buy box (a sticky copy of
 * "Add to cart", an installment form, mobile and desktop quantity fields), so
 * only repeated product identity — two cards or two offers — marks a rail.
 */
function isBuyBox($: CheerioAPI, el: Element): boolean {
  const node = $(el);
  if (
    !POSITIONAL_HINT.test(
      `${node.attr("class") ?? ""} ${node.attr("id") ?? ""}`,
    )
  )
    return false;
  const visible = (selector: string) =>
    node
      .find(selector)
      .add(node.filter(selector))
      .toArray()
      .filter((match) => !hiddenFromReaders($, match));
  const outermost = (selector: string) =>
    visible(selector).filter(
      (match) => match === el || !$(match).parentsUntil(el).is(selector),
    ).length;
  if (
    outermost(PRODUCT_CARD_SELECTOR) > 1 ||
    outermost('[itemprop="offers"]') > 1
  )
    return false;
  return (
    visible(PURCHASE_CONTROL).length > 0 ||
    visible('button, input[type="submit"], input[type="button"]').some(
      (button) =>
        PURCHASE_LABEL.test(
          `${$(button).text()} ${$(button).attr("value") ?? ""}`
            .replace(/\s+/g, " ")
            .trim(),
        ),
    )
  );
}

interface PageFindings {
  /** Supplementary blocks an extractor can recognise by element or role. */
  readonly marked: string[];
  /** Likely supplementary blocks without an explicit complementary landmark. */
  readonly unmarked: string[];
}

/**
 * A short label for a finding: the tag plus the class or id token that made
 * the block a candidate, so a theme wrapper's first token such as
 * `shopify-section` does not hide the `promo-bar` behind it.
 */
function describe(tag: string, attrs: string): string {
  const tokens = attrs.trim().split(/\s+/).filter(Boolean);
  const token = tokens.find((t) => SUPPLEMENTARY_HINT.test(t)) ?? tokens[0];
  return token ? `<${tag} ${token}>` : `<${tag}>`;
}

/** Find the supplementary-content blocks on one page, split by markup. */
function findSupplementary(page: PageContext): PageFindings {
  const $ = page.$;
  const marked: string[] = [];
  const unmarked: string[] = [];

  // Top-level marked landmarks. A nested one is part of the same block, so it
  // is not counted twice.
  $(MARKED_SELECTOR).each((_, el) => {
    const node = $(el);
    if (hiddenFromReaders($, el) || inPageChrome($, el)) return;
    if (node.parents(MARKED_SELECTOR).length > 0) return;
    marked.push(
      describe(
        (el as { tagName?: string }).tagName ?? "aside",
        `${node.attr("class") ?? ""} ${node.attr("id") ?? ""}`,
      ),
    );
  });

  $(CANDIDATE_SELECTOR).each((_, el) => {
    const node = $(el);
    // The class hint rejects almost every container, so it runs before the
    // ancestor walks below.
    const attrs = `${node.attr("class") ?? ""} ${node.attr("id") ?? ""}`;
    if (!SUPPLEMENTARY_HINT.test(attrs)) return;
    if (node.is('[role="main"]')) return;
    if (hiddenFromReaders($, el) || inPageChrome($, el)) return;
    // A sectioning header holds that section's introductory content: its
    // title, date and badges such as a product's promo tag. That is primary
    // content, unlike a section footer, which often carries related links.
    if (node.closest("header").length > 0) return;
    // A sale badge or quick-add block inside a product card belongs to that
    // card, not beside the page's content.
    if (node.parents(PRODUCT_CARD_SELECTOR).length > 0) return;
    if (isBuyBox($, el)) return;

    // Inside a marked landmark the block is already handled — Readability and
    // trafilatura drop the whole subtree.
    if (node.closest(MARKED_SELECTOR).length > 0) return;

    // Only report the outermost container of a nested promo/sidebar stack.
    // A primary container (main role or buy box) was excluded above, so it
    // cannot stand in for the blocks nested inside it.
    const nestedInHint = node
      .parents(CANDIDATE_SELECTOR)
      .toArray()
      .some(
        (a) =>
          !$(a).is('[role="main"]') &&
          SUPPLEMENTARY_HINT.test(
            `${$(a).attr("class") ?? ""} ${$(a).attr("id") ?? ""}`,
          ) &&
          !isBuyBox($, a),
      );
    if (nestedInHint) return;

    unmarked.push(
      describe((el as { tagName?: string }).tagName ?? "div", attrs),
    );
  });

  return { marked, unmarked };
}

const EXPECTED =
  'Every sidebar / promo / related-links block on a sampled page is wrapped in <aside> (or carries role="complementary")';

export class AsideElementAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/aside-element",
    category: "content-extraction",
    title: "<aside> for supplementary content",
    failureTitle: "<aside> for supplementary content",
    description:
      "Mozilla Readability and trafilatura delete <aside> subtrees before extraction, and Chromium exposes <aside> as a complementary landmark in the accessibility tree agents read. Explicit complementary landmarks help separate supplementary content from the main text. Bare containers depend on extractor heuristics.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.B, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.B,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/content-extraction/aside-element.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        'Mozilla Readability removes every <aside> from extracted article content (`this._clean(articleContent, "aside")`) and trafilatura lists "aside" first in its MANUALLY_CLEANED tag list, so supplementary blocks marked this way never reach the model. Firefox Reader Mode, Jina Reader and a long tail of LLM/agent tools run on Readability. Chromium additionally exposes <aside> as a `complementary` landmark, which is what Anthropic\'s browser-use `read_page` returns. A sidebar in a bare <div> lacks that explicit landmark; extractors may still remove it using class names or text density.',
      fix: 'Wrap sidebar, promo, advert and related-links containers in <aside> (or give them role="complementary"). Because Readability and trafilatura discard that subtree entirely, never put citable facts — author bios, specifications, key figures — inside an <aside>; those belong in the main article body.',
      code: '<article>\n  <p>Citable article body stays here.</p>\n</article>\n<aside>\n  <h3>Related Resources</h3>\n  <ul>\n    <li><a href="/related-topic">Related Topic</a></li>\n  </ul>\n</aside>',
      effort: FixEffort.Easy,
      docsUrl:
        "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/aside",
      tags: ["aside", "structure", "semantic", "html", "content-extraction"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Supplementary content can occur on any page type. Only pages with
    // visible supplementary candidates contribute to the denominator.
    const pages = ctx.pages;

    let marked = 0;
    const unmarked: string[] = [];
    let firstGapUrl: string | undefined;
    let evaluated = 0;

    for (const page of pages) {
      const found = findSupplementary(page);
      if (found.marked.length === 0 && found.unmarked.length === 0) continue;
      evaluated += 1;
      marked += found.marked.length;
      if (found.unmarked.length > 0) {
        unmarked.push(...found.unmarked.slice(0, 5));
        firstGapUrl ??= page.url;
      }
    }

    // A page with no sidebar, promo or related-links block is correct as it
    // stands. v1 warned at it, which asked authors to invent a sidebar.
    if (evaluated === 0) {
      return this.notApplicable(
        "No sampled page carries a sidebar, promo or related-links block, so there is nothing to mark up as supplementary.",
        EXPECTED,
        "No supplementary content detected",
      );
    }

    const sample = [...new Set(unmarked)].slice(0, 5).join(", ");

    if (unmarked.length === 0) {
      return this.pass(
        `All ${marked} supplementary block(s) across ${evaluated} relevant page(s) are marked with <aside> or role="complementary".`,
        EXPECTED,
        `${marked} marked supplementary block(s), 0 unmarked`,
      );
    }

    if (marked > 0) {
      return this.warn(
        `${unmarked.length} supplementary block(s) are not marked as complementary: ${sample}.`,
        EXPECTED,
        `${marked} marked, ${unmarked.length} unmarked — ${sample}`,
        {
          priority: CheckPriority.Low,
          description:
            "Some sidebar/promo blocks are wrapped in <aside> and some are not. The unwrapped ones rely on extractor heuristics and may enter the main text. Wrap them in <aside> too — but keep citable facts out, because that subtree is discarded.",
          code: '<aside class="sidebar">\n  <h3>Related Resources</h3>\n  <ul><li><a href="/related">Related page</a></li></ul>\n</aside>',
        },
        firstGapUrl,
      );
    }

    return this.fail(
      `${unmarked.length} supplementary block(s) are in bare containers with no <aside> or role="complementary" anywhere: ${sample}.`,
      EXPECTED,
      `0 marked, ${unmarked.length} unmarked — ${sample}`,
      {
        priority: CheckPriority.Low,
        description:
          "Likely sidebar, promo and related-links containers lack explicit complementary landmarks. Readability and trafilatura may remove them through other heuristics, but the markup does not identify their supplementary role. Confirm that each block is supplementary before changing it; keep primary content outside <aside>.",
        code: '<article>\n  <p>Citable article body stays here.</p>\n</article>\n<aside class="sidebar">\n  <h3>Related Resources</h3>\n  <ul><li><a href="/related">Related page</a></li></ul>\n</aside>',
      },
      firstGapUrl,
    );
  }
}
