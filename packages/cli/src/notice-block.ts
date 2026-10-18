import type { CheckResult } from "@forkpoint/agent-lighthouse-core";
import {
  type ReportView,
  NOTICE_LABELS,
  noticeKind,
  noticeText,
} from "@forkpoint/agent-lighthouse-report";

/** One check and its notice, indented under a section heading. */
function noticeEntry(c: CheckResult): string[] {
  if (!c.deprecated) return [`    \x1b[33m!\x1b[0m ${c.title}`];
  return [
    `    \x1b[33m!\x1b[0m ${c.title}`,
    `      ${noticeText(c.deprecated)}`,
    `      \x1b[90m${c.deprecated.link}\x1b[0m`,
  ];
}

/**
 * The terminal's "Obsolete (not scored)" block: what the site still publishes
 * that its consumer retired or ignores. Empty when nothing was found.
 */
export function obsoleteLines(view: ReportView): string[] {
  const { found, absent } = view.obsolete;
  if (found.length === 0) return [];
  const rest =
    absent.length > 0
      ? [
          `    \x1b[90m${absent.length} more obsolete check${absent.length === 1 ? "" : "s"} found nothing.\x1b[0m`,
        ]
      : [];
  return [
    `\x1b[1m🗑  OBSOLETE (not scored):\x1b[0m`,
    `    \x1b[90mStill published, but retired or ignored by its consumer. Never moves the score.\x1b[0m`,
    ...found.flatMap(noticeEntry),
    ...rest,
    "",
  ];
}

/** Notices on checks that ran, grouped under their label. */
export function noticeLines(view: ReportView): string[] {
  const byLabel = new Map<string, CheckResult[]>();
  for (const c of view.notices) {
    if (!c.deprecated) continue;
    const label = NOTICE_LABELS[noticeKind(c.deprecated)];
    byLabel.set(label, [...(byLabel.get(label) ?? []), c]);
  }
  return [...byLabel].flatMap(([label, checks]) => [
    `\x1b[1mℹ  ${label}:\x1b[0m`,
    ...checks.flatMap(noticeEntry),
    "",
  ]);
}
