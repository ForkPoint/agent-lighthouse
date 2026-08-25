import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ScanReport } from '../packages/core/src';

const dataPath = path.resolve(__dirname, '../reports/investigation/benchmark-stores-data.json');
const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

interface StoreResult {
  url: string;
  status: 'success' | 'error' | 'bot_blocked';
  score?: number;
  tier?: string;
  report?: ScanReport;
  error?: string;
  waf?: string;
  durationMs: number;
}

const stores = Object.entries(rawData) as [string, StoreResult][];

console.log(`\n========================================================================`);
console.log(`100-STORE BENCHMARK INVESTIGATION REPORT`);
console.log(`========================================================================\n`);

const successStores = stores.filter(([_, r]) => r.status === 'success' && r.report);
const blockedStores = stores.filter(([_, r]) => r.status === 'bot_blocked');
const errorStores = stores.filter(([_, r]) => r.status === 'error');

console.log(`Total Stores: ${stores.length}`);
console.log(`✓ Successful Scans: ${successStores.length}`);
console.log(`🛑 Bot Walls / WAF Protected: ${blockedStores.length}`);
console.log(`✗ Errors / Unreachable: ${errorStores.length}`);

// List blocked stores with WAF names
if (blockedStores.length > 0) {
  console.log(`\n--- BOT-WALL PROTECTED SITES ---`);
  for (const [domain, res] of blockedStores) {
    console.log(`  • ${domain}: ${res.waf || 'Aggressive Bot Protection / Cloudflare Challenge / Akamai'}`);
  }
}

// Average scores
if (successStores.length > 0) {
  const avgScore = successStores.reduce((acc, [_, r]) => acc + (r.score ?? 0), 0) / successStores.length;
  console.log(`\n--- SCORE STATISTICS ---`);
  console.log(`Average Overall Score: ${avgScore.toFixed(1)}/100`);

  const scores = successStores.map(([_, r]) => r.score ?? 0).sort((a, b) => b - a);
  console.log(`Highest Score: ${scores[0]}/100`);
  console.log(`Lowest Score: ${scores[scores.length - 1]}/100`);
  console.log(`Median Score: ${scores[Math.floor(scores.length / 2)]}/100`);

  // Breakdown of top performing stores
  console.log(`\n--- TOP 10 HIGHEST SCORING STORES ---`);
  const topStores = [...successStores].sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0)).slice(0, 10);
  for (const [domain, res] of topStores) {
    console.log(`  • ${domain}: ${res.score}/100 (${res.tier})`);
  }

  // Breakdown of lowest scoring stores
  console.log(`\n--- 10 LOWEST SCORING STORES ---`);
  const lowestStores = [...successStores].sort((a, b) => (a[1].score ?? 0) - (b[1].score ?? 0)).slice(0, 10);
  for (const [domain, res] of lowestStores) {
    console.log(`  • ${domain}: ${res.score}/100 (${res.tier})`);
  }
}

// Check Stats across all successful reports
const checkStats: Record<string, {
  id: string;
  title: string;
  category: string;
  passCount: number;
  warnCount: number;
  failCount: number;
  sampleExplanations: string[];
}> = {};

for (const [domain, res] of successStores) {
  if (!res.report) continue;
  for (const cat of res.report.categories) {
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
        if (checkStats[check.id].sampleExplanations.length < 3) {
          checkStats[check.id].sampleExplanations.push(`[${domain}] WARN: ${check.explanation || check.displayValue}`);
        }
      }
      if (check.status === 'fail') {
        checkStats[check.id].failCount++;
        if (checkStats[check.id].sampleExplanations.length < 3) {
          checkStats[check.id].sampleExplanations.push(`[${domain}] FAIL: ${check.explanation || check.displayValue}`);
        }
      }
    }
  }
}

console.log(`\n========================================================================`);
console.log(`AUDIT HEURISTIC ACCURACY & DISTRIBUTION ACROSS ${successStores.length} LIVE STORES`);
console.log(`========================================================================\n`);

// Group by category and print stats
const categories = Array.from(new Set(Object.values(checkStats).map(c => c.category)));
for (const cat of categories) {
  const catChecks = Object.values(checkStats).filter(c => c.category === cat);
  console.log(`\nCategory: [${cat}] (${catChecks.length} checks)`);
  for (const c of catChecks) {
    const passPct = ((c.passCount / successStores.length) * 100).toFixed(0);
    const warnPct = ((c.warnCount / successStores.length) * 100).toFixed(0);
    const failPct = ((c.failCount / successStores.length) * 100).toFixed(0);
    console.log(`  • [${c.id}] ${c.title.padEnd(45)} -> ${passPct}% pass | ${warnPct}% warn | ${failPct}% fail`);
  }
}
