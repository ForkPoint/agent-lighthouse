---
audit: access-crawl-control/sensitive-paths
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/sensitive-paths.ts
slug: sensitive-paths
evidence_grade: A
disposition: "kept — rewritten to crawl hygiene 2026-08-22 (Plan 4, Task 11)"
reviewed: 2026-08-22
signals:
  - name: path-level robots.txt Disallow honoured by named AI crawlers
    grade: A
    domain: crawler-permissions
sources:
  - rfc9309
  - applebot-doc
  - meta-web-crawlers-docs
  - anthropic-crawlers
  - s18
  - perplexity-bots-docs
  - google-common-crawlers
---

# sensitive-paths (`2.23`)

> access-crawl-control · source `sensitive-paths.ts` · evidence grade **A** · tier **scored** (weight 1.0) · rewritten from "sensitive paths" security framing to RFC 9309 crawl hygiene — see below

## What it checks

Without robots.txt, AI crawlers can access sensitive paths like /api/ and /admin/. This may expose internal endpoints, admin panels, or debug information in AI training data and search results.

## Code review findings (2026-08-20, 11-agent pass)

Net-misleading on three independent grounds and should be removed. (1) The matching logic inverts on the most common robots.txt idiom: `path.startsWith(r.path)` is always true when `r.path` is the empty string, so `User-agent: *\nDisallow:` — which means 'nothing is disallowed' — produces a PASS reading 'Sensitive paths are protected: /api/, /admin/'. It reports maximum protection on a file that protects nothing. (2) The premise is wrong for most sites: it hardcodes `['/api/', '/admin/']` and FAILs any site lacking those literal paths, so a WordPress site shipping the default `Disallow: /wp-admin/` fails for not protecting `/admin/` — a path that does not exist on it. (3) The guidance is a security anti-pattern: robots.txt is a public file and is not an access control; listing `/admin/` in it advertises the endpoint to attackers while doing nothing to stop the malicious crawlers the audit invokes. Telling users this reduces 'security and privacy risks' at high priority is actively wrong advice, and it belongs in a security category rather than crawler-permissions in any case.

**Required fix:** Delete. If the maintainer insists on retaining a robots.txt hygiene check, it must (a) drop the `path.startsWith(r.path)` clause and implement real longest-prefix matching per RFC 9309, (b) discover candidate paths from the crawl (links and sitemap entries actually observed) instead of hardcoding two, (c) return `notApplicable` when no such paths exist on the site, and (d) reframe the guidance to state explicitly that robots.txt is not an access control and that listing private paths discloses them.

**False-positive risks:**
- `return ruleNorm === pathNorm || r.path.startsWith(path) || path.startsWith(r.path);` — with `r.path === ''` from a bare `Disallow:`, `'/api/'.startsWith('')` is true, so an unprotected site PASSes. Concrete inverted result on an extremely common file.
- Same clause with `r.path === '/'`: a blanket-blocked site reports all sensitive paths 'protected' and PASSes here while 2.22 FAILs critical — the report contradicts itself on one input.
- Same clause with any short rule: `Disallow: /a` makes `/api/` 'protected' via `'/api/'.startsWith('/a')`.
- Hardcoded `/api/` and `/admin/` FAIL every site using `/wp-admin/`, `/administrator/`, `/dashboard/`, `/v1/`, or a headless/subdomain API — i.e. most of the real web.
- `checkSensitivePaths` filters to `g.userAgent === '*'` only, so a site that disallows `/admin/` under bot-specific groups is reported unprotected.
- SPA soft-404 serving HTML at /robots.txt yields a high-priority FAIL 'No sensitive paths are protected' on a site with no robots.txt at all.

**Test gaps:**
- No `Disallow:` (empty value) fixture — the exact input that inverts the result.
- No `Disallow: /` fixture showing the contradiction with 2.22.
- No `/wp-admin/` or other real-world admin path.
- No site legitimately lacking /api/ and /admin/ entirely.
- No bot-specific-group case, no soft-404 case.

**Overlaps with:** `2.22`

## The crawl-hygiene rewrite (Plan 4, Task 11, 2026-08-22)

The required rework from the [redemption dossier](../../deletions/crawler-permissions/sensitive-paths.md) is executed, together with the four-part fix the code review attached to the same audit. The mechanism the grade rests on is untouched — named AI crawlers do honour path-level `Disallow` — but everything the audit *said about it* was wrong, so the surgery is on the framing, the path list and the applicability gate.

**Old pass condition:** the wildcard `*` group in robots.txt disallows both of the hardcoded literals `/api/` and `/admin/`. Partial coverage warned, no coverage failed at `high` priority, a missing robots.txt warned. Every site without those two literal directories failed, whether or not it had anything at those paths.

**New pass condition:** every low-value URL family the crawl **actually observed** is disallowed for all six documented AI crawler tokens. When the crawl observed no such family, the audit is `notApplicable`.

### (a) Security/privacy framing dropped

The description, guidance and tags no longer claim protection of anything. The audit is now "Low-value URLs excluded from AI crawls" and the impact text carries RFC 9309's own two caveats verbatim in substance: the protocol "is not a substitute for valid content security measures", listed paths become publicly discoverable, and the fix instruction explicitly says to use HTTP authentication for anything that needs protecting. The `security` tag is replaced by `crawl-hygiene`; `docsUrl` now points at RFC 9309.

### (b) `/api/` removed from the list, not made opt-in

`/api/` is gone outright rather than hidden behind a flag. This is an agent-readiness framework and API surfaces are the thing agents need; there is no configuration in which the tool should be nudging a site to hide them. A dedicated regression test asserts that an `/api/`-heavy crawl produces `na` and that the word `/api/` appears nowhere in the result.

The families that replace it are all session-bearing, non-canonical, or carry nothing citable: cart/checkout (`cart`, `carts`, `checkout`, `basket`), site search (`search`), authentication (`login`, `signin`, `sign-in`, `signup`, `sign-up`, `register`, `logout`, `signout`), account areas (`account`, `my-account`, `dashboard`) and admin surfaces (`admin`, `wp-admin`, `administrator`).

### (c) User-initiated-fetcher caveat stated

`guidance.impact` names both documented exemptions — OpenAI on ChatGPT-User ("Because these actions are initiated by a user, robots.txt rules may not apply") and Perplexity on Perplexity-User ("generally ignores robots.txt rules") — so the check can never be read as protection against agent access.

### (d) `defaultPriority` `high` → `low`

The redeem note allows low or medium. `low` is chosen: the evidence supports the mechanism, not a severity. Nothing here is a security finding, the worst realistic outcome is wasted crawl budget and dead session URLs in an answer, and the audit now only speaks at all when the site demonstrably has the URL family in question. The result-level priorities on the `warn` and `fail` branches match.

### Candidate discovery, applicability, and RFC 9309 matching

- **Paths are discovered, not hardcoded.** Candidates come from the crawled page URLs, every same-origin `<a href>` on those pages, and `<loc>` entries in `/sitemap.xml` (falling back to `/sitemap-index.xml`). Cross-origin and non-HTTP links are ignored, and a leading language/locale segment is skipped so `/en-gb/checkout` classifies as checkout. This is what closes the review's headline false positive: a WordPress site shipping `Disallow: /wp-admin/` now passes on its own rule and is never asked about an `/admin/` it does not have.
- **The emitted fix rules match the paths that were flagged.** Each candidate carries a `disallow` value — the observed path truncated after the classified segment, built from the raw percent-encoded segments — so the rule is always a literal prefix of the path it came from and therefore always matches it under RFC 9309 prefix semantics. On a locale-prefixed URL that keeps the locale (`Disallow: /en-gb/checkout`); a bare `Disallow: /checkout` would not match, so following the suggested fix would have left the audit still failing. Candidates are deduplicated by rule rather than by segment, so `/en-gb/checkout` and `/de/checkout` each get their own line instead of collapsing into one that covers a single locale. Tests apply the audit's own emitted block back as robots.txt and assert the result flips to `pass`, for both a locale-prefixed and a plain candidate.
- **`notApplicable` when there is nothing to assess.** A docs site or a brochure site with no cart, search, login or admin URL leaves the score untouched instead of failing.
- **Matching is the shared RFC 9309 implementation.** The audit calls `isPathAllowed` from `gatherers/robots.ts` (via the `_robots-txt-helpers` shim) — group selection, longest-match arbitration and allow-wins-on-tie are that module's, not re-implemented here. The `path.startsWith(r.path)` inversion the review found had already been removed when parsing moved into the gatherer; a regression test now pins it, asserting that `Disallow:` with an empty value protects nothing.
- **Coverage is judged per bot, over all six tokens.** GPTBot, ClaudeBot, Applebot-Extended, meta-externalagent, Google-Extended and PerplexityBot — the tokens whose vendors document robots.txt as the control. A rule written only for GPTBot leaves the other five crawling the URL, so it does not count as coverage; the previous `g.userAgent === '*'` filter both missed bot-specific rules and over-credited them.
- **The self-contradiction with 2.22 is closed.** When robots.txt blanket-blocks the AI crawlers at the root, this audit returns `notApplicable` and points at `access-crawl-control/no-blanket-block`, which owns that finding. Previously the same input passed here and failed critical there.
- **A soft-404 no longer reads as a rule set.** A 200 response whose body starts with `<` is treated as no robots.txt, and the "no robots.txt is served" note is appended to the reported evidence.

### Grade decision: stays **A**, tier `scored`, weight 1.0

Source: the [redemption dossier's verdict](../../deletions/crawler-permissions/sensitive-paths.md) — "redeemed — keep with rewrite (grade A)" — and the [REWORK-TODO entry](../../../../packages/core/src/audits/REWORK-TODO.md) carrying it. The grade rests on vendor documentation with literal directory examples: Apple's support article 119829 shows `User-agent: Applebot / Allow: / / Disallow: /private/` and `User-agent: Applebot-Extended / Disallow: /private/`; Meta's crawler doc shows `User-agent: meta-externalagent / Allow: / # Allow everything / Disallow: /private/ # Disallow a specific directory`; RFC 9309 is the ratified standard whose path matching all of them implement, and OpenAI and Anthropic both point publishers at it.

Neither the redeem note nor the REWORK-TODO row asks for a tier change — the required changes are to framing, path list, applicability and priority — so the tier stays `scored`. Per the §4 weight law `weightForGrade('A', 'scored') = 1.0`; `scoreDisplayMode` stays `ternary`; `defaultPriority` moves `high` → `low` as instructed.

### Rewrite deviations

- **A missing robots.txt now `fail`s rather than `warn`s, when low-value URLs were observed.** Keeping the old dedicated `warn` would have made deleting robots.txt score better than serving one with no rules — a perverse incentive. Coverage is computed uniformly and absence is reported in the evidence string; at `low` priority and behind the observed-family gate, the finding is honest rather than alarming. "You have no robots.txt at all" remains a separate audit's job.
- **The `sensitive-paths` id, and therefore the slug and dossier path, are unchanged.** The name no longer describes the check, but the v2 merge plan freezes ids and `migration-map.json` records no rename for this audit.
- **Locale-prefix handling is a two-letter heuristic.** `/de/cart` and `/en-gb/checkout` classify correctly, and the fix rules they emit carry the locale so they actually match; a site using a three-letter or country-first prefix will simply not produce a candidate, which fails safe to `na`.
- **Query-only low-value spaces are not detected.** A site whose faceted search lives at `/?s=term` rather than `/search` yields no candidate. Detecting that would require classifying query parameters, which the vendor evidence says nothing about.

## Evidence

### Signal: path-level robots.txt Disallow honoured by named AI crawlers — grade A (crawler-permissions)

**Mechanism:** AI crawlers apply RFC 9309 path matching, not only a site-level allow or block. A `Disallow` naming a directory therefore keeps the URLs under it out of the crawls those agents perform. That is what makes a per-path rule a usable crawl-hygiene instrument rather than a decorative one.

**Grade: A** — two AI vendors document path-level `Disallow` for their own AI crawlers with literal directory examples, on top of a ratified standard whose matching rule they implement. That is documented consumer behaviour for exactly the signal this audit inspects.

**Evidence:**
- RFC 9309 is the ratified standard, and its matching rule is normative: "The most specific match found MUST be used" — https://www.rfc-editor.org/rfc/rfc9309.html (verified 2026-08-21)
- Apple documents the rule for both of its tokens with a literal directory. For the ordinary crawler: "Applebot doesn't try to crawl documents that are under /private/ or /not-allowed/". For the generative-AI training token: "You can add a rule in robots.txt to disallow Applebot-Extended, as follows: User-agent: Applebot-Extended / Disallow: /private/" — https://support.apple.com/en-us/119829 (verified 2026-08-21)
- Meta documents the same shape for a crawler that "crawls the web for use cases such as training foundation AI models": "User-agent: meta-externalagent / Allow: / # Allow everything / Disallow: /private/ # Disallow a specific directory" — https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/ (verified 2026-08-21)
- Anthropic states that "Anthropic's Bots respect 'do not crawl' signals by honoring industry standard directives in robots.txt" for ClaudeBot, Claude-User and Claude-SearchBot, though its own examples are root-level only — https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler (verified 2026-08-21)
- OpenAI directs publishers to robots.txt for GPTBot and OAI-SearchBot opt-outs — https://developers.openai.com/api/docs/bots (verified 2026-08-21)

**Counter-evidence:** The mechanism is real; the audit's original *benefit* — security and privacy, keeping internal endpoints out of training data — is contradicted by the standard it rests on. RFC 9309 states outright that "The Robots Exclusion Protocol is not a substitute for valid content security measures", and warns that listing paths makes them publicly discoverable, directing operators to HTTP authentication instead. The old guidance therefore told site owners to publish a map of their admin surface. The agent traffic most likely to reach `/admin/` or `/api/` is also exempt. OpenAI states that for `ChatGPT-User`, "Because these actions are initiated by a user, robots.txt rules may not apply". Perplexity states that `Perplexity-User` "generally ignores robots.txt rules" (https://docs.perplexity.ai/guides/bots, verified 2026-08-21). Finally there is a domain-fit limit that shaped the rewrite: `/api/` is precisely the surface an agent wants, so a high-priority failure telling every site to disallow it works against the outcome this project exists to improve. All four points are why the audit was rewritten to crawl hygiene over observed URL families, at low priority, rather than kept as a security check.

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/crawler-permissions/sensitive-paths.md](../../deletions/crawler-permissions/sensitive-paths.md). Outcome: **redeemable**, grade A.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (grade A, rewrite required).
- 2026-08-22 — required rework executed (Plan 4, Task 11): security framing dropped, `/api/` removed, candidate paths discovered from the crawl, `notApplicable` when none exist, `defaultPriority` `high` → `low`. Grade A / tier `scored` / weight 1.0 unchanged; `TODO(redeem)` marker removed from the source file.
