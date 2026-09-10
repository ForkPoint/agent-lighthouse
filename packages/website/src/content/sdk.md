# Run a scan from your application

Use the JavaScript and TypeScript SDK when you want to start scans from your own code. For a one-off scan, the [quickstart](./quickstart.md) is the shorter route.

## Install the packages

The core package runs the scan. The report package creates the HTML report:

```bash
npm install @forkpoint/agent-lighthouse-core @forkpoint/agent-lighthouse-report
```

## Run a scan and save its report

This example runs in Node.js:

```typescript
import { writeFile } from "node:fs/promises";
import { runScan } from "@forkpoint/agent-lighthouse-core";
import { generateHtmlReport } from "@forkpoint/agent-lighthouse-report";

const report = await runScan("https://example.com");
await writeFile("scan-report.html", generateHtmlReport(report));

if (report.overallScore === null) {
  console.log("No overall score. Check the report for coverage limits.");
} else {
  console.log(`Overall score: ${report.overallScore}/100`);
}
```

Open `scan-report.html` in a browser to review the findings. The example overwrites that file on each run.

## Choose the options you need

You can limit categories, supply specific pages, receive progress events, or cancel a scan. The [programmatic options](../../../../docs/config.md#programmatic-options) list the supported settings.

Treat an unscored result separately from zero. When you compare results, keep the scan options and tool version consistent.

## Build your own display

Use `buildReportView(report)` from the report package if you need its prepared report view. Keep findings, coverage limits, and scoring status visible beside the number.

The [package guide](./packages.md) explains the other entry points.
