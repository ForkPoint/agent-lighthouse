---
audit: content-discoverability/rss-feed-content
audit_id: "1.12"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/rss-feed-content.ts
slug: rss-feed-content
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# rss-feed-content (`1.12`)

> content-discoverability · source `rss-feed-content.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Full-content feeds allow AI agents to index your articles without visiting each page, reducing crawl load and improving content quality in AI responses.

## Code review findings (2026-08-20, 11-agent pass)

Grades feed items on a >500-character content threshold. Duplicates 1.11's entire discovery function verbatim (second full network probe per scan) and enforces an arbitrary, editorially-loaded rule: publishing excerpt-only feeds is a deliberate business decision, and link blogs, changelogs and podcast feeds legitimately have short items. Failing them tells the user to change their publishing model for an unquantified benefit.

**Required fix:** Consume the shared `_feed.ts` discovery (per the 1.11 fix) instead of duplicating it. Strip HTML before measuring length so the threshold reflects text, not markup. Skip items whose content is an enclosure (podcast/video). Downgrade the verdict for excerpt feeds from fail to warn/informational — full-text feeds are a choice, not a defect — and return notApplicable when the feed is a non-article type.

**False-positive risks:**
- `findFeedResult()` is copy-pasted from rss-feed.ts, so every discovery flaw listed for 1.11 (exact rel/type match, unresolved relative hrefs, HTML soft-404 accepted, missing /feed/ and /index.xml) recurs identically here — and the two audits can even resolve different feeds if the origin is flaky.
- A 200 HTML soft-404 reaches `cheerio.load(body, {xmlMode:true})`, finds no `<item>`, and returns WARN 'Feed has no items to check' — describing an imaginary empty feed.
- `Math.max(contentEncoded.length, description.length, content.length) > 500` counts raw markup length, so a short post wrapped in verbose HTML/CDATA passes while a dense 400-character plain-text post fails. It is measuring bytes of markup, not content.
- Podcast/video feeds (content is the enclosure) and changelog/link-blog feeds are structurally short-form and are failed at medium priority for it.
- `$(el).find('description')` is a descendant search inside `<item>`; a `<description>` inside a nested extension element is picked up.
- 500 is undocumented and unvalidated; 0.5/1.0 ratio cut-offs are equally arbitrary.
- Only the first discovered feed is examined; a site whose main feed is full-text but whose comment feed is discovered first is graded on the wrong document.

**Test gaps:**
- HTML soft-404 body reaching the parser (reported as 'feed has no items')
- <content:encoded> with CDATA — the exact form the guidance recommends is never tested
- Atom <content src="…"/> external content
- Podcast feed with <enclosure> and short descriptions
- Markup-heavy but text-poor items passing the 500-char bar
- Feed discovered via head link differing from the one 1.11 found

**Overlaps with:** `1.11`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
