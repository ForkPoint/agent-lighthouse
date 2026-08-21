---
audit: access-crawl-control/tdm-rep
audit_id: "2.27"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/tdm-rep.ts
slug: tdm-rep
review_verdict: delete
severity: medium
evidence_grade: C
disposition: "proposed: redeem as experimental (pending triage)"
reviewed: 2026-08-21
---

# tdm-rep (`2.27`)

> crawler-permissions · source `tdm-rep.ts` · review verdict **delete** · evidence grade **C** · disposition: **proposed: redeem as experimental (pending triage)**

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

## Graded evidence (2026-08-21)

**Mechanism claim:** An AI crawler fetches `/.well-known/tdmrep.json` or reads `<meta name="tdm-reservation">` and changes whether it collects or uses the page's content as a result.

**Grade: C** — TDM-Rep is a genuinely published specification with real publisher-side participation and one named partial implementer, but no major crawler operator documents consuming it, so the causal claim about agent behavior is plausible and unproven rather than demonstrated.

**Evidence:**
- W3C TDM Reservation Protocol, Community Group Final Report (10 May 2024). Its own status section says: "It is not a W3C Standard nor is it on the W3C Standards Track." It defines exactly the three signalling methods the audit looks for — a `/.well-known/tdmrep.json` well-known file, a `tdm-reservation` HTTP response header (described in the report as "currently the preferred technique"), and `<meta name="tdm-reservation">` / `<meta name="tdm-policy">` in HTML — https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240510/ (verified 2026-08-21)
- Spec-defined file shape: an **array of objects**, each with mandatory `location` and `tdm-reservation` and optional `tdm-policy` — confirming the code review's finding that the audit's `Record<string, unknown>` parse accepts non-conforming documents (same URL, verified 2026-08-21)
- Adoption is publisher-side, not crawler-side: the CG names Mondadori, Penguin Random House, the STM association, Copyright Clearance Center, Taylor & Francis and the BBC among participants, and records that "Spawning AI has already integrated partially the opt-out solution developed by the TDM Rep CG in their service" — the only named consuming implementer found — https://www.w3.org/community/tdmrep/ (verified 2026-08-21)

**Counter-evidence:** No major AI vendor documents honoring the protocol. OpenAI's crawler documentation describes robots.txt and published IP ranges only, with no mention of TDM signals (https://developers.openai.com/api/docs/bots); Anthropic's crawler article describes robots.txt directives and `Crawl-delay` only (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler); Perplexity's documents robots.txt and WAF allowlisting only (https://docs.perplexity.ai/guides/bots) — all verified 2026-08-21. Standardization momentum has also moved elsewhere: the IETF **AIPREF** working group is chartered to standardize AI-preference expression via "Well-Known URIs ([RFC 8615](https://www.rfc-editor.org/rfc/rfc8615.html)) such as the Robots Exclusion Protocol ([RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html)), and HTTP response header fields", with IESG submission targeted for 31 August 2026, and its charter does not reference TDM-Rep — https://datatracker.ietf.org/wg/aipref/about/ (verified 2026-08-21). Finally, the signal is directionally orthogonal to agent readiness: a reservation value of `1` denies mining, and the audit passes it identically to `0`.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded **C** (mechanism research pass); consistent with the proposed unscored/experimental disposition.
