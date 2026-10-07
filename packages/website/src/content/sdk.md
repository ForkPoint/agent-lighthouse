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

## Declare page purpose in v7

Use a declaration when you know the page's purpose. Leave it out when you want detection.

```ts
const report = await runScan("https://example.com/guide", {
  pageType: "article",
  pages: [{ url: "https://example.com/products/widget", pageType: "product" }],
});
```

The supported types are `homepage`, `category`, `product`, `article`, `unknown`, and legacy `content`. `content` means general/unknown, not article. Invalid types and malformed override URLs fail before the scan starts. A target declaration takes precedence over a matching entry in `pages`.

Read each check's optional `coverage` and `advisoryResults`. Keep nested advisory findings out of score calculations and audit counts. `pagesScanned[].classification` explains purpose; `pageAttempts` preserves failed reads. `buildReportView(report).pageScope` prepares the same data for a display. Saved older reports keep these fields absent.

The [v7 migration notes](../../../../docs/scoring.md#migration-from-6x) describe the changed semantics. Package publication remains a separate release step.
