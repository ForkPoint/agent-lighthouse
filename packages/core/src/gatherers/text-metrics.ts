/**
 * Text comparison primitives shared by the token-economics and
 * answer-selection audits.
 *
 * Six audits ask the same three questions — is this text the same as that text,
 * how much of it repeats across the site, and where do its sentences end.
 * Written once so two audits cannot answer them differently.
 */

/** Default shingle width. Five words is the width the dossiers specify. */
const DEFAULT_SHINGLE = 5;

/**
 * Abbreviations that end in a period without ending a sentence.
 *
 * Without this list every `e.g.` and `Inc.` splits a sentence in two, which
 * inflates every per-sentence count in this file.
 */
const ABBREVIATION =
  /\b(e\.g|i\.e|etc|vs|approx|no|fig|dr|mr|mrs|ms|prof|st|inc|ltd|co|dept|est|al)\.$/i;

/** Lowercase, collapse whitespace, drop punctuation. The comparison form. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words of the normalized text. */
export function wordCount(text: string): number {
  const normalized = normalizeText(text);
  return normalized === '' ? 0 : normalized.split(' ').length;
}

/**
 * Overlapping n-word shingles of the normalized text.
 *
 * Text shorter than `n` words yields one shingle — the whole text — rather than
 * an empty set, so a short paragraph can still match itself across two pages.
 */
export function shingles(text: string, n: number = DEFAULT_SHINGLE): Set<string> {
  const words = normalizeText(text).split(' ').filter(Boolean);
  if (words.length === 0) return new Set();
  if (words.length <= n) return new Set([words.join(' ')]);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i += 1) out.add(words.slice(i, i + n).join(' '));
  return out;
}

/** Set overlap. Two empty sets are identical, not undefined. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * Where one sentence ends and the next begins.
 *
 * Two boundaries. Terminal punctuation followed by whitespace is the ordinary
 * one. Terminal punctuation followed straight away by a capital is the one that
 * matters for extracted text: an extractor concatenates block elements with no
 * separator, so `<p>...four.</p><p>We ship...` arrives as `four.We ship` and the
 * whitespace boundary alone would read the two paragraphs as one sentence. The
 * character before the period must be lowercase, a digit or a closing mark, so
 * `U.S.A` and other single-letter abbreviations stay whole.
 */
const SENTENCE_BOUNDARY = /(?<=[a-z0-9\u2019'")\]][.!?])(?=[A-Z])|(?<=[.!?])\s+/u;

/**
 * Sentences of `text`.
 *
 * Splits on the boundaries above, then re-joins any piece whose predecessor
 * ended in a known abbreviation. A decimal never splits because neither
 * whitespace nor a capital follows its period.
 */
export function sentences(text: string): string[] {
  const pieces = text.replace(/\s+/g, ' ').trim().split(SENTENCE_BOUNDARY);
  const out: string[] = [];
  for (const piece of pieces) {
    const previous = out[out.length - 1];
    if (previous !== undefined && ABBREVIATION.test(previous)) {
      out[out.length - 1] = `${previous} ${piece}`;
      continue;
    }
    if (piece.trim() !== '') out.push(piece.trim());
  }
  return out;
}
