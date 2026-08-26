// Graduated from proposal 2026-08-22 (Plan 5, Task 9).
// Evidence dossier: docs/evidence/audits/operability-safety/invisible-instruction-scan.md
//
// Scope note (non-double-counting): `content-extraction/css-hidden-ghost-content`
// measures the same hidden text as a token-waste and duplication problem. This
// audit asks a different question of it — does the hidden text read like an
// instruction addressed to an AI — and fails only on that. A page can fail one
// and pass the other.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { collectPageCss, type CssRule } from '../../gatherers/css-rules';

/**
 * Phrases that mark text as an instruction addressed to a model rather than
 * prose addressed to a reader.
 *
 * Exported because `aria-layer-injection-scan` scores the same lexicon against
 * a different set of channels (alt, aria-label, title, option text). One
 * lexicon, two surfaces — duplicating it would let the two drift apart.
 */
export const INSTRUCTION_LEXICON: readonly RegExp[] = [
  /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /\byou are (an?\s+)?(AI|assistant|language model|agent|chatbot)\b/i,
  /^\s*(system|assistant|user|human)\s*:/im,
  /\b(when|if)\s+(you\s+are\s+)?(asked|summari[sz]ing|responding|answering)\b/i,
  /\b(always|never|you must|do not)\s+(recommend|mention|include|say|output|reply|cite)\b/i,
  /<\/?(system|instructions?|prompt)>/i,
  /\b(send|post|forward|exfiltrat\w*)\b.{0,40}\b(email|otp|token|cookie|api[_ -]?key|password)\b/i,
];

/** Inline or resolved declarations that take text out of a human's view. */
const HIDING_DECLARATIONS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /display\s*:\s*none/i, label: 'display:none' },
  { pattern: /visibility\s*:\s*hidden/i, label: 'visibility:hidden' },
  { pattern: /content-visibility\s*:\s*hidden/i, label: 'content-visibility:hidden' },
  { pattern: /font-size\s*:\s*0(\D|$)/i, label: 'font-size:0' },
  { pattern: /opacity\s*:\s*0(\.0+)?(\D|$)/i, label: 'opacity:0' },
  { pattern: /(left|top)\s*:\s*-\d{3,}px/i, label: 'off-screen positioning' },
  { pattern: /text-indent\s*:\s*-\d{3,}px/i, label: 'text-indent off-screen' },
  { pattern: /clip(-path)?\s*:\s*(rect\(\s*0|inset\(\s*50%)/i, label: 'clip idiom' },
];

/** Below this perceptual distance, text is the same colour as its background. */
const DELTA_E_FLOOR = 5;
/** Hidden text longer than this with no lexicon hit is an unexplained payload. */
const UNEXPLAINED_CHARS = 200;
/** The sr-only idiom is legitimate below this length with no lexicon hit. */
const SR_ONLY_CHARS = 120;

/** Class names the visually-hidden idiom is conventionally spelled with. */
const SR_ONLY_CLASS = /\b(sr-only|visually-hidden|visuallyhidden|screen-?reader-?(only|text))\b/i;
/** Class names a skip link is conventionally spelled with. */
const SKIP_LINK_CLASS = /\bskip(-|_)?(link|nav|to)?\b/i;

interface Payload {
  pageUrl: string;
  /** Why the text is not perceivable. */
  technique: string;
  /** The hidden text itself, quoted verbatim in the finding. */
  text: string;
  /** Lexicon patterns that matched. */
  hits: number;
}

interface Survey {
  textNodesSeen: number;
  payloads: Payload[];
  unexplained: Payload[];
  crossOrigin: number;
}

// ── Colour ────────────────────────────────────────────────────

/** Parse `#rgb`, `#rrggbb` or `rgb(r,g,b)` into 0-255 channels. */
function parseColor(value: string): [number, number, number] | undefined {
  const text = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
  if (hex) {
    const digits = hex[1]!;
    const full =
      digits.length === 3
        ? digits
            .split('')
            .map((d) => d + d)
            .join('')
        : digits;
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16),
    ];
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(text);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  if (text === 'white') return [255, 255, 255];
  if (text === 'black') return [0, 0, 0];
  return undefined;
}

/** sRGB to CIE L*a*b*, D65 white point. */
function toLab([r, g, b]: [number, number, number]): [number, number, number] {
  const linear = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const x = (linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047;
  const y = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const z = (linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 colour difference. Below ~5 the two colours are indistinguishable. */
export function deltaE76(a: string, b: string): number | undefined {
  const first = parseColor(a);
  const second = parseColor(b);
  if (!first || !second) return undefined;
  const [l1, a1, b1] = toLab(first);
  const [l2, a2, b2] = toLab(second);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

// ── Style resolution ──────────────────────────────────────────

/**
 * Every declaration block that could apply to this element: its own inline
 * style plus any scanned rule whose selector matches it.
 *
 * No cascade and no specificity: the question is whether *any* rule hides the
 * element, and the matched selector is reported so a human can adjudicate.
 */
function declarationsFor(
  page: PageContext,
  el: unknown,
  rules: CssRule[],
  matchCache: Map<CssRule, Set<unknown>>,
): string[] {
  const $ = page.$;
  const blocks: string[] = [$el($, el).attr('style') ?? ''];
  for (const rule of rules) {
    // @media print hides text from the screen reader's user only when printing;
    // it is not a technique for hiding text from a browsing human.
    if (rule.atRule?.startsWith('media print')) continue;
    let matched = matchCache.get(rule);
    if (!matched) {
      matched = new Set<unknown>();
      const target = matched;
      try {
        $(rule.selector).each((_, node) => {
          target.add(node);
        });
      } catch {
        // A selector cheerio cannot compile matches nothing rather than throwing
        // the whole audit away.
      }
      matchCache.set(rule, matched);
    }
    if (matched.has(el)) blocks.push(rule.declarations);
  }
  return blocks.filter(Boolean);
}

function $el($: PageContext['$'], el: unknown) {
  return $(el as never);
}

/** The nearest ancestor that literally declares a background colour. */
function nearestBackground(page: PageContext, el: unknown): string | undefined {
  const $ = page.$;
  let current: ReturnType<typeof $el> = $el($, el);
  for (let depth = 0; depth < 12 && current.length > 0; depth += 1) {
    const style = current.attr('style') ?? '';
    const match = /background(-color)?\s*:\s*([^;]+)/i.exec(style);
    if (match) return match[2]!.trim();
    current = current.parent() as ReturnType<typeof $el>;
  }
  return undefined;
}

function ownColor(page: PageContext, el: unknown): string | undefined {
  const style = $el(page.$, el).attr('style') ?? '';
  const match = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
  return match?.[1]?.trim();
}

// ── Survey ────────────────────────────────────────────────────

function isAllowlisted(page: PageContext, el: unknown, text: string, hits: number): boolean {
  if (hits > 0) return false;
  const $e = $el(page.$, el);
  const className = $e.attr('class') ?? '';
  // A live region legitimately holds text that is not on screen yet.
  if ($e.attr('aria-live') || $e.closest('[aria-live]').length > 0) return true;
  if (SKIP_LINK_CLASS.test(className)) return true;
  if (SR_ONLY_CLASS.test(className) && text.length < SR_ONLY_CHARS) return true;
  return false;
}

async function survey(ctx: CheckContext): Promise<Survey> {
  const result: Survey = { textNodesSeen: 0, payloads: [], unexplained: [], crossOrigin: 0 };

  for (const page of ctx.pages) {
    const $ = page.$;
    const css = await collectPageCss(ctx, page);
    result.crossOrigin += css.skippedCrossOrigin.length;
    const matchCache = new Map<CssRule, Set<unknown>>();

    $('body *').each((_, el) => {
      const $e = $(el);
      const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? '';
      if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
      // Only the element that directly holds the text, so a hidden wrapper is
      // reported once rather than once per descendant.
      const text = $e
        .contents()
        .filter((_i, node) => (node as { type?: string }).type === 'text')
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) return;
      result.textNodesSeen += 1;

      const technique = hidingTechnique(page, el, css.rules, matchCache);
      if (!technique) return;

      const hits = INSTRUCTION_LEXICON.filter((re) => re.test(text)).length;
      if (isAllowlisted(page, el, text, hits)) return;

      const payload: Payload = { pageUrl: page.url, technique, text, hits };
      if (hits > 0) result.payloads.push(payload);
      else if (text.length > UNEXPLAINED_CHARS) result.unexplained.push(payload);
    });
  }

  return result;
}

/** Why this element's text is not perceivable, or undefined when it is. */
function hidingTechnique(
  page: PageContext,
  el: unknown,
  rules: CssRule[],
  matchCache: Map<CssRule, Set<unknown>>,
): string | undefined {
  const $e = $el(page.$, el);
  if ($e.attr('hidden') !== undefined) return 'hidden attribute';
  if (($e.attr('aria-hidden') ?? '').toLowerCase() === 'true') return 'aria-hidden="true"';

  // An ancestor hiding the subtree hides this text too.
  for (const block of declarationsFor(page, el, rules, matchCache)) {
    for (const { pattern, label } of HIDING_DECLARATIONS) {
      if (pattern.test(block)) return label;
    }
  }
  const $hiddenAncestor = $e.parents().filter((_i, parent) => {
    for (const block of declarationsFor(page, parent, rules, matchCache)) {
      for (const { pattern } of HIDING_DECLARATIONS) if (pattern.test(block)) return true;
    }
    return false;
  });
  if ($hiddenAncestor.length > 0) return 'hidden ancestor';

  const color = ownColor(page, el);
  const background = color ? nearestBackground(page, $e.parent().get(0)) : undefined;
  if (color && background) {
    const distance = deltaE76(color, background);
    if (distance !== undefined && distance < DELTA_E_FLOOR) {
      return `colour within deltaE ${distance.toFixed(1)} of its background`;
    }
  }
  return undefined;
}

const EXPECTED =
  'No text that a human cannot perceive carries an instruction addressed to an AI agent';

const SAMPLE = `<!-- Remove the payload. If the text is for assistive tech, keep it short,
     keep it free of instructions, and use the sr-only idiom. -->
<span class="sr-only">Search products</span>`;

export class InvisibleInstructionScanAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/invisible-instruction-scan',
    category: 'operability-safety',
    title: 'Invisible Instruction Payload Scan',
    failureTitle: 'Invisible Instruction Payload Scan',
    description:
      'Detect text that is present in the byte stream or DOM but not perceivable by a human, and that reads like an instruction addressed to an AI. Covers CSS-hidden text (color ≈ background, font-size:0, opacity:0, off-screen absolute positioning, zero-size + overflow:hidden, visibility:hidden, display:none), plus channels that never render at all: HTML comments, <noscript>, <template>, oversized data-* attribute values, <script type="text/plain">/application/json blobs, non-standard <meta name> content, and inline <svg><text> with fill-opacity:0 or display:none.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/invisible-instruction-scan.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'critical',
    guidance: {
      impact:
        "If a page carries text nodes that a sighted human cannot perceive but that survive DOM-to-text serialization, an LLM browsing agent ingests them with the same weight as body copy and can act on them. Brave demonstrated exactly this against Comet (white-on-white text, HTML comments, invisible elements hidden in a Reddit spoiler tag) and confirmed Opera Neon was exploitable through 'hidden HTML elements and other non-rendered markup'. Falsifier: an agent that ingests only visually perceivable, rendered text would be immune — the disclosed incidents show current agents are not. Google's spam policy independently enumerates the same hiding techniques and their legitimate exceptions, giving the detector a canonical technique list and a false-positive allowlist.",
      fix: 'Remove the hidden text. If it exists for assistive technology, keep it short, keep it free of anything that reads as an instruction, and use the visually-hidden idiom (class="sr-only") so it is announced rather than concealed. If a third party injected it, treat the page as compromised: hidden instruction text is how the disclosed Comet and Opera Neon attacks worked.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/invisible-instruction-scan/',
      tags: ['injection-safety', 'prompt-injection', 'hidden-text', 'security', 'agent-safety'],
    },
  };

  private recommendation() {
    return {
      priority: 'critical' as const,
      description: InvisibleInstructionScanAudit.meta.description,
      code: SAMPLE,
    };
  }

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const s = await survey(ctx);

    const partial = s.crossOrigin > 0 ? `; ${s.crossOrigin} cross-origin stylesheet not fetched` : '';

    if (s.textNodesSeen === 0) {
      return this.notApplicable(
        'No body text on the scanned pages, so there is nothing to hide an instruction in.',
        EXPECTED,
        `No body text on the scanned pages${partial}`,
      );
    }

    if (s.payloads.length > 0) {
      const worst = s.payloads[0]!;
      const quoted = worst.text.length > 300 ? `${worst.text.slice(0, 297)}...` : worst.text;
      return this.fail(
        `${s.payloads.length} block(s) of text that a human cannot perceive carry instructions addressed to an AI. Hidden by ${worst.technique}: "${quoted}"`,
        EXPECTED,
        `${s.payloads.length} hidden instruction payload(s)${partial}`,
        this.recommendation(),
        worst.pageUrl,
      );
    }

    if (s.unexplained.length > 0) {
      const worst = s.unexplained[0]!;
      return this.warn(
        `${s.unexplained.length} block(s) of text over ${UNEXPLAINED_CHARS} characters are hidden from a human by ${worst.technique} and match no instruction pattern — an unexplained payload an agent still ingests.`,
        EXPECTED,
        `${s.unexplained.length} unexplained hidden payload(s)${partial}`,
        this.recommendation(),
        worst.pageUrl,
      );
    }

    return this.pass(
      'No text hidden from a human carries an instruction addressed to an AI.',
      EXPECTED,
      `${s.textNodesSeen} text block(s) scanned, no hidden instruction payload${partial}`,
      ctx.pages[0]?.url,
    );
  }
}
