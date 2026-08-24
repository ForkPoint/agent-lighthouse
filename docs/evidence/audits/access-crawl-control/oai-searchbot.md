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
  - s18
  - pebblous-blocking-citation-gap
---

# oai-searchbot (`2.16`)

> crawler-permissions · source `oai-searchbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, OAI-SearchBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

High-value and correctly scoped — OAI-SearchBot builds the ChatGPT Search index, so blocking it removes a site from ChatGPT search results entirely. Worth keeping and worth weighting above the training crawlers. Implementation is the unmodified base class, so it carries every shared defect, and the same edge-UA blind spot.

**Required fix:** Raise weight above the training tier, add an OAI-SearchBot UA probe, and apply the shared helper fixes from 2.1.

**False-positive risks:**
- Edge UA blocking invisible to the scanner — PASS while OAI-SearchBot is 403'd.
- Exact-match miss on `User-agent: OAI-SearchBot/1.0`.
- A site writing `User-agent: OAI-SearchBot` alongside `User-agent: GPTBot` with divergent policies is fine, but one writing the shorthand `User-agent: OAI-` matches nothing.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**
- No versioned or shorthand token case.
- No UA-probe coverage.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: OAI-SearchBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing OAI-SearchBot causes the site to be excluded from ChatGPT search answers. This is the single strongest documented allow-side signal in the whole domain: blocking it directly destroys AI answer visibility.

**Grade: A** — This is the strongest allow-side statement in the category, and it is causal rather than descriptive: "Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers." OpenAI names the token, publishes the user agent and an IP list, and states the consequence itself — well past the grade-A bar. One tension is on the record: an independent measurement found 82.4% citation retention among sites blocking the token, which suggests lagged enforcement or citation through other surfaces. The vendor's stated policy is what the audit scores, and the copy states the measurement rather than hiding it.

**Evidence:** OpenAI documents this as a direct causal consequence: 'Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers.' UA 'OAI-SearchBot/1.4; +https://openai.com/searchbot', IPs at openai.com/searchbot.json. This is a vendor-stated, falsifiable behavioral claim, not an inference — grade A, and it justifies scoring an OAI-SearchBot disallow as a negative for any site that wants AI answer visibility.

**Counter-evidence:** BuzzStream/XOFU measured 82.4% citation retention even among sites blocking OAI-SearchBot, suggesting either lagged enforcement, citation via other surfaces, or content reached through ChatGPT-User. The vendor claim and the field measurement are in tension; the vendor claim is the stated policy and should be scored, but the audit copy should not promise total disappearance.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
