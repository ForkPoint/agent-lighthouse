---
check: accessibility-layer-injection-scan
title: "Accessibility-Layer Injection Scan"
domain: injection-safety
status: proposed
evidence_grade: A
uniqueness: partial-overlap
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Accessibility-Layer Injection Scan

> Proposed check. Evidence grade **A** · partial overlap · implementation: `static-fetch`

## What it checks

Audit the text that reaches an agent through the accessibility tree and non-visual attributes rather than through body copy: alt, aria-label, aria-labelledby targets, aria-description, title, placeholder, hidden input values, <option> labels, document title and og:* metadata. Flag instruction-shaped content, anomalously long values, and aria-label/visible-text divergence.

## Claimed mechanism (falsifiable)

Computer-use and browser agents drive pages through the DOM and accessibility tree, not pixels, so a11y attributes enter the model context with the same weight as visible text while remaining invisible to a sighted human. Anthropic names the vector explicitly: 'hidden malicious form fields in a webpage's DOM invisible to humans, and other hard-to-catch injections such as through the URL text and tab title that only an agent might see.' The divergence sub-check is a defect in its own right independent of injection: an agent that clicks by accessible name will actuate an aria-label that contradicts the rendered label. Falsifier: if every a11y attribute is short, descriptive, and token-consistent with its element's visible text, this channel carries no payload.

## Evidence

- **[Piloting Claude for Chrome](https://claude.com/blog/claude-for-chrome)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - Red-team attack success rate 23.6% in autonomous browsing mode, 11.2% after mitigations; a browser-specific challenge set went 35.7% -> 0%. Names the exact vectors: 'hidden malicious form fields in a webpage's Document Object Model (DOM) invisible to humans, and other hard-to-catch injections such as through the URL text and tab title that only an agent might see.' This is the vendor-documented basis for auditing hidden inputs and a11y/metadata attributes.
- **[Computer use tool — security and prompt injection guidance](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - 'In some circumstances, Claude will follow commands found in content even when they conflict with your instructions. For example, instructions on webpages or contained in images might override your instructions.' Classifiers run on screenshots to flag injections and force user confirmation. Also recommends asking a human to confirm consequential actions — the vendor-side counterpart to the site-side 'don't hide consequence behind a GET link' check.
- **[EIA: Environmental Injection Attack on Generalist Web Agents](https://arxiv.org/abs/2409.11295)** — arXiv / ICLR 2025 (study, URL verified 2026-08-20)
  - Injects content into the page environment that blends into the surrounding site. Up to 70% ASR for stealing specific PII, 16% for extracting the full user request, over 177 Mind2Web action steps. Authors report EIA is hard to detect and that well-adapted injections survive human inspection — i.e. detection has to be mechanical, not eyeballed.

## Competitor coverage

axe-core and Lighthouse's accessibility and agentic-accessibility audits check that alt and aria attributes exist, are non-empty, and reference valid ids — they never inspect the content for adversarial instructions, never flag anomalous length, and never compare accessible name against rendered label for semantic contradiction. The presence checks are commodity; the adversarial-content and divergence checks are not shipped anywhere.

## Implementation sketch

Extract: all alt values; aria-label; text of aria-labelledby/aria-describedby targets; aria-description; title; placeholder; input[type=hidden] value; <option> text; <title>; <meta property=og:title|og:description>. Run the instruction lexicon from the Invisible Instruction Payload Scan over each => FAIL on any hit. FAIL when an input[type=hidden] value parses as a natural-language sentence (>=5 tokens containing a finite verb) rather than an identifier, token, nonce, or numeric id. WARN on alt or aria-label exceeding 250 characters — the canonical smuggling slot, since long alt is already an a11y anti-pattern. WARN when an interactive element's aria-label shares under 30% token overlap (Jaccard on lowercased alphanumeric tokens) with its own rendered text content, and FAIL when the two contain opposing action verbs (confirm/cancel, pay/back, delete/keep) — an agent selecting by accessible name will fire the wrong action. Also flag <a> whose href path or query contains lexicon hits (URL-text injection, as Anthropic describes).

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
