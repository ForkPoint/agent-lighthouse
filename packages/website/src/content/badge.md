# Add a score badge

A badge shows a scan score in a README, documentation page, or project update. Use a real result and keep the full report nearby.

## Create your badge

1. Run a scan and open its report.
2. Copy the overall score. If the result is unscored, do not enter zero.
3. Open the website's “Share your result” tool.
4. Enter the score and scanned address, then copy the Markdown.

The badge tool formats the number you enter. It does not run a scan or verify the number.

## What the badge does not do

The badge is static. It does not update when your website changes. Run another scan and replace the snippet when you publish a new result.

The generated badge links to the Agent Lighthouse project. Add a separate link to your report and the scan date so readers can check the result.

The badge image loads from Shields.io, an external image service.

## Write the Markdown yourself

This example uses a score of 87. Replace it with your scan's score:

```markdown
[![Agent Lighthouse score: 87 out of 100](https://img.shields.io/badge/Agent%20Lighthouse-87%2F100-4f46e5)](https://github.com/ForkPoint/agent-lighthouse)
```

Colors follow the existing badge tool: green for 90–100, indigo for 70–89, amber for 50–69, and red for 0–49. They summarize a score band. They do not prove that an AI system can access or use your website.

Read [what the score means](./scoring.md) before sharing it. The [sharing guide](./share.md) explains how to provide the full result.
