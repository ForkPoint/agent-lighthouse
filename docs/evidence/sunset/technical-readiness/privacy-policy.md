---
audit: technical-readiness/privacy-policy
audit_id: "8.19"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/privacy-policy.ts
slug: privacy-policy
status: sunset
review_verdict: fix
severity: high
evidence_grade: D
disposition: "removed — sunset 2026-08-21 (v2 taxonomy grading pass)"
reviewed: 2026-08-21
---

# privacy-policy (`8.19`)

> technical-readiness · source `privacy-policy.ts` · review verdict **fix** · evidence grade **D** · disposition: **removed — sunset 2026-08-21 (v2 taxonomy grading pass)**

## What it checks

Enterprise AI frameworks check for privacy policies before recommending sites in regulated industries. A missing privacy policy reduces your trust score in AI systems that prioritize sites with transparent data handling practices, especially for health, finance, and legal content.

## Code review findings (2026-08-20, 11-agent pass)

Looks for /privacy-policy/, /privacy/, /privacy-policy, /privacy at 200, then falls back to scanning anchors. The fallback is a genuine improvement over path-guessing, but both halves break on ordinary real-world sites: the path check has no content validation, so an SPA host that rewrites unknown paths to index.html with 200 makes every site 'pass' with no policy at all; and the anchor matcher is hard-coded English, so a fully GDPR-compliant German, French, Spanish, or Japanese site — the exact population most likely to have a rigorous privacy policy — is failed. The regexes themselves are well-crafted (the comment notes they were deliberately narrowed against 'privacy levers and knobs'), which makes the English-only ceiling the binding constraint.

**Required fix:** Validate the body, not just the status: require 200 AND a non-HTML-shell body AND some policy-ish content signal (or simply that the response differs from the homepage body) before declaring the path a hit — a shared `looksLikeRealPage()` helper would serve 8.19, 8.20 and 8.10 at once. Add an i18n label/slug table (datenschutz, datenschutzerklärung, confidentialité, privacidad, privacybeleid, informativa, プライバシー, 隐私, конфиденциальность, …) to both the text and href patterns. Fall back to `aria-label`/`title` when `.text()` is empty. Factor the near-identical scanner shared with 8.20 into one `_legal-links.ts` helper.

**False-positive risks:**
- Soft-404 false PASS: `ctx.rootFiles[p].status === 200` with no body check. Netlify/Vercel/React-Router catch-alls, and WordPress installs that 200 a search page for unknown slugs, return 200 for /privacy → 'Privacy policy found at /privacy.' when none exists.
- English-only false FAIL: `PRIVACY_TEXT = /\bprivacy\s*(policy|notice|statement|center|…)\b/` and `PRIVACY_HREF = /privacy[-_]?(policy|notice|…)|\/privacy(\.[a-z0-9]+)?($|[/?#])/`. A German site linking 'Datenschutzerklärung' at /datenschutz, a French site's 'Politique de confidentialité' at /confidentialite, or a Japanese site's プライバシーポリシー matches neither the text nor the href pattern → fail on a compliant site.
- Text-node extraction misses icon/aria-only links: `page.$(el).text()` returns empty for anchors whose label lives in `aria-label` or a nested `<span class=sr-only>`/SVG title, so accessible footer links are skipped.
- Consent-manager links: many sites expose privacy through a CMP button (`<button>` / `<a href="#" onclick>`) rather than an `<a href>` to a page — invisible to `$('a[href]')`.
- WAF/JS-only footers: if the footer is rendered client-side (common on SPAs) there are no anchors in the initial HTML at all, so the fallback silently finds nothing.
- Only `ctx.pages` anchors are scanned; a policy reachable only from a page not in the crawl set is missed.

**Test gaps:**
- No test for a 200 soft-404 / SPA rewrite (the false-pass case).
- No non-English test of any kind — no Datenschutz, confidentialité, privacidad, or CJK label.
- No test for an anchor whose label is in `aria-label` or an sr-only span.
- No test for a consent-manager button instead of a link.
- No test where the footer is client-rendered (no anchors in initial HTML).

**Overlaps with:** `8.20`, `8.7`

## Evidence

### Signal: TDM Reservation Protocol (W3C tdm-rep) and EU AI Act TDM opt-out legal weight — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: publishing a TDM reservation via /.well-known/tdmrep.json, the tdm-reservation / tdm-policy HTTP headers, or an HTML meta tag causes AI training crawlers to refrain from mining the content, and carries binding legal weight under EU AI Act Article 53(1)(c). FALSIFIABLE FORM: a named GPAI provider fetches and honours tdmrep.json, or a published EU list of recognised opt-out protocols names TDM-Rep.

**Evidence:** The legal frame is real, and that is the whole of the trajectory argument. EU AI Act Art. 53(1)(c) obliges GPAI providers to 'identify and comply with, including through state-of-the-art technologies, a reservation of rights expressed pursuant to Article 4(3) of Directive (EU) 2019/790'. The GPAI Code of Practice Copyright Chapter Measure 1.3 turns that into a commitment to crawlers that 'read and follow instructions expressed in accordance with the Robot Exclusion Protocol (robots.txt), as specified in... RFC 9309', plus 'other appropriate machine-readable protocols' that are 'state-of-the-art... and widely adopted by rightsholders'. The Commission ran a consultation (1 Dec 2025 – 23 Jan 2026) and committed to 'publish the list of generally-agreed machine-readable opt-out solutions', reviewed at least every two years. The W3C spec itself is well-formed: three delivery methods, boolean tdm-reservation, and tdm-policy pointing to an ODRL 2.2 document.

**Counter-evidence:** Damning on every practical axis. (1) The W3C document is a Final COMMUNITY GROUP Report (Feb 2024), not a W3C Recommendation — it carries no Standards Track standing. (2) The spec names essentially one implementer (an 'swpawning.ai' API); no AI model provider is listed as a consumer. (3) Neither the AI Act Article nor the Code of Practice Measure 1.3 names TDM-Rep — robots.txt / RFC 9309 is the ONLY protocol named in either, and the Commission's consultation page likewise names only 'robots.txt and subsequent IETF versions of this standard'. (4) As of this research date no EU list naming TDM-Rep has been published, so its legal weight is prospective, not established. (5) No vendor doc — OpenAI, Anthropic, Perplexity, Google, Apple — mentions tdmrep.json, and Cloudflare's opt-out machinery is built on robots.txt and its Content Signals `use` extension, not TDM-Rep. Keep as experimental strictly because the EU standardisation process is live and could name it; never score it, and never tell a user it will stop training crawlers today.
**Consumers:** none-known · **Recommended tier:** experimental

**Sources:** [TDM Reservation Protocol (TDMRep) — Final Community Group Report](https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240202/) · [EU AI Act — Article 53: Obligations for providers of general-purpose AI models](https://artificialintelligenceact.eu/article/53/) · [EU AI Act: General-Purpose AI Code of Practice — Final version (10 July 2025)](https://code-of-practice.ai/) · [Commission launches consultation on protocols for reserving rights from text and data mining under the AI Act and the GPAI Code of Practice](https://digital-strategy.ec.europa.eu/en/consultations/commission-launches-consultation-protocols-reserving-rights-text-and-data-mining-under-ai-act-and) · [Your site, your rules: new AI traffic options for all customers](https://blog.cloudflare.com/content-independence-day-ai-options/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
