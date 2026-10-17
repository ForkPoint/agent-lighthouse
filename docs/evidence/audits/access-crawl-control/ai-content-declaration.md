---
audit: access-crawl-control/ai-content-declaration
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/ai-content-declaration.ts
slug: ai-content-declaration
evidence_grade: D
disposition: "kept — rewritten to the real directive names 2026-08-22 (Plan 4, Task 16)"
reviewed: 2026-08-22
recommended_tier: experimental
consumers: []
consumers_note: "no AI vendor documents recognizing noai, noimageai, or tdm-reservation"
signals:
  - name: "AI content declaration meta tags (noai, noimageai, tdm-reservation, ai-generated)"
    grade: D
    domain: meta-head
sources:
  - s18
  - anthropic-crawlers
  - ietf-aipref-attach-draft
  - w3c-tdmrep-final-report
  - s10
  - originality-noai-adoption
  - google-special-tags
  - iptc-synthetic-media-guidance
---

# ai-content-declaration (`4.13`)

> access-crawl-control · source `ai-content-declaration.ts` · evidence grade **D** · tier **experimental** (weight 0) · rewritten from an invented meta name to the AIPREF `Content-Usage` attachment and the noai/noimageai convention — see below

## What it checks

Where a site declares how AI systems may use its content. The IETF AIPREF work attaches that preference to a `Content-Usage` response header or a robots.txt rule and explicitly leaves the HTML head out of scope; the head-level `noai`/`noimageai` convention has real adoption but no documented consumer. The audit reports what a site declares and where, and never treats declaring nothing as a defect.

_(The pre-rewrite description asserted that `<meta name="ai-content-declaration">` is "how AI systems discover your llms.txt or AI usage policy" and that GPTBot and ClaudeBot read it. That was false; it is quoted with its refutation in the rewrite section below.)_

## Evidence

### Signal: AI content declaration meta tags (noai, noimageai, tdm-reservation, ai-generated) — grade D (meta-head)

**Mechanism:** A head-level AI declaration (<meta name="noai">, <meta name="tdm-reservation" content="1">, or an ai-generated declaration) causes AI crawlers to change training/ingestion behavior or causes AI systems to label the content. Falsifiable: no AI vendor recognizes any of these names, and the active standards work explicitly attaches preferences somewhere other than the HTML head.

**Evidence:** Two distinct things live here and both are pre-consumer. (1) Opt-out declarations. The W3C TDMRep Community Group Final Report (2 Feb 2024) does formally define <meta name="tdm-reservation" content="1|0"> and <meta name="tdm-policy" content="URL">, positioned as a technical answer to EU DSM Article 4. But it is explicitly "not a W3C Standard", and it names no implementing consumer. The DeviantArt-origin noai/noimageai convention has measurable adoption: 88,000+ domains as of June 2026, 87.8% of them via the meta-tag placement, meta adoption up 26.5% month-over-month (Originality.AI). (2) AI-generated declarations: there is no HTML head standard at all — IPTC's Digital Source Type (trainedAlgorithmicMedia) targets the XMP packet embedded in image/video files or a C2PA manifest, not the page head.

**Counter-evidence:** Decisive. The IETF AIPREF attachment draft of 19 Aug 2026 is Standards Track, authored by Google and Mozilla, and updates RFC 9309. It defines exactly two attachment mechanisms: the Content-Usage HTTP response header, and a Content-Usage rule in robots.txt. It defines no HTML meta element and no link relation — 'Embedded Preferences' is acknowledged and left out of scope. So the standards trajectory is running away from the head, not toward it. Google's supported-meta-tags list omits noai and tdm-reservation; Originality.AI's own study concludes "Major AI companies point elsewhere ... rather than honoring the noai meta tag specifically." OpenAI's and Anthropic's crawler docs document robots.txt only. Keep as experimental with a plainly worded caveat that these tags currently express intent with no known enforcing consumer, and track AIPREF for the header/robots.txt path — do not present them to users as protection.

## Implementation deviations

- Verdict order follows the evidence. An AIPREF `Content-Usage` header or robots.txt rule passes. `noai` / `noimageai` warn, with the caveat in the message. The invented `ai-content-declaration` name warns as invented. Nothing declared is not applicable. The audit cannot fail.
- `noai` is read as a standalone `<meta name>` and as a token of `<meta name="robots">`. The DOM is queried directly, because the parsed meta map drops valueless tags. Tokens are split so `noarchive` is not read as `noai`.
- The audit does not judge the value of the invented meta name. No specification defines a valid value. A test pins that a URL value and a prose value get the same verdict.
- `tdm-reservation` and `tdm-policy` are not read here. `access-crawl-control/tdm-rep` owns them, and a test pins a `tdm-reservation`-only site as not applicable.
- The audit copy names no AI vendor as a consumer. A test asserts `GPTBot` and `ClaudeBot` appear nowhere in its meta.
- `defaultPriority` is `low`. Grade D, tier `experimental`, weight 0.
- The evidence gate (`requires`) declines the audit when the scan read no response from the site. A bot wall's site-wide headers are not reported as the site's declaration.
- Re-check trigger: if `Content-Usage` is ratified and a named crawler documents honoring it, re-examine the grade. The pass branch already targets the ratified form.
