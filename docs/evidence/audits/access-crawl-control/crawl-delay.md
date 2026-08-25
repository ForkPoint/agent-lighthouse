---
audit: access-crawl-control/crawl-delay
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/crawl-delay.ts
slug: crawl-delay
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - ClaudeBot / Claude-User / Claude-SearchBot (Anthropic)
  - YouBot
  - Bingbot (historical)
signals:
  - name: Crawl-delay directive in robots.txt
    grade: C
    domain: robots-ai-crawlers
sources:
  - rfc9309
  - google-robots-txt-spec
  - amazonbot-docs
  - anthropic-crawlers
  - youbot-docs
---

# crawl-delay (`2.24`)

> crawler-permissions · source `crawl-delay.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

Excessive Crawl-delay values (over 10 seconds) dramatically slow AI indexing, meaning your latest content may take days or weeks to appear in AI search results.

## Code review findings (2026-08-20, 11-agent pass)

Produces frequent, confident, high-priority FAILs on correctly configured sites. `groups.filter(g => g.crawlDelay !== undefined)` collects Crawl-delay from EVERY user-agent group, so the near-universal ops practice of throttling SEO scrapers — `User-agent: SemrushBot\nCrawl-delay: 60`, `User-agent: AhrefsBot\nCrawl-delay: 30`, `User-agent: MJ12bot\nCrawl-delay: 20` — triggers a high-priority failure claiming 'your latest content may take days or weeks to appear in AI search results'. Not one AI crawler is affected by those lines. Compounding the error, Crawl-delay is not honored by Google, and OpenAI and Anthropic do not document honoring it either; it is a Bing/Yandex-era directive. The audit therefore issues its most alarming verdict about a directive that mostly does not apply to the crawlers it names.

**Required fix:** Scope the check to groups matching `ALL_CRAWLERS` tokens plus `*`, and ignore Crawl-delay on unrelated bots entirely. Downgrade the verdict from high-priority FAIL to `warn`, and rewrite the copy to state which crawlers actually honor Crawl-delay (Bing, Yandex) and which do not (Google, OpenAI, Anthropic). Fix `scoreDisplayMode` to `'ternary'`. Return `notApplicable` rather than `warn` when robots.txt is absent.

**False-positive risks:**
- `groups.filter((g) => g.crawlDelay !== undefined)` is unscoped: a Crawl-delay on SemrushBot/AhrefsBot/Bingbot fails the audit with AI-visibility language. This is the single most likely false FAIL in the category on real sites.
- The `impact` claim that excessive Crawl-delay 'dramatically slows AI indexing' is false for Google-Extended, GPTBot and ClaudeBot, none of which document Crawl-delay support.
- Hard threshold `d.crawlDelay > 10` with no tolerance: `Crawl-delay: 10.5` fails, `10` passes — arbitrary cliff presented as a definitive verdict.
- `parseRobotsTxt` assigns one `crawlDelay` per group and duplicates it across consecutive shared User-agent lines, so `User-agent: A\nUser-agent: B\nCrawl-delay: 60` reports the violation twice, overstating scope in the message.
- `scoreDisplayMode: 'binary'` is declared but the audit returns `warn` (0.5) on missing robots.txt — a mode/behavior mismatch.
- BOM'd or soft-404 robots.txt parses to zero groups → 'No Crawl-delay directives found' → PASS regardless of the real file.

**Test gaps:**
- No test with Crawl-delay on a non-AI bot (SemrushBot/AhrefsBot) — the dominant real-world case, and the one that produces the false FAIL.
- No test with per-bot Crawl-delay scoped to an AI crawler.
- No fractional threshold case (10.0 / 10.5).
- No multi-group file mixing AI and non-AI delays.
- No BOM or soft-404 case.

**Overlaps with:** _none_

## Evidence

### Signal: Crawl-delay directive in robots.txt — grade C (robots-ai-crawlers)

**Mechanism:** A Crawl-delay line throttles fetch rate only for the specific crawlers that implement it; it is not part of RFC 9309, and the largest consumers explicitly do not support it, so its presence cannot be scored as a general readiness improvement.

**Evidence:** Support is genuinely split and each side is vendor-documented. Supporting: Anthropic explicitly names support for the 'Crawl-delay extension to robots.txt' for its bots; You.com states 'YouBot fully respects robots.txt directives, including user-agent specific rules and crawl-delay settings'. Not supporting: Google states 'Google supports the following fields (other fields such as crawl-delay aren't supported)' — only user-agent, allow, disallow and sitemap; Amazon states of Amazonbot 'They do not support the crawl-delay directive.'

**Counter-evidence:** RFC 9309 defines no crawl-delay directive at all — the only accommodation is §2.2.4, which merely permits crawlers to 'interpret other records that are not part of the robots.txt protocol'. There is no interoperable value semantics (seconds vs. requests-per-second is unspecified), no vendor consensus, and the two highest-volume AI crawlers in Cloudflare's data (GPTBot, ClaudeBot's operator aside) publish no crawl-delay commitment. OpenAI, Perplexity, Meta, Mistral and DuckDuckGo document no crawl-delay support in either direction. A crawl-delay line is at best a per-vendor hint; never score its presence or absence.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
