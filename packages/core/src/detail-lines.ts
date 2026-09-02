/**
 * Structured evidence, flattened to what `AuditResultSchema` accepts.
 *
 * `details` admits scalars and bounded string arrays only — at most 100 entries
 * of at most 1000 characters. An audit that attaches its own finding objects
 * throws in the runner, and the runner turns that into a `scan-error` stub, so
 * the audit reports nothing at all on exactly the pages where it found the most
 * to say. Three audits shipped that way and only failed on real storefronts.
 *
 * Every audit that reports a list of findings goes through here.
 */

/** The schema's cap on entries in one `details` array. */
export const MAX_DETAIL_ITEMS = 100;

/** The schema's cap on one entry's length. */
export const MAX_DETAIL_CHARS = 1000;

/**
 * Render findings as report lines that fit the schema.
 *
 * `limit` is how many findings are worth printing, not the schema's ceiling:
 * an audit picks the number a reader can act on, and the ceiling still applies
 * underneath it.
 */
export function detailLines<T>(
  items: readonly T[],
  render: (item: T) => string,
  limit: number = MAX_DETAIL_ITEMS,
): string[] {
  return items
    .slice(0, Math.min(limit, MAX_DETAIL_ITEMS))
    .map((item) => truncateLine(render(item)));
}

/** Cut one line to the schema's per-entry cap, marking where it was cut. */
export function truncateLine(line: string): string {
  if (line.length <= MAX_DETAIL_CHARS) return line;
  return `${line.slice(0, MAX_DETAIL_CHARS - 1)}…`;
}

/** Cap a list of already-rendered strings, so both limits hold. */
export function capDetailList(
  lines: readonly string[],
  limit: number = MAX_DETAIL_ITEMS,
): string[] {
  return detailLines(lines, (line) => line, limit);
}
