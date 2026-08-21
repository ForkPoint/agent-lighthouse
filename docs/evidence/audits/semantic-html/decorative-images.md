---
audit: semantic-html/decorative-images
audit_id: "6.16"
category: semantic-html
source_file: packages/core/src/audits/semantic-html/decorative-images.ts
slug: decorative-images
review_verdict: delete
severity: high
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# decorative-images (`6.16`)

> semantic-html · source `decorative-images.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

AI agents processing the accessibility tree treat images with empty alt but no role="presentation" as potentially missing alt text rather than intentionally decorative. Adding role="presentation" explicitly tells agents to skip these images, preventing them from flagging false content gaps.

## Code review findings (2026-08-20, 11-agent pass)

This audit gives actively harmful guidance and is built on a confirmed classification bug. extractImages sets 'alt: alt ?? ""', so an <img> with NO alt attribute at all yields alt === '' — and this audit's test is 'if (img.alt === '') { decorativeCount++ }'. I verified this in the parser: a missing alt is classified as decorative. The audit therefore takes genuinely broken images that audit 6.15 correctly fails for missing alt, relabels them 'decorative', and instructs the user to add role="presentation" — which would permanently hide informative images from assistive tech and from accessibility-tree readers. Even setting the bug aside, the underlying requirement is redundant per spec, so passing it improves nothing.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- 'if (img.alt === '')' misclassifies missing-alt images as decorative because extractImages does 'alt: alt ?? ""' — verified. The remediation offered ('add role=presentation') would actively harm accessibility and agent comprehension of those images.
- Directly contradicts audit 6.15, which correctly uses img.hasAlt for the same images: the same <img src=x> is a 6.15 failure ('add alt text') and a 6.16 failure ('add role=presentation'). Users receive two mutually exclusive fixes for one element.
- Demands markup that HTML/ARIA/WCAG explicitly call redundant, so a perfectly correct <img alt=""> site fails.
- Icon fonts and background images are out of scope but decorative <img> spacers on legacy sites all fail.
- The zero-decorative-image branch returns pass() rather than notApplicable(), inflating the score for sites with no empty-alt images.

**Test gaps:**
- No fixture with a missing alt attribute — the central misclassification bug is entirely untested (every test uses an explicit alt="").
- No cross-check against 6.15 showing the contradictory verdicts on one element.
- No aria-hidden-only fixture despite ariaHidden being accepted in the code.
- No test asserting na vs pass for the zero-decorative case.

**Overlaps with:** `6.15`

## Evidence

### Signal: Image alt text as the machine-readable representation of images — grade A (semantic-dom-a11y)

**Mechanism:** The alt attribute is the native text-alternative source in the accessible-name computation, so it becomes the accessible name of an <img> node in every accessibility-tree snapshot and the only representation of the image for text-only crawlers that do not execute JS or run vision models over page images. Google separately states it uses alt text as an input to understanding image subject matter. An image with missing alt is an unnamed node an agent cannot refer to; an image with alt='' is mapped to presentation/none and intentionally removed from the tree.

**Evidence:** Direct vendor statement: 'Google uses alt text along with computer vision algorithms and the contents of the page to understand the subject matter of the image' [google-image-seo-docs]. The mechanism is standardised: accname (W3C Recommendation, 2018) lists HTML alt among the native host-language text-alternative sources ranked below aria-labelledby/aria-label [w3c-accname], and HTML-AAM maps img[alt] to the image role and img[alt=''] to none/presentation [w3c-html-aam]. Vercel's crawler-log data shows the AI crawlers that matter here do not execute JavaScript at all [vercel-ai-crawler-study], so server-rendered alt is what they get. The ads experiment gives the behavioural corollary: agents across GPT-4o, Claude 3.7 Sonnet, Gemini 2.0 Flash and OpenAI Operator 'ignore purely visual calls to action, clicking banners only when semantic button overlays or off-screen text labels are present' [machine-readable-ads-paper]. Baseline: 69% of images pass the alt audit and ~8.5% of alt values are just filenames [web-almanac-2025-accessibility].

**Counter-evidence:** The 'multimodal AI' framing is where this overreaches. Neither OpenAI nor Anthropic documents consuming alt text anywhere, and Google's AI-features page says no special optimizations are needed for AI Overviews [google-ai-features-docs]. Vercel's data shows ClaudeBot spends 35.17% of its fetches on images [vercel-ai-crawler-study], meaning image bytes are being retrieved and can plausibly be captioned by a vision model without any alt at all — capable multimodal systems can substitute for alt in a way they cannot substitute for a missing heading. So grade A rests on Google's explicit statement, not on a general 'all AI reads alt' claim; the audit should say so. Also note alt='' is correct, not a failure, for decorative images (30% of alt attributes are legitimately empty [web-almanac-2024-accessibility]) — an audit that flags empty alt as missing alt is wrong.
**Consumers:** Google Search / Google Images, Playwright MCP snapshot, Anthropic read_page / Claude-in-Chrome, Chrome DevTools MCP take_snapshot, browser-use, screen readers (accname consumers) · **Recommended tier:** scored

**Sources:** [Image SEO Best Practices — Google Search Central](https://developers.google.com/search/docs/appearance/google-images) · [Accessible Name and Description Computation 1.1](https://www.w3.org/TR/accname/) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Machine-Readable Ads: Accessibility and Trust Patterns for AI Web Agents interacting with Online Advertisements](https://arxiv.org/abs/2507.12844) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) · [Web Almanac 2024 — Accessibility chapter](https://almanac.httparchive.org/en/2024/accessibility) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/semantic-html/decorative-images.md](../../deletions/semantic-html/decorative-images.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
