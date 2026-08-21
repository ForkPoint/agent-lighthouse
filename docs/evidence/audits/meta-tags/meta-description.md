---
audit: meta-tags/meta-description
audit_id: "4.1"
category: meta-tags
source_file: packages/core/src/audits/meta-tags/meta-description.ts
slug: meta-description
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# meta-description (`4.1`)

> meta-tags · source `meta-description.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI agents use the meta description as the primary summary of your page when generating answers. Without it, agents must extract a summary from body text, which often produces inaccurate or irrelevant snippets. Add a concise 50-300 character description.

## Code review findings (2026-08-20, 11-agent pass)

Genuinely valuable signal, but the length gate is naive: the value is never trimmed, length is counted in UTF-16 code units so CJK/Cyrillic pages are judged by an English-tuned 50-300 window, and only ctx.pages[0] is examined despite the guidance saying 'every page'. Passing this plausibly does help AI summarization, so the signal is worth keeping — only the measurement is wrong.

**Required fix:** 1) `const desc = (page?.meta?.['description'] ?? '').trim()` — currently `const desc = page?.meta?.['description'] ?? ''` with `const len = desc.length`, so a template leftover of 60 whitespace characters scores a clean pass. 2) Count graphemes/words rather than UTF-16 units, or widen/relax the window when `<html lang>` is a CJK locale — a well-written 40-character Japanese description is warned today. 3) Iterate all of `ctx.pages` and aggregate; report which pages are missing/oversized. 4) Consider falling back to `og:description` before failing, since many CMSes emit only the OG variant and agents read it. 5) Detect boilerplate: identical description across all scanned pages should warn even when the length is in range.

**False-positive risks:**
- Whitespace-only description passes: `const desc = page?.meta?.['description'] ?? ''` with no `.trim()`, then `len >= 50 && len <= 300` — 60 spaces from an unfilled CMS template scores 1.0.
- CJK/Thai/Arabic false warn: `const len = desc.length` counts UTF-16 code units. A complete 45-character Japanese description carrying more information than a 200-character English one is reported as 'too short'. Emoji and astral-plane characters count double, pushing a 295-visible-character description over 300.
- Multi-page false pass/fail: reads only `ctx.pages[0]`. A site whose homepage has a description but whose product/article pages do not passes; a site whose homepage is a bare splash page but whose content pages are perfect fails.
- WAF/CDN interstitial served with HTTP 200 has no description meta → hard fail with priority 'high' on a correctly marked-up site (no `ctx.wafProtection` check).
- Entry URL that redirects to a different page, or a non-200 homepage that gets filtered out of `ctx.pages` in the orchestrator, means the description reported belongs to a page the user did not ask about.
- `<meta name="description" content="">` is dropped entirely by `extractMetaTags` (`if (name && content)`), so an explicitly-blanked description is reported as 'missing' rather than 'empty' — the fix advice differs.
- The 300-character upper bound is asserted as fact but is a Google-SERP-truncation heuristic; for an AI agent ingesting the tag, a 400-character accurate description is strictly better than a 120-character vague one, so the warn can push users toward worse content.

**Test gaps:**
- No CJK / non-Latin description case.
- No whitespace-only or `content=""` description case (would expose the missing trim).
- No multi-page context — never verifies which page is judged.
- No duplicate `<meta name="description">` tags on one page (parser is last-wins).
- No og:description-only page.
- No boundary tests at exactly 50 and exactly 300.
- No WAF/empty-head page.

**Overlaps with:** `4.5`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
