import {
  HostStopReason,
  type ScanConditions,
} from "@forkpoint/agent-lighthouse-core";

const REASON_TEXT: Record<HostStopReason, string> = {
  [HostStopReason.TooManyRequests]: "after HTTP 429",
  [HostStopReason.Forbidden]: "after HTTP 403",
  [HostStopReason.Unavailable]: "after two HTTP 503 responses",
  [HostStopReason.RetryAfterTooLong]:
    "after a Retry-After longer than the scan",
};

/**
 * One sentence on a scheduler stop that cost the audits requests, or
 * undefined when nothing was lost or the report predates the block.
 */
export function describeRequestStop(
  stop: ScanConditions["requestStop"],
): string | undefined {
  if (!stop?.stopped || stop.unsentCount === 0) return undefined;
  const why = stop.reason ? ` ${REASON_TEXT[stop.reason]}` : "";
  return `The site paused the scan${why}: ${stop.unsentCount} audit request(s) were not sent, affecting at least ${stop.affectedAuditCount} audit(s) and ${stop.affectedMass} scored mass. Those audits report the URLs they could not read.`;
}
