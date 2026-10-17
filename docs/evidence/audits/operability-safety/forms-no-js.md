---
audit: operability-safety/forms-no-js
category: operability-safety
source_file: packages/core/src/audits/operability-safety/forms-no-js.ts
slug: forms-no-js
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - vercel-rise-of-ai-crawler
  - anthropic-browser-use-tool
  - playwright-mcp-repo
---

# forms-no-js (`5.19`)

> operability-safety · source `forms-no-js.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Many AI agents do not execute JavaScript, so forms that rely on JS for submission are invisible to them. Adding standard HTML action and method attributes ensures forms work via simple HTTP requests, making them accessible to all AI agents.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** An AI client that does not execute JavaScript cannot submit a form whose only submission path is a JS event handler; giving the form a server-side HTML submission path makes it actionable over plain HTTP.

**Grade: C** — the "AI crawlers do not run JavaScript" half is well measured. But no documented agent submits HTML forms over raw HTTP, and the specific attribute this audit scores, `action`, does not distinguish a JS-only form from a standards-compliant self-posting one. The causal link from signal to consumer is therefore unproven.

**Evidence:**

- Vercel's crawler study finds "none of the major AI crawlers currently render JavaScript", naming OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, Meta-ExternalAgent, Bytespider and PerplexityBot; ChatGPT (11.50%) and Claude (23.84%) fetch JS files but do not execute them — https://vercel.com/blog/the-rise-of-the-ai-crawler (verified 2026-08-21)
- Those same non-rendering clients are retrieval crawlers, not form submitters. The agents that actually fill and submit forms drive a real, JS-executing browser. Anthropic's browser use tool works "through its structure (the accessibility tree, elements, forms, and tabs) and through pixels" — https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool (verified 2026-08-21)
- Playwright MCP likewise drives a real browser and exposes structured accessibility snapshots to the model — https://github.com/microsoft/playwright-mcp (verified 2026-08-21)

**Counter-evidence:** The HTML Standard makes the graded attribute optional by design — in the form submission algorithm, if the action attribute "is null or attribute's value is the empty string, then return this's node document's URL" (https://html.spec.whatwg.org/multipage/form-control-infrastructure.html, verified 2026-08-21). A `<form method="post">` with no action is fully functional without JavaScript, so a missing `action` is not evidence of JS dependence. No vendor documents an agent that POSTs a form from parsed HTML without a browser, and every documented form-filling agent executes JavaScript — which removes the harm this audit's failure state describes.
