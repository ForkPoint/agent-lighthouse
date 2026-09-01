import { runScan, type ScanReport } from "../packages/core/src";
import * as fs from "node:fs";
import * as path from "node:path";

const STORES = [
  { name: "Hiut Denim Co.", url: "https://hiutdenim.co.uk" },
  { name: "United By Blue", url: "https://unitedbyblue.com" },
  { name: "Velasca", url: "https://www.velasca.com" },
  { name: "Fashion Nova", url: "https://www.fashionnova.com" },
  { name: "Lunchskins", url: "https://www.lunchskins.com" },
  { name: "Cocolab", url: "https://cocolab.com" },
  { name: "Artisaire", url: "https://artisaire.com" },
  { name: "Terre Bleu", url: "https://www.terrebleu.ca" },
];

async function main() {
  console.log(
    `Starting deep false-positive investigation on ${STORES.length} stores...\n`,
  );
  const reports: Record<string, ScanReport> = {};

  for (const store of STORES) {
    console.log(`\n======================================================`);
    console.log(`Auditing: ${store.name} (${store.url})`);
    console.log(`======================================================`);
    try {
      const report = await runScan(store.url, {
        onEvent: (event) => {
          if (event.type === "phase:done" || event.type === "scan:done") {
            console.log(
              `  [${Math.round(event.fraction * 100)}%] ${event.type === "phase:done" ? event.phase : "complete"}`,
            );
          }
        },
      });
      reports[store.name] = report;
      console.log(
        `\n  ✓ COMPLETED: Score ${report.overallScore}/100 | Pages: ${report.pagesScanned.length} | Duration: ${(report.durationMs / 1000).toFixed(1)}s`,
      );
      if (report.wafProtection?.isBlocked) {
        console.log(
          `  🛡️ WAF: ${report.wafProtection.name} - ${report.wafProtection.reason}`,
        );
      }

      const fails = report.recommendations.filter((r) => r.status === "fail");
      const warns = report.recommendations.filter((r) => r.status === "warn");
      console.log(
        `  Summary: ${report.topPasses.length} top passes, ${warns.length} warnings, ${fails.length} failures`,
      );
    } catch (err) {
      console.error(`  ✗ Error auditing ${store.name}:`, err);
    }
  }

  const outDir = path.resolve(__dirname, "../reports/investigation");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "stores-audit-data.json"),
    JSON.stringify(reports, null, 2),
  );

  console.log(
    `\nAll audits completed. Generated summary report at ${path.join(outDir, "stores-audit-data.json")}`,
  );
}

main().catch(console.error);
