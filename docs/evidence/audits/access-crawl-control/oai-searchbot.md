---
audit: access-crawl-control/oai-searchbot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/oai-searchbot.ts
slug: oai-searchbot
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - OAI-SearchBot
signals:
  - name: OAI-SearchBot allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - s18
  - pebblous-blocking-citation-gap
---

# oai-searchbot (`2.16`)

> crawler-permissions · source `oai-searchbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to OAI-SearchBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Evidence

### Signal: OAI-SearchBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing OAI-SearchBot causes the site to be excluded from ChatGPT search answers. This is the single strongest documented allow-side signal in the whole domain: blocking it directly destroys AI answer visibility.

**Grade: A** — This is the strongest allow-side statement in the category, and it is causal rather than descriptive: "Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers." OpenAI names the token, publishes the user agent and an IP list, and states the consequence itself. That is well past the grade-A bar. One tension is on the record: an independent measurement found 82.4% citation retention among sites blocking the token, which suggests lagged enforcement or citation through other surfaces. The vendor's stated policy is what the audit scores, and the copy states the measurement rather than hiding it.

**Evidence:** OpenAI documents this as a direct causal consequence: 'Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers.' UA 'OAI-SearchBot/1.4; +https://openai.com/searchbot', IPs at openai.com/searchbot.json. This is a vendor-stated, falsifiable behavioral claim, not an inference — grade A, and it justifies scoring an OAI-SearchBot disallow as a negative for any site that wants AI answer visibility.

**Counter-evidence:** BuzzStream/XOFU measured 82.4% citation retention even among sites blocking OAI-SearchBot, suggesting either lagged enforcement, citation via other surfaces, or content reached through ChatGPT-User. The vendor claim and the field measurement are in tension; the vendor claim is the stated policy and should be scored, but the audit copy should not promise total disappearance.

## Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to OAI-SearchBot permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
