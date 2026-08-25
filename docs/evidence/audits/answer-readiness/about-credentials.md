---
audit: answer-readiness/about-credentials
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/about-credentials.ts
slug: about-credentials
evidence_grade: C
disposition: "informative, weight 0 (approved 2026-08-21)"
reviewed: 2026-08-21
signals:
  - name: an About page identifying who is responsible for the site
    grade: C
    domain: generative-engine
sources:
  - google-quality-rater-guidelines
  - google-organization-structured-data
  - google-helpful-content
  - google-ai-features-trust
  - geo-paper-arxiv
  - igaming-notability
  - s18
---

# about-credentials (`10.4`)

> generative-engine · source `about-credentials.ts` · review verdict **delete** · evidence grade **C** · disposition: **informative, weight 0 (approved 2026-08-21)**

## What it checks

AI engines crawl your about page to build an organizational authority profile. Without an about page containing team credentials, expertise, and experience details, agents cannot assess your organization's authority, reducing your content's trust score in AI-generated recommendations.

## Code review findings (2026-08-20, 11-agent pass)

Falsy. No AI system keyword-matches "team"/"certified"/"specializ" on /about to compute an authority score; that mechanism is asserted in the guidance but does not exist. Worse, the match is `bodyLower.includes(kw)` against the *raw HTML source* — not extracted text — so `class="team-grid"`, an inline analytics blob containing "professional", or a nav link labelled "Our Team" all count. On real sites this is close to a constant PASS, and where it fails it fails for the wrong reason (the about page lives at /company/ or /ueber-uns/). A near-constant pass on a fabricated mechanism has negative information value; the E-E-A-T intent is already better served by 10.1/10.2/10.3.

**Required fix:** If retained instead of deleted: parse the fetched body with cheerio and run `getMainContentText` before matching; require word-boundary regex matches; add a soft-404/SPA-shell guard (minimum body-text length plus a 'not found' sniff); consult `finalUrl` and `contentType`; and turn the 'no about page found' branch into `notApplicable()` — absence of a page at a guessed URL is not evidence of a defect. But even a fixed version measures nothing an AI agent consumes; deletion is the honest call.

**False-positive risks:**
- `const bodyLower = aboutResult.body.toLowerCase(); CREDENTIAL_KEYWORDS.filter((kw) => bodyLower.includes(kw))` runs over raw HTML including `<script>`, `<style>`, class names, data attributes and inline JSON. `class="team-section"` plus a GTM payload containing "professional" is enough to PASS with zero credential content on the page.
- Substring matching with no word boundaries: 'team' matches "steam"/"teamwork"; 'background' matches the CSS property `background:` and `background-image` in any inline style block, so any about page with an inline style already has a free keyword; 'specializ' matches nothing in en-GB ("specialise").
- English-only keyword list AND English-only path list. A German (`/ueber-uns/`), French (`/qui-sommes-nous/`), Spanish (`/nosotros/`) or Japanese about page fails both, producing a hard FAIL on a site with an exemplary about page.
- The path list is Anglo/Shopify-shaped (`/about/`, `/pages/about`, `/our-story`). Sites using `/company/`, `/team/`, `/impressum/`, or a locale prefix `/en/about/` are reported 'No about page found'. The DOM fallback searches `ctx.pages` for the same three English substrings.
- No soft-404 detection. Many SPAs and CMSs return HTTP 200 with a client-rendered 'not found' shell for `/about/`; the audit accepts `status === 200 && body` and then keyword-matches the site chrome (nav 'Team', footer 'Partners'), PASSING for a page that does not exist.
- No content-type or `finalUrl` check. A 200 `application/json` response, or a redirect-to-homepage that lands 200, is scored as an about page.
- On an SPA the fetched `/about/` body is an empty `<div id="root">` shell — zero keywords → 'lacks credential keywords' warn, on a page that renders full team bios in a browser.
- Issues up to 7 extra network requests in a `ctx.fetch` loop duplicating work the orchestrator already did (all 7 about paths are in `rootFilePaths`), triggered whenever the site redirects `/about` → `/about/` and the un-slashed form was recorded non-200.

**Test gaps:**
- No test with a realistic full HTML page — every test uses a bare sentence, hiding the raw-HTML/class-name matching defect entirely.
- No test proving keywords are not matched inside `<script>`/`<style>`/class attributes.
- No test for a non-English about page or a non-English about path.
- No test for a soft-404 (200 + 'not found' body).
- No test for an SPA shell body.
- No test for a non-HTML content type or a redirect where `finalUrl` differs.
- No test for an about page at an unlisted path (`/company/`) present in `ctx.pages`.

**Overlaps with:** `10.7`

## Evidence

### Signal: an About page identifying who is responsible for the site — grade C (generative-engine)

**Mechanism:** Answer engines and the ranking systems feeding them assess who is responsible for a site, and the About page is the conventional artifact where that is declared — so a site with no page identifying its operator is harder to assess than one that has it.

**Grade: C** — the convention is genuinely near-universal and Google documents raters being sent to it, but no vendor documents a *system* reading it, and the narrower claim this audit originally scored is refuted rather than merely unproven.

**Evidence:**
- Google's Search Quality Rater Guidelines of 11 September 2025, §2.5.2 "Finding Who is Responsible for the Website…", state: "Most websites have 'contact us' or 'about us' or 'about' pages that provide information about who owns the site." §3.3 makes reputation research mandatory: "reputation research is required for all PQ rating tasks" — https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf (verified 2026-08-21)
- Google's Organization structured-data reference recommends placing the markup "on your home page, or a single page that describes your organization, for example the about us page" — https://developers.google.com/search/docs/appearance/structured-data/organization (verified 2026-08-21)

**Counter-evidence:** The vendor document closest to this audit inverts its original rule. The rater guidelines §5.6 warn about "claims of personal experience or expertise that seem overstated or included just to impress website visitors". They instruct that "E-E-A-T assessments should be based on the MC itself, the information you find during reputation research, verifiable credentials, etc, not just website or content creator claims of 'I'm an expert!'" A check that rewarded credential keywords on an About page rewarded exactly what raters are told to discount. Four further limits weigh against it. Google states plainly that "While E-E-A-T itself isn't a specific ranking factor" (https://developers.google.com/search/docs/fundamentals/creating-helpful-content, verified 2026-08-21). Its AI-features page adds that "There are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21). The KDD'24 GEO study is the strongest controlled evidence in this area, and it is explicitly confined to "textual modifications to website content" — it tests neither about pages nor site-level authority (https://arxiv.org/abs/2311.09735, verified 2026-08-21). And a 2026 citation audit finds "a systematic and overwhelming bias towards Earned media (third-party, authoritative sources) over Brand-owned content", about 78% of citations. That is the opposite of a mechanism where self-authored credential text drives trust (https://arxiv.org/abs/2603.12282, verified 2026-08-21). The rater guidelines' own consumer is a human contractor, not an agent parsing the page. OpenAI's, Anthropic's and Perplexity's crawler documents mention neither About pages nor credentials.

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/generative-engine/about-credentials.md](../../deletions/generative-engine/about-credentials.md). Outcome: **dead-but-informative-candidate**, grade C.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
