import type { RegistrySummary } from "@forkpoint/agent-lighthouse-core";

/** `agent-lighthouse --registry`: what the installed registry holds, as text. */
export function formatRegistrySummary(summary: RegistrySummary): string {
  const width = Math.max(...summary.byCategory.map((c) => c.name.length));
  return [
    `Agent Lighthouse core ${summary.version}`,
    `${summary.audits} audits in ${summary.categories} categories, registry mass ${summary.registryMass.toFixed(1)}`,
    `Tiers: ${Object.entries(summary.tiers)
      .map(([tier, count]) => `${count} ${tier}`)
      .join(", ")}`,
    "",
    ...summary.byCategory.map(
      (category) =>
        `  ${category.name.padEnd(width)}  ${String(category.audits).padStart(3)} audits  ${String(category.scored).padStart(3)} scored  mass ${category.registryMass.toFixed(1).padStart(5)}`,
    ),
  ].join("\n");
}
