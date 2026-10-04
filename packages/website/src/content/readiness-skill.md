# Improve agentic readiness with the Agent Lighthouse skill

The agentic readiness skill helps a coding agent use an Agent Lighthouse report to assess and improve how well AI agents can discover, read, cite and act on your website. It works with any framework, CMS, or plain HTML project.

It connects each finding to the code or hosting setting that produces the behavior. It also checks related routes and source code outside the scan sample. You choose whether the agent should assess the site or make fixes.

## Install the plugin

The repository is a plugin marketplace for Claude Code and Codex. Add it, then install the plugin.

In Claude Code:

```sh
claude plugin marketplace add ForkPoint/agent-lighthouse
claude plugin install agent-lighthouse@agent-lighthouse
```

Inside a Claude Code chat, the same steps are `/plugin marketplace add ForkPoint/agent-lighthouse` and `/plugin install agent-lighthouse@agent-lighthouse`.

In Codex:

```sh
codex plugin marketplace add ForkPoint/agent-lighthouse
codex plugin add agent-lighthouse@agent-lighthouse
```

To install from a local checkout, pass `/absolute/path/to/agent-lighthouse` to `marketplace add` instead, then run the same install command.

Start a new chat after installation. The plugin bundles the `agent-lighthouse` skill and its reference guides. Its scan workflow uses the project's Agent Lighthouse installation or an explicit pinned CLI command.

The repo marketplace is separate from OpenAI's public plugin directory. Packaging this plugin does not list it in that directory. See the [official plugin packaging guide](https://developers.openai.com/plugins/build/plugins) for distribution options.

For another agent that supports skills, use the complete [skill directory](https://github.com/ForkPoint/agent-lighthouse/tree/main/plugins/agent-lighthouse/skills/agent-lighthouse). Keep `references/` with `SKILL.md`. An agent with access to a checkout can read `plugins/agent-lighthouse/skills/agent-lighthouse/SKILL.md` directly.

The CLI and MCP npm packages do not install this skill. The plugin does not change the engine's audit rules or scores.

## Give it a site and code

Open your website project in your coding agent. Supply its deployed URL or an existing JSON report. Try:

> Use the `agent-lighthouse` skill to assess this website with Agent Lighthouse. Read the source code behind the findings. Show what needs work with file and page evidence. Do not change files yet.

To request fixes:

> Use the `agent-lighthouse` skill with this Agent Lighthouse report and the current project. Fix confirmed issues. Check related routes and shared components. Verify the changes and list anything that still needs deployment proof.

You can also supply only a local project. The skill then reviews the code without inventing a Lighthouse score. If you supply only a URL, it can assess the deployed site but must state that it could not inspect source code.

## What the workflow checks

1. Scan validity, page coverage, tool version, and the report's actual findings.
2. The routes, components, content sources, handlers, and hosting settings behind those findings.
3. Differences between local code and the scanned deployment.
4. Related code defects that the scan did not assess.
5. Focused tests, build output, browser behavior, or deployed responses that prove a fix.

A report about old deployed HTML may disagree with newer local code. The skill checks that difference before proposing edits. It does not add optional files or fake protocol endpoints merely to increase a score.

## Review the result

Expect report paths, findings with source evidence, completed changes, verification results, and remaining gaps. A local fix stays separate from a deployed fix. A deployed rescan needs the updated site to be available first.

The skill preserves unscored results and skipped-check reasons. It does not claim whole-site coverage from one page or treat advisory checks as scored failures. Read [how scoring works](./scoring.md) for those limits.

## Keep your stack

The skill fixes the site in the stack it already uses. It does not add a framework, a starter, or a dependency the project does not use. A new site uses its framework's native tools and gets the same review.

For a scan without code review, use the [quickstart](./quickstart.md). To expose scanning as a tool in your AI application, use the [MCP server](./mcp.md).
