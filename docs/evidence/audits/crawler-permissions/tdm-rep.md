---
audit: crawler-permissions/tdm-rep
audit_id: "2.27"
category: crawler-permissions
source_file: packages/core/src/audits/crawler-permissions/tdm-rep.ts
slug: tdm-rep
review_verdict: delete
severity: medium
evidence_grade: unrated
disposition: "proposed: redeem as experimental (pending triage)"
reviewed: 2026-08-21
---

# tdm-rep (`2.27`)

> crawler-permissions · source `tdm-rep.ts` · review verdict **delete** · evidence grade **unrated** · disposition: **proposed: redeem as experimental (pending triage)**

## What it checks

The TDM-Rep (Text and Data Mining Reservation) protocol is the emerging machine-readable standard for declaring whether your content may be used for text and data mining, anchored in EU DSM Directive Article 4. Without an explicit declaration — either a <meta name="tdm-reservation"> tag or a /.well-known/tdmrep.json policy file — AI crawlers and licensing agents cannot tell whether you reserve your mining rights, leaving your content in a legal gray zone where well-behaved agents guess and the rest assume permission. Declaring your terms explicitly puts you in control of how AI systems may use your content.

## Code review findings (2026-08-20, 11-agent pass)

Speculative and internally incoherent for a tool that measures AI agent outcomes. TDM-Rep is a W3C Community Group Final Report, not a W3C standard, and no major crawler operator — OpenAI, Google, Anthropic, Perplexity, Meta — documents honoring `/.well-known/tdmrep.json` or `<meta name="tdm-reservation">`. Its real relevance is legal (EU DSM Art. 4 opt-out evidence), not behavioral: publishing it changes no agent's behavior today. The deeper problem is directional. The audit PASSes identically for `tdm-reservation="1"` (rights RESERVED, mining denied) and `"0"` (mining permitted) — so a site maximally opting out of AI use earns a green check in an AI-readiness score. Whatever it is measuring, it is not whether agents can discover, parse, cite or act on the site. And because absence returns `warn` rather than `notApplicable`, roughly every site on the web is penalized 0.5 for not adopting a convention nothing consumes.

**Required fix:** Delete from the scored category. If retained for EU-compliance reporting, move it to a compliance category, set weight 0 / `scoreDisplayMode: 'informative'`, return `notApplicable` (not `warn`) when absent, gate `JSON.parse` behind a `content-type: application/json` check plus a leading-`<` guard, validate against the spec's array-of-objects shape, and report reservation=1 and reservation=0 as distinct outcomes rather than a shared pass.

**False-positive risks:**
- `JSON.parse(file.body)` runs on any 200 response with no content-type check. SPA and framework catch-all routes return 200 + `text/html` for unknown `/.well-known/` paths, so the audit reports 'A file exists at /.well-known/tdmrep.json but is not valid JSON' about a file that does not exist. Concrete, common false warning.
- No structural validation: the TDM-Rep spec defines the file as an array of objects with `location` and `tdm-reservation`, but any parseable JSON passes — `JSON.parse('123')` and `{"foo":1}` both yield 'Valid JSON policy'. The audit certifies malformed policies as correct.
- `describeReservation` treats anything other than `'1'` as 'mining explicitly permitted', so a typo, an empty-ish value, or a spec-legal nested structure is reported to the user as an affirmative grant of mining rights they never made. Misreporting a licensing posture is a serious wrong answer.
- Directional blindness: `"1"` (deny) and `"0"` (permit) both PASS with score 1.0 — the audit rewards opting out of AI in an AI-readiness score.
- First-match-wins across pages: it returns on the first page carrying the meta tag, so a site with inconsistent per-page reservations reports whichever page was scanned first.
- Absence → `warn` (0.5) for essentially every site, despite the class's own `notApplicable` helper existing precisely for 'precondition absent'.

**Test gaps:**
- No HTML soft-404 body served with status 200 at the well-known path — the input that produces the false 'malformed' warning.
- No content-type assertion (the `mockFetchResult` helper is passed `application/json` but the audit never reads it).
- No spec-shaped array fixture, and no test that non-conforming JSON like `123` or `{"foo":1}` is rejected.
- No test asserting that reservation=1 and reservation=0 should be scored differently.
- No multi-page conflicting-reservation case.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
