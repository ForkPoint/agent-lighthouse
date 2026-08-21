---
audit: semantic-html/address-element
audit_id: "6.12"
category: semantic-html
source_file: packages/core/src/audits/semantic-html/address-element.ts
slug: address-element
review_verdict: delete
severity: low
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# address-element (`6.12`)

> semantic-html · source `address-element.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

AI agents use <address> elements to extract contact information (email, phone, physical address) for structured answers to "how to contact" queries. Without semantic <address> markup, agents must guess which text on your page is contact info.

## Code review findings (2026-08-20, 11-agent pass)

Falsy audit. It passes if a single <address> exists anywhere ('const hasAddress = pagesWithAddress > 0') and otherwise only warns, so it can never fail and never discriminates. It also cannot detect the problem it names: contact info in a <p> or a <div class="contact"> is indistinguishable from a site with no contact info. And the claimed benefit is not real — <address> is spec'd as the contact info of the nearest article/body ancestor, carries no microdata, and is not what agents read for 'how do I contact X'. A site can satisfy it with an empty <address></address>.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- 'pagesWithAddress > 0' — one <address> anywhere passes; an empty <address></address> passes.
- Declares applicablePageTypes ['homepage'] but loops every page, so the reported ratio counts non-homepage pages.
- Warns any site whose contact info lives in a footer <p> (the overwhelming majority) with a fix that changes nothing an agent sees.
- Sites that expose contact info correctly via LocalBusiness/Organization JSON-LD — the format agents actually consume — still get warned.
- Contact-info-free sites (personal blogs, docs) get a permanent unfixable warning.

**Test gaps:**
- Two tests only; no empty-<address> fixture.
- No fixture with contact info in a <p> (the case the audit claims to distinguish).
- No multi-page crawl testing the applicablePageTypes/loop mismatch.
- No JSON-LD-contact fixture.

**Overlaps with:** `6.6`, `6.13`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/semantic-html/address-element.md](../../deletions/semantic-html/address-element.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
