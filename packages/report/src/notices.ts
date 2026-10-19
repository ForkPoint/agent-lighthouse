import type {
  CheckResult,
  DeprecationNotice,
} from "@forkpoint/agent-lighthouse-core";
import { CheckStatus, NoticeKind } from "@forkpoint/agent-lighthouse-core";

/** Heading each surface prints above a notice, by kind. */
export const NOTICE_LABELS: Record<NoticeKind, string> = {
  [NoticeKind.Deprecated]: "Deprecated — no longer a factor",
  [NoticeKind.Obsolete]: "Obsolete",
  [NoticeKind.Unconsumed]: "No AI vendor reads this",
};

/** Link text for the notice's source, by kind. */
export const NOTICE_LINK_LABELS: Record<NoticeKind, string> = {
  [NoticeKind.Deprecated]: "Why this is not a factor",
  [NoticeKind.Obsolete]: "Source",
  [NoticeKind.Unconsumed]: "Evidence",
};

/** A notice without a kind predates 9.0, when every notice was a deprecation. */
export function noticeKind(notice: DeprecationNotice): NoticeKind {
  return notice.kind ?? NoticeKind.Deprecated;
}

/** The notice line with its replacement, as plain text. */
export function noticeText(notice: DeprecationNotice): string {
  return notice.replacement
    ? `${notice.notice} Instead: ${notice.replacement}`
    : notice.notice;
}

/**
 * Checks outside the obsolete section whose notice the owner should read: they
 * reached a verdict and carry a notice. A not-applicable check found nothing,
 * so its notice has nothing to qualify.
 */
export function noticedChecks(checks: CheckResult[]): CheckResult[] {
  return checks.filter(
    (c) =>
      c.deprecated !== undefined &&
      noticeKind(c.deprecated) !== NoticeKind.Obsolete &&
      c.status !== CheckStatus.NotApplicable,
  );
}

/**
 * The line under the obsolete list: how many more checks looked and found
 * nothing, and how many never looked. An errored or skipped check observed no
 * absence, so it is never folded into "found nothing".
 */
export function obsoleteTally(absent: number, unrun: number): string {
  const parts: string[] = [];
  if (absent > 0) {
    parts.push(
      `${absent} more obsolete check${absent === 1 ? "" : "s"} found nothing.`,
    );
  }
  if (unrun > 0) {
    parts.push(`${unrun} obsolete check${unrun === 1 ? "" : "s"} did not run.`);
  }
  return parts.join(" ");
}
