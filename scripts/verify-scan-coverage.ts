import * as fs from 'node:fs';
import * as path from 'node:path';
import { defaultConfig, filterConfig, TAG_SCAN_ERROR, TAG_SKIPPED_PAGE_TYPE } from '../packages/core/src';
import type { ScanReport, CheckResult } from '../packages/core/src';

/**
 * Prove that every audit ran, on every store a benchmark scanned.
 *
 * A scan never throws: `audit-runner.ts` catches an audit that fails and
 * replaces it with a `scan-error`-tagged stub, so the report is complete and
 * the run keeps going. That is the right behaviour for an operator — one
 * broken audit should not lose the other 214 — but it means a defect looks
 * like an ordinary not-applicable unless someone goes looking.
 *
 * This is the going-looking. For each store it answers three questions:
 *
 *   1. Did every registered audit produce a result?
 *   2. Did any of them come back as a `scan-error` stub?
 *   3. What did the rest report?
 *
 * Exits non-zero if the answer to 1 is no or the answer to 2 is yes, so it can
 * gate a release the same way the test suite does.
 *
 * Usage:
 *   npx tsx scripts/verify-scan-coverage.ts [data-file.json]
 */

const DEFAULT_DATA = 'reports/investigation/benchmark-stores-data.json';

interface StoreResult {
  url: string;
  status: 'success' | 'error' | 'bot_blocked';
  report?: ScanReport;
  error?: string;
}

/** Every audit a default scan is expected to run — experimental tier excluded. */
function expectedAuditIds(): Set<string> {
  const config = filterConfig(defaultConfig, { includeExperimental: false });
  return new Set(Object.values(config.audits).flat().map((reg) => reg.meta.id));
}

function allChecks(report: ScanReport): CheckResult[] {
  return (report.categories ?? []).flatMap((category) => category.checks ?? []);
}

interface StoreVerdict {
  url: string;
  ran: number;
  missing: string[];
  scanErrors: Array<{ id: string; explanation: string }>;
  skipped: number;
  counts: Record<string, number>;
}

function verify(store: StoreResult, expected: Set<string>): StoreVerdict {
  const checks = allChecks(store.report!);
  const seen = new Set(checks.map((c) => c.id));
  const counts: Record<string, number> = {};
  const scanErrors: StoreVerdict['scanErrors'] = [];
  let skipped = 0;

  for (const check of checks) {
    const tags = check.tags ?? [];
    if (tags.includes(TAG_SCAN_ERROR)) {
      scanErrors.push({ id: check.id, explanation: check.explanation ?? '' });
      continue;
    }
    if (tags.includes(TAG_SKIPPED_PAGE_TYPE)) {
      skipped += 1;
      continue;
    }
    counts[check.status] = (counts[check.status] ?? 0) + 1;
  }

  return {
    url: store.url,
    ran: checks.length,
    missing: [...expected].filter((id) => !seen.has(id)),
    scanErrors,
    skipped,
    counts,
  };
}

/** The first line of an error, which is the part worth printing. */
function firstLine(text: string): string {
  return (text.split('\n')[0] ?? '').slice(0, 160);
}

function main(): void {
  const dataPath = path.resolve(process.argv[2] ?? DEFAULT_DATA);
  if (!fs.existsSync(dataPath)) {
    console.error(`No benchmark data at ${dataPath}`);
    process.exit(2);
  }

  // The benchmark writes a domain-keyed object so a resumed run can overwrite
  // one store in place; older files are a plain array.
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as StoreResult[] | Record<string, StoreResult>;
  const stores = Array.isArray(raw) ? raw : Object.values(raw);
  const expected = expectedAuditIds();
  const scanned = stores.filter((s) => s.status === 'success' && s.report);
  const blocked = stores.filter((s) => s.status === 'bot_blocked');
  const failed = stores.filter((s) => s.status === 'error');

  console.log(`\nScan coverage — ${path.basename(dataPath)}`);
  console.log(`${stores.length} store(s): ${scanned.length} scanned, ${blocked.length} bot-blocked, ${failed.length} errored`);
  console.log(`${expected.size} audits expected per scan (experimental tier excluded)\n`);

  const verdicts = scanned.map((store) => verify(store, expected));

  // Aggregate first: one line per defect kind beats one line per store.
  const errorsByAudit = new Map<string, { stores: number; example: string }>();
  const missingByAudit = new Map<string, number>();
  for (const v of verdicts) {
    for (const e of v.scanErrors) {
      const entry = errorsByAudit.get(e.id) ?? { stores: 0, example: e.explanation };
      entry.stores += 1;
      errorsByAudit.set(e.id, entry);
    }
    for (const id of v.missing) missingByAudit.set(id, (missingByAudit.get(id) ?? 0) + 1);
  }

  const totals: Record<string, number> = {};
  let totalChecks = 0;
  let totalSkipped = 0;
  for (const v of verdicts) {
    totalChecks += v.ran;
    totalSkipped += v.skipped;
    for (const [status, n] of Object.entries(v.counts)) totals[status] = (totals[status] ?? 0) + n;
  }

  console.log(`${totalChecks} check results across ${verdicts.length} scan(s)`);
  console.log(
    `  statuses: ${Object.entries(totals).map(([s, n]) => `${s} ${n}`).join(', ')}` +
      `${totalSkipped > 0 ? `, skipped:page-type ${totalSkipped}` : ''}\n`,
  );

  if (errorsByAudit.size > 0) {
    console.log(`SCAN ERRORS — ${errorsByAudit.size} audit(s) failed to run:`);
    for (const [id, { stores: n, example }] of [...errorsByAudit].sort((a, b) => b[1].stores - a[1].stores)) {
      console.log(`  ${String(n).padStart(3)} store(s)  ${id}`);
      console.log(`             ${firstLine(example)}`);
    }
    console.log();
  }

  if (missingByAudit.size > 0) {
    console.log(`MISSING — ${missingByAudit.size} audit(s) produced no result at all:`);
    for (const [id, n] of [...missingByAudit].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(3)} store(s)  ${id}`);
    }
    console.log();
  }

  // Blocked and errored stores are reported, never counted as clean: a scan
  // that never reached the site proves nothing about the audits.
  if (blocked.length > 0) {
    console.log(`Bot-blocked (not evidence either way): ${blocked.map((s) => s.url).join(', ')}\n`);
  }
  if (failed.length > 0) {
    console.log('Errored:');
    for (const s of failed) console.log(`  ${s.url} — ${firstLine(s.error ?? '')}`);
    console.log();
  }

  const clean = errorsByAudit.size === 0 && missingByAudit.size === 0 && failed.length === 0;
  console.log(
    clean
      ? `OK — all ${expected.size} audits produced a result on all ${verdicts.length} scanned store(s).`
      : 'FAILED — see above.',
  );
  process.exit(clean ? 0 : 1);
}

main();
