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

**Scored — Open Graph.** The four core properties `og:title`, `og:description`, `og:image`, `og:url` must be present and non-empty; `og:site_name` (absorbed from 4.8) is _recommended_ and can only produce a warn.

| State                                                               | Result                  |
| :------------------------------------------------------------------ | :---------------------- |
| all four core tags present, `og:site_name` usable                   | `pass`                  |
| all four core tags present, `og:site_name` missing or a placeholder | `warn`, priority `low`  |
| one to three core tags missing                                      | `warn`, priority `high` |
| all four core tags missing                                          | `fail`, priority `high` |

A placeholder `og:site_name` is treated as missing. A placeholder is an unrendered template token — `{{ … }}`, `{% … %}`, `${…}`, `<% … %>` — or one of the audit's own sample strings: "Your Site Name", "Site Name", "SiteName", "Your Website". This is the false positive 4.8's review names first.

**Informational — Twitter Cards.** `twitter:card`, `twitter:title`, `twitter:description` and `twitter:image` are reported in the `found` block, each labelled with the `og:*` property it falls back to. These rows never change the status, the score or the priority: no consumer is documented to read a `twitter:*` tag that has an `og:*` equivalent.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Named link-preview crawlers — `facebookexternalhit` and Slack's unfurler — fetch a shared URL and read `og:title`, `og:description`, `og:image` and `og:url` to build the preview card. When those tags are absent, the crawler falls back to heuristic guesses at the title, text and image.

**Grade: A** — two vendors document, by crawler name, that they read exactly these properties, and the fallback behavior when they are missing is stated in the vendor doc itself.

**Evidence:**

- Meta's webmaster guide instructs sites to add `og:url` ("The canonical URL for your page"), `og:title`, `og:description`, `og:image` and names the crawler user-agent `facebookexternalhit/1.1`; without markup the crawler "uses internal heuristics to make a best guess" — https://developers.facebook.com/docs/sharing/webmasters/ (verified 2026-08-21)
- Slack documents the same consumption for message unfurls: "Slack crawls the URL, looks for common OpenGraph and X (formerly known as Twitter) Card metadata, and renders some micro-approximation of the content." — https://docs.slack.dev/messaging/unfurling-links-in-messages/ (verified 2026-08-21)
- The Open Graph protocol itself defines `og:title`, `og:type`, `og:image`, `og:url` as the required basic metadata and names Facebook as the originating consumer — https://ogp.me/ (verified 2026-08-21)

**Counter-evidence:** The proven consumer path is social/messaging link previews, not AI answer generation — the audit's framing ("agents cannot display proper titles… in AI-generated responses") has no source. OpenAI's crawler documentation covers only robots.txt and user agents, and mentions no Open Graph tags — https://developers.openai.com/api/docs/bots (verified 2026-08-21). Google's AI-features page likewise never mentions Open Graph — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). And Google's supported-meta-tags list includes no `og:*` property at all, with the note that "Google will ignore `meta` tags that it doesn't support" — https://developers.google.com/search/docs/crawling-indexing/special-tags (verified 2026-08-21). Note also that the grade attaches to _resolvable_ values: the vendor doc's `og:image` contract is a URL the crawler can fetch, which the current non-emptiness check does not enforce.

## Implementation deviations

- The audit merges the former `og-site-name` and `twitter-card` audits. Their records are in `docs/evidence/merged/answer-readiness/`.
- Only `ctx.pages[0]` is read.
- A core tag counts when it is non-empty. `og:image` and `og:url` are not checked for absolute URLs, and the `og:image:url` and `og:image:secure_url` aliases are not read.
- A missing or placeholder `og:site_name` only warns, at priority `low`. Google ranks it below `WebSite` structured data and `<title>`.
- The `twitter:*` tags are read only inside `twitterReport()`, whose output goes into `found`. No status, score or priority path reads them. An absent `twitter:*` tag whose `og:*` counterpart is present is reported as a fallback, not as missing.
- The C-grade twitter half is text only, so the merged audit keeps grade A and weight 1.0.
- An empty page list returns `fail`, not `notApplicable`.

## Deferred

- Iterate all sampled pages.
- Enforce absolute URLs on `og:image` and `og:url`, and read the `og:image:url` and `og:image:secure_url` aliases.
