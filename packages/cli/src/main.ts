import { runScan } from '@forkpoint/agent-lighthouse-core';
import { buildReportView, generateHtmlReport, generateMarkdownSummary } from '@forkpoint/agent-lighthouse-report';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { exec } from 'node:child_process';

const args = process.argv.slice(2);
const command = args[0];

function printBanner() {
  console.log(`
\x1b[1m\x1b[36m🗼 Agent Lighthouse\x1b[0m \x1b[90mv0.1.0\x1b[0m
\x1b[90mThe Open-Source Lighthouse for the Agentic Web\x1b[0m
`);
}

function usage(): never {
  printBanner();
  console.log(`Usage:
  agent-lighthouse <url> [options]
  agent-lighthouse audit <url> [options]

Options:
  -o, --output <formats>       Output formats (comma-separated: terminal, html, json, md) [default: terminal,html,json]
  -d, --output-dir <path>      Output directory for generated reports [default: ./reports]
  -v, --view                   Automatically open the generated HTML report in your browser
  --min-score <number>         Minimum score (0-100) required to pass CI assertions
  --silent                     Suppress progress output

Examples:
  npx agent-lighthouse https://example.com
  npx agent-lighthouse https://example.com --view
  npx agent-lighthouse https://staging.example.com --min-score 85
`);
  process.exit(1);
}

function openInBrowser(filePath: string) {
  const cmd = process.platform === 'darwin' ? `open "${filePath}"` : process.platform === 'win32' ? `start "" "${filePath}"` : `xdg-open "${filePath}"`;
  exec(cmd, () => {});
}

async function audit(url: string) {
  try {
    new URL(url);
  } catch {
    console.error(`\x1b[31mInvalid URL:\x1b[0m ${url}`);
    process.exit(1);
  }

  const isSilent = args.includes('--silent');
  const shouldView = args.includes('-v') || args.includes('--view');
  
  const minScoreArgIdx = args.indexOf('--min-score');
  const minScore = minScoreArgIdx !== -1 && args[minScoreArgIdx + 1] ? Number(args[minScoreArgIdx + 1]) : 0;

  const outputDirIdx = args.indexOf('-d') !== -1 ? args.indexOf('-d') : args.indexOf('--output-dir');
  const outputDir = outputDirIdx !== -1 && args[outputDirIdx + 1] ? args[outputDirIdx + 1] : './reports';

  const outputFormatIdx = args.indexOf('-o') !== -1 ? args.indexOf('-o') : args.indexOf('--output');
  const outputFormats = outputFormatIdx !== -1 && args[outputFormatIdx + 1]
    ? args[outputFormatIdx + 1].split(',').map(s => s.trim())
    : ['terminal', 'html', 'json'];

  if (!isSilent) {
    printBanner();
    console.log(`Auditing \x1b[1m${url}\x1b[0m ...\n`);
  }

  const report = await runScan(url, (pct, phase) => {
    if (!isSilent) {
      process.stdout.write(`\r  \x1b[36m[${pct.toString().padStart(3)}%]\x1b[0m ${phase}`);
    }
  });

  if (!isSilent) {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  }

  const view = buildReportView(report);

  // Terminal Output
  if (outputFormats.includes('terminal') && !isSilent) {
    console.log(`\x1b[1m────────────────────────────────────────────────────────────────────────\x1b[0m`);
    console.log(`\x1b[1mOVERALL AGENT READINESS:\x1b[0m \x1b[1m${view.overallScore}/100\x1b[0m (${view.scoreTier.toUpperCase()})`);
    console.log(`Target: ${report.url} | Pages Scanned: ${view.pagesScanned.length} | Duration: ${(view.durationMs / 1000).toFixed(1)}s`);
    console.log(`\x1b[1m────────────────────────────────────────────────────────────────────────\x1b[0m\n`);

    console.log(`\x1b[1m📊 CATEGORIES:\x1b[0m`);
    for (const group of view.groups) {
      console.log(`\n  \x1b[1m${group.label}\x1b[0m \x1b[90m—\x1b[0m ${group.score}/100`);
      for (const cat of group.categories) {
        const c = cat.counts;
        const scoreColor = cat.score >= 90 ? '\x1b[32m' : cat.score >= 70 ? '\x1b[34m' : cat.score >= 50 ? '\x1b[33m' : '\x1b[31m';
        console.log(
          `    ${scoreColor}•\x1b[0m ${cat.name.padEnd(36)} : ${scoreColor}${cat.score.toString().padStart(3)}/100\x1b[0m  \x1b[90m(${c.pass}✓ ${c.warn}! ${c.fail}✗)\x1b[0m`
        );
      }
    }
    console.log();
  }

  // Ensure output directory exists
  mkdirSync(resolve(outputDir), { recursive: true });

  // JSON Report
  if (outputFormats.includes('json')) {
    const jsonPath = resolve(outputDir, 'agent-lighthouse-report.json');
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    if (!isSilent) console.log(`  \x1b[90m• JSON Report:\x1b[0m    ${jsonPath}`);
  }

  // HTML Report
  let htmlPath = '';
  if (outputFormats.includes('html')) {
    htmlPath = resolve(outputDir, 'agent-lighthouse-report.html');
    const htmlContent = generateHtmlReport(report);
    writeFileSync(htmlPath, htmlContent);
    if (!isSilent) console.log(`  \x1b[90m• HTML Report:\x1b[0m    ${htmlPath}`);
  }

  // Markdown Summary
  if (outputFormats.includes('md') || outputFormats.includes('markdown')) {
    const mdPath = resolve(outputDir, 'agent-lighthouse-report.md');
    const mdContent = generateMarkdownSummary(report);
    writeFileSync(mdPath, mdContent);
    if (!isSilent) console.log(`  \x1b[90m• Markdown Report:\x1b[0m ${mdPath}`);
  }

  if (shouldView && htmlPath) {
    openInBrowser(htmlPath);
  }

  // CI Assertions
  if (minScore > 0 && view.overallScore < minScore) {
    console.error(`\n\x1b[31m✖ CI Assertion Failed:\x1b[0m Score ${view.overallScore} is below minimum threshold ${minScore}`);
    process.exit(1);
  }
}

async function main() {
  if (!command || command === '-h' || command === '--help') {
    usage();
  }

  if (command === 'audit') {
    const url = args[1];
    if (!url) usage();
    await audit(url);
  } else if (!command.startsWith('-')) {
    await audit(command);
  } else {
    usage();
  }
}

main().catch((err) => {
  console.error('\x1b[31mFatal error:\x1b[0m', err.message ?? err);
  process.exit(1);
});
