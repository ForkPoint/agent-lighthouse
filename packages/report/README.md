# @forkpoint/agent-lighthouse-report

Standalone HTML, Markdown, and view-model reporting for Agent Lighthouse audit results.

Use this package to turn scanner output from `@forkpoint/agent-lighthouse-core` into browser-ready reports, pull-request summaries, and user-facing score views.

## Usage

```typescript
import { runScan } from "@forkpoint/agent-lighthouse-core";
import {
  buildReportView,
  generateHtmlReport,
  generateMarkdownSummary,
} from "@forkpoint/agent-lighthouse-report";

const report = await runScan("https://example.com");
const view = buildReportView(report);
const html = generateHtmlReport(report);
const markdown = generateMarkdownSummary(report);

console.log(view.overallScore, html.length, markdown.length);
```

## Links

- Documentation: https://forkpoint.github.io/agent-lighthouse/
- Repository: https://github.com/ForkPoint/agent-lighthouse
- CLI package: https://www.npmjs.com/package/@forkpoint/agent-lighthouse

## License

GPL-3.0-only
