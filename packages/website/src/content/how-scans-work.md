# How a scan works

Agent Lighthouse turns what it can read on your website into checks, findings and next steps. This guide explains what happens between entering a URL and opening your report.

## From your website to a report

The scan reads pages and supporting files, such as crawler rules and sitemaps. It checks the information it obtains, then brings the findings into one report.

<figure class="scan-diagram scan-diagram--flow">
  <img class="diagram-light" src="../../diagrams/scan-flow-light.svg" alt="Scan flow: choose a website address, read pages and supporting files, check the available information, then review findings and next steps." width="360" height="530" />
  <img class="diagram-dark" src="../../diagrams/scan-flow-dark.svg" alt="Scan flow: choose a website address, read pages and supporting files, check the available information, then review findings and next steps." width="360" height="530" />
  <figcaption>The report describes what this scan could assess.</figcaption>
</figure>

The result depends on the pages and files the scan reaches. A blocked page or unreadable content can limit what it can tell you.

## Why some checks do not affect your score

A finding and a score are different things. A check needs enough information to make a judgement. Its rules also determine whether it can affect the score.

<figure class="scan-diagram">
  <img class="diagram-light" src="../../diagrams/result-types-light.svg" alt="A report separates checks that affect the score, advisory and experimental findings that provide context, and checks that do not apply or lack enough information for a verdict." width="620" height="360" />
  <img class="diagram-dark" src="../../diagrams/result-types-dark.svg" alt="A report separates checks that affect the score, advisory and experimental findings that provide context, and checks that do not apply or lack enough information for a verdict." width="620" height="360" />
  <figcaption>Read the explanation beside each finding, not only the score.</figcaption>
</figure>

- **Scored checks** can change the result when they apply and the scan can assess them.
- **Advisory and experimental checks** give context without changing the score.
- **Not assessed or not applicable** means the check lacks needed information or does not fit this scan. It is not a pass.

If the scan lacks too much evidence, it can leave the overall result unscored. See [how scoring works](../../../../docs/scoring.md) for the full rules.

## Missing is not the same as broken

An optional file is not a requirement for every website. For example, a shop without a published API does not need to fix the contents of an API description it never supplied.

A file that exists but contains errors is different. A check can report those errors. If part of a file is readable, the scan can still use that part.

Each check explains when it applies. Read those limits before you decide to add a file, change crawler permissions or build a new feature.

## Use the report to choose your next fixes

Start with coverage: what could the scan read? Then review the relevant failures and their priority. Each check links to its supporting proof and limits.

Choose fixes that serve your website's goals. Run another scan after your changes. Compare the findings as well as the score.

A scan measures website signals. It does not guarantee AI mentions, citations, search rankings or completed actions.

## Run your first scan

Agent Lighthouse is free and open source. Follow the [scan guide](./quickstart.md) to run it from your terminal.

## For contributors

Building or changing a check? The [technical design record](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/architecture/audits.md) covers implementation rules, code references and design history. The public guide above explains the result from a website owner's point of view.
