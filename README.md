<div align="center">
  <h1>🗼 Agent Lighthouse</h1>
  <p><strong>The Open-Source Lighthouse for the Agentic Web</strong></p>
  <p>Audit, score, and optimize websites and storefronts for autonomous AI agents, LLMs, WebMCP, and machine-readable commerce protocols.</p>
</div>

---

## ⚡ Quickstart

Run a zero-install scan directly in your terminal:

```bash
# Instant audit (prints terminal report & generates HTML + JSON reports)
npx @forkpoint/agent-lighthouse https://yourstore.com

# Open the standalone HTML report in your browser
npx @forkpoint/agent-lighthouse https://yourstore.com --view

# Run in CI and fail if score is below threshold
npx @forkpoint/agent-lighthouse https://staging.yourstore.com --min-score 85
```

---

## 🎯 What Agent Lighthouse Checks

Agent Lighthouse evaluates websites across **10 audit categories** grouped into **3 readiness pillars**:

```
├── 1. Agentic Readiness
│   ├── AI Agent Tools & Action Surfaces (WebMCP manifests, OpenAPI specs, agents.json, ai-plugin.json)
│   ├── Content Discoverability (llms.txt, llms-full.txt, sitemaps, commerce links)
│   └── AI Crawler Permissions (robots.txt rules for GPTBot, ClaudeBot, PerplexityBot, etc.)
│
├── 2. AI Search Optimization
│   ├── Answer Engine Optimization (AEO) (direct answerability, step lists, table schemas)
│   └── Generative Engine Optimization (GEO) (unique data density, authoritative citations)
│
└── 3. Technical Foundation
    ├── Structured Data & Schema Markup (Schema.org Product, Offer, SKU, GTIN, Organization)
    ├── Meta Tags & AI Head Elements (AI content declarations, canonicals, Open Graph)
    ├── Semantic HTML & Content Structure (Headings hierarchy, landmarks, semantic tags)
    ├── Accessibility & Agent Interaction (Form labels, button roles, interactable elements)
    └── Technical Readiness & Security (HTTPS, security.txt, TTFB response latency)
```

---

## 📦 Packages & Architecture

This repository is organized as a lightweight pnpm monorepo published under the **`@forkpoint`** scope:

| Package | npm Package | Description |
| :--- | :--- | :--- |
| **`packages/cli`** | [`@forkpoint/agent-lighthouse`](https://www.npmjs.com/package/@forkpoint/agent-lighthouse) | Main CLI binary (`npx @forkpoint/agent-lighthouse <url>`). |
| **`packages/core`** | [`@forkpoint/agent-lighthouse-core`](https://www.npmjs.com/package/@forkpoint/agent-lighthouse-core) | Core gatherer-audit engine, scoring algorithms, and types. |
| **`packages/report`** | [`@forkpoint/agent-lighthouse-report`](https://www.npmjs.com/package/@forkpoint/agent-lighthouse-report) | Standalone HTML, Markdown, and unified report view-model. |
| **`packages/mcp`** | [`@forkpoint/agent-lighthouse-mcp`](https://www.npmjs.com/package/@forkpoint/agent-lighthouse-mcp) | Model Context Protocol (MCP) server for Claude / Cursor / IDEs. |

---

## 💻 Programmatic Node.js / TypeScript SDK

```typescript
import { runScan } from '@forkpoint/agent-lighthouse-core';
import { buildReportView, generateHtmlReport } from '@forkpoint/agent-lighthouse-report';

const report = await runScan('https://example.com');
const view = buildReportView(report);

console.log(`Overall Score: ${view.overallScore}/100 (${view.scoreTier})`);

// Generate standalone HTML report
const html = generateHtmlReport(report);
```

---

## 🤖 Model Context Protocol (MCP) Server

Add Agent Lighthouse to your Claude Desktop or Cursor IDE to let AI coding agents audit live staging URLs:

```json
{
  "mcpServers": {
    "agent-lighthouse": {
      "command": "npx",
      "args": ["-y", "@forkpoint/agent-lighthouse-mcp"]
    }
  }
}
```

---

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/ForkPoint/agent-lighthouse.git
cd agent-lighthouse

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run unit tests
pnpm test
```

---

## 📄 License

GPL-3.0-only © [ForkPoint](https://github.com/ForkPoint)
