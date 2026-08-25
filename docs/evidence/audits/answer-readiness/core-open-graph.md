---
audit: answer-readiness/core-open-graph
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/core-open-graph.ts
slug: core-open-graph
evidence_grade: A
disposition: "merged 2026-08-22 (Plan 4, Task 6) — absorbs og-site-name (4.8) and twitter-card (4.10)"
reviewed: 2026-08-22
sources:
  - meta-sharing-webmasters
  - slack-link-unfurling
  - ogp-me-spec
  - s18
  - google-ai-features-trust
  - google-special-tags
---

# core-open-graph (`4.6`, `4.8`, `4.10`)

> answer-readiness · source `core-open-graph.ts` · merged social-meta audit, absorbs og-site-name (4.8) and twitter-card (4.10) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

One social-meta diagnostic for the head of `ctx.pages[0]`, with a scored half and an informational half.

**Scored — Open Graph.** The four core properties `og:title`, `og:description`, `og:image`, `og:url` must be present and non-empty; `og:site_name` (absorbed from 4.8) is *recommended* and can only produce a warn.

| State | Result |
| :--- | :--- |
| all four core tags present, `og:site_name` usable | `pass` |
| all four core tags present, `og:site_name` missing or a placeholder | `warn`, priority `low` |
| one to three core tags missing | `warn`, priority `high` |
| all four core tags missing | `fail`, priority `high` |

A placeholder `og:site_name` is treated as missing. A placeholder is an unrendered template token — `{{ … }}`, `{% … %}`, `${…}`, `<% … %>` — or one of the audit's own sample strings: "Your Site Name", "Site Name", "SiteName", "Your Website". This is the false positive 4.8's review names first.

**Informational — Twitter Cards.** `twitter:card`, `twitter:title`, `twitter:description` and `twitter:image` are reported in the `found` block, each labelled with the `og:*` property it falls back to. These rows never change the status, the score or the priority: no consumer is documented to read a `twitter:*` tag that has an `og:*` equivalent.

## Code review findings (2026-08-20, 11-agent pass)

Reasonable presence check, but it validates nothing beyond non-emptiness — notably it does not enforce the absolute og:image URL that its own `guidance.fix` demands, so a relative og:image (which no social/AI consumer can resolve) scores a full pass. Single-page evaluation again. The AI-impact framing ('agents cannot display proper titles… in AI-generated responses') is somewhat speculative — OG is primarily a social-preview standard — but the tags are cheap and genuinely reused, so keep the audit.

**Required fix:** 1) Enforce what the guidance already promises: `guidance.fix` says 'og:image (with an absolute URL)' but the loop is only `if (val.trim()) present.push(tag)`. Add an absolute-URL check for og:image and og:url and warn on relative values. 2) Accept `og:image:url` / `og:image:secure_url` as satisfying og:image (valid per ogp.me, emitted by several CMSes) before reporting og:image missing. 3) Verify og:url resolves to the same origin as `page.url`; a stale og:url pointing at a dev domain is a common real bug that currently passes. 4) Iterate all `ctx.pages`. 5) Return `notApplicable` when `ctx.wafProtection?.isBlocked` rather than a 4-tag hard fail. 6) Reference `meta.guidance` instead of re-embedding a second copy of the description/code strings in the warn and fail branches.

**False-positive risks:**
- Relative og:image passes: the loop is `const val = page?.meta?.[tag] ?? ''; if (val.trim()) present.push(tag)`. `<meta property="og:image" content="/img/card.png">` is unresolvable by every OG consumer, yet scores a full pass while the audit's own fix text demands an absolute URL.
- `og:image:url` / `og:image:secure_url` only (valid OGP, emitted by some CMSes) → reported as og:image missing.
- Stale/wrong og:url (pointing at a staging domain or the homepage) passes — no comparison to `page.url`.
- Multiple `<meta property="og:image">` tags (the standard way to offer several images) collapse to last-wins in `extractMetaTags`; the audit sees only one, which is fine here but hides a broken first entry.
- Only `ctx.pages[0]` checked: homepage has all four, interior templates have none → pass.
- WAF interstitial or a JS-injected OG head (SPA) → all four reported missing, priority 'high', on a site whose rendered pages are correct.
- Non-HTML entry URL (PDF, JSON API root) still parses through cheerio and reports four missing OG tags rather than declaring itself inapplicable.

**Test gaps:**
- No relative-og:image test — the exact case the guidance calls out.
- No `og:image:secure_url`-only test.
- No multi-page test.
- No duplicate-og-tag test.
- No whitespace-only content test (would pass the `.trim()` guard correctly, but untested).
- No `name="og:title"` instead of `property=` test (the parser accepts both; the behavior is untested).

**Overlaps with:** `4.7`, `4.8`, `4.9` — `4.8` is now absorbed here, so that overlap is resolved.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Named link-preview crawlers — `facebookexternalhit` and Slack's unfurler — fetch a shared URL and read `og:title`, `og:description`, `og:image` and `og:url` to build the preview card. When those tags are absent, the crawler falls back to heuristic guesses at the title, text and image.

**Grade: A** — two vendors document, by crawler name, that they read exactly these properties, and the fallback behavior when they are missing is stated in the vendor doc itself.

**Evidence:**
- Meta's webmaster guide instructs sites to add `og:url` ("The canonical URL for your page"), `og:title`, `og:description`, `og:image` and names the crawler user-agent `facebookexternalhit/1.1`; without markup the crawler "uses internal heuristics to make a best guess" — https://developers.facebook.com/docs/sharing/webmasters/ (verified 2026-08-21)
- Slack documents the same consumption for message unfurls: "Slack crawls the URL, looks for common OpenGraph and X (formerly known as Twitter) Card metadata, and renders some micro-approximation of the content." — https://docs.slack.dev/messaging/unfurling-links-in-messages/ (verified 2026-08-21)
- The Open Graph protocol itself defines `og:title`, `og:type`, `og:image`, `og:url` as the required basic metadata and names Facebook as the originating consumer — https://ogp.me/ (verified 2026-08-21)

**Counter-evidence:** The proven consumer path is social/messaging link previews, not AI answer generation — the audit's framing ("agents cannot display proper titles… in AI-generated responses") has no source. OpenAI's crawler documentation covers only robots.txt and user agents, and mentions no Open Graph tags — https://developers.openai.com/api/docs/bots (verified 2026-08-21). Google's AI-features page likewise never mentions Open Graph — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). And Google's supported-meta-tags list includes no `og:*` property at all, with the note that "Google will ignore `meta` tags that it doesn't support" — https://developers.google.com/search/docs/crawling-indexing/special-tags (verified 2026-08-21). Note also that the grade attaches to *resolvable* values: the vendor doc's `og:image` contract is a URL the crawler can fetch, which the current non-emptiness check does not enforce.

## The merge (Plan 4, Task 6, 2026-08-22)

Three v1 audits asked one question — "does this page emit its social-preview metadata" — and charged for it three times. 4.8 `og-site-name` was a 26-line copy of the loop already running here; 4.10 `twitter-card` failed sites for a defect that does not exist. Both are now branches of this audit, and a site with no social metadata at all costs one score instead of three.

### Absorbed evidence — og-site-name (4.8)

4.8's dossier is kept verbatim at [merged/answer-readiness/og-site-name.md](../../merged/answer-readiness/og-site-name.md) (grade **A**). Its signal is the one Open Graph claim with direct Google documentation: the title-link page lists "Content in `og:title` meta tags" among the sources for a title link, and the site-names page states the system "will also consider content in `og:site_name`, `<title>`, heading elements, and other text on a home page". That adds Googlebot — and with it the AI Overviews / AI Mode source card, which reuses those labels — to this audit's consumer list alongside `facebookexternalhit` and Slack's unfurler.

Its counter-evidence is what fixes the *weight* of the absorbed half: Google ranks `og:site_name` below `WebSite` structured data ("most important" for the site name) and `og:title` below `<title>` and the visible title, so both are tiebreakers rather than levers. 4.8's own required fix therefore lands as written — "extend the `OG_CORE` loop with a second RECOMMENDED list that downgrades a miss to a warn rather than a standalone fail" — at priority `low`, and the audit no longer repeats 4.8's unsupported claim that a missing `og:site_name` "fragments your brand identity across AI-generated responses". No AI answer engine is documented to build entity association from the tag.

### The twitter-card redemption (4.10)

4.10's `TODO(redeem)` header asked for exactly two things: **fix the `twitter:*`/`og:*` fallback errors** and **fold the check into the social-meta diagnostic alongside core-open-graph, unscored**. Both are done here.

The factual error was structural: `TWITTER_REQUIRED = ['twitter:card','twitter:title','twitter:description']` never consulted the `og:*` head, so the configuration X itself documents as correct — `og:*` complete, `twitter:*` absent — was reported as `warn` "Missing Twitter Card tags", and a site with complete OG and no twitter tags took a hard `fail` at `medium` priority. The archived Cards Markup Tag Reference (Dec 2023, the last public version) documents a fallback for every content-bearing tag: `twitter:title`→`og:title`, `twitter:description`→`og:description`, `twitter:image`→`og:image`, `twitter:card`→`og:type`. The merged audit encodes that table directly: an absent `twitter:*` tag whose `og:*` counterpart is present is reported as *"falls back to og:…"*, not as missing. Only when neither exists does the row say so, and even then it is a statement, not a finding.

The one interaction 4.10's review says actually matters — `twitter:card="summary_large_image"` with no image in either namespace — is the single extra line the twitter block can emit. It is also informational.

**Why the twitter half cannot move the score, mechanically and not only by intent:** the `twitter:*` values are read exclusively inside `twitterReport()`, whose return value is concatenated into `found`. Nothing in the status, score, priority or `code` path reads a `twitter:*` key. Two tests pin it: identical `og:*` markup with and without a complete twitter block returns the same `status`, `score` and `priority`; and a page with full `og:*` plus a lone `twitter:card` still returns `pass` with score 1.

### Grade decision: stays **A**, tier `scored`, weight 1.0

The strongest **proven** path among the three sources is unchanged. 4.6 grades **A** on two named crawlers documenting that they read exactly these four properties; 4.8 also grades **A**, on Google's title-link and site-name docs; 4.10 grades **C**, and its own recommended tier is `informative` ("no live public X Cards specification… no AI vendor doc references `twitter:*` tags"). Absorbing an A and a C alongside an A neither raises nor lowers the merged grade: **A**, `tier: scored`, `weight 1.0` (`weightForGrade('A', 'scored')`).

The C-grade half is not silently averaged into that weight — it is excluded from scoring entirely, which is the only way the meta law (`weight = weightForGrade(grade, tier)`, one weight per audit) can carry two evidence grades in one audit: the weaker signal becomes text. `defaultPriority` stays `high`, which is now only reached through the core-tag branches; the absorbed `og:site_name` branch sets `low` per result.

### Deviations

- **Still single-page.** `ctx.pages[0]` only, as before. Multi-page iteration is required fix #4 on 4.6's own review (and appears in 4.8's "if kept standalone" list), not part of the fold; 4.6 is a `move` row with an open `fix` verdict, so its remaining required fixes — absolute-URL enforcement on `og:image`/`og:url`, the `og:image:url` / `og:image:secure_url` alias, `notApplicable` under WAF protection, all-pages iteration — stay open and are not claimed here.
- **No `pass` requires twitter tags, and no `fail` mentions them.** A site that deliberately ships no `twitter:*` markup is correct by X's own fallback rules and is reported as such.
- **Empty page list still returns `fail`**, not `na`, matching the pre-merge behavior and its test. The other Plan 4 folds that switched to `na` did so where the review asked for it; neither review here does.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — approved: 4.8 folds in (§5); 4.10 redeemed as the informational half of the social-meta diagnostic.
- 2026-08-22 — merged (Plan 4, Task 6); registry 165 → 163 for this fold.
