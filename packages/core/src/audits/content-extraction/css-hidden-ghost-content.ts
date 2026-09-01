// Graduated from proposal 2026-08-22 (Plan 5, Task 12).
// Evidence dossier: docs/evidence/audits/content-extraction/css-hidden-ghost-content.md
//
// Scope note (non-double-counting): `operability-safety/invisible-instruction-scan`
// looks at the same class-hidden text and asks whether it reads like an
// instruction addressed to a model. This audit asks what it costs — tokens and
// duplicated context — and fails on size, not on wording. A page can fail one
// and pass the other.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { collectPageCss, type CssRule } from '../../gatherers/css-rules';

/** The repo-wide rough token estimator; no tokenizer dependency is carried. */
const CHARS_PER_TOKEN = 4;
/** Class-hidden text above this share of page text fails. */
const HIDDEN_SHARE_FLOOR = 0.15;
/** Class-hidden text above this absolute size fails regardless of share. */
const HIDDEN_TOKEN_FLOOR = 1000;
/** The sr-only clip idiom is legitimate assistive text below this length. */
const SR_ONLY_CHARS = 120;
/** Word count of a shingle used for the duplication comparison. */
const SHINGLE_N = 5;
/** Above this shingle overlap, hidden text is a copy of visible text. */
const DUPLICATE_OVERLAP = 0.8;

/**
 * Declarations that take a subtree out of a human's view while leaving it in
 * the byte stream every non-rendering extractor reads.
 */
const HIDING_DECLARATIONS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /display\s*:\s*none/i, label: 'display:none' },
  { pattern: /visibility\s*:\s*hidden/i, label: 'visibility:hidden' },
  { pattern: /content-visibility\s*:\s*hidden/i, label: 'content-visibility:hidden' },
  { pattern: /clip(-path)?\s*:\s*(rect\(\s*0|inset\(\s*50%)/i, label: 'clip idiom' },
];

/** Inline markers Readability already honours, so their text is not ingested. */
const INLINE_HIDDEN = /display\s*:\s*none|visibility\s*:\s*hidden/i;

/** Claims that contradict visible copy when a stale hidden variant survives. */
const CONTRADICTION =
  /(\$|€|£|\bUSD\b|\bEUR\b|\bGBP\b)\s?\d|\b(in|out of) stock\b|\bsold out\b|\bback ?order\b|\b(19|20)\d{2}\b/i;

interface Block {
  pageUrl: string;
  /** The selector that hid it, verbatim, so a human can adjudicate the match. */
  selector: string;
  /** Which declaration hid it. */
  technique: string;
  chars: number;
  duplicate: boolean;
  contradictory: boolean;
}

interface Survey {
  totalChars: number;
  hiddenChars: number;
  blocks: Block[];
  crossOrigin: number;
}

function $el($: PageContext['$'], el: unknown) {
  return $(el as never);
}

/** Five-word shingles, punctuation and case folded away. */
function shingles(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE_N <= words.length; i += 1) {
    out.add(words.slice(i, i + SHINGLE_N).join(' '));
  }
  return out;
}

function overlap(part: Set<string>, whole: Set<string>): number {
  if (part.size === 0) return 0;
  let shared = 0;
  for (const shingle of part) if (whole.has(shingle)) shared += 1;
  return shared / part.size;
}

/** True when this element or an ancestor already carries an inline hidden marker. */
function inlineHidden(page: PageContext, el: unknown): boolean {
  const $e = $el(page.$, el);
  const chain = $e.add($e.parents());
  let found = false;
  chain.each((_i, node) => {
    const $n = $el(page.$, node);
    if ($n.attr('hidden') !== undefined) found = true;
    if (($n.attr('aria-hidden') ?? '').toLowerCase() === 'true') found = true;
    if (INLINE_HIDDEN.test($n.attr('style') ?? '')) found = true;
  });
  return found;
}

/** Every rule that hides its matches, ignoring print-only and unattributable at-rules. */
function hidingRules(rules: CssRule[]): Array<{ rule: CssRule; technique: string }> {
  const out: Array<{ rule: CssRule; technique: string }> = [];
  for (const rule of rules) {
    // Hiding text from a printer is not hiding it from a reader.
    if (rule.atRule?.startsWith('media print')) continue;
    for (const { pattern, label } of HIDING_DECLARATIONS) {
      if (pattern.test(rule.declarations)) {
        out.push({ rule, technique: label });
        break;
      }
    }
  }
  return out;
}

/** Text of every node not inside one of the hidden subtrees. */
function visibleText(page: PageContext, hidden: Set<unknown>): string {
  const $ = page.$;
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (hidden.has(node)) return;
    const tag = (node as { tagName?: string }).tagName?.toLowerCase() ?? '';
    if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
    $el($, node)
      .contents()
      .each((_i, child) => {
        const type = (child as { type?: string }).type;
        if (type === 'text') parts.push($el($, child).text());
        else if (type === 'tag') walk(child);
      });
  };
  $('body').each((_i, body) => walk(body));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

async function survey(ctx: CheckContext): Promise<Survey> {
  const result: Survey = { totalChars: 0, hiddenChars: 0, blocks: [], crossOrigin: 0 };

  for (const page of ctx.pages) {
    const $ = page.$;
    const pageText = $('body').text().replace(/\s+/g, ' ').trim();
    result.totalChars += pageText.length;
    if (!pageText) continue;

    const css = await collectPageCss(ctx, page);
    result.crossOrigin += css.skippedCrossOrigin.length;

    // Candidate elements first, then one pass to drop nested duplicates, so a
    // hidden wrapper is counted once rather than once per hidden descendant.
    const candidates = new Map<unknown, { selector: string; technique: string }>();
    for (const { rule, technique } of hidingRules(css.rules)) {
      try {
        $(rule.selector).each((_i, el) => {
          const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? '';
          if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
          if ($el($, el).closest('body').length === 0) return;
          // Readability drops these already, so their text costs nothing.
          if (inlineHidden(page, el)) return;
          const text = $el($, el).text().replace(/\s+/g, ' ').trim();
          if (!text) return;
          // A short sr-only string is assistive text, not ghost content.
          if (technique === 'clip idiom' && text.length < SR_ONLY_CHARS) return;
          if (!candidates.has(el)) candidates.set(el, { selector: rule.selector, technique });
        });
      } catch {
        // A selector cheerio cannot compile matches nothing rather than
        // throwing the whole audit away.
      }
    }

    const outermost = new Set<unknown>();
    for (const el of candidates.keys()) {
      const hasHiddenAncestor = $el($, el)
        .parents()
        .toArray()
        .some((parent) => candidates.has(parent));
      if (!hasHiddenAncestor) outermost.add(el);
    }

    const visible = shingles(visibleText(page, outermost));
    for (const el of outermost) {
      const { selector, technique } = candidates.get(el)!;
      const text = $el($, el).text().replace(/\s+/g, ' ').trim();
      result.hiddenChars += text.length;
      result.blocks.push({
        pageUrl: page.url,
        selector,
        technique,
        chars: text.length,
        duplicate: overlap(shingles(text), visible) > DUPLICATE_OVERLAP,
        contradictory: CONTRADICTION.test(text),
      });
    }
  }

  result.blocks.sort((a, b) => b.chars - a.chars);
  return result;
}

const EXPECTED =
  'No text hidden by a stylesheet class, or so little of it that an extractor which cannot evaluate CSS still reads the page a human sees';

const SAMPLE = `<!-- Do not ship parallel copies behind display:none. Render one copy and
     let CSS reposition it, or load the alternate view on demand. -->
<nav class="site-nav">...</nav>
<!-- Not: -->
<nav class="site-nav desktop-only">...</nav>
<nav class="site-nav mobile-only">...</nav>   <!-- .mobile-only{display:none} -->`;

export class CssHiddenGhostContentAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/css-hidden-ghost-content',
    category: 'content-extraction',
    title: 'Ghost content: CSS-hidden text ingested as visible',
    failureTitle: 'Ghost content: CSS-hidden text ingested as visible',
    description:
      "Find text that is hidden from human readers by an external stylesheet class but is invisible-as-hidden to every extractor an agent uses, and size it in tokens. Fail if class-hidden text exceeds 15% of the page's total text tokens or 1,000 tokens absolute; separately fail on near-duplicate hidden blocks (a mobile nav or tab-panel set duplicating visible content). Report contradiction risk when hidden text contains prices, availability, or dated claims.",
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/css-hidden-ghost-content.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        "This is provable from source, not inferred. Readability's visibility test consults only node.style.display, node.style.visibility, the hidden attribute and aria-hidden — it explicitly does not evaluate class-based CSS rules from stylesheets. AI crawlers do not render, so no cascade is ever computed. Therefore any subtree hidden by `.mobile-only{display:none}`, `.tab-panel:not(.active){display:none}` or `[data-state=closed]{display:none}` reaches the model as ordinary body text with full weight. Consequence is not just cost: the agent sees three parallel copies of a nav, both the collapsed and expanded FAQ answers, and often stale price text from a hidden variant block, and irrelevant/contradictory context measurably degrades answers.",
      fix: 'Stop shipping parallel copies of the same content behind a hiding class. Render one copy and let CSS reposition or restyle it, or load the alternate view on demand. Where a hidden block must stay in the markup — a collapsed tab panel, an off-canvas menu — add the `hidden` attribute or an inline `display:none` alongside the class, because those are the markers a non-rendering extractor does honour. Keep the visually-hidden idiom for short assistive strings only.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/content-extraction/css-hidden-ghost-content/',
      tags: ['token-economics', 'extraction', 'ghost-content', 'duplication'],
    },
  };

  private recommendation() {
    return {
      priority: 'medium' as const,
      description: CssHiddenGhostContentAudit.meta.description,
      code: SAMPLE,
    };
  }

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const s = await survey(ctx);
    const partial =
      s.crossOrigin > 0 ? `; ${s.crossOrigin} cross-origin stylesheet not fetched` : '';

    if (s.totalChars === 0) {
      return this.notApplicable(
        'No body text on the scanned pages, so there is no ghost content to size.',
        EXPECTED,
        `No body text on the scanned pages${partial}`,
      );
    }

    if (s.blocks.length === 0) {
      return this.pass(
        'No text is hidden by a stylesheet rule an extractor cannot evaluate.',
        EXPECTED,
        `0 est. tokens hidden by CSS class${partial}`,
        ctx.pages[0]?.url,
      );
    }

    const hiddenTokens = Math.round(s.hiddenChars / CHARS_PER_TOKEN);
    const share = s.hiddenChars / s.totalChars;
    const pct = `${(share * 100).toFixed(1)}%`;
    const worst = s.blocks[0]!;
    const duplicates = s.blocks.filter((b) => b.duplicate);
    const contradictory = s.blocks.filter((b) => b.contradictory);
    const found = `${hiddenTokens} est. tokens hidden by CSS class across ${s.blocks.length} block(s), ${pct} of page text${partial}`;

    const detail = `Largest: "${worst.selector}" (${worst.technique}).`;
    const dupeClause =
      duplicates.length > 0
        ? ` ${duplicates.length} block(s) duplicate text that is already visible, so the agent reads the same copy twice.`
        : '';
    const riskClause =
      contradictory.length > 0
        ? ` ${contradictory.length} block(s) carry prices, availability or dated claims that can contradict the visible copy.`
        : '';

    if (
      duplicates.length > 0 ||
      hiddenTokens > HIDDEN_TOKEN_FLOOR ||
      share > HIDDEN_SHARE_FLOOR
    ) {
      return this.fail(
        `${hiddenTokens} est. tokens (${pct} of page text) are hidden only by stylesheet rules, which no non-rendering extractor evaluates. ${detail}${dupeClause}${riskClause}`,
        EXPECTED,
        found,
        this.recommendation(),
        worst.pageUrl,
      );
    }

    return this.warn(
      `${hiddenTokens} est. tokens (${pct} of page text) are hidden only by stylesheet rules, below the 15% and ${HIDDEN_TOKEN_FLOOR}-token thresholds but still ingested. ${detail}${riskClause}`,
      EXPECTED,
      found,
      this.recommendation(),
      worst.pageUrl,
    );
  }
}
