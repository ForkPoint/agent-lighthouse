---
audit: access-crawl-control/no-blanket-block
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/no-blanket-block.ts
slug: no-blanket-block
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - OAI-SearchBot
  - PerplexityBot
  - Claude-SearchBot
  - DuckAssistBot
  - MistralAI-Index
  - Meta-WebIndexer
signals:
  - name: "Blanket-blocking all AI bots (User-agent: * Disallow: / for AI tokens, or long AI-bot denylists) as a negative signal"
    grade: B
    domain: robots-ai-crawlers
sources:
  - s18
  - perplexity-bots-docs
  - pebblous-blocking-citation-gap
  - consent-in-crisis-arxiv
  - cloudflare-ai-crawler-purpose-industry
  - tollbit-robots-noncompliance
---

# no-blanket-block (`2.22`)

> crawler-permissions · source `no-blanket-block.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

A blanket Disallow: / under User-agent: * blocks every crawler, including all AI agents. Your site becomes invisible to AI search engines, ChatGPT Browse, Perplexity, and others.

## Code review findings (2026-08-20, 11-agent pass)

The most defensible audit in the category — a wildcard `Disallow: /` genuinely destroys AI discoverability and critical priority is appropriate. Two problems keep it from 'keep'. First, the title and description say 'No blanket AI block' but the code only inspects `groups.filter(g => g.userAgent === '*')`; a site with `User-agent: GPTBot\nDisallow: /`, `User-agent: ClaudeBot\nDisallow: /` and `User-agent: *\nAllow: /` has blanket-blocked AI and receives a PASS titled 'No blanket AI block'. Second, the missing-robots.txt branch is wrong-signed: no robots.txt means nothing is blocked, which is a pass for this specific criterion, yet it returns `warn` and drags the score down.

**Required fix:** Strip the BOM in `parseRobotsTxt`; extend `isBlanketBlocked` to `/`, `/*`, `*`. Add a content-type + leading-`<` guard so an HTML soft-404 is reported as 'no robots.txt' rather than parsed. Change the missing-robots.txt branch from `warn` to `pass` (nothing is blocked) or `notApplicable`. Either rename the audit to 'No wildcard blanket block' or extend it to fail when every AI token in `ALL_CRAWLERS` is disallowed.

**False-positive risks:**

- BOM'd robots.txt parses to zero groups → `wildcardGroups` empty → `isBlanketBlocked([])` false → PASS on a site that blocks the entire web. Highest-impact single false result in the category.
- `isBlanketBlocked` matches only `r.path === '/'`; `User-agent: *\nDisallow: /*` and `Disallow: *` are real-world blanket blocks reported as PASS.
- SPA soft-404 serving HTML at /robots.txt with status 200 parses to zero groups → PASS, and the user is told crawler permissions were verified when no robots.txt exists.
- Title/criterion mismatch: AI-specific blanket blocks pass an audit named 'No blanket AI block'.
- `warn` on missing robots.txt penalizes the most permissive possible configuration.

**Test gaps:**

- No BOM fixture (the case that silently inverts the result).
- No `Disallow: /*` or `Disallow: *` case.
- No HTML soft-404 body at /robots.txt.
- No AI-specific blanket block case (all AI bots disallowed, wildcard allowed) to expose the title/criterion mismatch.
- No CRLF-only line endings.

**Overlaps with:** `2.23`, `2.28`

## Evidence

### Signal: Blanket-blocking all AI bots (User-agent: * Disallow: / for AI tokens, or long AI-bot denylists) as a negative signal — grade B (robots-ai-crawlers)

**Mechanism:** Blocking answer/search-side AI agents (OAI-SearchBot, PerplexityBot, Claude-SearchBot, MistralAI-Index, DuckAssistBot, Meta-WebIndexer) measurably reduces referral traffic and vendor-stated answer eligibility, while blocking training-side agents (GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended, MistralAI-Training, meta-externalagent) has near-zero measured effect on citation presence. An undifferentiated blanket block therefore pays the full visibility cost while capturing almost none of the intended protection.

**Grade: B** — The answer-side half of the claim has direct vendor statements behind it. OpenAI: "Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers." Perplexity recommends allowing PerplexityBot "to ensure your site appears in search results". The traffic cost has been measured independently. What holds the grade at B is that this audit's claim is broader than any single vendor sentence. It is about the aggregate effect of a blanket block across a mixed population of training and answer agents. No vendor documents that effect, and no study isolates it. The counter-case is also real and recorded: blocking is a legitimate rights choice, and Cloudflare's crawl-to-refer data makes the economic argument for blocking training crawlers a serious one.

**Evidence:** The strongest direct vendor claim: OpenAI states 'Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers.' Perplexity mirrors it from the allow side: 'To ensure your site appears in search results, we recommend allowing PerplexityBot'. Quantified traffic cost: Zhao (Rutgers) & Berman (Wharton) measured large publishers that blocked crawlers losing 23.1% of total traffic monthly in the Dec 2025 version, revised to roughly -7% weekly in the Apr 2026 version. The training-side block is measurably futile. A BuzzStream and XOFU analysis of 4M AI citations across 3,600 prompts found citation retention among blocking sites of 92.3% for Google-Extended, 88.2% for GPTBot, 82.4% for OAI-SearchBot and 70.6% for ChatGPT-User. It concluded that 'Even the sites that blocked training bots still accounted for about 95% of ChatGPT's citation sources.' The summary finding — 'visitors are lost while citations remain' — is exactly the asymmetry an audit should score. Blocking is also no longer differentiating: Consent in Crisis found restrictions rendering 28%+ of the most actively maintained C4 sources fully restricted in a single year.

**Counter-evidence:** Blocking is a legitimate rights choice, not a defect, and the audit must not frame it as an error. Publishers with licensing deals or a copyright strategy block deliberately. Cloudflare's crawl-to-refer data — Anthropic at about 50,000:1, OpenAI at 887:1 — shows the economic case for blocking training crawlers is real. Blocking is also partly self-executing at best: TollBit H1 2026 found ~15% of AI page-fetchers reached disallowed URLs anyway, so a block neither reliably protects nor is it fully costly. The correct audit posture is to flag UNDIFFERENTIATED blanket blocks (search-side and training-side treated identically) as a likely-unintended configuration, and to report deliberate, differentiated blocking neutrally.

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the robots.txt served at the root, and
  `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked domain
  a broker's page from another host, on a walled or throttled origin nothing
  at all. It now consults `scanReadTheSite()` and returns `notApplicable`
  carrying the gate's own reason.
  Verdicts that moved on the five nothing-obtained contract states: walled
  warn → na, throttled warn → na, redirected away pass → na, non-HTML homepage
  warn → na, HTTP 200 bot challenge pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
