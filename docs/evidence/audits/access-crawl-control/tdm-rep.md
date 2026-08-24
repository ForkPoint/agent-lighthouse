---
audit: access-crawl-control/tdm-rep
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/tdm-rep.ts
slug: tdm-rep
evidence_grade: C
disposition: "kept — internal incoherence fixed, moved to experimental 2026-08-22 (Plan 4, Task 16)"
reviewed: 2026-08-22
sources:
  - tdmrep-cg-final
  - tdmrep-community-group
  - s18
  - anthropic-crawlers
  - perplexity-bots-docs
  - rfc-8615
  - rfc9309
  - ietf-aipref-wg
---

# tdm-rep (`2.27`)

> access-crawl-control · source `tdm-rep.ts` · evidence grade **C** · tier **experimental** (weight 0) · rewritten so the two reservation directions are distinct outcomes, absence is `na`, and the file is validated against the spec shape — see below

## What it checks

Whether your site publishes a **TDM-Rep** declaration — a machine-readable
text-and-data-mining reservation — and, if so, in which direction it points.

The declaration lives in one of two places: a `<meta name="tdm-reservation">`
tag, or a `/.well-known/tdmrep.json` policy file, which is validated against the
shape the specification defines (an array of objects, each carrying `location`
and `tdm-reservation`, optionally `tdm-policy`).

The two directions are reported as distinct outcomes, never as the same one:
`tdm-reservation="1"` reserves your mining rights, `"0"` permits mining. A site
that publishes no declaration is **not applicable**, not a failure — nothing is
documented to read the file, so its absence is not a defect.

Nothing here changes your score. TDM-Rep is a W3C Community Group Final Report,
explicitly not a W3C Standard, and its value is legal evidence of an opt-out
rather than a change in any agent's behaviour.

## What it checked before the rewrite

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

## The coherence rewrite (Plan 4, Task 16, 2026-08-22)

**Old pass condition:** the first scanned page carrying `<meta name="tdm-reservation">` with *any* value, or any 200 response at `/.well-known/tdmrep.json` whose body happened to survive `JSON.parse`. Absence **warned** (0.5); a `1` and a `0` passed identically.

**New pass condition:** an unambiguous declaration in one of the three forms the CG report defines, carrying a value the protocol defines, consistent across the site — and the direction is reported. Malformed, non-conforming and self-contradictory declarations warn. No declaration is `notApplicable`. The audit can no longer fail.

### Every item on the required-fix list

- **Weight 0 / `scoreDisplayMode: 'informative'`** — was already true; the tier now says the same thing (see the grade decision below).
- **`notApplicable`, not `warn`, when absent.** Roughly every site on the web was losing half a point for not adopting a convention nothing consumes. Declining to publish a legal instrument is a choice, not a gap, and the message says so.
- **`JSON.parse` gated.** Two independent guards, because either alone is bypassable: the media type must be JSON-ish, **and** the body must not start with `<`. An SPA catch-all answering 200 + `text/html` is now read as "no file", not as the confident false claim "a file exists at /.well-known/tdmrep.json but is not valid JSON" about a file that does not exist. A framework answering `application/json` with an HTML error document is caught by the second guard.
- **Spec shape validated.** The CG report defines the document as an **array of objects**, each with a mandatory `location` and `tdm-reservation`. `123`, `{"foo":1}`, `[]` and `[{"location":"/"}]` are all rejected as non-conforming instead of being certified as "Valid JSON policy".
- **Reservation 1 and 0 are distinct outcomes.** `1` reports "rights reserved — mining denied by default", `0` reports "mining explicitly permitted", and the two are never narrated with the same sentence.
- **`describeReservation` no longer invents permission.** Anything that is not `1` or `0` is reported as *not a value the protocol defines*, at `warn`. Previously a typo, an empty-ish value or a nested structure was narrated to the user as an affirmative grant of mining rights they never made — misreporting a licensing posture, which is the most serious wrong answer this audit could give.
- **First-match-wins fixed.** Meta declarations are collected across every scanned page; disagreement warns and names both values rather than silently reporting whichever page was crawled first. A file declaring different reservations per `location` is legal, and warns with that explained rather than being flattened.

### Added: the response header

The CG report calls the `tdm-reservation` HTTP response header "currently the preferred technique", and the old audit did not look at it at all. It is now checked first, ahead of the well-known file and the meta tags, with `tdm-policy` read alongside it.

### Removed: the fallback fetch

`/.well-known/tdmrep.json` is in the orchestrator's `rootFilePaths`, so the audit's `ctx.fetch` fallback could never fire in production; it existed only to be exercised by a test. It is gone, and `audit()` is synchronous again — which also means the audit issues no network request of its own and needs no `isSafeUrl` gate.

### Copy: the incoherence the code review named

The shipped description ended "Declaring your terms explicitly puts you in control of how AI systems may use your content" — a behavioural claim about a signal with no crawler consumer. The description now states what the protocol is (a CG Final Report, explicitly not a W3C Standard), what it is for (EU DSM Article 4 opt-out evidence) and that no major AI crawler operator documents honouring it. A regression test pins that the audit's meta contains "no major AI crawler" and not the old control claim.

### Deviation from the required fix: the category

The required fix asks to "move it to a compliance category". Not done, deliberately: an audit's id is `category/slug`, so a category move renames the id, which would need a `migration-map.json` entry and would break every consumer keyed on `access-crawl-control/tdm-rep`. This task was explicitly scoped to no id changes. Everything the category move was meant to achieve — that the signal never touches a score, and is not presented as agent readiness — is achieved by the `experimental` tier and weight 0.

### Grade decision: stays **C**, tier `informative` → `experimental`, weight 0

Source: the [REWORK-TODO redemption note](../../../../packages/core/src/audits/REWORK-TODO.md) — "TDM Reservation Protocol is a real W3C CG spec with EU AI Act relevance. Experimental flag, unscored, fix internal incoherence" — and the graded evidence above, which assigns **C** on the reasoning that TDM-Rep is genuinely published with real publisher-side participation and one named partial implementer (Spawning AI), but no major crawler operator documents consuming it. The target tier `experimental` is met; `weightForGrade('C', 'experimental') = 0`, so `scoreDisplayMode` stays `informative`. `defaultPriority` drops `medium` → `low`.

### Re-check trigger

The IETF AIPREF working group targeted IESG submission for 2026-08-31 and its charter does not reference TDM-Rep. If AIPREF ratifies and a named crawler documents honouring either protocol, this grade needs re-examining. The `Content-Usage` half of that work is already read by `access-crawl-control/ai-content-declaration`; the trigger is stamped in the source file header.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Evidence (2026-08-21)

**Mechanism claim:** An AI crawler fetches `/.well-known/tdmrep.json` or reads `<meta name="tdm-reservation">` and changes whether it collects or uses the page's content as a result.

**Grade: C** — TDM-Rep is a genuinely published specification with real publisher-side participation and one named partial implementer, but no major crawler operator documents consuming it, so the causal claim about agent behavior is plausible and unproven rather than demonstrated.

**Evidence:**
- W3C TDM Reservation Protocol, Community Group Final Report (10 May 2024). Its own status section says: "It is not a W3C Standard nor is it on the W3C Standards Track." It defines exactly the three signalling methods the audit looks for — a `/.well-known/tdmrep.json` well-known file, a `tdm-reservation` HTTP response header (described in the report as "currently the preferred technique"), and `<meta name="tdm-reservation">` / `<meta name="tdm-policy">` in HTML — https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240510/ (verified 2026-08-21)
- Spec-defined file shape: an **array of objects**, each with mandatory `location` and `tdm-reservation` and optional `tdm-policy` — so the audit's `Record<string, unknown>` parse accepts non-conforming documents (same URL, verified 2026-08-21)
- Adoption is publisher-side, not crawler-side: the CG names Mondadori, Penguin Random House, the STM association, Copyright Clearance Center, Taylor & Francis and the BBC among participants, and records that "Spawning AI has already integrated partially the opt-out solution developed by the TDM Rep CG in their service" — the only named consuming implementer found — https://www.w3.org/community/tdmrep/ (verified 2026-08-21)

**Counter-evidence:** No major AI vendor documents honoring the protocol. OpenAI's crawler documentation describes robots.txt and published IP ranges only, with no mention of TDM signals (https://developers.openai.com/api/docs/bots); Anthropic's crawler article describes robots.txt directives and `Crawl-delay` only (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler); Perplexity's documents robots.txt and WAF allowlisting only (https://docs.perplexity.ai/guides/bots) — all verified 2026-08-21. Standardization momentum has also moved elsewhere: the IETF **AIPREF** working group is chartered to standardize AI-preference expression via "Well-Known URIs ([RFC 8615](https://www.rfc-editor.org/rfc/rfc8615.html)) such as the Robots Exclusion Protocol ([RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html)), and HTTP response header fields", with IESG submission targeted for 31 August 2026, and its charter does not reference TDM-Rep — https://datatracker.ietf.org/wg/aipref/about/ (verified 2026-08-21). Finally, the signal is directionally orthogonal to agent readiness: a reservation value of `1` denies mining, and the audit passes it identically to `0`.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded **C** (mechanism research pass); consistent with the proposed unscored/experimental disposition.
- 2026-08-22 — user approved the pending-triage redeem; required rework executed (Plan 4, Task 16): reservation 1 and 0 are distinct outcomes, unrecognized values are no longer narrated as permission, absence is `na` instead of a universal warn, `JSON.parse` is gated on media type plus a leading-`<` guard, the file is validated against the spec's array-of-objects shape, meta declarations are judged across every page instead of first-match-wins, the `tdm-reservation` response header is read (the CG's preferred technique), and the dead `ctx.fetch` fallback is removed so the audit is synchronous and issues no request. Grade C unchanged; tier `informative` → `experimental` per the target; weight 0; `defaultPriority` `medium` → `low`. The category move in the required fix was deliberately not done — it would rename the id. `TODO(redeem)` marker removed from the source file.
