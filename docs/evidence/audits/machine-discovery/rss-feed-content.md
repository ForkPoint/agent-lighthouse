---
audit: machine-discovery/rss-feed-content
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/rss-feed-content.ts
slug: rss-feed-content
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - rss-content-module
  - rfc-4287-atom
  - google-sitemap-formats
  - rss-2-specification
  - s18
  - perplexity-crawlers-docs
  - google-ai-optimization-mythbusting
---

# rss-feed-content (`1.12`)

> content-discoverability · source `rss-feed-content.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

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

## Evidence (2026-08-21)

**Mechanism claim:** A crawler that fetches a site's RSS or Atom feed ingests each item's `<content:encoded>` or `<atom:content>` as the article body, and therefore does not request the article page. When items carry only a truncated excerpt, the crawler must fetch every article individually.

**Grade: C** — full-text feed content is a published, widely implemented convention with real consumers in feed readers. But the only vendor that documents machine consumption of feeds is Google, and it documents reading them for URLs rather than for article bodies. No AI vendor documents ingesting article text from a feed.

**Evidence:**
- The RSS 1.0 content module defines `content:encoded` as "An element whose contents are the entity-encoded or CDATA-escaped version of the content of the item" — i.e. the item's full body carried inside the feed — https://web.resource.org/rss/1.0/modules/content/ (verified 2026-08-21)
- RFC 4287 (Atom Syndication Format, standards track, December 2005) defines `atom:content` as the entry's content element and constrains its cardinality — a ratified standard for the same signal — https://www.rfc-editor.org/rfc/rfc4287.html (verified 2026-08-21)
- Google documents machine consumption of feeds: "Google accepts RSS 2.0 and Atom 1.0 feeds" as sitemaps, so a named crawler demonstrably parses these documents — https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap (verified 2026-08-21)
- The RSS 2.0 specification acknowledges the full-content usage explicitly: "An item may also be complete in itself, if so, the description contains the text" — https://www.rssboard.org/rss-specification (verified 2026-08-21)

**Counter-evidence:** The strongest documented feed consumer reads feeds only as a source of recent URLs. Google's sitemap documentation describes RSS and Atom as providing "information about recent URLs", not article bodies. The claimed "index without visiting each page" path is therefore not documented for any named crawler (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap, verified 2026-08-21). The RSS 2.0 spec blesses excerpt feeds as an equal, conformant choice: "its description is a synopsis of the story, and the link points to the full story". A truncated feed is therefore a publishing decision, not a defect (https://www.rssboard.org/rss-specification, verified 2026-08-21). RFC 4287 goes further: "the absence of atom:summary is not an error, and Atom Processors MUST NOT fail to function correctly as a consequence of such an absence" (https://www.rfc-editor.org/rfc/rfc4287.html, verified 2026-08-21). Neither OpenAI's (https://developers.openai.com/api/docs/bots) nor Perplexity's (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) crawler documentation mentions feeds at all (both verified 2026-08-21), and Google states that no additional files or markup are needed for its AI features (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide, verified 2026-08-21). The audit's 500-character bar has no source in any specification.
