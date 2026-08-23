import { encode } from 'gpt-tokenizer/encoding/o200k_base';

/**
 * BPE token counting, in the encoding the models this tool is about actually use.
 *
 * Every "tokens" number in a report is a real `o200k_base` count, never a
 * `chars / 4` estimate. The difference is not cosmetic: base64, minified
 * JavaScript and SVG path data tokenize four to eight times worse than prose,
 * and those are exactly the payloads the token-economics audits are about.
 */

/**
 * Above this many characters the encoder is skipped and the count estimated.
 *
 * Encoding is linear but not free, and a 5 MB document would cost more than the
 * finding is worth. Documents this large are rare and already failing every
 * payload audit; the estimate keeps the scan bounded rather than exact.
 */
const MAX_ENCODED_CHARS = 2_000_000;

/** Characters per token in the estimated tail. Measured on HTML, not on prose. */
const ESTIMATE_CHARS_PER_TOKEN = 3.4;

/** Token count of `text` under `o200k_base`. Empty text costs nothing. */
export function countTokens(text: string): number {
  if (!text) return 0;
  if (text.length <= MAX_ENCODED_CHARS) return encode(text).length;
  const head = encode(text.slice(0, MAX_ENCODED_CHARS)).length;
  return head + Math.round((text.length - MAX_ENCODED_CHARS) / ESTIMATE_CHARS_PER_TOKEN);
}

/**
 * Token counts for a set of named parts, so a report can say where the tokens went.
 *
 * The audits that use this always present the parts beside the whole, which is
 * what makes the finding actionable: "62k tokens, 58k of them one inline style
 * block" names the fix, where "62k tokens" only names the problem.
 */
export function tokenBudget(parts: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, text] of Object.entries(parts)) out[name] = countTokens(text);
  return out;
}
