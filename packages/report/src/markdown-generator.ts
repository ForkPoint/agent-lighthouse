import { formatBrowserAssessment } from "./browser-assessment";
import {
  formatPageScope,
  formatAuditScope,
  escapeScopeHtml,
} from "./page-scope";
import type {
  CheckResult,
  ScanConditions,
  ScanReport,
} from "@forkpoint/agent-lighthouse-core";
import { buildReportView } from "./view-model";
import { PROJECT_URL } from "./brand";
import {
  NOTICE_LABELS,
  NOTICE_LINK_LABELS,
  noticeKind,
  noticeText,
} from "./notices";

/** One bullet: the check, its notice, and the source behind it. */
function noticeBullet(c: CheckResult): string {
  if (!c.deprecated) return `- **${c.title}**`;
  const kind = noticeKind(c.deprecated);
  return `- **${c.title}** — ${noticeText(c.deprecated)} [${NOTICE_LINK_LABELS[kind]}](${c.deprecated.link})`;
}

/**
 * The "Obsolete (not scored)" section: what the owner still publishes that a
 * consumer retired or ignores. Silent when nothing obsolete was found, because
 * a list of retired things the site never had is noise.
 */
function obsoleteSection(view: ReturnType<typeof buildReportView>): string {
  const { found, absent } = view.obsolete;
  if (found.length === 0) return "";
  const rest =
    absent.length > 0
      ? `\n\n${absent.length} more obsolete check${absent.length === 1 ? "" : "s"} found nothing.`
      : "";
  return `\n#### Obsolete (not scored)\n\nThis site still publishes things their consumers retired or ignore. None of this moves the score.\n\n${found.map(noticeBullet).join("\n")}${rest}\n`;
}

/** Notices on checks that ran, such as "no AI vendor reads this". */
function noticesSection(view: ReturnType<typeof buildReportView>): string {
  if (view.notices.length === 0) return "";
  const byKind = new Map<string, CheckResult[]>();
  for (const c of view.notices) {
    if (!c.deprecated) continue;
    const label = NOTICE_LABELS[noticeKind(c.deprecated)];
    byKind.set(label, [...(byKind.get(label) ?? []), c]);
  }
  return [...byKind]
    .map(
      ([label, checks]) =>
        `\n#### ${label}\n\n${checks.map(noticeBullet).join("\n")}\n`,
    )
    .join("");
}

/**
 * Generates a GitHub PR comment markdown summary.
 */
/**
 * The sentence that explains a large not-assessed count.
 *
 * "154 audits not assessed" reads as a broken scanner unless the reason sits
 * next to it.
 */
function notAssessedLine(view: ReturnType<typeof buildReportView>): string {
  const { skippedNoEvidence, noEvidenceReasons } = view.coverage;
  if (skippedNoEvidence === 0) return "";
  const why =
    noEvidenceReasons.length > 0 ? ` ${noEvidenceReasons.join(" ")}` : "";
  return `\n> **${skippedNoEvidence} audit${skippedNoEvidence === 1 ? "" : "s"} not assessed:** this scan did not obtain the evidence they need.${why}\n`;
}

function conditionsBlock(view: ReturnType<typeof buildReportView>): string {
  if (!view.conditions) return "";
  const c = view.conditions;
  const pct =
    c.coverage.registryMass > 0
      ? Math.round((c.coverage.assessedMass / c.coverage.registryMass) * 100)
      : 0;
  return `\n**Scan Conditions:**  
- **Page Type:** \`${c.pageType.type}\` (${c.pageType.source})
- **Origin Evidence:** \`${c.origin.cached ? "cached" : "fresh"}\` (version: \`${c.origin.version}\`, read at: \`${c.origin.readAt}\`)
- **Evidence Coverage:** \`${c.coverage.assessedMass} / ${c.coverage.registryMass}\` mass (${pct}%) — page: \`${c.coverage.pageMass}\`, origin: \`${c.coverage.originMass}\`, gated: \`${c.coverage.gatedMass}\`
- **Unscored Checks:** \`${c.unscored.totalCount}\` (${c.unscored.informativeCount} advisory, ${c.unscored.gatedCount} gated)${budgetLine(c.budget)}\n`;
}

/** The budget line of the conditions block, or nothing for an older report. */
function budgetLine(budget: ScanConditions["budget"]): string {
  if (!budget) return "";
  const limit = Math.round(budget.limitMs / 1000);
  const elapsed = Math.round(budget.elapsedMs / 1000);
  if (budget.limitMs === 0)
    return `\n- **Budget:** \`none\` (${elapsed} s elapsed)`;
  return budget.exhausted
    ? `\n- **Budget:** \`ran out\` at ${limit} s — ${budget.skippedCount} audits not assessed`
    : `\n- **Budget:** \`${elapsed} s\` of ${limit} s`;
}

export function generateMarkdownSummary(report: ScanReport): string {
  const view = buildReportView(report);

  const getTierEmoji = (score: number) => {
    if (score >= 90) return "🟢";
    if (score >= 70) return "🔵";
    if (score >= 50) return "🟡";
    return "🔴";
  };

  const rows = view.groups
    .flatMap((group) => {
      return group.categories.map((cat) => {
        const score = cat.assessed
          ? `**${cat.score} / 100**`
          : "_Not assessed_";
        const emoji = cat.assessed ? getTierEmoji(cat.score) : "⚪";
        const advisory =
          cat.counts.advisory > 0 ? ` (${cat.counts.advisory} not scored)` : "";
        return `| **${cat.name}** | ${score} | ${emoji} ${cat.counts.pass}✓ ${cat.counts.warn}! ${cat.counts.fail}✗${advisory} |`;
      });
    })
    .join("\n");

  const advisory = view.groups
    .flatMap((group) => group.categories)
    .reduce((sum, cat) => sum + cat.counts.advisory, 0);

  // Without this line a reviewer sees a reported failure that moved no score
  // and has no way to tell why.
  const advisoryLine =
    advisory > 0
      ? `\n> ${advisory} advisory check${advisory === 1 ? "" : "s"} ran. They are reported but never scored.\n`
      : "";

  return `[![Agent Lighthouse](${PROJECT_URL}brand/kit/icons/icon-64.png "Agent Lighthouse logo")](${PROJECT_URL})

### Agent Lighthouse — AI readiness report

**Target:** \`${report.url}\`  
**Overall Score:** ${
    view.overallScore === null
      ? `_Not scored_ — ${view.unscoredReason ?? "this scan obtained too little evidence to judge the site."}`
      : `**\`${view.overallScore}/100\`** *(${view.scoreTier})*`
  }  
**Pages Audited:** \`${view.pagesScanned.length}\` | **Duration:** \`${(view.durationMs / 1000).toFixed(1)}s\`
${conditionsBlock(view)}${notAssessedLine(view)}

| Category | Score | Breakdown |
| :--- | :---: | :--- |
${rows}
${advisoryLine}${obsoleteSection(view)}${noticesSection(view)}
${view.pageScope ? `<details><summary>Page scope and coverage</summary>\n\n<pre>${escapeScopeHtml(formatPageScope(view.pageScope))}</pre>\n\nInput URLs are pages supplied to the audit. Results cover this sample. Origin evidence may also support a result. Each audit counts toward the score at most once.\n\n${view.pageScope.audits.map((a) => `<details><summary>${escapeScopeHtml(a.title)} [${escapeScopeHtml(a.id)}]</summary>\n\n<pre>${escapeScopeHtml(formatAuditScope(a))}</pre>\n</details>`).join("\n")}\n</details>\n` : ""}
${view.browserAssessment ? `### Browser agent assessment\n\n<pre>${escapeScopeHtml(formatBrowserAssessment(view.browserAssessment))}</pre>\n\n` : ""}
*Generated by [Agent Lighthouse](${PROJECT_URL}) · Open-source website checks for AI readiness. [Apache-2.0](https://github.com/ForkPoint/agent-lighthouse)*
`;
}
