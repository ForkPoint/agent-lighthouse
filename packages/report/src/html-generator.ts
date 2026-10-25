import { formatBrowserAssessment } from "./browser-assessment";
import {
  isInformative,
  AuditTier,
  CheckStatus,
  NoticeKind,
  PageTypeSource,
  EvidenceKey,
} from "@forkpoint/agent-lighthouse-core";
import { formatPageScope, formatAuditScope } from "./page-scope";
import type { CheckResult, ScanReport } from "@forkpoint/agent-lighthouse-core";
import {
  NOTICE_LABELS,
  NOTICE_LINK_LABELS,
  noticeKind,
  obsoleteTally,
} from "./notices";
import { buildReportView } from "./view-model";
import { PROJECT_URL, REPORT_ICON, REPORT_ICON_URL } from "./brand";

declare const __PACKAGE_VERSION__: string;

const REPORT_VERSION =
  typeof __PACKAGE_VERSION__ === "string" ? __PACKAGE_VERSION__ : "unknown";

/** Gauge stroke colour for a 0-100 score. */
function getGaugeColor(score: number): string {
  if (score >= 90) return "#10b981"; // emerald-500
  if (score >= 70) return "#3b82f6"; // blue-500
  if (score >= 50) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

/** Label and tooltip for a check's not-scored pill, by tier. */
function tierPill(c: CheckResult): { label: string; title: string } {
  if (c.tier === AuditTier.Experimental) {
    return {
      label: "Experimental",
      title:
        "Experimental check — excluded from scoring while it is validated.",
    };
  }
  if (c.tier === AuditTier.Obsolete) {
    return {
      label: "Obsolete",
      title: "Obsolete check — tells you what to retire, never scored.",
    };
  }
  return {
    label: "Advisory",
    title: "Advisory check — reported, never scored.",
  };
}

/** One check as a collapsible card; shared by category cards and the obsolete section. */
function renderCheck(c: CheckResult): string {
  return `
                  <details class="check-item py-3 group cursor-pointer" data-status="${c.status}">
                    <summary class="flex items-start justify-between gap-3 list-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 rounded-lg p-1 -m-1">
                      <div class="flex items-start gap-3">
                        <span class="mt-0.5 w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                          c.status === CheckStatus.NotApplicable
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
                            : c.status === CheckStatus.Pass
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                              : c.status === CheckStatus.Warn
                                ? "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                                : "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800"
                        }">
                          ${c.status === CheckStatus.NotApplicable ? "i" : c.status === CheckStatus.Pass ? "✓" : c.status === CheckStatus.Warn ? "!" : "✗"}
                        </span>
                        <div>
                          <div class="font-semibold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                            <span>${escapeHtml(c.title)}</span>
                            <span class="text-[10px] uppercase tracking-wider font-mono text-slate-400">[${escapeHtml(c.id)}]</span>
                            ${c.deprecated && noticeKind(c.deprecated) === NoticeKind.Deprecated ? '<span class="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">Deprecated</span>' : ""}
                            ${isInformative(c) || (c.tier && c.tier !== AuditTier.Scored) ? `<span class="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300" title="${escapeHtml(tierPill(c).title)}">${tierPill(c).label} — not scored</span>` : ""}
                          </div>
                          ${c.displayValue ? `<div class="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5 whitespace-pre-line">${escapeHtml(c.displayValue)}</div>` : ""}
                        </div>
                      </div>
                      <span class="text-xs text-slate-400 group-open:rotate-180 transition-transform mt-1">▼</span>
                    </summary>

                    <div class="mt-3 pl-8 text-xs text-slate-600 dark:text-slate-400 space-y-3 cursor-text">
                      ${
                        c.deprecated
                          ? `
                        <div class="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-300 dark:border-slate-700">
                          <strong class="text-slate-700 dark:text-slate-300 block mb-1">${NOTICE_LABELS[noticeKind(c.deprecated)]}</strong>
                          <span>${escapeHtml(c.deprecated.notice)}</span>
                          ${c.deprecated.replacement ? `<span class="block mt-1"><strong>Instead:</strong> ${escapeHtml(c.deprecated.replacement)}</span>` : ""}
                          <a href="${escapeHtml(c.deprecated.link)}" target="_blank" rel="noopener" class="block mt-1 underline text-slate-500">${NOTICE_LINK_LABELS[noticeKind(c.deprecated)]}</a>
                        </div>
                      `
                          : ""
                      }

                      ${
                        c.details?.["optionalGuidance"] === true
                          ? Object.entries(c.details)
                              .filter(([, value]) => Array.isArray(value))
                              .map(
                                ([key, value]) =>
                                  `<div><strong>${escapeHtml(key.replace(/([a-z])([A-Z])/g, "$1 $2"))}</strong><ul>${(value as string[]).map((item) => `<li class="whitespace-pre-wrap">${escapeHtml(item)}</li>`).join("")}</ul></div>`,
                              )
                              .join("")
                          : ""
                      }
                      ${c.explanation ? `<p class="leading-relaxed font-medium text-slate-700 dark:text-slate-300">${escapeHtml(c.explanation)}</p>` : ""}
                      
                      ${
                        c.details?.found && c.details.found !== c.displayValue
                          ? `
                        <div class="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                          <strong class="text-slate-900 dark:text-slate-200 block mb-1">What we found:</strong>
                          <span class="font-mono text-[11px] whitespace-pre-line">${escapeHtml(c.details.found)}</span>
                        </div>
                      `
                          : ""
                      }

                      ${
                        c.impact
                          ? `
                        <div class="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                          <strong class="text-slate-900 dark:text-slate-200 block mb-1">Impact on AI Agents:</strong>
                          <span>${escapeHtml(c.impact)}</span>
                        </div>
                      `
                          : ""
                      }

                      ${
                        c.fix
                          ? `
                        <div class="bg-indigo-50/50 dark:bg-indigo-950/20 p-3 rounded-lg border border-indigo-200/50 dark:border-indigo-900/30">
                          <strong class="text-indigo-900 dark:text-indigo-300 block mb-1">${c.details?.["optionalGuidance"] === true ? "Optional choices and verification:" : "How to Fix:"}</strong>
                          <span>${escapeHtml(c.fix)}</span>
                        </div>
                      `
                          : ""
                      }

                      ${
                        c.details?.evidenceUrl
                          ? `
                        <a href="${escapeHtml(c.details.evidenceUrl)}" target="_blank" rel="noopener"
                           class="inline-block underline text-indigo-600 dark:text-indigo-400">Why this audit exists — the evidence</a>
                      `
                          : ""
                      }

                      ${
                        c.details?.code
                          ? `
                        <div class="mt-2">
                          <div class="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                            <span>Recommended Code Snippet:</span>
                            <button onclick="copySnippet(this)" aria-live="polite" class="hover:text-slate-200 font-sans">Copy Code</button>
                          </div>
                          <pre class="bg-slate-950 text-slate-200 p-3 rounded-lg font-mono text-[11px] overflow-x-auto border border-slate-800"><code>${escapeHtml(c.details.code)}</code></pre>
                        </div>
                      `
                          : ""
                      }
                    </div>
                  </details>
`;
}

/**
 * The "Obsolete (not scored)" section: what the site still publishes that its
 * consumer retired or ignores. Empty when nothing obsolete was found.
 */
function renderObsoleteSection(found: CheckResult[], tally: string): string {
  if (found.length === 0) return "";
  return `
      <div class="group-section mb-12" data-group="obsolete">
        <div class="flex items-center justify-between pb-3 mb-6 border-b border-slate-200 dark:border-slate-800">
          <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100">Obsolete (not scored)</h3>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">This site still publishes things their consumers retired or ignore. None of this moves the score.${tally ? ` ${tally}` : ""}</p>
        <div class="cat-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div class="checks-container divide-y divide-slate-100 dark:divide-slate-800/60">
            ${found.map(renderCheck).join("")}
          </div>
        </div>
      </div>
    `;
}

/**
 * The "Optional guidance (not scored)" section: evidence-backed recommendations
 * that do not move the site's score. Empty when no optional guidance applies.
 */
function renderOptionalGuidanceSection(checks: CheckResult[]): string {
  if (checks.length === 0) return "";
  return `
      <section aria-label="Optional guidance" class="mb-12">
        <div class="flex items-center justify-between pb-3 mb-6 border-b border-slate-200 dark:border-slate-800">
          <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100">Optional guidance (not scored)</h3>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Evidence-backed setup choices and preferences. None of this moves the score; adoption is voluntary.</p>
        <div class="cat-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div class="checks-container divide-y divide-slate-100 dark:divide-slate-800/60">
            ${checks.map(renderCheck).join("")}
          </div>
        </div>
      </section>
    `;
}

/**
 * Generates a standalone, zero-dependency, self-contained HTML report
 * with interactive tabs, category accordions, copyable code snippets,
 * and circular SVG score gauges.
 */
export function generateHtmlReport(report: ScanReport): string {
  const view = buildReportView(report);

  const allRenderedChecks = [
    ...view.categories.flatMap((cat) => cat.checks),
    ...view.optionalGuidance,
    ...view.obsolete.found,
  ];
  const totalCount = allRenderedChecks.length;
  const failCount = allRenderedChecks.filter(
    (c) => c.status === CheckStatus.Fail,
  ).length;
  const warnCount = allRenderedChecks.filter(
    (c) => c.status === CheckStatus.Warn,
  ).length;
  const passCount = allRenderedChecks.filter(
    (c) => c.status === CheckStatus.Pass,
  ).length;

  const pages = view.pagesScanned;
  const typeCounts = new Map<string, number>();
  for (const page of pages) {
    const label =
      page.pageType.charAt(0).toUpperCase() + page.pageType.slice(1);
    typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
  }
  const pageTypeSummary = Array.from(typeCounts, ([label, count]) =>
    pages.length === 1 ? label : `${count} ${label.toLowerCase()}`,
  ).join(" · ");
  const detectedCount = pages.filter(
    (page) => page.classification?.source === PageTypeSource.Detected,
  ).length;
  const classificationSummary =
    detectedCount === pages.length && pages.length > 0
      ? "Page types detected automatically. Type-specific findings are advisory."
      : detectedCount > 0
        ? `${detectedCount} page type(s) detected automatically. Their type-specific findings are advisory.`
        : pages.some((page) => !page.classification)
          ? "Page type detection details are not available."
          : "Page types supplied for this audit.";
  const noReadableText =
    report.scanValidity?.evidence[EvidenceKey.RenderedBody] === false;
  const coverageLimit = noReadableText
    ? "The scan found too little readable page text." +
      (view.overallScore === null
        ? " It could not give an overall score."
        : " Some checks could not run.")
    : view.unscoredReason;

  function renderGaugeSvg(score: number, size = 120, strokeWidth = 10): string {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = getGaugeColor(score);

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="gauge-svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke="#334155" stroke-opacity="0.3" stroke-width="${strokeWidth}" fill="none" />
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" fill="none" transform="rotate(-90 ${size / 2} ${size / 2})" style="transition: stroke-dashoffset 0.8s ease;" />
        <text x="${size / 2}" y="${size / 2 + 8}" text-anchor="middle" font-size="${size * 0.28}px" font-weight="800" fill="${color}">${score}</text>
      </svg>
    `;
  }

  // Pre-render Category Cards
  const categoryCards = view.groups
    .map((group) => {
      return `
      <div class="group-section mb-12" data-group="${escapeHtml(group.key)}">
        <div class="flex items-center justify-between pb-3 mb-6 border-b border-slate-200 dark:border-slate-800">
          <div class="flex items-center gap-3">
            <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100">${escapeHtml(group.label)}</h3>
          </div>
          ${
            group.assessed
              ? `<span class="text-sm font-bold px-3 py-1 rounded-full" style="background-color: ${getGaugeColor(group.score)}15; color: ${getGaugeColor(group.score)}">
            ${group.score} / 100
          </span>`
              : `<span class="text-sm font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">Not assessed</span>`
          }
        </div>

        <div class="grid grid-cols-1 gap-6">
          ${group.categories
            .map(
              (cat) => `
            <div class="cat-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                <div>
                  <h4 class="text-lg font-bold text-slate-900 dark:text-slate-100">${escapeHtml(cat.name)}</h4>
                  <div class="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span class="text-emerald-600 dark:text-emerald-400 font-semibold">${cat.counts.pass} Passed</span>
                    <span>•</span>
                    <span class="text-amber-600 dark:text-amber-400 font-semibold">${cat.counts.warn} Warnings</span>
                    <span>•</span>
                    <span class="text-red-600 dark:text-red-400 font-semibold">${cat.counts.fail} Failed</span>
                    ${cat.counts.na > 0 ? `<span>•</span><span>${cat.counts.na} N/A</span>` : ""}
                    ${cat.counts.advisory > 0 ? `<span>•</span><span>${cat.counts.advisory} Advisory</span>` : ""}
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  ${
                    cat.assessed
                      ? renderGaugeSvg(cat.score, 68, 7)
                      : `<span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400" title="No scored check reached a verdict, so this category has no score.">Not assessed</span>`
                  }
                </div>
              </div>

              <!-- Checks Accordion -->
              <div class="checks-container mt-4 divide-y divide-slate-100 dark:divide-slate-800/60">
                ${cat.checks.map(renderCheck).join("")}
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Lighthouse Report — ${escapeHtml(report.domain)}</title>
  <link rel="icon" type="image/svg+xml" href="${REPORT_ICON_URL}">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              500: '#6366f1',
              600: '#4f46e5',
            }
          },
          fontFamily: {
            sans: ['Avenir Next', 'Segoe UI', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'Menlo', 'monospace'],
          }
        }
      }
    }
  </script>
  <style>
    body { font-family: 'Avenir Next', 'Segoe UI', system-ui, sans-serif; background: #080e1c; }
    .gauge-svg text { font-family: inherit; font-weight: 800; }
    .report-brand { display: flex; align-items: center; gap: 18px; color: #f5f7ff; text-decoration: none; }
    .report-brand svg { width: 76px; height: 76px; flex-shrink: 0; }
    .report-wordmark { display: block; line-height: 1.05; letter-spacing: -.04em; }
    .report-wordmark span { display: block; font-size: 22px; font-weight: 500; }
    .report-wordmark strong { display: block; font-size: 38px; font-weight: 900; }
    .report-heading { font-family: 'Iowan Old Style', 'Palatino Linotype', Georgia, serif; font-size: 26px; font-weight: 400; font-style: italic; color: #c7d2fe; margin-top: 24px; }
    header { background: #111b2e !important; }
    header > div > div { min-width: 0; }
    .report-target { overflow-wrap: anywhere; }
    .report-meta { flex-wrap: wrap; }
    .cat-card { min-width: 0; overflow-wrap: anywhere; }
    .cat-card .flex > div { min-width: 0; }
    .check-item summary .font-semibold { flex-wrap: wrap; }
    .cat-card h4 + div { flex-wrap: wrap; }
    header .font-mono { overflow-wrap: anywhere; }
    @media (max-width: 480px) {
      .report-brand svg { width: 60px; height: 60px; }
      .report-wordmark strong { font-size: 30px; }
      .report-wordmark span { font-size: 18px; }
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen py-10 px-4 sm:px-6 lg:px-8 antialiased selection:bg-indigo-500 selection:text-white">
  <div class="max-w-5xl mx-auto">
    <!-- Header -->
    <header class="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl mb-10">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div class="min-w-0">
          <div>
            <div class="flex flex-wrap items-center gap-4">
              <a class="report-brand" href="${PROJECT_URL}" target="_blank" rel="noopener noreferrer" aria-label="Agent Lighthouse — project website (opens in a new tab)">
                ${REPORT_ICON.replace("<svg ", '<svg aria-hidden="true" focusable="false" ')}
                <span class="report-wordmark"><span>Agent</span><strong>Lighthouse</strong></span>
              </a>
              <span class="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">v${escapeHtml(REPORT_VERSION)}</span>
            </div>
            <h1 class="report-heading">Your AI readiness report</h1>
            <p class="report-target text-sm text-slate-400 mt-1.5">
              Website <a href="${escapeHtml(report.url)}" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:underline font-mono font-medium">${escapeHtml(report.url)}</a>
            </p>
            <div class="report-meta flex items-center gap-3 text-xs text-slate-500 mt-2">
              <span>Duration: ${(view.durationMs / 1000).toFixed(1)}s</span>
              <span>•</span>
              <span>Pages: ${view.pagesScanned.length} scanned</span>
              ${
                view.coverage.skippedNoEvidence > 0
                  ? `<span>•</span>
              <span class="text-amber-300" title="${escapeHtml(
                view.coverage.noEvidenceReasons.join(" "),
              )}">${view.coverage.skippedNoEvidence} not assessed</span>`
                  : ""
              }
              <span>•</span>
              <span>${new Date(report.scannedAt).toLocaleString()}</span>
            </div>
            ${
              view.conditions
                ? `
            <div class="flex flex-wrap items-center gap-2 mt-3 text-xs">
              <span class="px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800 text-slate-300 font-mono">
                Page: <strong class="text-indigo-400">${escapeHtml(view.conditions.pageType.type)}</strong> (${escapeHtml(view.conditions.pageType.source)})
              </span>
              <span class="px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800 text-slate-300 font-mono">
                Origin: <strong class="${view.conditions.origin.cached ? "text-amber-400" : "text-emerald-400"}">${view.conditions.origin.cached ? "cached" : "fresh"}</strong> (${escapeHtml(view.conditions.origin.readAt)})
              </span>
              <span class="px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800 text-slate-300 font-mono">
                Coverage: <strong class="text-slate-100">${view.conditions.coverage.assessedMass}/${view.conditions.coverage.registryMass}</strong> mass (${view.conditions.coverage.registryMass > 0 ? Math.round((view.conditions.coverage.assessedMass / view.conditions.coverage.registryMass) * 100) : 0}%)
              </span>
              <span class="px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800 text-slate-300 font-mono">
                Unscored: <strong class="text-slate-300">${view.conditions.unscored.totalCount}</strong> (${view.conditions.unscored.informativeCount} advisory, ${view.conditions.unscored.gatedCount} gated)
              </span>
              ${
                view.conditions.budget
                  ? `<span class="px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800 text-slate-300 font-mono">
                Budget: ${
                  view.conditions.budget.limitMs === 0
                    ? `<strong class="text-slate-100">none</strong> (${Math.round(view.conditions.budget.elapsedMs / 1000)} s elapsed)`
                    : view.conditions.budget.exhausted
                      ? `<strong class="text-amber-400">ran out</strong> at ${Math.round(view.conditions.budget.limitMs / 1000)} s (${view.conditions.budget.skippedCount} audits not assessed)`
                      : `<strong class="text-slate-100">${Math.round(view.conditions.budget.elapsedMs / 1000)} s</strong> of ${Math.round(view.conditions.budget.limitMs / 1000)} s`
                }
              </span>`
                  : ""
              }
            </div>`
                : ""
            }
          </div>
        </div>
        
        <div class="flex flex-col items-center">
          ${
            view.overallScore === null
              ? `<div class="px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-center max-w-xs">
              <div class="text-sm font-bold uppercase tracking-wider text-amber-300">Not scored</div>
              <p class="text-xs text-amber-100/80 mt-1">${escapeHtml(
                view.unscoredReason ??
                  "This scan obtained too little evidence to judge the site.",
              )}</p>
            </div>`
              : `${renderGaugeSvg(view.overallScore, 120, 9)}
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">${view.scoreTier}</span>`
          }
        </div>
      </div>

      <!-- Vitals Summary Bar -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-800">
        <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div class="text-[11px] text-slate-400 font-medium">Commerce Readiness</div>
          <div class="text-base font-bold text-slate-200 mt-0.5">${view.vitals.commerce}%</div>
        </div>
        <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div class="text-[11px] text-slate-400 font-medium">Content Legibility</div>
          <div class="text-base font-bold text-slate-200 mt-0.5">${view.vitals.content}%</div>
        </div>
        <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div class="text-[11px] text-slate-400 font-medium">AI Bot Accessibility</div>
          <div class="text-base font-bold text-slate-200 mt-0.5">${view.vitals.botAccessibility}%</div>
        </div>
        <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div class="text-[11px] text-slate-400 font-medium">Technical Foundation</div>
          <div class="text-base font-bold text-slate-200 mt-0.5">${view.vitals.technical}%</div>
        </div>
      </div>
    </header>
    ${view.browserAssessment ? `<section aria-label="Browser agent assessment" class="mb-8 p-6 rounded-2xl border border-slate-700 bg-slate-900 text-slate-200"><h2 class="text-lg font-bold mb-3">Browser agent assessment</h2><pre class="text-xs whitespace-pre-wrap break-words">${escapeHtml(formatBrowserAssessment(view.browserAssessment))}</pre></section>` : ""}


    ${
      view.wafProtection?.isBlocked
        ? `
    <!-- WAF / Bot Wall Alert Banner -->
    <div class="bg-red-950/70 border-2 border-red-500/80 rounded-2xl p-5 mb-8 text-red-100 flex items-start gap-4 shadow-xl">
      <div class="text-3xl">🛡️</div>
      <div>
        <div class="flex items-center gap-2">
          <h3 class="text-base font-bold text-red-200">Bot Defense Wall Detected (${escapeHtml(view.wafProtection.name)})</h3>
          <span class="text-[10px] uppercase font-bold tracking-wider bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/40">Access Blocked</span>
        </div>
        <p class="text-xs text-red-300/90 mt-1.5 leading-relaxed font-medium">
          <strong>Diagnosis:</strong> ${escapeHtml(view.wafProtection.reason)}.<br>
          This website is actively dropping, challenging, or blocking automated crawler requests. AI search agents (like ChatGPT, Claude, and Perplexity) cannot access or index pages on this storefront unless allowlisted in your firewall/CDN settings.
        </p>
      </div>
    </div>
    `
        : ""
    }

    ${
      view.pageScope
        ? `<section aria-label="Page scope" class="mb-8 p-6 rounded-2xl border border-slate-700 bg-slate-900 text-slate-200">
      <h2 class="text-lg font-bold mb-3">Pages checked</h2>
      <p class="text-base font-semibold">${pages.length} ${pages.length === 1 ? "page" : "pages"}${pageTypeSummary ? ` · ${escapeHtml(pageTypeSummary)}` : ""}</p>
      ${pages.length ? `<p class="mt-2 text-sm text-slate-400">${escapeHtml(classificationSummary)}</p>` : ""}
      ${coverageLimit ? `<div class="mt-4 border-l-2 border-amber-400 pl-3"><h3 class="text-sm font-semibold text-amber-300">Coverage limit</h3><p class="mt-1 text-sm">${escapeHtml(coverageLimit)}</p></div>` : ""}
      <p class="text-sm text-slate-400 mt-3">Results cover this sample, not every page on the site.</p>
      <details class="mt-5 border-t border-slate-700 pt-4"><summary class="cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400">Technical details</summary>
      <p class="text-xs text-slate-400 my-3">A successful HTTP response does not prove that the page has readable content. Origin evidence may also support a result. Each audit counts toward the score at most once.</p>
      <pre class="text-xs whitespace-pre-wrap break-words">${escapeHtml(formatPageScope(view.pageScope))}</pre>
      <details class="mt-4"><summary class="cursor-pointer font-semibold">Scope by check (${view.pageScope.audits.length})</summary>
      ${view.pageScope.audits.map((a) => `<details class="mt-3 border-t border-slate-700 pt-3"><summary class="cursor-pointer text-sm">${escapeHtml(a.title)} <span class="text-xs text-slate-400">[${escapeHtml(a.id)}] · ${escapeHtml(a.assessments.map((r) => `${r.advisory ? "advisory " : ""}${r.status}`).join(" / "))}</span></summary><pre class="mt-3 text-xs whitespace-pre-wrap break-words">${escapeHtml(formatAuditScope(a))}</pre></details>`).join("")}
      </details>
      </details>
    </section>`
        : ""
    }

    <!-- Filter Tabs & View Controls -->
    <div class="flex items-center justify-between gap-4 mb-8 flex-wrap">
      <div class="flex items-center gap-2 overflow-x-auto pb-1">
        <button data-filter="all" aria-pressed="true" onclick="filterStatus('all', this)" class="filter-btn active bg-slate-800 text-white hover:bg-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer">
          <span>All checks</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono">${totalCount}</span>
        </button>
        <button data-filter="fail" aria-pressed="false" onclick="filterStatus('fail', this)" class="filter-btn bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer">
          <span>Opportunities & Failures</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/60 font-mono">${failCount}</span>
        </button>
        <button data-filter="warn" aria-pressed="false" onclick="filterStatus('warn', this)" class="filter-btn bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer">
          <span>Warnings</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/60 font-mono">${warnCount}</span>
        </button>
        <button data-filter="pass" aria-pressed="false" onclick="filterStatus('pass', this)" class="filter-btn bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer">
          <span>Passed checks</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono">${passCount}</span>
        </button>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button onclick="toggleAllChecks()" id="toggle-all-btn" class="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer">
          <span id="toggle-all-icon">▼</span>
          <span id="toggle-all-text">Expand all</span>
        </button>
      </div>
    </div>

    <!-- Category Groups -->
    <main id="audits-main">
      <div id="filter-empty-state" class="hidden text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-12">
        <div class="text-3xl mb-2">🎉</div>
        <h4 class="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">No checks match this filter</h4>
        <p class="text-xs text-slate-500 dark:text-slate-400">Try selecting another filter above or view all checks.</p>
      </div>
      ${categoryCards}
      ${renderOptionalGuidanceSection(view.optionalGuidance)}
      ${renderObsoleteSection(view.obsolete.found, obsoleteTally(view.obsolete.absent.length, view.obsolete.unrun.length))}
    </main>

    <!-- Footer -->
    <footer class="mt-16 text-center text-xs text-slate-500 border-t border-slate-800/80 pt-6">
      <p>Generated by <a href="${PROJECT_URL}" target="_blank" rel="noopener noreferrer" class="font-semibold text-slate-400 hover:underline">Agent Lighthouse</a> — Open-source website checks for AI readiness.</p>
      <p class="mt-2"><a href="https://github.com/ForkPoint/agent-lighthouse" target="_blank" rel="noopener noreferrer" class="hover:underline">View the source</a> · Apache-2.0</p>
    </footer>
  </div>

  <script>
    function filterStatus(status, btn) {
      const activeBtn = btn || Array.from(document.querySelectorAll('.filter-btn')).find(b => b.dataset.filter === status);
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.setAttribute('aria-pressed', String(b === activeBtn));
        b.classList.remove('bg-slate-800', 'text-white');
        b.classList.add('bg-slate-900', 'text-slate-400');
      });
      if (activeBtn) {
        const targetBtn = activeBtn.closest ? activeBtn.closest('.filter-btn') : activeBtn;
        if (targetBtn) {
          targetBtn.classList.remove('bg-slate-900', 'text-slate-400');
          targetBtn.classList.add('bg-slate-800', 'text-white');
        }
      }

      document.querySelectorAll('.check-item').forEach(item => {
        if (status === 'all' || item.getAttribute('data-status') === status) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });

      // Update visibility of category cards, groups, and optional guidance
      document.querySelectorAll('.cat-card').forEach(card => {
        const items = card.querySelectorAll('.check-item');
        if (items.length > 0) {
          const hasVisible = Array.from(items).some(i => i.style.display !== 'none');
          card.style.display = hasVisible ? '' : 'none';
        } else {
          card.style.display = status === 'all' ? '' : 'none';
        }
      });
      document.querySelectorAll('.group-section').forEach(group => {
        const cards = group.querySelectorAll('.cat-card');
        const hasVisible = Array.from(cards).some(c => c.style.display !== 'none');
        group.style.display = hasVisible ? '' : 'none';
      });
      const optionalSection = document.querySelector('section[aria-label="Optional guidance"]');
      if (optionalSection) {
        const items = optionalSection.querySelectorAll('.check-item');
        const hasVisible = Array.from(items).some(i => i.style.display !== 'none');
        optionalSection.style.display = hasVisible ? '' : 'none';
      }

      const totalVisible = Array.from(document.querySelectorAll('.check-item')).filter(i => i.style.display !== 'none').length;
      const emptyState = document.getElementById('filter-empty-state');
      if (emptyState) {
        emptyState.classList.toggle('hidden', totalVisible > 0);
      }
      updateExpandControl();
    }

    function visibleChecks() {
      return Array.from(document.querySelectorAll('.check-item')).filter(item => item.style.display !== 'none');
    }

    function updateExpandControl() {
      const items = visibleChecks();
      const allExpanded = items.length > 0 && items.every(item => item.open);
      document.getElementById('toggle-all-btn').disabled = items.length === 0;
      document.getElementById('toggle-all-icon').textContent = allExpanded ? '▲' : '▼';
      document.getElementById('toggle-all-text').textContent = allExpanded ? 'Collapse all' : 'Expand all';
    }
    function toggleAllChecks() {
      const items = visibleChecks();
      const expand = !items.every(item => item.open);
      items.forEach(item => { item.open = expand; });
      updateExpandControl();
    }

    document.querySelectorAll('.check-item').forEach(item => {
      item.addEventListener('toggle', updateExpandControl);
    });
    filterStatus('all');

    async function copySnippet(btn) {
      if (btn.disabled) return;
      btn.disabled = true;
      clearTimeout(btn.copyResetTimer);
      const code = btn.closest('div').nextElementSibling.textContent;
      let ok = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(code);
          ok = true;
        } catch {
          // Fallback below
        }
      }
      if (!ok) {
        const previousFocus = document.activeElement;
        const textarea = document.createElement('textarea');
        try {
          textarea.value = code;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          ok = document.execCommand('copy');
        } catch {
          ok = false;
        } finally {
          textarea.remove();
          btn.disabled = false;
          if (previousFocus && previousFocus.focus) previousFocus.focus();
        }
      }
      btn.disabled = false;
      btn.textContent = ok ? 'Copied! ✓' : 'Copy failed — select the code and copy it';
      if (ok) {
        btn.copyResetTimer = setTimeout(() => { btn.textContent = 'Copy Code'; }, 2000);
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
