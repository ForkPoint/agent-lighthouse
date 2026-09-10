# Check a staging site on pull requests

Use GitHub Actions to run Agent Lighthouse during development. The scan can help your team spot changes in website AI readiness before a release.

The website must already be reachable from the workflow runner. This action does not deploy your application.

## Start with reports

Run a scan on a known staging site before you set a score threshold. Check that the scan can reach the pages you care about.

The [GitHub Actions setup guide](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/github-action.md) covers action inputs, report files, and pull-request comments.

## Add a minimum score

This example runs when a pull request targets `main`. Replace the address with your staging site. The score of 85 is an example, not a recommended target for every website.

```yaml
name: Website AI readiness

on:
  pull_request:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ForkPoint/agent-lighthouse@main
        with:
          url: https://staging.example.com
          min-score: "85"
```

The example follows the project's `main` branch. For repeatable production workflows, pin the action to a reviewed commit and update it deliberately.

## Review a failed run

Read the report before changing the threshold. A lower score can reflect a website change, different coverage, or new scanner rules.

A site that blocks the runner may produce an unscored result. Fix access or review the scan conditions rather than treating it as a zero score.

For individual scan options, use the command-line reference. For interpretation, read [understand your score](./scoring.md).
