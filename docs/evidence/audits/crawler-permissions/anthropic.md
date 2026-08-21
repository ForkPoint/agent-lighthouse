---
audit: crawler-permissions/anthropic
audit_id: "2.3"
category: crawler-permissions
source_file: packages/core/src/audits/crawler-permissions/anthropic.ts
slug: anthropic
review_verdict: fix
severity: high
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# anthropic (`2.3`)

> crawler-permissions · source `anthropic.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, anthropic-ai / ClaudeBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

The only bot audit with custom alias logic, and that logic can invert the result. `isAnthropicAllowed` returns `allowed: result1.allowed || result2.allowed` when both tokens are explicit — so a site with `User-agent: anthropic-ai\nAllow: /` and `User-agent: ClaudeBot\nDisallow: /` is reported as a PASS, 'explicitly allowed', while Anthropic's actual production crawler is fully blocked. The OR should be an AND. Compounding this, `botName` is the retired `anthropic-ai` token: Anthropic's live tokens in 2026 are ClaudeBot (training), Claude-User (user-initiated fetch) and Claude-SearchBot (search index). The `fix`/`code` guidance still leads with `User-agent: anthropic-ai`, teaching users to write a directive nothing reads.

**Required fix:** Make ClaudeBot the primary `botName` and `anthropic-ai` the (legacy) alias. Change the combination rule from OR to AND — a bot family is allowed only if no live token is blocked — and report which token caused the block. Update `code`/`fix` guidance to lead with ClaudeBot and mark anthropic-ai as legacy. Add the versioned-token and BOM helper fixes.

**False-positive risks:**
- `allowed: result1.allowed || result2.allowed` — PASS reported while ClaudeBot is blocked. Concrete inverted result, not merely imprecise.
- Legacy-only block: a site with `User-agent: anthropic-ai\nDisallow: /` (a stale 2023-era line) and no ClaudeBot group gets a high-priority FAIL, though ClaudeBot is unaffected and crawls freely.
- `explicitlyNamed`-style alias handling is absent from `isAllowed` itself, so `User-agent: ClaudeBot/1.0` (versioned) is missed entirely.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**
- The existing test `passes if either alias is allowed when both are explicit` codifies the bug as intended behavior — it asserts `allowed: true` for anthropic-ai blocked + ClaudeBot allowed, but never tests the dangerous inverse (anthropic-ai allowed + ClaudeBot blocked).
- No test for legacy-only `anthropic-ai` block with no ClaudeBot group.
- No versioned-token or BOM case.

**Overlaps with:** `2.15`, `2.21`, `2.22`, `2.28`

## Evidence

### Signal: ClaudeBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing ClaudeBot stops Anthropic from collecting the site's content for potential model training; Anthropic states its bots honor robots.txt.

**Evidence:** Anthropic documents ClaudeBot as 'collecting web content that could potentially contribute to their training' and states 'Anthropic's Bots respect do not crawl signals by honoring industry standard directives in robots.txt', with IP verification at claude.com/crawling/bots.json. Very much active in 2026 and often the #1 AI crawler by volume: Cloudflare Radar had ClaudeBot and GPTBot together at nearly half of all AI crawl activity, and Known Agents records 21% of top websites blocking ClaudeBot as of 2026-08-19 — the highest block rate of any Anthropic token.

**Counter-evidence:** Anthropic has by far the worst crawl-to-refer ratio measured by Cloudflare Radar (~50,000:1 overall, 2,500:1 in News & Publications), so allowing ClaudeBot buys essentially no referral traffic — the allow-side case is about training/corpus inclusion, not visibility. Note the canonical support URL moved from support.anthropic.com to support.claude.com; audits hard-coding the old host will 301.
**Consumers:** ClaudeBot · **Recommended tier:** scored

**Sources:** [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [A deeper look at AI crawlers: breaking down traffic by purpose and industry](https://blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry/) · [ClaudeBot — Known Agents](https://knownagents.com/agents/claudebot)

### Signal: anthropic-ai (legacy token) present in robots.txt — grade C (robots-ai-crawlers)

**Mechanism:** 'anthropic-ai' is a legacy/undocumented token widely copy-pasted into robots.txt boilerplate; it appears in no current Anthropic documentation, so blocking or allowing it has no vendor-confirmed consequence.

**Evidence:** Known Agents classifies anthropic-ai as an 'Undocumented AI Agent' — 'Crawls websites without disclosing its purpose, collecting data for an unknown AI use case' — while attributing it to Anthropic. Adoption is nevertheless substantial: 16% of top websites block anthropic-ai, evidence of how deeply it is embedded in circulated robots.txt templates. Claude-Web is in the same category: 'currently unclear exactly what it's used for, since there's no official documentation.'

**Counter-evidence:** Decisive negative: Anthropic's current, canonical crawler support article names only ClaudeBot, Claude-User and Claude-SearchBot. Neither 'anthropic-ai' nor 'Claude-Web' appears anywhere on it. There is no vendor doc, no published IP range, and no Cloudflare Radar breakout for anthropic-ai. Treat its presence as harmless legacy cruft — never as evidence a site has configured Anthropic access, and never award or deduct points for it. The same applies to Claude-Web.
**Consumers:** none-known · **Recommended tier:** informative

**Sources:** [anthropic-ai — Known Agents](https://knownagents.com/agents/anthropic-ai) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
