import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ScanReport, CheckResult } from '../packages/core/src';

const dataPath = path.resolve(__dirname, '../reports/investigation/stores-audit-data.json');
const reports: Record<string, ScanReport> = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

console.log(`\n========================================================================`);
console.log(`INVESTIGATION MATRIX: 8 BENCHMARK STORES`);
console.log(`========================================================================\n`);

const summaryTable: Array<{
  Store: string;
  Score: number;
  Tier: string;
  Commerce: number;
  Content: number;
  BotAccess: number;
  Technical: number;
  Passes: number;
  Warnings: number;
  Failures: number;
}> = [];

for (const [name, report] of Object.entries(reports)) {
  const allChecks = report.categories.flatMap(c => c.checks);
  const passes = allChecks.filter(c => c.status === 'pass').length;
  const warns = allChecks.filter(c => c.status === 'warn').length;
  const fails = allChecks.filter(c => c.status === 'fail').length;

  summaryTable.push({
    Store: name,
    Score: report.overallScore,
    Tier: report.scoreTier,
    Commerce: report.readinessVitals?.commerce ?? 0,
    Content: report.readinessVitals?.content ?? 0,
    BotAccess: report.readinessVitals?.botAccessibility ?? 0,
    Technical: report.readinessVitals?.technical ?? 0,
    Passes: passes,
    Warnings: warns,
    Failures: fails,
  });
}

console.table(summaryTable);

// Group all failures & warnings across stores by check ID to find potential false positives
const checkStats: Record<string, {
  id: string;
  title: string;
  category: string;
  passCount: number;
  warnCount: number;
  failCount: number;
  sampleExplanations: string[];
}> = {};

for (const [storeName, report] of Object.entries(reports)) {
  for (const cat of report.categories) {
    for (const check of cat.checks) {
      if (!checkStats[check.id]) {
        checkStats[check.id] = {
          id: check.id,
          title: check.title,
          category: cat.id,
          passCount: 0,
          warnCount: 0,
          failCount: 0,
          sampleExplanations: [],
        };
      }
      if (check.status === 'pass') checkStats[check.id].passCount++;
      if (check.status === 'warn') {
        checkStats[check.id].warnCount++;
        checkStats[check.id].sampleExplanations.push(`[${storeName}] WARN: ${check.explanation || check.displayValue}`);
      }
      if (check.status === 'fail') {
        checkStats[check.id].failCount++;
        checkStats[check.id].sampleExplanations.push(`[${storeName}] FAIL: ${check.explanation || check.displayValue}`);
      }
    }
  }
}

// Identify checks where ALL or MOST stores failed or warned
console.log(`\n========================================================================`);
console.log(`POTENTIAL FALSE-POSITIVE / HARSH AUDIT CANDIDATES (>=7 stores failing/warning)`);
console.log(`========================================================================\n`);

const highFailureChecks = Object.values(checkStats)
  .filter(c => c.failCount + c.warnCount >= 7)
  .sort((a, b) => (b.failCount + b.warnCount) - (a.failCount + a.warnCount));

for (const c of highFailureChecks) {
  console.log(`\n• Check [${c.id}] ${c.title} (${c.category})`);
  console.log(`  Verdict: ${c.passCount} pass, ${c.warnCount} warn, ${c.failCount} fail`);
  console.log(`  Sample details:`);
  for (const sample of c.sampleExplanations.slice(0, 3)) {
    console.log(`    - ${sample}`);
  }
}
