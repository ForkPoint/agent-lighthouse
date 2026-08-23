import type { AuditTier } from "@forkpoint/agent-lighthouse-core";

/**
 * A check whose tier is not `scored` is reported but never moves a score.
 * Without a marker, a failing advisory reads as work the operator owes.
 */
export function tierMarker(tier?: AuditTier): string {
  if (tier === "informative") return " \x1b[36m(advisory)\x1b[0m";
  if (tier === "experimental") return " \x1b[36m(experimental)\x1b[0m";
  return "";
}
