#!/usr/bin/env node
/** Compact and strictly classify a saved v7 replay; unknown transitions fail review. */
import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    "Usage: node scripts/review-v7-corpus.mjs <raw replay.json> <review.json>",
  );
const raw = JSON.parse(readFileSync(input, "utf8"));
const articleIds = new Set([
  "answer-readiness/author-page",
  "answer-readiness/author-same-as",
  "answer-readiness/dates-on-content",
  "answer-readiness/first-paragraph-answers",
  "answer-readiness/last-modified-schema",
  "answer-readiness/meta-author",
  "answer-readiness/named-author",
  "answer-readiness/publication-date",
  "content-extraction/article-element",
  "structured-data/article-schema",
  "structured-data/author-schema",
  "structured-data/speakable-schema",
]);
const causes = {
  "common-page-gate": {
    reason:
      "6.0.0 withheld this result because no readable homepage existed. P1 allows universal checks to use the readable interior page. A new NA verdict means the audit's own artifact/precondition guard declined, rather than the old homepage gate.",
    source: "packages/core/src/audit-runner.ts",
    regression: "packages/core/src/tests/common-page-scope.test.ts",
    count: 0,
  },
  "article-population": {
    reason:
      "P3 restricts these 12 obligations to article purpose. General/unknown pages, including legacy content declarations, no longer acquire article requirements. On shells the page-type skip replaces the earlier evidence skip, without creating a verdict.",
    source: "packages/core/src/audit-applicability.ts",
    regression: "packages/core/src/tests/page-purpose.test.ts",
    count: 0,
  },
  "detected-gated-mode": {
    reason:
      "P4 keeps informative mode on detected typed populations even when evidence gating prevents execution. Both versions still return NA and score zero; the audit contributes no score mass in either version.",
    source: "packages/core/src/audit-runner.ts",
    regression: "packages/core/src/tests/selected-page-evidence.test.ts",
    count: 0,
  },
};
const groups = new Map();
const cases = [];
const unknown = [];
const transitions = {};
let verdictChanges = 0;
const auditIds = [
  ...new Set(raw.results.flatMap((r) => r.after.coverage.map((c) => c.id))),
].sort();
const auditIndex = new Map(auditIds.map((id, index) => [id, index]));
for (const [caseIndex, entry] of raw.results.entries()) {
  for (const change of entry.changes) {
    const a = change.before,
      b = change.after;
    let cause;
    if (
      a.tags.includes("skipped:no-evidence") &&
      change.explanationBefore ===
        "Not assessed: no scanned homepage page served readable text." &&
      !b.tags.includes("skipped:no-evidence")
    )
      cause = "common-page-gate";
    else if (
      articleIds.has(change.id) &&
      entry.after.pageType !== "article" &&
      b.status === "na" &&
      b.tags.includes("skipped:page-type")
    )
      cause = "article-population";
    else if (
      entry.scenario === "detected" &&
      a.status === "na" &&
      b.status === "na" &&
      a.score === 0 &&
      b.score === 0 &&
      a.mode !== "informative" &&
      b.mode === "informative" &&
      a.tags.includes("skipped:no-evidence") &&
      b.tags.includes("skipped:no-evidence")
    )
      cause = "detected-gated-mode";
    if (!cause) {
      unknown.push({
        fixture: entry.fixture,
        scenario: entry.scenario,
        ...change,
      });
      continue;
    }
    causes[cause].count++;
    if (a.status !== b.status) verdictChanges++;
    const transition = `${a.status}->${b.status}`;
    transitions[transition] = (transitions[transition] ?? 0) + 1;
    const summary = { audit: change.id, before: a, after: b, cause };
    const key = JSON.stringify(summary);
    if (!groups.has(key)) groups.set(key, { ...summary, cases: [] });
    groups.get(key).cases.push(caseIndex);
  }
  const coverageGroups = new Map();
  for (const coverage of entry.after.coverage) {
    const { id, ...fields } = coverage;
    if (fields.inputUrls.some((url) => !fields.selectedUrls.includes(url)))
      throw new Error(`Input URL outside selection: ${entry.fixture}/${id}`);
    if (fields.unreadUrls.some((url) => !fields.selectedUrls.includes(url)))
      throw new Error(`Unread URL outside selection: ${entry.fixture}/${id}`);
    const key = JSON.stringify(fields);
    if (!coverageGroups.has(key))
      coverageGroups.set(key, { ...fields, audits: [] });
    coverageGroups.get(key).audits.push(auditIndex.get(id));
  }
  cases.push({
    ...entry,
    changes: undefined,
    after: { ...entry.after, coverage: [...coverageGroups.values()] },
  });
}
const review = {
  formatVersion: 1,
  readingGuide: {
    cases:
      "Each case identifies a frozen response and declaration scenario. No live verdict is implied.",
    changes:
      "Each group gives an audit, exact old/new status/score/mode/tags, a reviewed cause, and zero-based indexes into cases. Expanding the groups accounts for every changed record.",
    coverage:
      "Coverage groups share URL sets. Their audits are zero-based indexes into auditIds. Old coverage is explicitly not recorded; no old URL sets are fabricated.",
    scores:
      "runnerScore is diagnostic, before full-orchestrator score suppression. Do not publish it as a site score.",
  },
  baselineCommit: raw.baselineCommit,
  comparisonTime: raw.comparisonTime,
  limits: raw.limits,
  summary: {
    fixtures: raw.fixtureCount,
    scenarios: raw.scenarioCount,
    auditsPerScenario: 215,
    comparedPerEngine: raw.scenarioCount * 215,
    changedRecords: raw.changedResults,
    verdictChanges,
    unchangedRecords: raw.scenarioCount * 215 - raw.changedResults,
    transitionCounts: transitions,
    errors: raw.errors.length,
    unknown: unknown.length,
  },
  causes,
  auditIds,
  cases,
  changes: [...groups.values()],
  errors: raw.errors,
  unknown,
};
if (
  Object.values(causes).reduce((n, c) => n + c.count, 0) + unknown.length !==
  raw.changedResults
)
  throw new Error("Change accounting differs");
if (
  raw.results.some(
    (r) => r.before.auditCount !== 215 || r.after.auditCount !== 215,
  )
)
  throw new Error("Registry count changed");
writeFileSync(output, JSON.stringify(review, null, 2) + "\n");
console.log(JSON.stringify(review.summary));
if (unknown.length || raw.errors.length) process.exitCode = 1;
