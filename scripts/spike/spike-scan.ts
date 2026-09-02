/**
 * Spike step 2: how many audits make a claim they have no evidence for?
 *
 * Runs a real scan against sites where the scan provably did not obtain the
 * content (client-rendered shells, WAF walls) and counts, per site:
 *   - audits that read `ctx.pages` and still returned pass/fail/warn
 *   - what those verdicts did to the score
 *
 * That count is the number the evidence-gate design is or is not warranted by.
 */
import * as fs from "node:fs";
import { runScan } from "../../packages/core/src/index";
import type { AuditTrace } from "../../packages/core/src/index";

const READS_PAGES = new Set(
  fs
    .readFileSync(`${__dirname}/reads-pages.txt`, "utf8")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean),
);

const TARGETS: Array<{ url: string; kind: "shell" | "waf" | "control" }> = [
  { url: "https://excalidraw.com", kind: "shell" },
  { url: "https://www.tldraw.com", kind: "shell" },
  { url: "https://web.telegram.org", kind: "shell" },
  { url: "https://mail.proton.me", kind: "shell" },
  { url: "https://music.youtube.com", kind: "shell" },
  { url: "https://ridge.com", kind: "waf" },
  { url: "https://westontable.com", kind: "waf" },
  { url: "https://developer.mozilla.org", kind: "control" },
  { url: "https://allbirds.com", kind: "control" },
];

interface SiteResult {
  url: string;
  kind: string;
  ok: boolean;
  error?: string;
  score: number | null;
  waf?: {
    provider?: string;
    isBlocked: boolean;
    statusCode?: number;
    isRateLimit?: boolean;
  };
  pagesScanned: number;
  homepageWords?: number;
  totals: { total: number; ran: number; skipped: number; errored: number };
  status: Record<string, number>;
  /** Audits that read ctx.pages and still produced a verdict. */
  claimedWithoutPages: { pass: number; fail: number; warn: number; na: number };
  claimIds: string[];
  traces?: Array<{
    id: string;
    category: string;
    status: string;
    score: number;
    weight: number;
  }>;
}

async function scanOne(t: { url: string; kind: string }): Promise<SiteResult> {
  const traces: AuditTrace[] = [];
  const res: SiteResult = {
    url: t.url,
    kind: t.kind,
    ok: false,
    score: null,
    pagesScanned: 0,
    totals: { total: 0, ran: 0, skipped: 0, errored: 0 },
    status: {},
    claimedWithoutPages: { pass: 0, fail: 0, warn: 0, na: 0 },
    claimIds: [],
  };
  try {
    const report = await runScan(t.url, {
      onAuditTrace: (tr) => traces.push(tr),
    });
    res.ok = true;
    res.score = report.overallScore;
    res.pagesScanned = report.pagesScanned.length;
    if (report.wafProtection) {
      res.waf = {
        provider: report.wafProtection.provider,
        isBlocked: report.wafProtection.isBlocked,
        statusCode: report.wafProtection.statusCode,
        isRateLimit: (report.wafProtection as { isRateLimit?: boolean })
          .isRateLimit,
      };
    }
  } catch (err) {
    res.error = err instanceof Error ? err.message : String(err);
    return res;
  }

  res.totals.total = traces.length;
  for (const tr of traces) {
    res.totals[
      tr.outcome === "ran"
        ? "ran"
        : tr.outcome === "skipped"
          ? "skipped"
          : "errored"
    ]++;
    res.status[tr.status] = (res.status[tr.status] ?? 0) + 1;
    if (READS_PAGES.has(tr.id)) {
      const s = tr.status as "pass" | "fail" | "warn" | "na";
      res.claimedWithoutPages[s] = (res.claimedWithoutPages[s] ?? 0) + 1;
      if (s !== "na") res.claimIds.push(`${s}:${tr.id}`);
    }
  }
  res.traces = traces.map((t) => ({
    id: t.id,
    category: t.category,
    status: t.status,
    score: t.score,
    weight: t.weight,
  }));
  return res;
}

async function main() {
  const out: SiteResult[] = [];
  for (const t of TARGETS) {
    process.stdout.write(`scanning ${t.url} ... `);
    const r = await scanOne(t);
    out.push(r);
    if (!r.ok) {
      console.log(`ERROR ${r.error}`);
    } else {
      const c = r.claimedWithoutPages;
      console.log(
        `score=${r.score} pages=${r.pagesScanned} waf=${r.waf?.provider ?? "-"}/${r.waf?.statusCode ?? "-"} | page-reading audits: pass=${c.pass} fail=${c.fail} warn=${c.warn} na=${c.na}`,
      );
    }
    await new Promise((rr) => setTimeout(rr, 4000));
  }
  const path = process.argv[2] ?? `${__dirname}/spike-scan.json`;
  fs.writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`\nwritten: ${path}`);
}

void main();
