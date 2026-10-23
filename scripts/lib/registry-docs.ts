/**
 * Registry numbers in the docs, filled from `getRegistrySummary()` so no
 * count is maintained by hand. `pnpm build:audit-map` writes them and
 * `pnpm check:audit-map` rejects a stale copy.
 *
 * - Inline: `<!-- registry:audits -->222<!-- /registry:audits -->`. The
 *   comments are invisible on GitHub, npm and the website; the generator
 *   rewrites only the text between them. Keys are `REGISTRY_KEYS`.
 * - Block: the category table in docs/scoring.md, between
 *   `SCORING_TABLE_START` and `SCORING_TABLE_END`.
 */
import type { RegistrySummary } from "#core/registry-summary";
import { AuditTier } from "#core/types";

export const SCORING_TABLE_START = "<!-- scoring-table:start -->";
export const SCORING_TABLE_END = "<!-- scoring-table:end -->";

/** Every inline value a document may name, by marker key. */
export function registryValues(
  summary: RegistrySummary,
): Record<string, string> {
  return {
    audits: String(summary.audits),
    categories: String(summary.categories),
    scored: String(summary.tiers[AuditTier.Scored]),
    informative: String(summary.tiers[AuditTier.Informative]),
    experimental: String(summary.tiers[AuditTier.Experimental]),
    obsolete: String(summary.tiers[AuditTier.Obsolete]),
    "registry-mass": summary.registryMass.toFixed(1),
  };
}

const INLINE = /<!-- registry:([a-z-]+) -->[^<]*<!-- \/registry:([a-z-]+) -->/g;

/** Rewrite every inline registry value; throws on an unknown or unpaired key. */
export function withRegistryValues(
  doc: string,
  summary: RegistrySummary,
): string {
  const values = registryValues(summary);
  return doc.replace(INLINE, (_match, key: string, closing: string) => {
    if (key !== closing)
      throw new Error(`registry:${key} is closed by /registry:${closing}`);
    const value = values[key];
    if (value === undefined)
      throw new Error(
        `Unknown registry key "${key}"; use one of ${Object.keys(values).join(", ")}`,
      );
    return `<!-- registry:${key} -->${value}<!-- /registry:${key} -->`;
  });
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

/** The docs/scoring.md block, markers excluded. */
export function scoringSummary(summary: RegistrySummary): string {
  // Heaviest category first; equal masses fall back to the name.
  const categories = [...summary.byCategory].sort(
    (a, b) => b.registryMass - a.registryMass || a.name.localeCompare(b.name),
  );
  const sentence =
    `The current registry has ${summary.audits} audits: ` +
    `${summary.tiers[AuditTier.Scored]} scored, ` +
    `${summary.tiers[AuditTier.Informative]} informative, ` +
    `${summary.tiers[AuditTier.Experimental]} experimental, ` +
    `${summary.tiers[AuditTier.Obsolete]} obsolete, ` +
    `with a total registry mass of ${summary.registryMass.toFixed(1)}:`;
  return `${sentence}\n\n${table(
    ["Category", "Audits", "Scored", "Registry mass"],
    categories.map((category) => [
      category.name,
      String(category.audits),
      String(category.scored),
      category.registryMass.toFixed(1),
    ]),
  )}`;
}

/** Replace the block between the markers; throws when they are missing. */
export function withScoringSummary(doc: string, block: string): string {
  const start = doc.indexOf(SCORING_TABLE_START);
  const end = doc.indexOf(SCORING_TABLE_END);
  if (start === -1 || end < start) {
    throw new Error(
      `docs/scoring.md needs ${SCORING_TABLE_START} and ${SCORING_TABLE_END}`,
    );
  }
  return (
    doc.slice(0, start + SCORING_TABLE_START.length) +
    `\n\n${block}\n\n` +
    doc.slice(end)
  );
}

/** How far from the current total a typed number still reads as the total. */
const NEAR_TOTAL = 20;
const BARE_COUNT =
  /\b(\d{1,4})\s+(?:(?:registered|active|shipping|scored)\s+)?(?:audits|checks)\b/gi;
const DATED = /\b\d{4}-\d{2}-\d{2}\b/;

/**
 * Lines that type the registry total by hand: a number near the current
 * total followed by "audits" or "checks", outside a registry marker. A dated
 * line is history and stays as written, the scoring table block is
 * generated, and `<!-- registry-ignore -->` exempts any other line that
 * means a different set.
 */
export function bareRegistryCounts(
  doc: string,
  summary: RegistrySummary,
): string[] {
  let generated = false;
  return doc.split("\n").flatMap((line, index) => {
    // The scoring table block is written by the generator itself.
    if (line.includes(SCORING_TABLE_START)) generated = true;
    if (line.includes(SCORING_TABLE_END)) generated = false;
    if (
      generated ||
      DATED.test(line) ||
      line.includes("<!-- registry-ignore -->")
    )
      return [];
    const outside = line.replace(INLINE, "");
    return [...outside.matchAll(BARE_COUNT)]
      .filter(
        (match) => Math.abs(Number(match[1]) - summary.audits) <= NEAR_TOTAL,
      )
      .map((match) => `line ${index + 1}: "${match[0]}"`);
  });
}
