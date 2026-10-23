/**
 * The registry summary in docs/scoring.md: audit counts by tier and the
 * per-category table. Generated from audit metadata so the numbers cannot
 * drift from the registry; `pnpm build:audit-map` writes it and
 * `pnpm check:audit-map` rejects a stale copy.
 */
import { CATEGORY_NAMES } from "#core/contracts";
import type { AuditMeta } from "#core/types";
import { AuditTier } from "#core/types";

export const SCORING_TABLE_START = "<!-- scoring-table:start -->";
export const SCORING_TABLE_END = "<!-- scoring-table:end -->";

/** Round a summed weight to one decimal, as the table prints it. */
function mass(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** A Markdown table padded the way Prettier pads it, so format:check agrees. */
function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => row[column]!.length)),
  );
  const line = (cells: string[]) =>
    `| ${cells
      .map((cell, column) =>
        column === 0
          ? cell.padEnd(widths[column]!)
          : cell.padStart(widths[column]!),
      )
      .join(" | ")} |`;
  const rule = `| ${widths
    .map((width, column) =>
      column === 0 ? `:${"-".repeat(width - 1)}` : `${"-".repeat(width - 1)}:`,
    )
    .join(" | ")} |`;
  return [line(headers), rule, ...rows.map(line)].join("\n");
}

/** The generated block, markers excluded. */
export function scoringSummary(metas: readonly AuditMeta[]): string {
  const count = (tier: AuditTier) =>
    metas.filter((meta) => meta.tier === tier).length;
  const total = metas.reduce((sum, meta) => sum + meta.weight, 0);
  const categories = Object.keys(CATEGORY_NAMES).map((category) => {
    const members = metas.filter((meta) => meta.category === category);
    return {
      name: CATEGORY_NAMES[category]!,
      audits: members.length,
      scored: members.filter((meta) => meta.tier === AuditTier.Scored).length,
      mass: members.reduce((sum, meta) => sum + meta.weight, 0),
    };
  });
  // Heaviest category first; equal masses fall back to the name.
  categories.sort(
    (a, b) =>
      Math.round(b.mass * 10) - Math.round(a.mass * 10) ||
      a.name.localeCompare(b.name),
  );
  const sentence =
    `The current registry has ${metas.length} audits: ` +
    `${count(AuditTier.Scored)} scored, ` +
    `${count(AuditTier.Informative)} informative, ` +
    `${count(AuditTier.Experimental)} experimental, ` +
    `${count(AuditTier.Obsolete)} obsolete, ` +
    `with a total registry mass of ${mass(total)}:`;
  return `${sentence}\n\n${table(
    ["Category", "Audits", "Scored", "Registry mass"],
    categories.map((category) => [
      category.name,
      String(category.audits),
      String(category.scored),
      mass(category.mass),
    ]),
  )}`;
}

/** Replace the block between the markers; throws when they are missing. */
export function withScoringSummary(doc: string, summary: string): string {
  const start = doc.indexOf(SCORING_TABLE_START);
  const end = doc.indexOf(SCORING_TABLE_END);
  if (start === -1 || end < start) {
    throw new Error(
      `docs/scoring.md needs ${SCORING_TABLE_START} and ${SCORING_TABLE_END}`,
    );
  }
  return (
    doc.slice(0, start + SCORING_TABLE_START.length) +
    `\n\n${summary}\n\n` +
    doc.slice(end)
  );
}
