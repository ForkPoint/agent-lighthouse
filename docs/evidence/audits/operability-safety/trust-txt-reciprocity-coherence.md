---
audit: operability-safety/trust-txt-reciprocity-coherence
category: operability-safety
source_file: packages/core/src/audits/operability-safety/trust-txt-reciprocity-coherence.ts
slug: trust-txt-reciprocity-coherence
evidence_grade: C
tier: informative
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-10-18
graduated: 2026-08-23
sources:
  - journallist-trust-txt-spec
  - journallist-faq
  - rji-trust-txt-extension
---

# trust.txt reciprocity and AI-policy coherence

> Shipped in v2. Evidence grade **C** · informative tier · unique · implementation: `multi-page`

## What it checks

ROADMAP / UNSCORED. Parses trust.txt for publishers who maintain one, validating attribute names, resolving the reciprocal member=/belongto= relationships across domains, and cross-checking the datatrainingallowed= declaration against what robots.txt actually tells AI crawlers. Reported as an informational trust signal, never scored.

## Why it matters

No search engine, platform or AI company documents reading trust.txt. The [JournalList reference document](https://journallist.net/reference-document-for-trust-txt-specifications) (verified 2026-10-18) defines the reciprocal attributes and names no consumer. The [JournalList FAQ](https://journallist.net/frequently-asked-questions) (verified 2026-10-18) names only generic audiences: "the search engines, social networks and advertisers". The one documented reader is a [JournalList browser extension](https://rjionline.org/news/trust-txt-launches-browser-extension-making-verification-of-trusted-news-sources-easier-for-publishers-and-audiences-alike/) (verified 2026-10-18) that shows a badge to human readers. So the reciprocity check has no machine reader. The file still serves the JournalList network. For AI training preferences, robots.txt groups for the AI crawlers are the channel crawlers read.

## How it scores

Informative, weight 0. Every result carries an `unconsumed` notice. The audit never warns or fails. No trust.txt is not applicable. A trust.txt passes; each unreciprocated association, unknown attribute or datatrainingallowed= conflict with robots.txt is counted in the message and listed in `details.observations`, with the note that it does not affect AI agents.

## Claimed mechanism (falsifiable)

trust.txt's association attributes are defined as reciprocal: belongto=<association> is only meaningful if that association's own trust.txt lists member=<this domain>. That reciprocity is mechanically checkable across two HTTP fetches, which makes the association claim falsifiable rather than self-asserted. Independently, datatrainingallowed= and robots.txt AI-bot directives express the same policy through two channels. A site declaring datatrainingallowed=no, while leaving GPTBot, ClaudeBot and PerplexityBot unrestricted in robots.txt, is therefore stating contradictory policy. The machine-readable channel that actually gates crawlers says the opposite of the human-facing declaration. One limitation, stated plainly: no evidence was found that any AI engine, answer engine or crawler consumes trust.txt, and the JournalList reference document itself publishes no adoption statistics and names no consumer. The mechanism is internally sound; the consumer does not demonstrably exist.

## Evidence

- **[Reference Document for trust.txt Specifications](https://journallist.net/reference-document-for-trust-txt-specifications)** — JournalList.net (spec, verified 2026-10-18). Released 2020-06-29, revised through 2024-07-11; `datatrainingallowed=` added 2024-04-04. `belongto=` pairs with `member=` on the association, `controlledby=` with `control=`. Names no consumer.
- **[Frequently Asked Questions](https://journallist.net/frequently-asked-questions)** — JournalList.net (verified 2026-10-18). Says "crawlers may look at the trust.txt file at any time" and names no reader.
- **[trust.txt launches browser extension](https://rjionline.org/news/trust-txt-launches-browser-extension-making-verification-of-trusted-news-sources-easier-for-publishers-and-audiences-alike/)** — Reynolds Journalism Institute, 2025-02-21 (verified 2026-10-18). A browser badge for human readers; "about 3,000 participating publishers". No machine consumer is named.

**Grade:** C, the policy's community-convention row. The file is registered (IANA provisional) and published, and nothing documents a machine consuming it.

## Example finding

A regional news site publishes trust.txt with datatrainingallowed=no and belongto=https://example-press-association.org/. That association's trust.txt has no member= line for the site, so the membership claim is uncorroborated; meanwhile robots.txt has no GPTBot or ClaudeBot rules at all, so the site's only enforceable channel grants exactly the training access its declaration refuses.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade C does not meet the A/B bar required for scored audits.

## Implementation deviations

- The slug is shortened from `trust-txt-reciprocity-and-ai-policy-coherence`, which would make a 63-character id.
- No code path returns `warn` or `fail`, and a test asserts it across every input. Until 2026-10-18 an observation returned `warn`; the 2026-10-18 consumer review (policy.md, "Informative or obsolete") made the audit report only, with an `unconsumed` notice. The observations stay in the pass message and in `details`.
- The dossier's only source used to be `S1`, the MCP Streamable HTTP transport specification, which says nothing about trust.txt. It is replaced by the JournalList and RJI sources (2026-10-18).
- The weight is now computed with `weightForGrade` instead of being written as `0`.
- At most three associations are resolved. The finding says how many were skipped.
- The robots.txt comparison uses `parseRobots` and `isPathAllowed` from `gatherers/robots.ts`, as the `access-crawl-control` audits do.

## Deferred

- `social=` verification. It needs a third-party social profile fetched, which needs a headless browser.
- Cross-scan caching of association documents. The cache is per scan.
