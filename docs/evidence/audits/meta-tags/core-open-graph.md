---
audit: meta-tags/core-open-graph
audit_id: "4.6"
category: meta-tags
source_file: packages/core/src/audits/meta-tags/core-open-graph.ts
slug: core-open-graph
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# core-open-graph (`4.6`)

> meta-tags · source `core-open-graph.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI agents and social platforms use Open Graph tags to generate rich previews and understand page content at a glance. Missing tags mean agents cannot display proper titles, descriptions, or images when referencing your page in AI-generated responses.

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

**Overlaps with:** `4.7`, `4.8`, `4.9`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
