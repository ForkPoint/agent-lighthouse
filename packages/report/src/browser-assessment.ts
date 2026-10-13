import type { BrowserAssessment } from "@forkpoint/agent-lighthouse-core/contracts";
import {
  CaptureSource,
  CheckStatus,
} from "@forkpoint/agent-lighthouse-core/contracts";

/** Strip terminal controls from all uploaded metadata and audit text. */
function plain(value: string): string {
  // Client text must not emit terminal escape or control sequences.
  // oxlint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");
}

/**
 * Capture metadata is client text. Keep each value on its own line, so a saved
 * report from before label validation still cannot forge report lines or end
 * the Markdown block it renders into.
 */
function oneLine(value: string): string {
  return value.replace(/[\r\n\u2028\u2029]+/g, " ");
}

export function formatBrowserAssessment(assessment: BrowserAssessment): string {
  const lines = [
    "Browser agent assessment — unscored",
    assessment.unscoredReason,
    `Coverage: ${assessment.coverage.assessed}/${assessment.coverage.eligible} eligible audit/page pairs assessed (includes completed not-applicable checks).`,
    "Capture conditions (client-provided):",
  ];
  for (const capture of assessment.captures) {
    const source =
      capture.captureSource === CaptureSource.CurrentTab
        ? "Current tab"
        : "Fresh browser";
    lines.push(
      `${source}: ${capture.requestedUrl}`,
      `Captured URL: ${capture.capturedUrl}`,
      `Captured at: ${capture.capturedAt}; document: ${capture.documentState}; collector: ${oneLine(capture.collector.name)} ${oneLine(capture.collector.version)}`,
      `Truncated: ${capture.truncation.truncated}; redacted: ${capture.redaction.redacted}${capture.redaction.fields.length ? ` (${capture.redaction.fields.map(oneLine).join(", ")})` : ""}`,
    );
  }
  lines.push("DOM findings (no action execution):");
  for (const finding of assessment.findings) {
    const check = finding.check;
    const source =
      finding.captureSource === CaptureSource.CurrentTab
        ? "Current tab"
        : "Fresh browser";
    lines.push(
      `[${check.id}] ${check.status.toUpperCase()} — ${check.title}`,
      `${source} / browser-snapshot: ${finding.pageUrl}`,
      check.description,
      check.explanation ?? check.displayValue ?? "No explanation.",
    );
    if (check.status === CheckStatus.Fail || check.status === CheckStatus.Warn)
      lines.push(`Fix: ${check.fix}`);
  }
  if (assessment.missingEvidence.length) {
    lines.push("Missing evidence:");
    for (const missing of assessment.missingEvidence)
      lines.push(`[${missing.auditId}] ${missing.pageUrl}: ${missing.reason}`);
  }
  for (const group of assessment.notEligible)
    lines.push(
      `Not eligible for snapshot evidence (${group.auditIds.length} audit${group.auditIds.length === 1 ? "" : "s"}): ${group.reason}`,
      group.auditIds.join(", "),
    );
  lines.push("Evidence limits:", ...assessment.limits);
  return plain(lines.join("\n"));
}
