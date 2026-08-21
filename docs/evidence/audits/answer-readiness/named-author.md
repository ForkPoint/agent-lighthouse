---
audit: answer-readiness/named-author
audit_id: "10.1"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/named-author.ts
slug: named-author
review_verdict: fix
severity: high
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# named-author (`10.1`)

> generative-engine · source `named-author.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI systems assign higher confidence to content from named experts. Generic authors like "Staff" or "Admin" reduce trust scoring because agents cannot verify expertise.

## Code review findings (2026-08-20, 11-agent pass)

Signal is real — schema.org `author` on a Person is genuinely consumed by search and AI grounding pipelines, and named attribution is a defensible E-E-A-T proxy. The implementation both over-passes and under-passes badly. The visible-byline fallback `$('[class*="author"]').first().text().trim()` grabs the whole text of the first element whose class merely contains "author", then checks that raw blob against a 10-word generic-name set — so "By Staff Writer · 5 min read" passes as a named author, which is exactly the failure this audit exists to catch. And because `applicablePageTypes: ['content']` does not filter `ctx.pages`, a `WebPage` node with an author on the homepage satisfies the audit for the whole site.

**Required fix:** 1) Replace the local `findJsonLdByType` with the shared `flattenJsonLd`-based lookup used in brand-name.ts, and dereference `@id` author references. 2) Filter to `p.pageType === 'content'` inside the loop and report the page the evidence actually came from. 3) Replace the byline blob read with targeted extraction: prefer `[itemprop="author"]`, `[rel="author"]`, `.byline a`; strip a leading By|Von|Par|Por prefix and any trailing metadata after `·`, `|`, `—` or a date. 4) Change the generic test from exact-set membership to token-based (reject when every token is generic) and extend the set with non-English equivalents keyed off the page `lang`. 5) Reject or downgrade `@type: Organization` authors. 6) Ignore `<meta name="author">` values matching known CMS/platform names. 7) When the site has no article-type pages at all, return `notApplicable()` instead of `fail`.

**False-positive risks:**
- `$('[class*="author"]').first().text().trim()` returns the concatenated text of a *container*, not a name. A typical theme's `<div class="post-author"><img><span>By</span><a>Staff</a><span>· Mar 3</span></div>` yields "By Staff · Mar 3", which is not in GENERIC_AUTHOR_NAMES, so the audit reports 'Named author found in visible byline: "By Staff · Mar 3"' — a false PASS on the precise anti-pattern being audited.
- The generic-name check is exact-set membership on the full trimmed string (`GENERIC_AUTHOR_NAMES.has(lower)`), not a token or substring test. "Staff Writer", "Editorial Team", "The Admin", "Site Administrator" all pass. Only the bare literal "staff"/"admin" is caught.
- GENERIC_AUTHOR_NAMES is English-only. A German site with `"author":{"name":"Redaktion"}`, a French "Rédaction", or a Japanese "編集部" is reported as a named expert.
- `[class*="author"]` is case-sensitive and semantic-class-dependent: `class="Author"`, `class="c-Byline"`, styled-components `class="sc-1x2y3z"`, or a Tailwind-only byline `<p class="text-sm text-gray-500">By Jane Smith</p>` all miss, producing a false FAIL on sites that display the author perfectly well.
- `applicablePageTypes: ['content']` gates execution only; the loop is `for (const p of ctx.pages)` over every page. A store whose homepage carries `{"@type":"WebPage","author":{"name":"Acme Editorial"}}` passes while none of its articles have a byline, and the reported `pageUrl` is a page the user was never told to check.
- The local shallow `findJsonLdByType` only descends into `@graph`. Yoast/next-seo's very common `{"@type":"WebPage","mainEntity":{"@type":"Article","author":{...}}}` and `isPartOf` nestings are invisible → false FAIL. brand-name.ts in the same directory uses deep `flattenJsonLd` and would find it.
- `p.meta['author']` is accepted verbatim. CMS boilerplate routinely emits `<meta name="author" content="WordPress">`, `content="Shopify"`, or the site's own domain — all pass as named experts.
- No check that the name denotes a person. `"author":{"@type":"Organization","name":"Acme Inc."}` passes an audit whose whole point is a verifiable individual.

**Test gaps:**
- No test for a byline container with surrounding chrome ("By Staff · 5 min read") — the highest-frequency real shape and a confirmed false pass.
- No test for multi-word generic names ("Staff Writer", "Editorial Team").
- No test for non-English author names or non-English generic names.
- No test for a Tailwind/CSS-Modules/styled-components byline with no `author` substring in the class.
- No test where the author is found on a non-content page (homepage/product) — the applicablePageTypes leak is entirely untested.
- No test for `mainEntity`/`isPartOf`-nested Article, which the shallow helper misses.
- No test for `<meta name="author" content="WordPress">`-style CMS boilerplate.
- No test for an Organization-typed author.
- Existing tests are line-coverage exercises ("covers line 118 ?? empty-string fallback") rather than behavioral scenarios.

**Overlaps with:** `10.3`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Graded evidence (2026-08-21)

**Mechanism claim:** Replacing a generic author label ("Staff", "Admin", "Team") with a named person in schema.org `author` / the visible byline raises the page's confidence or citation rate in generative answer engines.

**Grade: C** — the field itself is a documented Google Search input with wide adoption, but no vendor documents any AI answer engine reading author identity and no study measures a citation delta for named vs. generic authorship, so the "AI trust scoring" half of the claim is convention, not proof.

**Evidence:**
- Google documents that it parses `author` markup and prescribes its shape: "To help Google best understand and represent the author of the content, we recommend following these best practices when specifying authors in markup", "In the `author.name` property, only specify the name of the author. Don't add any other piece of information", "Use the `Person` type for people, and the `Organization` type for organizations." This is a named consumer reading the exact field the audit inspects, and it independently justifies rejecting byline blobs and Organization authors — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21)
- Google's content guidance treats a real byline as an expected quality signal: "We strongly encourage adding accurate authorship information, such as bylines to content where readers might expect it", "Do pages carry a byline, where one might be expected?", "Is this content written or reviewed by an expert or enthusiast who demonstrably knows the topic well?" — https://developers.google.com/search/docs/fundamentals/creating-helpful-content (verified 2026-08-21)

**Counter-evidence:** The 2026 critical GEO survey rates authority-flavoured signals as the weakest family it reviewed — "authoritative tone" has "weak and unstable" support and "may conflict with credibility" — and it finds no dedicated research on E-E-A-T signals for generative engines at all (https://arxiv.org/html/2607.14035v1, verified 2026-08-21). Google's own AI-features documentation states there are "no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary" and "There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21). Nothing published distinguishes the *named* case from the *generic* case in any engine's behaviour; the documented consumption proves the field is read, not that its value changes an outcome.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
