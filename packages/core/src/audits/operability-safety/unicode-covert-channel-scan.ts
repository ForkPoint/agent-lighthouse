// Graduated from proposal 2026-08-23 (Plan 5b, Wave A, Task 7).
// Evidence dossier: docs/evidence/audits/operability-safety/unicode-covert-channel-scan.md
//
// Scope note (non-double-counting): `invisible-instruction-scan` looks for text
// a stylesheet hides from a human and asks whether it reads like an instruction
// addressed to a model. This audit looks at text nothing hides — it is in plain
// sight and still unreadable, because the codepoints themselves render as
// nothing. A page can fail one and pass the other.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';

/** Attributes whose value reaches a model as ordinary text. */
const SCANNED_ATTRIBUTES = [
  'alt',
  'title',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'placeholder',
  'value',
  'content',
  'label',
];

/** Root files an agent ingests with high trust and a human rarely reads. */
const ROOT_FILES = ['/robots.txt', '/llms.txt', '/sitemap.xml'];

/** The Unicode Tags block. It mirrors ASCII and renders as nothing. */
const TAG_BLOCK = /[\u{E0000}-\u{E007F}]+/gu;

/** Bidi controls that open a scope, and the ones that close it. */
const BIDI_PUSH = /[‪‫‭‮⁦⁧⁨]/g;
const BIDI_POP = /[‬⁩]/g;

/** Scripts that legitimately need a bidi scope. */
const RTL_SCRIPT = /[֐-׿؀-ۿ܀-ݏހ-޿ࢠ-ࣿיִ-﷿ﹰ-﻿]/;

/** Zero-width and invisible joiners. */
const ZERO_WIDTH = /[​‌‍⁠﻿]/g;

/** Soft hyphen and the Hangul filler characters used the same way. */
const FILLER = /[­ᅟᅠㅤﾠ]/g;

/** Above this many zero-width characters on one page, it is a channel. */
const ZERO_WIDTH_FLOOR = 20;

/** A letter on either side of an invisible character means it is mid-word. */
const LETTER = /\p{L}|\p{N}/u;

/** Emoji, whose ZWJ sequences are the one legitimate use of U+200D. */
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

/** Scripts whose shaping legitimately uses ZWJ and ZWNJ. */
const JOINING_SCRIPT = /[؀-ۿऀ-෿က-႟]/;

/** How much of a decoded payload to print. */
const MAX_PAYLOAD = 120;

type Kind = 'tag-block' | 'bidi' | 'zero-width' | 'filler';

interface Hit {
  kind: Kind;
  /** Where it was found, in words a human can act on. */
  source: string;
  /** The decoded sentence for a tag-block run; empty otherwise. */
  decoded: string;
  /** The raw characters, escaped so the report cannot re-hide them. */
  escaped: string;
  count: number;
}

/** Every codepoint as `\u{XXXX}`, so a copied report stays visible. */
function escape(text: string): string {
  return [...text]
    .map((c) => `\\u{${c.codePointAt(0)!.toString(16).toUpperCase()}}`)
    .join('');
}

/** The ASCII a tag-block run mirrors. */
function decodeTags(run: string): string {
  return [...run].map((c) => String.fromCharCode(c.codePointAt(0)! - 0xe0000)).join('');
}

function scan(text: string, source: string): Hit[] {
  if (!text) return [];
  const hits: Hit[] = [];

  // (1) The tag block has no legitimate web use at all, so one run is enough.
  for (const match of text.matchAll(TAG_BLOCK)) {
    const run = match[0];
    hits.push({
      kind: 'tag-block',
      source,
      decoded: decodeTags(run).slice(0, MAX_PAYLOAD),
      escaped: escape(run.slice(0, 8)),
      count: [...run].length,
    });
  }

  // (2) A scope that opens and never closes changes the reading order of
  // everything after it, which is the Trojan Source class.
  const pushes = (text.match(BIDI_PUSH) ?? []).length;
  const pops = (text.match(BIDI_POP) ?? []).length;
  if (pushes !== pops) {
    const first = /[‪-‮⁦-⁩]/.exec(text)?.[0] ?? '';
    hits.push({
      kind: 'bidi',
      source,
      decoded: '',
      escaped: escape(first),
      count: Math.abs(pushes - pops),
    });
  } else if (pushes > 0 && !RTL_SCRIPT.test(text)) {
    // Balanced, but around text that never needed a direction scope.
    hits.push({
      kind: 'bidi',
      source,
      decoded: '',
      escaped: escape(/[‪-‮⁦-⁩]/.exec(text)?.[0] ?? ''),
      count: pushes,
    });
  }

  // (3) A zero-width character between two letters splits a word for every
  // substring match without changing what a reader sees.
  const chars = [...text];
  let zeroWidth = 0;
  let firstZeroWidth = '';
  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i]!;
    if (!ZERO_WIDTH.test(c)) continue;
    ZERO_WIDTH.lastIndex = 0;
    const before = chars[i - 1] ?? '';
    const after = chars[i + 1] ?? '';
    // An emoji ZWJ sequence and Arabic or Indic shaping are the legitimate uses.
    if (PICTOGRAPHIC.test(before) || PICTOGRAPHIC.test(after)) continue;
    if (JOINING_SCRIPT.test(before) || JOINING_SCRIPT.test(after)) continue;
    if (!LETTER.test(before) || !LETTER.test(after)) continue;
    zeroWidth += 1;
    if (!firstZeroWidth) firstZeroWidth = c;
  }
  if (zeroWidth > 0) {
    hits.push({
      kind: 'zero-width',
      source,
      decoded: '',
      escaped: escape(firstZeroWidth),
      count: zeroWidth,
    });
  }

  // (4) Soft hyphens and Hangul fillers do the same job with different bytes.
  let filler = 0;
  let firstFiller = '';
  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i]!;
    if (!FILLER.test(c)) continue;
    FILLER.lastIndex = 0;
    if (!LETTER.test(chars[i - 1] ?? '') || !LETTER.test(chars[i + 1] ?? '')) continue;
    filler += 1;
    if (!firstFiller) firstFiller = c;
  }
  if (filler > 0) {
    hits.push({ kind: 'filler', source, decoded: '', escaped: escape(firstFiller), count: filler });
  }

  return hits;
}

/** Every string value in a JSON-LD block, however deeply nested. */
function jsonStrings(node: unknown, out: string[]): void {
  if (typeof node === 'string') {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) jsonStrings(item, out);
    return;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) jsonStrings(value, out);
  }
}

function scanPage(page: PageContext): Hit[] {
  const $ = page.$;
  const hits: Hit[] = [];
  const where = `page ${page.url}`;

  // Script and style bodies never reach a reader or a model as prose.
  const $body = $('body').clone();
  $body.find('script, style, noscript').remove();
  hits.push(...scan($body.text(), where));

  for (const name of SCANNED_ATTRIBUTES) {
    $(`[${name}]`).each((_i, node) => {
      const value = $(node as never).attr(name) ?? '';
      hits.push(...scan(value, `${where} (${name})`));
    });
  }

  $('[href], [src]').each((_i, node) => {
    const $n = $(node as never);
    for (const name of ['href', 'src']) {
      const raw = $n.attr(name);
      if (!raw) continue;
      let value = raw;
      try {
        value = decodeURIComponent(raw);
      } catch {
        // A stray `%` is legal in a URL; the raw value still carries the
        // codepoints this audit is looking for.
      }
      hits.push(...scan(value, `${where} (${name})`));
    }
  });

  const strings: string[] = [];
  for (const block of page.jsonLd) jsonStrings(block, strings);
  for (const value of strings) hits.push(...scan(value, `${where} (JSON-LD)`));

  return hits;
}

const EXPECTED =
  'No text on the site or in its root files carries codepoints that render as nothing: no Unicode Tags block, no unbalanced bidi override, and no zero-width or filler characters splitting words';

const SAMPLE = `# Find them before shipping. Every one of these renders as nothing.
grep -P '[\\x{E0000}-\\x{E007F}]' page.html      # Unicode Tags block
grep -P '[\\x{202A}-\\x{202E}\\x{2066}-\\x{2069}]' page.html   # bidi controls
grep -P '[\\x{200B}-\\x{200D}\\x{2060}\\x{FEFF}\\x{00AD}]' page.html  # zero-width and soft hyphen`;

export class UnicodeCovertChannelScanAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/unicode-covert-channel-scan',
    category: 'operability-safety',
    title: 'Invisible codepoints carrying hidden text',
    failureTitle: 'Invisible codepoints carrying hidden text',
    description:
      'Scans rendered text, the attributes an agent reads, every JSON-LD string value and the site’s root files for codepoints that carry information invisibly: the Unicode Tags block (U+E0000–U+E007F), bidirectional overrides and isolates (U+202A–U+202E, U+2066–U+2069), and zero-width or filler characters (U+200B–U+200D, U+2060, U+FEFF, U+00AD, U+115F, U+1160, U+3164, U+FFA0). Decodes any tag-block run back to ASCII and prints the invisible sentence sitting on the page.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/unicode-covert-channel-scan.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'critical',
    guidance: {
      impact:
        'Tag-block codepoints mirror ASCII and, per Unicode, render as nothing in tag-unaware implementations — while modern LLM tokenizers process them normally. A complete instruction can therefore ride inside a product description that no human and no visual QA pass can see. Bidi controls make the rendered order differ from the logical order a text-extracting agent reads, which is the Trojan Source class (CVE-2021-42574). Zero-width characters defeat naive substring matching on both sides at once: the site’s own filters and the agent’s. None of this is visible in a screenshot, a browser, or a review — only in the bytes.',
      fix: 'Strip these codepoints at the boundary where text enters the site: user-generated content, imported feeds, translated copy, and anything pasted from a rich-text editor. Reject the Unicode Tags block outright — it has no legitimate web use. Allow bidi controls only in balanced pairs and only around text that is actually right-to-left. Allow ZWJ and ZWNJ only inside emoji sequences and in scripts whose shaping needs them. Run the same filter over robots.txt, llms.txt and sitemap.xml, which agents ingest with high trust and humans almost never read.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/unicode-covert-channel-scan/',
      tags: ['injection-safety', 'unicode', 'prompt-injection'],
    },
  };

  private recommendation() {
    return {
      priority: 'critical' as const,
      description: UnicodeCovertChannelScanAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const hits: Hit[] = [];
    for (const page of ctx.pages) hits.push(...scanPage(page));
    for (const path of ROOT_FILES) {
      const file = ctx.rootFiles[path];
      if (file?.status !== 200 || !file.body) continue;
      hits.push(...scan(file.body, path));
    }

    if (ctx.pages.length === 0 && Object.keys(ctx.rootFiles).length === 0) {
      return this.notApplicable(
        'No page and no root file was fetched, so there is no text to scan.',
        EXPECTED,
        'Nothing scanned',
      );
    }

    const byKind = (kind: Kind) => hits.filter((h) => h.kind === kind);
    const tagBlock = byKind('tag-block');
    const bidi = byKind('bidi');
    const zeroWidth = byKind('zero-width').reduce((n, h) => n + h.count, 0);
    const filler = byKind('filler').reduce((n, h) => n + h.count, 0);
    const details = {
      tagBlockRuns: tagBlock.length,
      bidiFindings: bidi.length,
      zeroWidthCount: zeroWidth,
      fillerCount: filler,
    };

    if (hits.length === 0) {
      return {
        ...this.pass(
          'No invisible codepoint carries text on the scanned pages or in the root files.',
          EXPECTED,
          'No Unicode covert channel found',
          ctx.pages[0]?.url,
        ),
        details,
      };
    }

    const parts = hits
      .slice(0, 5)
      .map((h) => `${h.kind} in ${h.source}: ${h.escaped}${h.count > 1 ? ` ×${h.count}` : ''}`);
    const found = parts.join('; ');

    if (tagBlock.length > 0) {
      const worst = tagBlock[0]!;
      return {
        ...this.fail(
          `The Unicode Tags block carries ${worst.count} codepoint(s) in ${worst.source}, which decode to: "${worst.decoded}". Nothing renders them, and every modern tokenizer reads them.`,
          EXPECTED,
          found,
          this.recommendation(),
          ctx.pages[0]?.url,
        ),
        displayValue: found,
        details,
      };
    }

    if (bidi.length > 0) {
      const worst = bidi[0]!;
      return {
        ...this.fail(
          `A bidirectional control in ${worst.source} opens a direction scope the text never closes, or opens one around text that is not right-to-left. The order a reader sees and the order an extractor reads are then different.`,
          EXPECTED,
          found,
          this.recommendation(),
          ctx.pages[0]?.url,
        ),
        displayValue: found,
        details,
      };
    }

    if (zeroWidth > ZERO_WIDTH_FLOOR) {
      return {
        ...this.fail(
          `${zeroWidth} zero-width character(s) sit mid-word across the scanned text, past the ${ZERO_WIDTH_FLOOR} that could be an encoding accident. At this density they are a channel, not a stray paste.`,
          EXPECTED,
          found,
          this.recommendation(),
          ctx.pages[0]?.url,
        ),
        displayValue: found,
        details,
      };
    }

    return {
      ...this.warn(
        `${zeroWidth + filler} invisible character(s) split words in the scanned text. Each one breaks a substring match without changing what a reader sees.`,
        EXPECTED,
        found,
        this.recommendation(),
        ctx.pages[0]?.url,
      ),
      displayValue: found,
      details,
    };
  }
}
