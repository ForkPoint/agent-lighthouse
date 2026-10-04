---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-report": minor
"@forkpoint/agent-lighthouse-mcp": minor
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-website": patch
---

Stop showing "no data" as a failing grade. A category where no scored check reached a verdict now reads "Not assessed" in the terminal, HTML and Markdown reports and in the website's report viewer instead of "0 / 100", and it no longer drags its section group's score down: group scores are weighted by assessed evidence mass, the same rule the overall score uses. The scan summary no longer names such a category as the primary improvement area, and an unscored scan's summary says "not scored" instead of "Overall Readiness null%". Category check counts include scored-tier checks the scan ran as informative (page-typed audits on a detected page type) in the not-scored count. Core exports `isCategoryAssessed`, `categoryAssessedMass` and `generateScanSummary`, and the report package re-exports core's summary instead of keeping its own copy; the MCP `audit_website` summary adds `assessed` to each category.
