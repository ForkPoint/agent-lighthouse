#!/usr/bin/env node

/**
 * Sweep evidence dossiers in docs/evidence/audits/ for reviewed: dates.
 *
 * Spec §Phase 6: A scheduled job sweeps reviewed: across docs/evidence/audits/,
 * listing audits past their review window, oldest first, with grade and
 * category. The window follows the grade: the weaker the evidence, the
 * sooner it can move. A is reviewed every 12 months, B every 6, C and D
 * every 3.
 *
 * Law 2 sibling: a stale grade is not a broken build, and a score must not
 * move because nobody did paperwork. It never fails CI and never demotes an
 * audit. Its only job is to make the debt impossible to forget.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const DOSSIERS_DIR = path.resolve(REPO_ROOT, "docs/evidence/audits");

const DAY_MS = 24 * 60 * 60 * 1000;

/** Review window in days per evidence grade. */
export const REVIEW_WINDOW_DAYS = { A: 365, B: 182, C: 91, D: 91 };

/** An unknown or missing grade gets the shortest window. */
export function reviewWindowDays(grade) {
  return REVIEW_WINDOW_DAYS[grade] ?? REVIEW_WINDOW_DAYS.D;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const data = {};
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon > 0 && !line.startsWith(" ") && !line.startsWith("-")) {
      const key = line.slice(0, colon).trim();
      let val = line.slice(colon + 1).trim();
      // Strip wrapping quotes
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      data[key] = val;
    }
  }
  return data;
}

function findDossiers(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDossiers(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

export function sweepAudits(now = new Date(), dir = DOSSIERS_DIR) {
  const files = findDossiers(dir);
  const dossiers = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const fm = parseFrontmatter(content);
    if (!fm.audit && !fm.slug) continue;

    const auditId =
      fm.audit ??
      (fm.category && fm.slug ? `${fm.category}/${fm.slug}` : fm.slug);
    const reviewedStr = fm.reviewed;
    const reviewedDate = reviewedStr ? new Date(reviewedStr) : null;
    const isValidDate = reviewedDate && !isNaN(reviewedDate.getTime());
    const ageMs = isValidDate
      ? now.getTime() - reviewedDate.getTime()
      : Infinity;
    const evidenceGrade = fm.evidence_grade ?? "D";
    const windowDays = reviewWindowDays(evidenceGrade);
    const isOverdue = ageMs > windowDays * DAY_MS;
    const daysOld = isValidDate
      ? Math.floor(ageMs / (24 * 60 * 60 * 1000))
      : null;

    dossiers.push({
      file: path.relative(REPO_ROOT, file),
      auditId,
      category: fm.category ?? "unknown",
      evidenceGrade,
      reviewed: reviewedStr ?? "never",
      windowDays,
      daysOld,
      isOverdue,
    });
  }

  // Sort oldest first (never reviewed first, then largest daysOld)
  dossiers.sort((a, b) => {
    if (a.daysOld === null && b.daysOld === null) return 0;
    if (a.daysOld === null) return -1;
    if (b.daysOld === null) return 1;
    return b.daysOld - a.daysOld;
  });

  return {
    totalAudits: dossiers.length,
    overdueCount: dossiers.filter((d) => d.isOverdue).length,
    dossiers,
    overdue: dossiers.filter((d) => d.isOverdue),
  };
}

export function formatMarkdownReport(sweepResult, now = new Date()) {
  const { totalAudits, overdueCount, overdue } = sweepResult;
  const lines = [
    `# 📜 Scheduled Audit Evidence Review Sweep`,
    ``,
    `*Swept on ${now.toISOString().split("T")[0]}*`,
    ``,
    `Every audit in Agent Lighthouse requires an empirical evidence dossier. Audits are re-reviewed on a window set by their evidence grade (A: 12 months, B: 6 months, C and D: 3 months) to ensure assumptions, standards, and documented consumer behavior remain up to date.`,
    ``,
    `**Total Registered Audits:** ${totalAudits}  `,
    `**Audits Overdue for Re-review:** ${overdueCount}  `,
    ``,
  ];

  if (overdueCount === 0) {
    lines.push(
      `✅ All audit evidence dossiers are up to date within their review window.`,
    );
  } else {
    lines.push(
      `| Audit ID | Grade | Category | Last Reviewed | Age (Days) | Window (Days) | Dossier File |`,
    );
    lines.push(`| :--- | :---: | :--- | :---: | ---: | ---: | :--- |`);
    for (const d of overdue) {
      lines.push(
        `| \`${d.auditId}\` | **${d.evidenceGrade}** | \`${d.category}\` | ${d.reviewed} | ${d.daysOld ?? "—"} | ${d.windowDays ?? "—"} | [${path.basename(d.file)}](${d.file}) |`,
      );
    }
  }

  lines.push(
    ``,
    `---`,
    `*Automated evidence sweep generated by \`scripts/sweep-audit-reviews.mjs\`*`,
  );
  return lines.join("\n");
}

// CLI Execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const isJson = args.includes("--json");
  const isMarkdown = args.includes("--markdown");

  const result = sweepAudits();

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else if (isMarkdown) {
    console.log(formatMarkdownReport(result));
  } else {
    console.log(`\n=== Audit Evidence Review Sweep ===`);
    console.log(`Total dossiers: ${result.totalAudits}`);
    console.log(
      `Overdue for review (A 365d, B 182d, C/D 91d): ${result.overdueCount}`,
    );
    if (result.overdueCount > 0) {
      console.log(`\nOldest 10 overdue dossiers:`);
      for (const d of result.overdue.slice(0, 10)) {
        console.log(
          `  • [${d.evidenceGrade}] ${d.auditId.padEnd(45)} - Reviewed: ${d.reviewed} (${d.daysOld}d ago, window ${d.windowDays}d)`,
        );
      }
      if (result.overdueCount > 10) {
        console.log(`  ... and ${result.overdueCount - 10} more`);
      }
    }
  }

  // Always exit 0: a stale dossier never fails a build (Law 2 sibling)
  process.exit(0);
}
