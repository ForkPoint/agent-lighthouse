---
name: agent-lighthouse
description: Assess and improve website agentic readiness — how well AI agents can discover, read, cite and act on a site — on any stack, using an Agent Lighthouse report plus source-code review. Use when a user asks to audit a site for AI agents or AI search, explain or fix Agent Lighthouse findings, make a site agent-ready, or check llms.txt, robots.txt rules for AI crawlers (GPTBot, ClaudeBot, PerplexityBot), structured data / JSON-LD, Markdown or text extraction, OpenAPI or MCP discovery, WebMCP actions, or agentic commerce. Accept a URL, report, or local project.
---

# Agent Lighthouse agentic readiness

Start with [Agent Lighthouse](https://forkpoint.github.io/agent-lighthouse/). Use its report to guide a review of the actual site code and deployment. Support any framework, CMS, or plain HTML. This companion skill turns scan evidence into source review and verified site improvements. Invoke it as `agent-lighthouse`.

## Start from the user's request

- **Assess or explain:** scan/read the report, inspect available code, and report findings. Keep site files unchanged.
- **Fix or improve:** establish findings, trace causes, apply supported fixes, and verify within the user's authorized scope.
- **New site:** use the requested stack and its native tools. Apply the same review as the code develops; run a deployed baseline when a reachable URL exists.

Infer the project, stack, package manager, and target URL from available files and conversation. Confirm that a discovered URL belongs to this project before scanning it. Ask only for missing input that prevents useful work. Continue independent code inspection while waiting. Do not assume permission to deploy or submit real forms.

## 1. Obtain the report

Read [references/scan.md](references/scan.md) for official sources, pinned invocation, report checks, and local-only limits.

Use a supplied report when it matches the requested site and task. Otherwise run Agent Lighthouse on the authorized reachable URL. Preserve the original JSON and HTML in a new run directory. Review validity, coverage, scan date, engine version, and options before interpreting the score.

When no usable URL or report exists, inspect the code now. State **code inspection only; no Agent Lighthouse score**. Do not scan placeholder domains or calculate a substitute score.

## 2. Inspect the implementation

Read [references/code-review.md](references/code-review.md). Identify the routes, shared components, data sources, server handlers, and deployment settings that produce the audited behavior.

Review the site beyond the scan's sample: route types, crawl policy, content output, discovery links, structured data, accessibility, forms, and real agent interfaces. Inspect relevant source and generated output; use browser or HTTP evidence where behavior requires it. Record the areas and pages you checked and what remains unreviewed. Never claim to have reviewed all code after sampling a few files.

For each relevant report finding, read the check's `fix`, `found`, and `evidenceUrl` first, then trace the live evidence to its source owner. Confirm the issue, identify a deployment mismatch, mark it inapplicable with a reason, or leave it unresolved when evidence is missing. Keep code-only findings separate from engine findings. A report is evidence about the scanned deployment; it does not prove the local checkout has the same defect.

## 3. Decide what needs work

Maintain a concise finding table. When a run directory exists, save it there as `findings.md`, beside the report, so a before/after pair and a pull request can reuse it:

| Audit ID or code finding | Page and report evidence | Source file:line / setting | Assessment | Proposed fix | Proof needed |
| ------------------------ | ------------------------ | -------------------------- | ---------- | ------------ | ------------ |

Order work by access blockers, relevant scored failures, then other demonstrated usability or correctness defects. Review advisory findings against real site needs. Explain shared causes once when several findings point to one component.

Preserve the engine's status, tier, evidence grade, and skipped/not-applicable reasons. Do not turn missing optional files into scored failures. Do not add interfaces or schema solely to increase a score. A static MCP description is not an MCP server. Content, product data, actions, and crawler permissions must match the site's real purpose and owner policy.

## 4. Implement when requested

Use the project's existing stack, commands, patterns, and deployment model. Patch the layer that owns the problem. Preserve unrelated work, existing content, and working behavior. Add regression proof for behavior changes where it meaningfully protects the fix.

Do not add a framework, starter, or dependency the project does not already use. Do not migrate the site to another stack to fix a finding.

For CMS or hosting changes outside available access, state the exact setting and required owner action. Do not mark the finding fixed.

## 5. Verify and report

Run checks appropriate to the changed behavior using the project's tools. Inspect generated HTML when relevant. Check browser behavior and HTTP responses when the finding depends on them.

After changes reach an authorized deployment, repeat the scan with the same version, target, page-type declaration, and options in a new directory. Compare findings and coverage, not only scores. Without deployment access, report **fixed locally; deployed rescan pending**. Do not rescan unchanged production and claim it validates local changes.

When a valid deployed rescan exists, offer a CI gate based on it; [references/scan.md](references/scan.md) has the flags.

Return the report paths, the findings table, key findings with code evidence, completed changes, checks run, coverage limits, and next required actions. Clearly distinguish engine-confirmed results, code observations, local fixes, deployed verification, and unresolved work. A high score does not guarantee citations, rankings, or completed actions.
