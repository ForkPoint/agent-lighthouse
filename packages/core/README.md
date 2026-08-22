# @forkpoint/agent-lighthouse-core

Core TypeScript scanner engine for Agent Lighthouse.

Use this package when you want to embed AI-agent readiness audits in your own service, build tooling, CI system, or reporting flow.

## Usage

```typescript
import { runScan } from "@forkpoint/agent-lighthouse-core";

const report = await runScan("https://example.com");

console.log(report.overallScore);
```

The engine runs deterministic audits for AI crawler access, machine discovery (`llms.txt`, sitemaps, feeds), content extraction, Schema.org structured data, answer readiness, agent interfaces (WebMCP, MCP, OpenAPI discovery), agentic commerce, and agent operability & safety.

## Links

- Documentation: https://forkpoint.github.io/agent-lighthouse/
- Repository: https://github.com/ForkPoint/agent-lighthouse
- CLI package: https://www.npmjs.com/package/@forkpoint/agent-lighthouse

## License

Apache-2.0
