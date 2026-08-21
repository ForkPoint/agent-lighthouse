---
audit: meta-tags/ai-instructions
audit_id: "4.14"
category: meta-tags
source_file: packages/core/src/audits/meta-tags/ai-instructions.ts
slug: ai-instructions
review_verdict: delete
severity: high
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# ai-instructions (`4.14`)

> meta-tags · source `ai-instructions.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

The ai-instructions meta tag gives AI agents a plain-English brief on how to interact with your site and represent your content. It acts like a system prompt for any AI agent visiting your page, telling it your preferred summarization style, content focus, and usage guidelines.

## Code review findings (2026-08-20, 11-agent pass)

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

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/meta-tags/ai-instructions.md](../../deletions/meta-tags/ai-instructions.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
