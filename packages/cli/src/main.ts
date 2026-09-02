import {
  runScan,
  loadConfigFile,
  getPreset,
  logger,
  CATEGORY_IDS,
  type ScanEvent,
  type AuditTrace,
} from "@forkpoint/agent-lighthouse-core";
import { createProgressRenderer } from "./progress-renderer";
import {
  parseCliOptions,
  resolveCommand,
  isValidUrl,
  parseCategoryAssertions,
  failedAssertion,
  selectDebugChecks,
  openCommand,
  PAGE_TYPE_IDS,
} from "./options";
import { tierMarker } from "./tier-marker";
import {
  buildReportView,
  generateHtmlReport,
  generateMarkdownSummary,
} from "@forkpoint/agent-lighthouse-report";
import {
  writeFileSync,
  mkdirSync,
  readFileSync,
  appendFileSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";
import { exec } from "node:child_process";

const args = process.argv.slice(2);

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
  --debug-audit <id|fails>     Print deep diagnostic breakdown for a specific audit ID
                               (e.g. structured-data/faqpage-schema) or all fails
  --trace [path]               Write one NDJSON record per audit — outcome, status, score,
                               duration and the evidence behind it — including the audits
                               that were skipped or errored. Defaults to
                               ./agent-lighthouse-trace.ndjson
  --categories <list>          Comma-separated list of categories to audit
  --page-type <type>           Declare what the target URL is: homepage, category,
                               product or content. Page-typed audits score only a
                               declared type; a detected one runs them as informative
                               (access-crawl-control, content-extraction, machine-discovery,
                               structured-data, answer-readiness, agent-interfaces,
                               agentic-commerce, operability-safety)
  --experimental               Also run experimental-tier audits (excluded by default;
                               they are reported but never scored)
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
  npx @forkpoint/agent-lighthouse https://yourstore.com --debug-audit structured-data/faqpage-schema
  npx @forkpoint/agent-lighthouse https://staging.yourstore.com --min-score 85
`);
  process.exit(1);
}

function openInBrowser(filePath: string) {
  exec(openCommand(process.platform, filePath), () => {});
}

async function audit(targetUrl?: string) {
  const configPath = parseCliOptions(args, targetUrl).configPath;
  const fileConfig = loadConfigFile(configPath);
  const opts = parseCliOptions(args, targetUrl, fileConfig);

  const url = opts.url;
  if (!url) {
    console.error("\x1b[31mError:\x1b[0m No target URL specified.");
    usage();
  }

  if (!isValidUrl(url)) {
    console.error(`\x1b[31mInvalid URL:\x1b[0m ${url}`);
    process.exit(1);
  }

  const {
    isSilent,
    progressJson,
    shouldView,
    debugAudit,
    minScore,
    outputDir,
    tracePath,
  } = opts;
  // Keep the NDJSON stream clean: scanner logs also go to stderr.
  if (progressJson) logger.level = "silent";

  const presetName = opts.presetName;
  const preset = getPreset(presetName);

  const {
    categories,
    unknownCategories,
    includeExperimental,
    outputFormats,
    pageType,
    invalidPageType,
  } = opts;
  if (unknownCategories.length > 0) {
    console.error(
      `\x1b[31mUnknown category: ${unknownCategories.join(", ")}\x1b[0m\nValid categories: ${CATEGORY_IDS.join(", ")}`,
    );
    process.exit(1);
  }
  if (invalidPageType !== undefined) {
    console.error(
      `\x1b[31mUnknown page type: ${invalidPageType}\x1b[0m\nValid page types: ${PAGE_TYPE_IDS.join(", ")}`,
    );
    process.exit(1);
  }

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

  // One NDJSON record per audit, appended as the scan runs so a crash still
  // leaves the trace up to the point it stopped. Truncated first: a trace that
  // silently appended to the previous run's would read as one impossible scan.
  const traceFile = tracePath ? resolve(tracePath) : undefined;
  if (traceFile) rmSync(traceFile, { force: true });
  const onAuditTrace = traceFile
    ? (trace: AuditTrace) =>
        appendFileSync(traceFile, `${JSON.stringify(trace)}\n`)
    : undefined;

  const report = await runScan(url, {
    onEvent,
    ...(categories ? { categories } : {}),
    ...(pageType ? { pageType } : {}),
    includeExperimental,
    ...(onAuditTrace ? { onAuditTrace } : {}),
  });

  const view = buildReportView(report);

  // Terminal Output
  if (outputFormats.includes("terminal") && !isSilent) {
    console.log(
      `\x1b[1m────────────────────────────────────────────────────────────────────────\x1b[0m`,
    );
    console.log(
      view.overallScore === null
        ? `\x1b[1mOVERALL AGENT READINESS:\x1b[0m \x1b[33mNOT SCORED\x1b[0m — ${
            view.unscoredReason ??
            "this scan obtained too little evidence to judge the site."
          }`
        : `\x1b[1mOVERALL AGENT READINESS:\x1b[0m \x1b[1m${view.overallScore}/100\x1b[0m (${view.scoreTier?.toUpperCase()})`,
    );
    console.log(
      `Target: ${report.url} | Preset: ${preset.name} | Pages: ${view.pagesScanned.length} | Duration: ${(view.durationMs / 1000).toFixed(1)}s`,
    );
    if (view.conditions) {
      const cond = view.conditions;
      const pct =
        cond.coverage.registryMass > 0
          ? Math.round(
              (cond.coverage.assessedMass / cond.coverage.registryMass) * 100,
            )
          : 0;
      console.log(
        `Conditions: Page: \x1b[1m${cond.pageType.type}\x1b[0m (${cond.pageType.source}) | ` +
          `Origin: \x1b[1m${cond.origin.cached ? "cached" : "fresh"}\x1b[0m | ` +
          `Coverage: \x1b[1m${cond.coverage.assessedMass}/${cond.coverage.registryMass}\x1b[0m mass (${pct}%) | ` +
          `Unscored: \x1b[1m${cond.unscored.totalCount}\x1b[0m (${cond.unscored.informativeCount} advisory, ${cond.unscored.gatedCount} gated)`,
      );
    }
    if (view.coverage.skippedNoEvidence > 0) {
      // The count alone reads as a broken scanner; the reason makes it a fact
      // about the scan.
      console.log(
        `\x1b[33m${view.coverage.skippedNoEvidence} audit(s) not assessed:\x1b[0m ` +
          `this scan did not obtain the evidence they need. ${view.coverage.noEvidenceReasons.join(" ")}`,
      );
    }
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
            )}/100\x1b[0m  \x1b[90m(${c.pass}✓ ${c.warn}! ${c.fail}✗${c.advisory > 0 ? ` ${c.advisory} advisory` : ""})\x1b[0m`,
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
    const targetChecks = selectDebugChecks(allChecks, debugAudit);

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
          `\n${statusBadge} \x1b[1m[${check.id}] ${check.title}\x1b[0m (Score: ${check.score})${tierMarker(check.tier)}`,
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

  if (traceFile && !isSilent) {
    console.log(`  \x1b[90m• Audit trace:\x1b[0m    ${traceFile}`);
  }

  if (shouldView && htmlPath) {
    openInBrowser(htmlPath);
  }

  // Overall Score Assertion. An unscored scan fails it: the assertion asks for
  // proof the site clears a bar, and a scan that saw too little proves nothing.
  if (minScore > 0 && view.overallScore === null) {
    console.error(
      `\n\x1b[31m✖ CI Assertion Failed:\x1b[0m The scan produced no score, so it cannot clear ${minScore}. ` +
        (view.unscoredReason ??
          "It obtained too little evidence to judge the site."),
    );
    process.exit(1);
  }
  if (
    minScore > 0 &&
    view.overallScore !== null &&
    view.overallScore < minScore
  ) {
    console.error(
      `\n\x1b[31m✖ CI Assertion Failed:\x1b[0m Overall score ${view.overallScore} is below minimum threshold ${minScore}`,
    );
    process.exit(1);
  }

  // Per-category Assertions
  const failed = failedAssertion(
    view.groups.flatMap((g) => g.categories),
    parseCategoryAssertions(args, fileConfig),
  );
  if (failed) {
    console.error(
      `\n\x1b[31m✖ Category Assertion Failed:\x1b[0m Category '${failed.name}' scored ${failed.score} (threshold: ${failed.threshold})`,
    );
    process.exit(1);
  }
}

async function main() {
  const resolved = resolveCommand(args);
  if (resolved.action === "help") usage();
  await audit(resolved.url);
}

main().catch((err) => {
  console.error("\x1b[31mFatal error:\x1b[0m", err.message ?? err);
  process.exit(1);
});
