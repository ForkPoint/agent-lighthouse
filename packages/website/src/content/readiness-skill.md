# Improve agentic readiness with the Agent Lighthouse skill

The agentic readiness skill helps a coding agent use an Agent Lighthouse report to assess and improve how well AI agents can discover, read, cite and act on your website. It works with any framework, CMS, or plain HTML project.

It connects each finding to the code or hosting setting that produces the behavior. It also checks related routes and source code outside the scan sample. You choose whether the agent should assess the site or make fixes.

## Install from the Codex marketplace

Add the repository marketplace, then install the plugin:

```sh
codex plugin marketplace add ForkPoint/agent-lighthouse
codex plugin add agent-lighthouse@agent-lighthouse
```

To install from a local checkout, point the first command at it instead:

```sh
codex plugin marketplace add /absolute/path/to/agent-lighthouse
codex plugin add agent-lighthouse@agent-lighthouse
```

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

## Use templates only when needed

Existing projects keep their own stack and conventions. New sites can use a matching starter or the framework's native tools. The separate [Astro agent-ready framework repository](https://github.com/magnifito/astro-agent-ready-framework) provides optional Astro templates. Agent Lighthouse itself ships the workflow skill, not website starters.

For a scan without code review, use the [quickstart](./quickstart.md). To expose scanning as a tool in your AI application, use the [MCP server](./mcp.md).
