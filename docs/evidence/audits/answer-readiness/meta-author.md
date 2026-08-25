---
audit: answer-readiness/meta-author
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/meta-author.ts
slug: meta-author
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - whatwg-metadata-names
  - google-article-structured-data
  - google-special-tags
  - s18
---

# meta-author (`4.2`)

> meta-tags · source `meta-author.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI agents use the meta author tag to attribute content to a specific person or organization for E-E-A-T scoring. Without it, your content appears authorless, which reduces trust signals in AI ranking systems that prioritize named expertise.

## Code review findings (2026-08-20, 11-agent pass)

Borderline falsy, and wired to the wrong page. `applicablePageTypes: ['content']` makes the runner execute the audit whenever ANY scanned page is a content page, but the body then evaluates `ctx.pages[0]` — which the orchestrator makes the entry/homepage. So the audit gates on content pages and then measures the homepage, which almost never carries a meta author. The E-E-A-T justification in the description is cargo cult: no shipping AI system is known to score trust off this tag.

**Required fix:** 1) Evaluate the pages the gate selected: `ctx.pages.filter(p => p.pageType === 'content')` instead of `ctx.pages[0]` — the current `applicablePageTypes: ['content']` + `const page = ctx.pages[0]` combination is an outright wrong-page bug (see audit-runner.ts planAudits, which only checks that SOME scanned page matches). 2) Drop the E-E-A-T claim from `description`/`guidance.impact` or cite a source; as written it asserts behavior no AI system exhibits. 3) Downgrade `defaultPriority` from 'medium' to 'low'. 4) Accept the modern equivalents before failing: `article:author`, `<meta name="twitter:creator">`, and a rel=author link. 5) Reject placeholder values ('admin', 'WordPress', 'user', the site domain) which currently pass.

**False-positive risks:**
- Wrong-page bug: `applicablePageTypes: ['content']` gates on content pages existing, but `const page = ctx.pages[0]` reads the homepage (orchestrator sets `isFirstPage = p.index === 0`, and detectPageType returns 'homepage' for it). A blog whose every article correctly carries `<meta name="author">` fails this audit because the homepage does not.
- Placeholder values pass: `if (author.trim().length > 0)` accepts `content="admin"`, `content="WordPress"`, `content="Your Name Here"`, or `content="{{ author }}"` — all real CMS defaults — and reports them as a satisfied trust signal.
- Sites that publish authorship correctly via JSON-LD `"author": {"@type":"Person"}` (the form agents actually parse) but omit the legacy meta tag are told their content 'appears authorless'. That is wrong guidance.
- Corporate/organizational content with no named author is penalized even though an organization byline is legitimate and the guidance itself allows it — no way for the audit to distinguish.
- WAF interstitial or filtered-out homepage shifts `ctx.pages[0]`, producing an author verdict for an arbitrary page.

**Test gaps:**
- No test where pages[0] is a homepage and a later page is the content page — precisely the production configuration the `applicablePageTypes` gate creates.
- No placeholder-value test ('admin', empty-ish, template token).
- No JSON-LD-author-only page (the false-negative case).
- No `article:author` / rel=author alternative-markup case.
- Only 3 tests, all single-page.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Evidence (2026-08-21)

**Mechanism claim:** A named ranking or answer system reads `<meta name="author">` and uses it to attribute the page to a person or organization, raising the page's trust/authority weighting relative to an otherwise identical page without the tag.

**Grade: C** — `author` is a WHATWG-standard metadata name with long-standing partial adoption, but no vendor documents any system reading it, and the specific E-E-A-T mechanism this audit asserts is contradicted by the one vendor that documents authorship handling.

**Evidence:**
- WHATWG HTML defines `author` as a standard metadata name: "The value must be a free-form string giving the name of one of the page's authors." The spec assigns no consumer behavior to it — https://html.spec.whatwg.org/multipage/semantics.html#standard-metadata-names (verified 2026-08-21)
- Convention is real but consumer-less: the tag predates and is superseded by schema.org `author`, which is the form Google documents for authorship — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21)

**Counter-evidence:** Google's list of meta tags Google Search supports does not include `author`, and the same page states "Google will ignore `meta` tags that it doesn't support" — https://developers.google.com/search/docs/crawling-indexing/special-tags (verified 2026-08-21). Google's Article structured-data guidance handles authorship exclusively through schema.org (`author.name`, `author.url`, `Person`/`Organization`) and never mentions the meta tag — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21). OpenAI's crawler documentation mentions no HTML metadata of any kind — https://developers.openai.com/api/docs/bots (verified 2026-08-21). The audit's "E-E-A-T scoring" framing is therefore D-grade on its own terms. No shipping AI system is documented to derive a trust signal from this tag. And the page it is currently measured on — the homepage, per the wrong-page bug above — would not carry a byline even on a site that marks up authorship correctly.
