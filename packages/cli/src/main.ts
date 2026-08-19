import {
  runScan,
  loadConfigFile,
  getPreset,
  logger,
  type PresetName,
  type ScanEvent,
} from "@forkpoint/agent-lighthouse-core";
import { createProgressRenderer } from "./progress-renderer";
import {
  buildReportView,
  generateHtmlReport,
  generateMarkdownSummary,
} from "@forkpoint/agent-lighthouse-report";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { exec } from "node:child_process";

const args = process.argv.slice(2);
const command = args[0];

function getPackageVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, "../package.json"), "utf8"),
    ) as { version?: string };
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

function printBanner() {
  console.log(`
\x1b[1m\x1b[36m🗼 Agent Lighthouse\x1b[0m \x1b[90mv${getPackageVersion()}\x1b[0m
\x1b[90mThe Open-Source Lighthouse for the Agentic Web\x1b[0m
`);
}

function usage(): never {
  printBanner();
  console.log(`Usage:
  agent-lighthouse <url> [options]
  agent-lighthouse audit <url> [options]

Options:
  -p, --preset <name>          Audit preset (ecommerce, saas, content, quick, full) [default: full]
  -c, --config <path>          Path to configuration file (e.g. agent-lighthouse.config.json)
  --debug-audit <id|fails>     Print deep diagnostic breakdown for specific audit ID (e.g. 3.2) or all fails
  --categories <list>          Comma-separated list of categories to audit
  -o, --output <formats>       Output formats (comma-separated: terminal, html, json, md) [default: terminal,html,json]
  -d, --output-dir <path>      Output directory for generated reports [default: ./reports]
  -v, --view                   Automatically open the generated HTML report in your browser
  --min-score <number>         Minimum score (0-100) required to pass CI assertions
  --assert-category <id:min>   Per-category assertions (e.g. --assert-category structured-data:90)
  --silent                     Suppress progress output
  --progress-json              Stream scan progress as NDJSON (one ScanEvent per line) to stderr
                               and suppress the interactive progress display. Stderr is used so
                               NDJSON never interleaves with the terminal report on stdout;
                               all scanner logs (including error logs) are silenced to keep the
                               stream clean — audit errors still appear in the report itself.

Examples:
  npx @forkpoint/agent-lighthouse https://yourstore.com
  npx @forkpoint/agent-lighthouse https://yourstore.com --preset ecommerce
  npx @forkpoint/agent-lighthouse https://yourstore.com --debug-audit 3.2
  npx @forkpoint/agent-lighthouse https://staging.yourstore.com --min-score 85
`);
  process.exit(1);
}

function openInBrowser(filePath: string) {
  const cmd =
    process.platform === "darwin"
      ? `open "${filePath}"`
      : process.platform === "win32"
        ? `start "" "${filePath}"`
        : `xdg-open "${filePath}"`;
  exec(cmd, () => {});
}

function getArgValue(shortFlag: string, longFlag: string): string | undefined {
  for (const arg of args) {
    if (shortFlag && arg.startsWith(`${shortFlag}=`)) {
      return arg.slice(shortFlag.length + 1);
    }
    if (longFlag && arg.startsWith(`${longFlag}=`)) {
      return arg.slice(longFlag.length + 1);
    }
  }
  const shortIdx = shortFlag ? args.indexOf(shortFlag) : -1;
  if (
    shortIdx !== -1 &&
    args[shortIdx + 1] &&
    !args[shortIdx + 1].startsWith("-")
  ) {
    return args[shortIdx + 1];
  }
  const longIdx = longFlag ? args.indexOf(longFlag) : -1;
  if (
    longIdx !== -1 &&
    args[longIdx + 1] &&
    !args[longIdx + 1].startsWith("-")
  ) {
    return args[longIdx + 1];
  }
  return undefined;
}

async function audit(targetUrl?: string) {
  const customConfigPath = getArgValue("-c", "--config");
  const fileConfig = loadConfigFile(customConfigPath);

  const url = targetUrl || fileConfig.url;
  if (!url) {
    console.error("\x1b[31mError:\x1b[0m No target URL specified.");
    usage();
  }

  try {
    new URL(url);
  } catch {
    console.error(`\x1b[31mInvalid URL:\x1b[0m ${url}`);
    process.exit(1);
  }

  const isSilent = args.includes("--silent");
  const progressJson = args.includes("--progress-json");
  // Keep the NDJSON stream clean: scanner logs also go to stderr.
  if (progressJson) logger.level = "silent";
  const shouldView = args.includes("-v") || args.includes("--view");
  const debugAudit = getArgValue("", "--debug-audit");

  const presetName = (getArgValue("-p", "--preset") ||
    fileConfig.preset ||
    "full") as PresetName;
  const preset = getPreset(presetName);

  const minScoreArg = getArgValue("", "--min-score");
  const minScore = minScoreArg
    ? Number(minScoreArg)
    : (fileConfig.minScore ?? 0);

  const outputDir =
    getArgValue("-d", "--output-dir") || fileConfig.outputDir || "./reports";

  const outputFormatArg = getArgValue("-o", "--output");
  const outputFormats = outputFormatArg
    ? outputFormatArg.split(",").map((s) => s.trim())
    : (fileConfig.output ?? ["terminal", "html", "json"]);

  if (!isSilent) {
    printBanner();
    console.log(
      `Auditing \x1b[1m${url}\x1b[0m using \x1b[36m${preset.name}\x1b[0m preset ...\n`,
    );
  }

  // Progress: --progress-json streams raw ScanEvents as NDJSON to stderr (kept
  // off stdout so it can't interleave with the terminal report). Otherwise the
  // interactive renderer animates on a TTY and prints plain phase summaries in
  // CI (non-TTY). --silent suppresses all progress output as before.
  const onEvent = progressJson
    ? (event: ScanEvent) => {
        process.stderr.write(JSON.stringify(event) + "\n");
      }
    : isSilent
      ? undefined
      : createProgressRenderer({ tty: Boolean(process.stdout.isTTY) });

  const report = await runScan(url, { onEvent });

  const view = buildReportView(report);

  // Terminal Output
  if (outputFormats.includes("terminal") && !isSilent) {
    console.log(
      `\x1b[1m────────────────────────────────────────────────────────────────────────\x1b[0m`,
    );
    console.log(
      `\x1b[1mOVERALL AGENT READINESS:\x1b[0m \x1b[1m${view.overallScore}/100\x1b[0m (${view.scoreTier.toUpperCase()})`,
    );
    console.log(
      `Target: ${report.url} | Preset: ${preset.name} | Pages: ${view.pagesScanned.length} | Duration: ${(view.durationMs / 1000).toFixed(1)}s`,
    );
    console.log(
      `\x1b[1m────────────────────────────────────────────────────────────────────────\x1b[0m\n`,
    );

    if (report.wafProtection?.isBlocked) {
      console.log(
        `  \x1b[41m\x1b[37m\x1b[1m 🛡️  BOT PROTECTION WALL DETECTED: ${report.wafProtection.name.toUpperCase()} \x1b[0m`,
      );
      console.log(
        `  \x1b[31m⚠️  Diagnosis: ${report.wafProtection.reason}\x1b[0m`,
      );
      console.log(
        `  \x1b[90mThis storefront is actively dropping or challenging automated crawler connections.\x1b[0m`,
      );
      console.log(
        `  \x1b[90mAI agents (GPTBot, Claude, Perplexity) cannot index or interact with this catalog.\x1b[0m\n`,
      );
    }

    console.log(`\x1b[1m📊 CATEGORIES:\x1b[0m`);
    for (const group of view.groups) {
      console.log(
        `\n  \x1b[1m${group.label}\x1b[0m \x1b[90m—\x1b[0m ${group.score}/100`,
      );
      for (const cat of group.categories) {
        const c = cat.counts;
        const scoreColor =
          cat.score >= 90
            ? "\x1b[32m"
            : cat.score >= 70
              ? "\x1b[34m"
              : cat.score >= 50
                ? "\x1b[33m"
                : "\x1b[31m";
        console.log(
          `    ${scoreColor}•\x1b[0m ${cat.name.padEnd(36)} : ${scoreColor}${cat.score
            .toString()
            .padStart(
              3,
            )}/100\x1b[0m  \x1b[90m(${c.pass}✓ ${c.warn}! ${c.fail}✗)\x1b[0m`,
        );
      }
    }
    console.log();
  }

  // Audit Debugger Output
  if (debugAudit) {
    const allChecks = view.groups.flatMap((g) =>
      g.categories.flatMap((c) => [...c.checks, ...c.notApplicable]),
    );
    const targetChecks =
      debugAudit === "fails"
        ? allChecks.filter((c) => c.status === "fail" || c.status === "warn")
        : allChecks.filter(
            (c) =>
              c.id === debugAudit ||
              c.title.toLowerCase().includes(debugAudit.toLowerCase()),
          );

    if (targetChecks.length === 0) {
      console.log(
        `\x1b[33m[debugger] No audits found matching: ${debugAudit}\x1b[0m\n`,
      );
    } else {
      console.log(
        `\x1b[1m🔍 AUDIT DEBUGGER DIAGNOSTICS (${targetChecks.length} checks):\x1b[0m`,
      );
      console.log(
        `\x1b[1m────────────────────────────────────────────────────────────────────────\x1b[0m`,
      );

      for (const check of targetChecks) {
        const statusBadge =
          check.status === "pass"
            ? "\x1b[32m[PASS]\x1b[0m"
            : check.status === "warn"
              ? "\x1b[33m[WARN]\x1b[0m"
              : check.status === "fail"
                ? "\x1b[31m[FAIL]\x1b[0m"
                : "\x1b[90m[N/A]\x1b[0m";

        console.log(
          `\n${statusBadge} \x1b[1m[${check.id}] ${check.title}\x1b[0m (Score: ${check.score})`,
        );
        if (check.pageUrl)
          console.log(`  \x1b[90mPage:\x1b[0m        ${check.pageUrl}`);
        if (check.displayValue)
          console.log(`  \x1b[90mFound:\x1b[0m       ${check.displayValue}`);
        if (check.details?.expected)
          console.log(
            `  \x1b[90mExpected:\x1b[0m    ${check.details.expected}`,
          );
        if (check.explanation)
          console.log(`  \x1b[90mExplanation:\x1b[0m ${check.explanation}`);
        if (check.impact)
          console.log(`  \x1b[90mImpact:\x1b[0m      ${check.impact}`);
        if (check.fix)
          console.log(`  \x1b[90mFix:\x1b[0m         ${check.fix}`);
        if (check.details?.code) {
          console.log(`  \x1b[90mCode Example:\x1b[0m`);
          console.log(
            check.details.code
              .split("\n")
              .map((line: string) => `    \x1b[36m${line}\x1b[0m`)
              .join("\n"),
          );
        }
      }
      console.log(
        `\x1b[1m────────────────────────────────────────────────────────────────────────\x1b[0m\n`,
      );
    }
  }

  // Ensure output directory exists
  mkdirSync(resolve(outputDir), { recursive: true });

  // JSON Report
  if (outputFormats.includes("json")) {
    const jsonPath = resolve(outputDir, "agent-lighthouse-report.json");
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    if (!isSilent)
      console.log(`  \x1b[90m• JSON Report:\x1b[0m    ${jsonPath}`);
  }

  // HTML Report
  let htmlPath = "";
  if (outputFormats.includes("html")) {
    htmlPath = resolve(outputDir, "agent-lighthouse-report.html");
    const htmlContent = generateHtmlReport(report);
    writeFileSync(htmlPath, htmlContent);
    if (!isSilent)
      console.log(`  \x1b[90m• HTML Report:\x1b[0m    ${htmlPath}`);
  }

  // Markdown Summary
  if (outputFormats.includes("md") || outputFormats.includes("markdown")) {
    const mdPath = resolve(outputDir, "agent-lighthouse-report.md");
    const mdContent = generateMarkdownSummary(report);
    writeFileSync(mdPath, mdContent);
    if (!isSilent) console.log(`  \x1b[90m• Markdown Report:\x1b[0m ${mdPath}`);
  }

  if (shouldView && htmlPath) {
    openInBrowser(htmlPath);
  }

  // Overall Score Assertion
  if (minScore > 0 && view.overallScore < minScore) {
    console.error(
      `\n\x1b[31m✖ CI Assertion Failed:\x1b[0m Overall score ${view.overallScore} is below minimum threshold ${minScore}`,
    );
    process.exit(1);
  }

  // Per-category Assertions
  const categoryAssertions = fileConfig.assertCategories ?? {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--assert-category" && args[i + 1]) {
      const [catId, min] = args[i + 1].split(":");
      if (catId && min) categoryAssertions[catId] = Number(min);
    }
  }

  for (const [catId, threshold] of Object.entries(categoryAssertions)) {
    const matchedCategory = view.groups
      .flatMap((g) => g.categories)
      .find(
        (c) =>
          c.id === catId || c.name.toLowerCase().includes(catId.toLowerCase()),
      );

    if (matchedCategory && matchedCategory.score < threshold) {
      console.error(
        `\n\x1b[31m✖ Category Assertion Failed:\x1b[0m Category '${matchedCategory.name}' scored ${matchedCategory.score} (threshold: ${threshold})`,
      );
      process.exit(1);
    }
  }
}

async function main() {
  if (!command || command === "-h" || command === "--help") {
    usage();
  }

  if (command === "audit") {
    const url = args[1];
    await audit(url);
  } else if (!command.startsWith("-")) {
    await audit(command);
  } else {
    await audit();
  }
}

main().catch((err) => {
  console.error("\x1b[31mFatal error:\x1b[0m", err.message ?? err);
  process.exit(1);
});
