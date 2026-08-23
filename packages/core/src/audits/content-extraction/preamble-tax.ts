import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { countTokens } from '../../gatherers/tokens';
import { readabilityArticle, semanticText } from '../../gatherers/extraction';

/** Below this the page has no main content to locate, so nothing is measured. */
const MIN_CONTENT_CHARS = 200;

/** How much of the extracted content is used as the search needle. */
const NEEDLE_CHARS = 200;

/** Under this many tokens ahead of the content, the preamble is not a problem. */
const WARN_TOKENS = 2000;

/** Above this, the answer is in the low-recall middle and first to be truncated. */
const FAIL_TOKENS = 10_000;

/** Entities common enough in prose that ignoring them breaks the match. */
const ENTITIES: ReadonlyArray<[string, string]> = [
  ['&amp;', '&'],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#39;', "'"],
  ['&apos;', "'"],
  ['&nbsp;', ' '],
];

/** Blocks whose whole text is invisible to a reader but streamed to an agent. */
const OPAQUE_BLOCK = /<(script|style|template|svg|noscript)\b[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi;

interface Projection {
  /** Visible text of the document with every whitespace character removed. */
  text: string;
  /** For each character of `text`, its offset in the raw body. */
  offsets: number[];
}

/**
 * Project the raw body onto its visible text, keeping a byte offset per character.
 *
 * This is what makes the measurement deterministic rather than a guess: the
 * extracted content is a string with no markup in it, and the question is where
 * that string starts inside a document that is mostly markup. Walking the body
 * once and remembering where each surviving character came from answers it
 * exactly, including when tags sit between two words of a sentence.
 *
 * Whitespace is dropped on both sides of the comparison rather than collapsed.
 * Extractors disagree about whether a tag boundary is a word separator —
 * readability concatenates `<h1>Mugs</h1><p>Sentence` into `MugsSentence` — so
 * any rule about spaces would match one extractor and miss another.
 */
function project(body: string): Projection {
  const text: string[] = [];
  const offsets: number[] = [];
  let i = 0;

  while (i < body.length) {
    if (body.startsWith('<!--', i)) {
      const end = body.indexOf('-->', i);
      i = end === -1 ? body.length : end + 3;
      continue;
    }
    if (body[i] === '<') {
      const tagMatch = /^<\s*(\/?)([a-zA-Z][\w:-]*)/.exec(body.slice(i, i + 32));
      const end = body.indexOf('>', i);
      const name = tagMatch?.[2]?.toLowerCase();
      const closing = tagMatch?.[1] === '/';
      if (end === -1) break;
      if (!closing && name && ['script', 'style', 'template', 'noscript'].includes(name)) {
        const close = body.toLowerCase().indexOf(`</${name}`, end);
        i = close === -1 ? body.length : close;
        continue;
      }
      i = end + 1;
      continue;
    }
    if (body[i] === '&') {
      const entity = ENTITIES.find(([from]) => body.startsWith(from, i));
      if (entity) {
        const decoded = entity[1];
        if (!/\s/.test(decoded)) {
          text.push(decoded);
          offsets.push(i);
        }
        i += entity[0].length;
        continue;
      }
    }
    const char = body[i] as string;
    if (!/\s/.test(char)) {
      text.push(char);
      offsets.push(i);
    }
    i += 1;
  }

  return { text: text.join(''), offsets };
}

/** The heaviest opaque block ahead of the content, with its line number. */
function largestPreambleNode(preamble: string): { label: string; tokens: number; line: number } | undefined {
  let best: { label: string; tokens: number; line: number } | undefined;
  for (const match of preamble.matchAll(OPAQUE_BLOCK)) {
    const tokens = countTokens(match[0]);
    if (best && tokens <= best.tokens) continue;
    const index = match.index ?? 0;
    const label = match[1] ? `<${match[1].toLowerCase()}>` : 'comment';
    best = { label, tokens, line: preamble.slice(0, index).split('\n').length };
  }
  return best;
}

export class PreambleTaxTokensBeforeTheFirstContentTokenAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/preamble-tax',
    category: 'content-extraction',
    title: 'Preamble tax: tokens before the first content token',
    failureTitle: 'The answer sits behind thousands of tokens of preamble',
    description:
      'Measures how many `o200k_base` tokens an agent must stream past before the first sentence of the main content appears, by locating the extracted content inside the raw response body. Reports the offset in tokens and as a share of the document, and names the single heaviest block sitting in front of the content.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier:
      'docs/evidence/audits/content-extraction/preamble-tax.md',
    guidance: {
      impact:
        'A non-rendering agent ingests the document as a linear stream, so DOM order is context order. A page that inlines a critical-CSS block and a serialized state blob ahead of its content does two things at once: it pushes the answer into the middle of the context window, where retrieval is measurably weakest, and it guarantees the answer is what gets cut when the fetching harness truncates to a byte or token cap.',
      fix: 'Move inline `<style>` and `<script>` blocks below the main content or into external files, and put `<main>` as early in the body as the layout allows. Where critical CSS must be inline, keep it to the rules that paint the first screen rather than the whole stylesheet.',
      code: `<!-- The answer arrives 40k tokens in -->
<head><style>/* the entire stylesheet */</style></head>
<body><script>window.__STATE__ = { /* 30k tokens */ }</script>
  <main><h1>How to descale a kettle</h1><p>Fill it with...</p></main>
</body>

<!-- The answer arrives first -->
<head><link rel="stylesheet" href="/app.css"></head>
<body><main><h1>How to descale a kettle</h1><p>Fill it with...</p></main>
  <script src="/state.js" defer></script>
</body>`,
      effort: 'moderate',
      docsUrl:
        'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/content-extraction/preamble-tax.md',
      tags: ['tokens', 'context-window', 'content', 'truncation'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.notApplicable(
        'No page was fetched, so no preamble could be measured.',
        'At least one fetched page',
        'None',
      );
    }

    const html = page.$.html() ?? '';
    const body = page.fetchResult.body ?? '';
    const article = readabilityArticle(html, page.url);
    const extracted = article ?? semanticText(html);

    if (extracted.text.length < MIN_CONTENT_CHARS) {
      return this.notApplicable(
        'No main content long enough to locate in the response body.',
        `At least ${MIN_CONTENT_CHARS} characters of extractable main content`,
        `${extracted.text.length} characters extracted by ${extracted.source}`,
      );
    }

    const projection = project(body);
    const needle = extracted.text.replace(/\s+/g, '').slice(0, NEEDLE_CHARS);
    const at = projection.text.indexOf(needle);

    if (at === -1) {
      // Guessing an offset would invent the finding rather than measure it.
      return this.notApplicable(
        'The extracted main content could not be located in the raw response body, so the preamble was not measured.',
        'Extracted content locatable in the response body',
        `Content extracted by ${extracted.source} does not appear in the served body`,
      );
    }

    const offset = projection.offsets[at] ?? 0;
    const preamble = body.slice(0, offset);
    const preambleTokens = countTokens(preamble);
    const documentTokens = countTokens(body);
    const preambleShare = documentTokens === 0 ? 0 : preambleTokens / documentTokens;
    const largest = largestPreambleNode(preamble);

    const culprit = largest
      ? ` Largest block ahead of the content: ${largest.tokens} tokens, ${largest.label} at line ${largest.line}.`
      : '';
    const found = `${preambleTokens} tokens (${(preambleShare * 100).toFixed(1)}% of the document) precede the first content token, extracted by ${extracted.source}.${culprit}`;
    const expected = `Fewer than ${WARN_TOKENS} tokens before the first content token`;
    const details = {
      preambleTokens,
      documentTokens,
      preambleShare: Number(preambleShare.toFixed(4)),
      extractor: extracted.source,
      largestNodeTokens: largest?.tokens ?? 0,
      largestNode: largest?.label ?? '',
      largestNodeLine: largest?.line ?? 0,
    };

    if (preambleTokens > FAIL_TOKENS) {
      return {
        ...this.fail(
          `An agent streams ${preambleTokens} tokens before reaching your content.`,
          expected,
          found,
          'Move inline style and script blocks below the main content or into external files.',
          page.url,
        ),
        displayValue: `${preambleTokens} tokens of preamble`,
        details,
      };
    }

    if (preambleTokens > WARN_TOKENS) {
      return {
        ...this.warn(
          `An agent streams ${preambleTokens} tokens before reaching your content.`,
          expected,
          found,
          'Move the heaviest inline block below the main content.',
          page.url,
        ),
        displayValue: `${preambleTokens} tokens of preamble`,
        details,
      };
    }

    return {
      ...this.pass(
        `Content starts ${preambleTokens} tokens into the document.`,
        expected,
        found,
        page.url,
      ),
      displayValue: `${preambleTokens} tokens of preamble`,
      details,
    };
  }
}
