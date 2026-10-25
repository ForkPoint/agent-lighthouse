---
audit: access-crawl-control/content-signals
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/content-signals.ts
slug: content-signals
evidence_grade: C
tier: informative
disposition: "new informative audit — 2026-10-25"
reviewed: 2026-10-25
sources:
  - s9
  - s7
---

# Content Signals choices and optional setup

## What it checks

Reads Content-Signal declarations from the fetched robots.txt. Shows search, ai-input and ai-train choices with their bot groups, case-sensitive path scopes, source URL and line numbers. Keeps valid entries beside syntax faults. Repeated equal values are redundant; opposite values at identical scopes conflict. No precedence is inferred.

## Why it matters

An owner can compare declared use preferences with their goals. Yes and no are valid independent choices. Omission means no preference through this format. This is not a completeness target or a crawl-access rule.

## Evidence

[Content Signals](https://contentsignals.org/) (verified 2026-10-25) documents optional preferences and bot/path scopes. [Cloudflare managed robots.txt](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/) (verified 2026-10-25) documents publication, policy-only comments, managed blocks, and the optional use test extension. Grade C applies because publication and meaning do not establish universal vendor consumption.

## Limits

Compliance is voluntary. A scan cannot prove that external bots obeyed the policy or that firewall rules enforce it. Search excludes AI-generated summaries. AI input covers answers, retrieval and grounding. Training includes fine-tuning. Unknown extensions remain unrecognized, not invalid by vocabulary alone. The use extension does not replace core purposes. Line order and server headers do not prove CDN ownership. Explicit Cloudflare managed markers justify a qualified Bot Preference Sync note.

Parsing stops before expansion when the file exceeds 500 KiB or its conservative agent-header count times signal-field count exceeds 4096, or the expanded directive text estimate exceeds 4 Mi characters. The report marks analysis incomplete. It does not infer absence, omitted choices, or exact edits. Evidence strings have a 1000-character limit and a combined 20000-character limit. Shortened evidence carries a label. Exact edits that cannot fit are omitted rather than shortened.

## How it scores

Informative, grade C, weight zero. Readable valid declarations pass. Syntax faults and repeated declarations warn without score loss. Missing declarations are not applicable with optional advice. Unreadable evidence is not applicable without a missing-policy claim or optional setup action.

## Example finding

`Content-Signal: /blog/ search=yes, ai-train=no` leaves AI input not declared for that bot and path. If the owner wants AI-answer use, add `ai-input=yes` to that same line. Preserve its scope, comments, extensions and all access rules. Do not add an Allow rule. A valid explicit no needs no change.

## Sources

- https://contentsignals.org/ (verified 2026-10-25)
- https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/ (verified 2026-10-25)

## Implementation deviations

Report details use bounded string arrays. No client configuration is written. No extra URL is fetched.

## Deferred

External bot compliance and firewall enforcement cannot be established by a declaration scan. Overlapping declarations do not receive an invented effective precedence.
