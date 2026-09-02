---
audit: semantic-html/decorative-images
category: semantic-html
audit_id: "6.16"
source_file: packages/core/src/audits/semantic-html/decorative-images.ts
slug: decorative-images
review_verdict: delete
severity: high
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# decorative-images — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned: an agent walking the accessibility tree encounters `<img alt="">`. If the agent could not tell an intentionally-decorative image from one whose alt text an author simply forgot, it would either hallucinate a missing-content gap or burn processing on irrelevant images. Adding an explicit `role="presentation"` (or `role="none"`, or `aria-hidden="true"`) would disambiguate intent, so agents stop flagging false content gaps. For this to matter, `alt=""` alone must be ambiguous to the consuming agent and the extra role attribute must change what the agent sees.

## What we searched

WebSearch quota was exhausted, so I tested the claim directly against the spec and against a real browser. I fetched W3C HTML-AAM 1.0 for the normative accessibility-API mapping of an img element with an empty alt attribute — the precise question the audit turns on. I fetched W3C ARIA-in-HTML for implicit role assignment. Then I ran the decisive experiment: a probe page with three images on the same data URI — one `alt=""` with no role, one `alt="" role="presentation"`, one with real alt text — and captured the live Chromium accessibility snapshot through Playwright MCP, the same class of representation Anthropic's browser-use `read_page` returns. I confirmed via Anthropic's browser-use and computer-use docs which representation each agent actually consumes, and read the audit source at packages/core/src/audits/semantic-html/decorative-images.ts to confirm the pass/fail logic keys purely on the presence of the redundant attribute.

## Best evidence found for the audit

The surrounding domain is real: the accessibility tree genuinely does distinguish decorative from content images, and named agents genuinely read that tree. My snapshot showed the content image surviving as `img "A described chart" [ref=e9]` while decorative ones vanished. But that distinction is produced by `alt=""` alone. The specific thing the audit requires — an added `role="presentation"` — produced literally zero difference: the `alt=""` image with no role and the `alt="" role="presentation"` image were both absent from the snapshot, identically and completely. No agent can flag a 'false content gap' on a node that is not in the tree it reads. I found no evidence at all for the specific requirement.

## Counter-evidence

Positive, normative proof that the required attribute is a no-op. W3C HTML Accessibility API Mappings 1.0 §3.5.57 specifies that an `img` element with an empty `alt` attribute maps to role "none or presentation" — i.e. `alt=""` ALREADY confers exactly the role the audit demands authors write out, with the only exception being an img that gains an accessible name through another naming mechanism (which is the opposite case from the audit's). My live Chromium snapshot confirms the spec in practice: with and without `role="presentation"`, both empty-alt images were omitted from the agent-facing tree, byte-identically. The audit therefore FAILS pages (fail/warn at medium priority) for omitting an attribute that provably changes nothing an agent sees. There is a second, worse problem in the opposite direction the hint asks about: `alt=""` REMOVES the image from the agent's view entirely — verified, both empty-alt images disappeared while `img "A described chart"` survived. The audit counts every `alt=""` image as 'decorative' by definition (`if (img.alt === '')` at line 37 of decorative-images.ts) and rewards marking more of them, so it structurally cannot detect the real failure mode — a content-bearing image wrongly given empty alt, which deletes information from every agent that reads the tree. It scores the harmless case and is blind to the harmful one. Finally, the a11y-tree premise does not even reach Anthropic's computer use tool, which is documented as screenshot-only.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. The required signal is normatively redundant: HTML-AAM 1.0 §3.5.57 states an img with empty alt maps to role none/presentation already, and a live Chromium accessibility snapshot shows `<img alt="">` and `<img alt="" role="presentation">` producing an identical result — both absent from the tree. Adding the attribute cannot change agent behavior, so the audit's stated impact ('agents treat them as potentially missing alt text', 'false-positive content gaps') describes something that cannot occur. Delete it as written. The one salvageable idea points the other way and belongs to a different check: because empty alt deletes an image from the agent-visible accessibility tree, the valuable audit is detecting content-bearing images wrongly given `alt=""` (large images, images inside <figure>, images that are a link's only content) — the existing image-alt-text audit at packages/core/src/audits/semantic-html/image-alt-text.ts is the right home for that, not a new pass for a redundant attribute.

## Sources

- **[HTML Accessibility API Mappings 1.0 — §3.5.57 img element](https://www.w3.org/TR/html-aam-1.0/)** — W3C (spec, URL verified 2026-08-21)
  - An img element with an empty alt attribute maps to role 'none or presentation'. The only exception: if such an img is given an accessible name via another valid naming mechanism, user agents expose it with its implicit image role. Normative proof that adding role="presentation" on top of alt="" is redundant.
- **[Live Chromium accessibility snapshot of a probe page (own experiment)](https://playwright.dev/docs/aria-snapshots)** — Own experiment via Playwright MCP + Chromium (study, URL verified 2026-08-21)
  - Three same-source images: `alt=""` (no role), `alt="" role="presentation"`, and `alt="A described chart"`. The snapshot contained only `img "A described chart" [ref=e9]`. Both empty-alt images were omitted identically, with and without the role attribute — the attribute the audit requires changes nothing an agent sees, and empty alt removes the image from the agent's view entirely.
- **[ARIA in HTML](https://www.w3.org/TR/html-aria/)** — W3C (spec, URL verified 2026-08-21)
  - Ratified spec governing implicit roles and permitted role overrides for HTML elements; confirms the implicit-role machinery by which alt="" already yields presentation/none rather than requiring an author-supplied role.
- **[Browser use tool](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/browser-use-tool)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - Confirms `read_page` returns the page's accessibility tree as text — the representation in which empty-alt images are already absent, so the audit's 'agents flag false content gaps' scenario has no node to flag.
- **[Computer use tool](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - Computer use perceives only screenshots and zoom images, with no accessibility tree or DOM access. A second named agent for which ARIA roles on images are entirely inert.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/semantic-html/decorative-images.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

AI agents processing the accessibility tree treat images with empty alt but no role="presentation" as potentially missing alt text rather than intentionally decorative. Adding role="presentation" explicitly tells agents to skip these images, preventing them from flagging false content gaps.

### Code review findings (2026-08-20, 11-agent pass)

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

### Evidence

#### Signal: Image alt text as the machine-readable representation of images — grade A (semantic-dom-a11y)

**Mechanism:** The alt attribute is the native text-alternative source in the accessible-name computation, so it becomes the accessible name of an <img> node in every accessibility-tree snapshot and the only representation of the image for text-only crawlers that do not execute JS or run vision models over page images. Google separately states it uses alt text as an input to understanding image subject matter. An image with missing alt is an unnamed node an agent cannot refer to; an image with alt='' is mapped to presentation/none and intentionally removed from the tree.

**Evidence:** Direct vendor statement: 'Google uses alt text along with computer vision algorithms and the contents of the page to understand the subject matter of the image' [google-image-seo-docs]. The mechanism is standardised: accname (W3C Recommendation, 2018) lists HTML alt among the native host-language text-alternative sources ranked below aria-labelledby/aria-label [w3c-accname], and HTML-AAM maps img[alt] to the image role and img[alt=''] to none/presentation [w3c-html-aam]. Vercel's crawler-log data shows the AI crawlers that matter here do not execute JavaScript at all [vercel-ai-crawler-study], so server-rendered alt is what they get. The ads experiment gives the behavioural corollary: agents across GPT-4o, Claude 3.7 Sonnet, Gemini 2.0 Flash and OpenAI Operator 'ignore purely visual calls to action, clicking banners only when semantic button overlays or off-screen text labels are present' [machine-readable-ads-paper]. Baseline: 69% of images pass the alt audit and ~8.5% of alt values are just filenames [web-almanac-2025-accessibility].

**Counter-evidence:** The 'multimodal AI' framing is where this overreaches. Neither OpenAI nor Anthropic documents consuming alt text anywhere, and Google's AI-features page says no special optimizations are needed for AI Overviews [google-ai-features-docs]. Vercel's data shows ClaudeBot spends 35.17% of its fetches on images [vercel-ai-crawler-study], meaning image bytes are being retrieved and can plausibly be captioned by a vision model without any alt at all — capable multimodal systems can substitute for alt in a way they cannot substitute for a missing heading. So grade A rests on Google's explicit statement, not on a general 'all AI reads alt' claim; the audit should say so. Also note alt='' is correct, not a failure, for decorative images (30% of alt attributes are legitimately empty [web-almanac-2024-accessibility]) — an audit that flags empty alt as missing alt is wrong.
**Consumers:** Google Search / Google Images, Playwright MCP snapshot, Anthropic read_page / Claude-in-Chrome, Chrome DevTools MCP take_snapshot, browser-use, screen readers (accname consumers) · **Recommended tier:** scored

**Sources:** [Image SEO Best Practices — Google Search Central](https://developers.google.com/search/docs/appearance/google-images) · [Accessible Name and Description Computation 1.1](https://www.w3.org/TR/accname/) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Machine-Readable Ads: Accessibility and Trust Patterns for AI Web Agents interacting with Online Advertisements](https://arxiv.org/abs/2507.12844) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) · [Web Almanac 2024 — Accessibility chapter](https://almanac.httparchive.org/en/2024/accessibility) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/semantic-html/decorative-images.md`; that copy removed (one dossier per removed audit, under `sunset/`).
