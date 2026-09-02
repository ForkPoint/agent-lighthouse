---
audit: meta-tags/ai-instructions
category: meta-tags
audit_id: "4.14"
source_file: packages/core/src/audits/meta-tags/ai-instructions.ts
slug: ai-instructions
review_verdict: delete
severity: high
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# ai-instructions — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

An HTML <meta name="ai-instructions" content="..."> tag acts as a site-authored, page-scoped system prompt: AI crawlers, answer engines and browsing agents parse it out of <head> and let it shape how they summarize, frame, or refuse to speculate about the page. Steelmanned, this only needs ONE of two things to be true: (a) some named vendor documents reading a page-level instruction meta tag, or (b) agents demonstrably follow instructions found in page markup (which indirect-prompt-injection research shows they can), making it a de facto channel even if unofficial.

## What we searched

WebSearch quota for this session was exhausted after the first call, so I verified everything by fetching primary sources directly and by using authenticated GitHub code search as a search substitute. Angle 1 — vendor meta-tag registries: fetched Google's supported-meta-tags doc and Google's 'AI features and your website' doc to see whether any AI-instruction meta is recognized. Angle 2 — standards track: fetched draft-ietf-aipref-attach (the IETF AI Preferences WG document that defines how AI preferences attach to content) to see whether an HTML meta mechanism is defined. Angle 3 — the de-facto/injection route: fetched Anthropic's Claude for Chrome post to see whether vendors treat page-embedded instructions as a supported channel or as an attack to defend against; also checked Cloudflare's Content Signals Policy as the competing real-world mechanism. Angle 4 — adoption: GitHub code search for the literal string name="ai-instructions" across all public code (17 hits restricted to HTML, ~100 hits unrestricted). No vendor doc, spec, draft, or crawler documentation anywhere names this tag.

## Best evidence found for the audit

Nothing supports the tag itself. The closest positive evidence is indirect and self-defeating: Anthropic confirms that browsing agents DO ingest instruction-shaped text from page markup — 'malicious actors hide instructions in websites, emails, or documents to trick AIs into harmful actions' — and specifically names 'hidden malicious form fields in a webpage's Document Object Model (DOM) invisible to humans' as an attack surface (https://claude.com/blog/claude-for-chrome). So a hidden instruction in HTML can reach an agent's context. But that is documented as a vulnerability being actively suppressed by classifiers and system-prompt hardening, not as a publisher-facing feature. Adoption is effectively nil: GitHub-wide code search for the literal string name="ai-instructions" returns ~100 files total (17 in HTML), i.e. hobby sites and SEO-tool templates, no framework or CMS default.

## Counter-evidence

1. Google explicitly discards unrecognized meta tags: 'You can use other meta tags if they are important to your site, but Google will ignore meta tags that it doesn't support' — and the supported list is description, robots/googlebot, notranslate, nopagereadaloud, google-site-verification, Content-Type/charset, refresh, viewport, rating. No AI-instruction tag (https://developers.google.com/search/docs/crawling-indexing/special-tags). 2) Google's dedicated 'AI features and your website' page names the ONLY page-level controls that affect AI Overviews/AI Mode/Gemini grounding: 'nosnippet, data-nosnippet, max-snippet, or noindex controls', and states there are 'no additional technical requirements' and 'no special schema.org structured data' (https://developers.google.com/search/docs/appearance/ai-features). 3) The IETF AI Preferences WG deliberately declined to define an embedded-in-HTML mechanism: draft-ietf-aipref-attach defines 'A Content-Usage header field for HTTP' and 'A Content-Usage directive for the Robots Exclusion Protocol', and its section on Embedded Preferences states 'This document, however, does not define any specific means of embedding preferences in content' (https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/). 4) Cloudflare's Content Signals Policy — the most widely deployed real mechanism for telling AI systems how content may be used — is robots.txt-based ('Content-Signal: search=yes, ai-train=no'), not meta-tag-based (https://blog.cloudflare.com/content-signals-policy/). 5) Anthropic's stated engineering direction is to make agents IGNORE instructions found in web content: improved system prompts plus 'advanced classifiers to detect suspicious instruction patterns'. Any agent that obeyed <meta name="ai-instructions"> would be exhibiting the exact failure mode vendors are training out.

## Verdict

**confirmed dead — delete** (grade D)

Grade D: no spec defines it, no vendor reads it, the one standards body working on the problem explicitly chose HTTP headers and robots.txt over embedded markup, and Google states it ignores unsupported meta tags outright. Worse than merely useless: the only pathway by which an agent would honor this tag is prompt injection, which every major vendor is actively hardening against — so the audit advises publishers to invest in a channel whose success condition is a security bug. Adoption (~100 files on all of GitHub) rules out even the 'wide community convention' escape hatch. Delete.

## Sources

- **[Meta tags and HTML attributes that Google supports](https://developers.google.com/search/docs/crawling-indexing/special-tags)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - Enumerates every meta tag Google supports; ai-instructions is absent. States 'Google will ignore meta tags that it doesn't support.'
- **[AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - The documented controls for AI Overviews / AI Mode / Gemini grounding are 'nosnippet, data-nosnippet, max-snippet, or noindex'. No AI-instruction meta tag and no llms.txt-family file is mentioned.
- **[draft-ietf-aipref-attach: Attaching AI Preferences to Content](https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/)** — IETF AI Preferences WG (spec, URL verified 2026-08-21)
  - Defines two mechanisms only — a Content-Usage HTTP header and a Content-Usage robots.txt directive. Explicitly: 'This document, however, does not define any specific means of embedding preferences in content.'
- **[Piloting Claude for Chrome](https://claude.com/blog/claude-for-chrome)** — Anthropic (announcement, URL verified 2026-08-21)
  - Defines instructions hidden in web pages/DOM as prompt injection; describes system-prompt hardening and 'advanced classifiers to detect suspicious instruction patterns' to make Claude NOT follow page-embedded instructions.
- **[Giving users choice with Cloudflare's new Content Signals Policy](https://blog.cloudflare.com/content-signals-policy/)** — Cloudflare (announcement, URL verified 2026-08-21)
  - Real-world AI usage-preference signalling (search, ai-input, ai-train) is expressed in robots.txt via 'Content-Signal:', not via HTML meta tags.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/meta-tags/ai-instructions.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

The ai-instructions meta tag gives AI agents a plain-English brief on how to interact with your site and represent your content. It acts like a system prompt for any AI agent visiting your page, telling it your preferred summarization style, content focus, and usage guidelines.

### Code review findings (2026-08-20, 11-agent pass)

Invented signal, and one that is counterproductive to recommend. The description calls the tag 'like a system prompt for any AI agent visiting your page'. Nothing implements it, and any agent that did would be honoring instructions from an untrusted third party — the canonical prompt-injection vulnerability. The check itself is a bare non-emptiness test, so a site could satisfy it with any string. Passing this improves nothing and the guidance teaches an anti-pattern. Delete.

**Required fix:** Delete the audit. The legitimate version of 'tell agents how to use my site' is expressed through content quality, structured data, llms.txt, and machine-readable tool descriptions (OpenAPI/MCP) — all of which are audited elsewhere. If the maintainer insists on retaining it, it must be informational-only (weight 0 / `notApplicable`-style, never a scored fail), the 'acts like a system prompt' framing must be removed, and the guidance should note that agents deliberately do not follow page-supplied instructions.

**False-positive risks:**

- Guaranteed failure on every real site: no site ships this tag, so this contributes a fixed 'medium' priority failure to every scan regardless of the site's actual AI-readiness — it measures nothing about the site.
- Non-validating pass: `const value = (page?.meta?.['ai-instructions'] ?? '').trim(); if (value)` — a single character, a template token, or arbitrary text scores 1.0. The audit cannot distinguish a thoughtful brief from `content="x"`.
- Actively harmful guidance: the recommended code sample instructs agents not to 'speculate about unreleased features'. Recommending that site owners place directives to models in page metadata normalizes a prompt-injection vector; a security-conscious agent ignores it by design, so the site owner gains a false sense of control.
- Only `ctx.pages[0]` is examined, so even under its own invented contract it cannot verify the per-page instructions the guidance implies.
- Overlaps conceptually with 4.13 (ai-content-declaration): both invent a meta-tag channel for 'tell AI systems what to do', so a scan penalizes the same nonexistent capability twice.

**Test gaps:**

- No test distinguishing meaningful content from a one-character placeholder — the audit has no quality bar to test.
- The only substantive test asserts the 80-character truncation of the display value, i.e. it tests string formatting, not the signal.
- No multi-page test.
- No test acknowledging that no consumer exists — the suite validates an invented contract.

**Overlaps with:** `4.13`

### Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/meta-tags/ai-instructions.md`; that copy removed (one dossier per removed audit, under `sunset/`).
