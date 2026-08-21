---
audit: answer-readiness/about-credentials
audit_id: "10.4"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/about-credentials.ts
slug: about-credentials
review_verdict: delete
severity: high
evidence_grade: C
disposition: "informative, weight 0 (approved 2026-08-21)"
reviewed: 2026-08-21
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
- No test proving keywords are NOT matched inside `<script>`/`<style>`/class attributes.
- No test for a non-English about page or a non-English about path.
- No test for a soft-404 (200 + 'not found' body).
- No test for an SPA shell body.
- No test for a non-HTML content type or a redirect where `finalUrl` differs.
- No test for an about page at an unlisted path (`/company/`) present in `ctx.pages`.

**Overlaps with:** `10.7`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/generative-engine/about-credentials.md](../../deletions/generative-engine/about-credentials.md). Outcome: **dead-but-informative-candidate**, grade C.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
