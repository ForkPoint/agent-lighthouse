---
audit: access-crawl-control/anthropic-ai
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/anthropic-ai.ts
slug: anthropic-ai
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-24
recommended_tier: informative
tier_rationale: "The recommendation graded the retired `anthropic-ai` token. The audit now scores the live `ClaudeBot` token, which Anthropic documents by name, so the grade-A signal it rests on is not the one the recommendation weighed (contradiction sweep, 2026-08-24)."
consumers: []
signals:
  - name: ClaudeBot allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
  - name: anthropic-ai (legacy token) present in robots.txt
    grade: C
    domain: robots-ai-crawlers
sources:
  - anthropic-crawlers
  - cloudflare-ai-crawler-purpose-industry
  - knownagents-claudebot
  - knownagents-anthropic-ai
---

# anthropic-ai (`2.3`)

> access-crawl-control · source `anthropic-ai.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

ClaudeBot collects web content that may contribute to Anthropic's model training, and Anthropic states its bots honour robots.txt.

This reads the robots.txt rules that actually apply to `ClaudeBot` — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants a named crawler the same access a named group would.

The legacy `anthropic-ai` and `Claude-Web` tokens are detected and reported on the result when a group names them, but they never change the status or the score.

## Code review findings (2026-08-20, 11-agent pass)

The only bot audit with custom alias logic, and that logic can invert the result. `isAnthropicAllowed` returns `allowed: result1.allowed || result2.allowed` when both tokens are explicit — so a site with `User-agent: anthropic-ai\nAllow: /` and `User-agent: ClaudeBot\nDisallow: /` is reported as a PASS, 'explicitly allowed', while Anthropic's actual production crawler is fully blocked. The OR should be an AND. Compounding this, `botName` is the retired `anthropic-ai` token: Anthropic's live tokens in 2026 are ClaudeBot (training), Claude-User (user-initiated fetch) and Claude-SearchBot (search index). The `fix`/`code` guidance still leads with `User-agent: anthropic-ai`, teaching users to write a directive nothing reads.

**Required fix:** Make ClaudeBot the primary `botName` and `anthropic-ai` the (legacy) alias. Change the combination rule from OR to AND — a bot family is allowed only if no live token is blocked — and report which token caused the block. Update `code`/`fix` guidance to lead with ClaudeBot and mark anthropic-ai as legacy. Add the versioned-token and BOM helper fixes.

> **Status, 2026-08-24 (contradiction sweep):** partly discharged, partly superseded. ClaudeBot is now the only token the audit scores and the `code`/`fix` guidance leads with it; versioned tokens and BOM-prefixed files are handled by the shared RFC 9309 gatherer. The instruction to keep `anthropic-ai` as a scoring alias and change the OR to an AND was **not** carried out and is withdrawn: the audit's own grade-C research records `anthropic-ai` with `Consumers: none-known` and instructs that no points be awarded or deducted for it, so an AND would still let a token with no documented consumer fail a site. There is no combination rule left to report on. See [Pass-rule correction (contradiction sweep, 2026-08-24)](#pass-rule-correction-contradiction-sweep-2026-08-24).

**False-positive risks:**
- `allowed: result1.allowed || result2.allowed` — PASS reported while ClaudeBot is blocked. Concrete inverted result, not merely imprecise.
- Legacy-only block: a site with `User-agent: anthropic-ai\nDisallow: /` (a stale 2023-era line) and no ClaudeBot group gets a high-priority FAIL, though ClaudeBot is unaffected and crawls freely.
- `explicitlyNamed`-style alias handling is absent from `isAllowed` itself, so `User-agent: ClaudeBot/1.0` (versioned) is missed entirely.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**
- The existing test `passes if either alias is allowed when both are explicit` codifies the bug as intended behavior — it asserts `allowed: true` for anthropic-ai blocked + ClaudeBot allowed, but never tests the dangerous inverse (anthropic-ai allowed + ClaudeBot blocked).
- No test for legacy-only `anthropic-ai` block with no ClaudeBot group.
- No versioned-token or BOM case.

> **Status, 2026-08-24 (contradiction sweep):** closed. The test that codified the OR as intended behaviour was removed along with the rule; the dangerous inverse, the legacy-only block with no ClaudeBot group, and the versioned token `ClaudeBot/1.0` are each pinned by a test in `anthropic-ai.test.ts`. BOM handling is covered by the shared gatherer and by the `bom-prefixed` fixture in `_robots-consumers.differential.test.ts`.

**Overlaps with:** `2.15`, `2.21`, `2.22`, `2.28`

## Evidence

### Signal: ClaudeBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing ClaudeBot stops Anthropic from collecting the site's content for potential model training; Anthropic states its bots honor robots.txt.

**Grade: A** — Anthropic's current crawler article names ClaudeBot, describes it as "collecting web content that could potentially contribute to their training", asserts that "Anthropic's Bots respect do not crawl signals by honoring industry standard directives in robots.txt", and publishes an IP list for verification. A named agent, a named directive and a stated behaviour is the grade-A bar.

**Evidence:** Anthropic documents ClaudeBot as 'collecting web content that could potentially contribute to their training' and states 'Anthropic's Bots respect do not crawl signals by honoring industry standard directives in robots.txt', with IP verification at claude.com/crawling/bots.json. Very much active in 2026 and often the #1 AI crawler by volume: Cloudflare Radar had ClaudeBot and GPTBot together at nearly half of all AI crawl activity, and Known Agents records 21% of top websites blocking ClaudeBot as of 2026-08-19 — the highest block rate of any Anthropic token.

**Counter-evidence:** Anthropic has by far the worst crawl-to-refer ratio measured by Cloudflare Radar (~50,000:1 overall, 2,500:1 in News & Publications), so allowing ClaudeBot buys essentially no referral traffic — the allow-side case is about training/corpus inclusion, not visibility. Note the canonical support URL moved from support.anthropic.com to support.claude.com; audits hard-coding the old host will 301.

### Signal: anthropic-ai (legacy token) present in robots.txt — grade C (robots-ai-crawlers)

**Mechanism:** 'anthropic-ai' is a legacy/undocumented token widely copy-pasted into robots.txt boilerplate; it appears in no current Anthropic documentation, so blocking or allowing it has no vendor-confirmed consequence.

**Grade: C** — The token is genuinely widespread — 16% of top sites carry it — but that is adoption by publishers, not consumption by an agent. It appears in no current Anthropic documentation, has no published IP range and no traffic breakout, so nothing confirms any consequence of allowing or blocking it. Wide adoption plus an unproven mechanism is grade C, which is why this signal is reported and never scored.

**Evidence:** Known Agents classifies anthropic-ai as an 'Undocumented AI Agent' — 'Crawls websites without disclosing its purpose, collecting data for an unknown AI use case' — while attributing it to Anthropic. Adoption is nevertheless substantial: 16% of top websites block anthropic-ai, evidence of how deeply it is embedded in circulated robots.txt templates. Claude-Web is in the same category: 'currently unclear exactly what it's used for, since there's no official documentation.'

**Counter-evidence:** Decisive negative: Anthropic's current, canonical crawler support article names only ClaudeBot, Claude-User and Claude-SearchBot. Neither 'anthropic-ai' nor 'Claude-Web' appears anywhere on it. There is no vendor doc, no published IP range, and no Cloudflare Radar breakout for anthropic-ai. Treat its presence as harmless legacy cruft — never as evidence a site has configured Anthropic access, and never award or deduct points for it. The same applies to Claude-Web.

## Pass-rule correction (contradiction sweep, 2026-08-24)

The audit scored two tokens as one composite, and its own research only ever
graded one of them.

The **Evidence** section above carries two signals. The first — "ClaudeBot
allow/block state in robots.txt" — is grade A and reads
`**Consumers:** ClaudeBot · **Recommended tier:** scored`. The second — "anthropic-ai
(legacy token) present in robots.txt" — is grade C and reads
`**Consumers:** none-known · **Recommended tier:** informative`, with the
instruction to treat the token's presence as "harmless legacy cruft — never as
evidence a site has configured Anthropic access, and never award or deduct
points for it".

The shipped code did the opposite in both directions. `botName` was the retired
`anthropic-ai` spelling, so every message, `found` string and fix snippet led
with it, and the combination helper `isAnthropicAllowed` returned
`allowed: result1.allowed || result2.allowed` whenever both tokens had explicit
groups. A site with `User-agent: anthropic-ai` / `Allow: /` beside
`User-agent: ClaudeBot` / `Disallow: /` scored a full 1.0 at weight 1.0 while
Anthropic's only documented training crawler was completely blocked. In the
other direction, a stale 2023-era `User-agent: anthropic-ai` / `Disallow: /`
line with no ClaudeBot group produced a high-priority failure on a site
ClaudeBot crawls freely. Both are points moved by a token the dossier says
nothing consumes.

**The scored signal is now ClaudeBot alone.** The status is decided by
`isPathAllowed(groups, 'ClaudeBot', '/')` and nothing else. A group naming
`anthropic-ai` or `Claude-Web` can no longer change the status or the score in
either direction.

**The grade-C signal is kept as a report, at weight zero by construction.**
When a group names one of the legacy tokens, the result's `found` string gains a
note — "legacy anthropic-ai group present — Anthropic's current crawler
documentation names only ClaudeBot, Claude-User and Claude-SearchBot, so this
group is not a documented Anthropic access control and does not affect this
result" — and `details.legacyTokens` lists the tokens found. That is the useful
half of the C-grade research: the dossier records that 16% of top sites carry
the token because it is deeply embedded in circulated robots.txt templates, so
what an owner needs to hear is that their `anthropic-ai` group is not the
control they think it is. The note deliberately stops at "no documented
consumer" rather than claiming the token configures nothing: the same signal's
**Evidence** paragraph records Known Agents attributing an actively crawling
"Undocumented AI Agent" to it, and the sources do not support the stronger
claim.

**A second correction rides along, because the same pass rule was wrong here for
the reason it was wrong on `access-crawl-control/meta-external-agent`.** The
rule inherited from `_crawler-bot-audit.ts` passed only on
`allowed && explicitly` and warned at score 0.5 on `allowed && !explicitly`, so
a site whose robots.txt reads `User-agent: *` / `Allow: /` — every crawler
welcome, nothing blocked — took half marks at weight 1.0 for not naming a token.
Nothing in the grade-A evidence supports that. The mechanism statement is
"Anthropic states its bots honor robots.txt", which is a fact about whether a
disallow takes effect, not about whether a group names the token, and under RFC
9309 §2.2.1 a crawler obeys the group matching its own product token and falls
back to `*` only when no such group exists. The catch-all case and the named
case grant identical access. The rule now asks one question: do the rules that
apply to ClaudeBot permit `/`? Allowed by its own group, allowed through the
catch-all, and allowed because no group applies all pass. A disallow that
reaches the token still fails. The `warn` band is gone from this audit.

An unreadable robots.txt is now not applicable rather than a warn: missing,
non-200, an empty body, or a 200 that parses to no groups and no directives,
which is the shape of an HTML error page served at `/robots.txt`. A file that
parses but carries no group applying to ClaudeBot — a `Sitemap:`-only file —
passes, because the crawl state is the same as any other file with no matching
group. This follows the disposition `meta-external-agent` and
`agent-governance` took on the same branch.

**One user-facing claim was withdrawn, and the failure priority follows it
down.** The old description and impact text said an explicit allow rule
"improves your visibility in AI-powered search", and the failure fired at
priority `high`. This dossier's own counter-evidence refutes that: Anthropic has
"by far the worst crawl-to-refer ratio measured by Cloudflare Radar (~50,000:1
overall, 2,500:1 in News & Publications), so allowing ClaudeBot buys essentially
no referral traffic — the allow-side case is about training/corpus inclusion,
not visibility". The failure now states what the block actually does — exclusion
from the web content Anthropic collects for potential model training — and its
priority drops to `medium`, matching `defaultPriority`, because the `high` rested
on the visibility claim just withdrawn. Blocking ClaudeBot is an effective,
documented control that 21% of top sites have chosen deliberately; it is a
problem only where it was not intended, and the text now says so.

The title also changed. `meta.title` was "anthropic-ai / ClaudeBot allowed",
which a not-applicable row would print over a site that serves no robots.txt at
all. It is now "ClaudeBot crawl access", which reads true on `pass` and on `na`,
with `failureTitle` "ClaudeBot disallowed by robots.txt" carrying the `fail`
case.

Grade, tier and weight are unchanged at A, scored, 1.0. What was wrong was which
token the score depended on and what counted as passing, not the grade.

### Decisions taken where the review left a choice

- **Split or narrow.** The grade-C signal was not given its own audit. An
  informative row saying "you have an `anthropic-ai` group" predicts nothing on
  its own; it is only worth reading beside the ClaudeBot verdict it is so often
  mistaken for. Keeping it as a note on this result puts it exactly there, at
  weight zero, without spending a registry id, a dossier and a new block in the
  robots differential baseline.
- **Test bookkeeping.** The old `passes when ClaudeBot is explicitly allowed
  (alias)` case was rewritten rather than duplicated, and
  `fails when both aliases are explicitly blocked` — whose name and inline
  comment described a combination rule that no longer exists — was dropped in
  favour of an explicit `User-agent: ClaudeBot` / `Disallow: /` case and a case
  pinning the inverted result the OR used to produce.

### What this change does not fix

- **`access-crawl-control/agent-governance` still counts the legacy token.** It
  is grade A, scored, weight 1.0, and its `explicitlyNamed` and `categoryBlocked`
  helpers build their name set from `botName` plus `aliases` in the shared
  `TRAINING_CRAWLERS` table, whose Anthropic row is still
  `{ botName: 'anthropic-ai', aliases: ['ClaudeBot'] }`. A site whose only
  Anthropic group is `User-agent: anthropic-ai` therefore still earns credit
  toward a scored check, and that audit's `guidance.fix` still tells owners to
  "name training crawlers (GPTBot, CCBot, Google-Extended, anthropic-ai)". The
  shared table and `agent-governance.ts` are outside this change's scope; the
  correction belongs in that audit's own dossier and is handed off there. Until
  it lands, "never award or deduct points for it" holds for this audit, not for
  the product as a whole.
- **The audit id still carries the legacy spelling.** The audit scores
  `ClaudeBot` but is registered as `access-crawl-control/anthropic-ai`.
  Retargeting it to `access-crawl-control/claudebot` touches the audit registry,
  `migration-map.json`, the v2 audit map and the robots differential harness,
  all of which are managed centrally; it is recorded as an open item rather than
  done here. The title, description and guidance no longer lead with the legacy
  token, so a report reader sees the live one.
- **`docs/evidence/audits/access-crawl-control/claude-searchbot.md` goes
  partly stale.** It states that "2.3 is keyed on the deprecated `anthropic-ai`
  token" and recommends consolidating 2.3/2.15/2.21 "keyed on the live tokens
  rather than the deprecated anthropic-ai". The first half is now true only of
  the id, not of the rule. That dossier is outside this change's scope and is
  handed off.
- **The robots differential baseline must be regenerated.** This audit is pinned
  in `_robots-consumers.differential.test.ts`, which is regenerated centrally.
  In the `anthropic-ai` consumer block, four fixtures (`missing`, `non-200`,
  `empty`, `html-error-page`) move from `warn` to `na`; twelve move from `warn`
  to `pass` now that catch-all access counts; three (`wildcard-blanket-block`,
  `wildcard-star-disallow`, `anthropic-alias-only`) stay `fail` with new text and
  `medium` priority; and `mixed-case-tokens` stays `pass` but for a different
  reason and with the legacy note attached. The `agent-governance` block does not
  move, because the shared alias table is untouched.

### Handed off, done in the same commit

- The robots differential baseline was regenerated for the `anthropic-ai`
  consumer block only, exactly as predicted above; no other consumer's rows
  moved.
- `agent-governance.ts` guidance now names `ClaudeBot` instead of `anthropic-ai`
  in its list of training crawlers to declare. Guidance text only.
- `claude-searchbot.md` carries a dated note recording that the "2.3 is keyed on
  the deprecated token" half of its finding is discharged.

### Handed off, still open

- `_robots-txt-helpers.ts` still declares the alias table as
  `{ botName: 'anthropic-ai', aliases: ['ClaudeBot'] }`. `agent-governance`
  builds its name set from that table, so a site whose only Anthropic group
  names the retired token still earns credit on a grade-A, weight-1.0 check.
  Inverting the entry to `{ botName: 'ClaudeBot', aliases: ['anthropic-ai'] }`
  also fixes `ai-usage-signal-coherence-across-channels.ts:265`, which calls
  `isBlanketBlocked` on the retired token. It moves two rows of the
  `agent-governance` differential block, so it belongs to that audit's own
  correction, not this one.
- `isAnthropicAllowed` in `_robots-txt-helpers.ts` and the alias branch in
  `_crawler-bot-audit.ts` are now dead: no shipped `CrawlerBot` declares
  `aliases`. Harmless, removable with the item above.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-24 — contradiction sweep: narrowed the scored signal to ClaudeBot, demoted the legacy `anthropic-ai` / `Claude-Web` tokens to a non-scoring note, replaced the explicit-group pass criterion with the RFC 9309 access state, and made an unreadable robots.txt not applicable. Grade A / scored / weight 1.0 unchanged.
