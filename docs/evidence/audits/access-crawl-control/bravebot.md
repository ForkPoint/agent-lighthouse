---
audit: access-crawl-control/bravebot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/bravebot.ts
slug: bravebot
evidence_grade: D
disposition: "obsolete tier (2026-10-18)"
reviewed: 2026-10-18
recommended_tier: obsolete
consumers:
  - none (Brave sends no Bravebot user agent and follows Googlebot rules)
signals:
  - name: BraveBot / Bravebot allow/block state in robots.txt
    grade: C
    domain: robots-ai-crawlers
sources:
  - brave-search-crawler
  - rfc-9309
  - knownagents-bravebot
---

# bravebot (`2.18`)

> access-crawl-control · source `bravebot.ts` · evidence grade **D** · tier **obsolete** (weight 0, never fails)

## What it checks

Whether robots.txt has a group that names `Bravebot`. A catch-all group that happens to cover the token is not reported: this audit speaks only about a group the owner wrote for Brave.

| State                                                  | Result                 |
| :----------------------------------------------------- | :--------------------- |
| a `User-agent: Bravebot` group, allowing or blocking   | `warn`, priority `low` |
| no robots.txt, a soft 404, or no group naming Bravebot | `notApplicable`        |

## Claimed mechanism (falsifiable)

**Mechanism:** a named robots.txt group controls the crawler that sends that product token. The claim this audit tests is that Brave documents following the Googlebot rules and does not document reading a Bravebot group, so the group is not the control Brave describes.

## Evidence

- Brave: "The Brave Search crawler does not advertise a differentiated user agent because we must avoid discrimination from websites that allow only Google to crawl them. However, if a domain or page is not crawlable by Googlebot, then Brave Search's bot will not crawl it either." — [Brave Search Crawler](https://search.brave.com/help/brave-search-crawler) (verified 2026-10-18)

**Counter-evidence:** Third-party bot directories list a `Bravebot/1.0` user-agent string. Brave does not document one, and its page does not say a `Bravebot` group is ignored. The message therefore says only what Brave documents: it follows the Googlebot rules.

## Scoring

**Grade: D** — the operator documents following the Googlebot rules and sending no distinct user agent; it documents no reading of a Bravebot group. An obsolete audit carries weight 0 and never returns `fail` (`sunset.test.ts`; `Audit.toCheckResult` lowers a stray `fail` to `warn`). It does not move any score.

## Example finding

robots.txt has `User-agent: Bravebot` / `Disallow: /private`. The report says Brave documents following the Googlebot rules and does not document reading a Bravebot group.

## Implementation deviations

- 2026-10-18: moved from informative (grade C) to the obsolete tier (grade D). The audit no longer extends `CrawlerBotAudit`; it uses `_obsolete-robots-group-audit.ts`.
- The allow/block verdict is gone. Brave's access follows the rules that apply to Googlebot.
- 2026-10-18, after independent review: the message no longer says the group "governs nothing Brave sends". Brave's page does not say that; it says Brave follows the Googlebot rules.

## Record before the obsolete tier

The dossier as it stood before the move on 2026-10-18. Kept as the research record; withheld from the public page.

### What it checks

Reads the robots.txt rules that apply to Bravebot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

### Evidence

#### Signal: BraveBot / Bravebot allow/block state in robots.txt — grade C (robots-ai-crawlers)

**Mechanism:** A 'Bravebot' disallow is intended to block Brave Search's crawler. But Brave's own documentation states its crawler deliberately does not advertise a differentiated user agent. The token therefore has no vendor-confirmed consumer and the rule is likely a no-op.

**Evidence:** Known Agents lists a Bravebot entry with UA 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Bravebot/1.0; +https://search.brave.com/help/brave-search-crawler) Chrome/W.X.Y.Z Safari/537.36' and only 2% top-website blocking as of 2026-08-19 — the lowest of any token in this set, indicating near-zero operator recognition.

**Counter-evidence:** The vendor refutes this directly: Brave's own crawler help page states 'The Brave Search crawler does not advertise a differentiated user agent because we must avoid discrimination from websites that allow only Google to crawl them.' Brave further states 'robots.txt is not used to prevent a page from being indexed. A site owner can delist a page by using the robots noindex directive' — i.e. Brave directs publishers to noindex, not to a robots.txt token. Brave's page makes no mention of AI training, data licensing, or Brave Leo in connection with the crawler. Given the vendor contradicts the token's existence and blocking adoption is 2%, this should never be scored; consider demoting the audit toward deletion unless a Brave-published token is confirmed.

### Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to Bravebot permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.

### Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
