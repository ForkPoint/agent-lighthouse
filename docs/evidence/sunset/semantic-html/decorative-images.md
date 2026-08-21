---
audit: semantic-html/decorative-images
category: semantic-html
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

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
