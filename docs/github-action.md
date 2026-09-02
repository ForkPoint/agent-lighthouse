# GitHub Action Marketplace Setup

Agent Lighthouse ships as a composite action through the repository root `action.yml`.

## Basic Workflow

```yaml
name: Agent Lighthouse

on:
  pull_request:
    branches: [main]

jobs:
  agent-lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ForkPoint/agent-lighthouse@main
        with:
          url: https://staging.example.com
          preset: ecommerce
          min-score: "85"
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Release Pinning

For production repositories, pin a release tag or major version instead of `main`:

```yaml
- uses: ForkPoint/agent-lighthouse@v4
# or pin a patch release:
# - uses: ForkPoint/agent-lighthouse@v4.0.0
```

## Marketplace Copy

Name:

```text
Agent Lighthouse Audit
```

Description:

```text
Audit websites for AI-agent readiness, LLM crawler access, MCP discovery, WebMCP, and Schema.org signals in CI.
```

Categories:

```text
Code Quality, Testing, Utilities
```
