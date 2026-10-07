import type { CheckResult, ScanReport } from "@forkpoint/agent-lighthouse-core";
import { isInformative } from "@forkpoint/agent-lighthouse-core";

export interface AssessmentView {
  status: CheckResult["status"];
  advisory: boolean;
  coverage?: CheckResult["coverage"];
  explanation?: string;
  displayValue?: string;
  fix?: string;
}
export interface AuditScopeView {
  id: string;
  title: string;
  assessments: AssessmentView[];
}
export interface PageScopeView {
  pages: ScanReport["pagesScanned"];
  attempts?: ScanReport["pageAttempts"];
  audits: AuditScopeView[];
}

/** Keep population details separate from audit counts and score summaries. */
export function buildPageScope(
  report: ScanReport,
  checks: CheckResult[],
): PageScopeView | undefined {
  const pages = report.pagesScanned ?? [];
  const audits = checks
    .filter((c) => c.coverage || c.advisoryResults?.length)
    .map((c) => ({
      id: c.id,
      title: c.title,
      assessments: [c, ...(c.advisoryResults ?? [])].map((a, index) => ({
        status: a.status,
        advisory:
          index > 0 ||
          isInformative(a) ||
          (a.tier !== undefined && a.tier !== "scored"),
        ...(a.coverage ? { coverage: a.coverage } : {}),
        ...(a.explanation ? { explanation: a.explanation } : {}),
        ...(a.displayValue ? { displayValue: a.displayValue } : {}),
        ...(a.fix ? { fix: a.fix } : {}),
      })),
    }));
  if (
    !audits.length &&
    !report.pageAttempts &&
    !pages.some((p) => p.classification)
  )
    return undefined;
  return {
    pages,
    ...(report.pageAttempts ? { attempts: report.pageAttempts } : {}),
    audits,
  };
}

/** Plain text shared by terminal, HTML and Markdown. Renderers must escape it. */
export function formatPageScope(scope: PageScopeView): string {
  const lines = [
    "Page scope",
    "Detected page types express uncertainty. Type-specific findings on detected pages are advisory.",
  ];
  for (const page of scope.pages) {
    const c = page.classification;
    lines.push(
      `${page.url}: ${page.pageType} (${c ? `${c.source}, ${c.confidence}` : "classification not recorded"})`,
    );
    if (c?.signals.length) lines.push(`  Signals: ${c.signals.join("; ")}`);
  }
  for (const attempt of scope.attempts ?? []) {
    lines.push(
      `Fetch: ${attempt.url} — ${attempt.outcome}, HTTP ${attempt.status}; ${attempt.pageType} (${attempt.source})`,
    );
  }
  return lines.join("\n");
}

export function formatAuditScope(audit: AuditScopeView): string {
  return audit.assessments
    .map((a) => {
      const lines = [
        `${a.coverage?.provenance ?? "Scope not recorded"} — ${a.status.toUpperCase()} — ${a.advisory ? "Advisory — not scored" : a.status === "na" ? "Not assessed — not scored" : "Primary result"}`,
      ];
      if (a.explanation) lines.push(a.explanation);
      if (a.displayValue) lines.push(`Finding: ${a.displayValue}`);
      if (a.coverage) {
        for (const [label, urls] of [
          ["Selected URLs", a.coverage.selectedUrls],
          ["Input URLs", a.coverage.inputUrls],
          ["Unread URLs", a.coverage.unreadUrls],
        ] as const) {
          lines.push(
            `${label}: ${urls.length ? "\n  " + urls.join("\n  ") : "none"}`,
          );
        }
      } else lines.push("Coverage not recorded.");
      if (a.fix && a.status !== "pass" && a.status !== "na")
        lines.push(`Suggested fix: ${a.fix}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function escapeScopeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
