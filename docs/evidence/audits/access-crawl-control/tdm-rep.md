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

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** An AI crawler fetches `/.well-known/tdmrep.json` or reads `<meta name="tdm-reservation">` and changes whether it collects or uses the page's content as a result.

**Grade: C** — TDM-Rep is a genuinely published specification with real publisher-side participation and one named partial implementer, but no major crawler operator documents consuming it, so the causal claim about agent behavior is plausible and unproven rather than demonstrated.

**Evidence:**

- W3C TDM Reservation Protocol, Community Group Final Report (10 May 2024). Its own status section says: "It is not a W3C Standard nor is it on the W3C Standards Track." It defines exactly the three signalling methods the audit looks for. A `/.well-known/tdmrep.json` well-known file. A `tdm-reservation` HTTP response header, described in the report as "currently the preferred technique". And `<meta name="tdm-reservation">` or `<meta name="tdm-policy">` in HTML — https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240510/ (verified 2026-08-21)
- Spec-defined file shape: an **array of objects**, each with mandatory `location` and `tdm-reservation` and optional `tdm-policy` — so the audit's `Record<string, unknown>` parse accepts non-conforming documents (same URL, verified 2026-08-21)
- Adoption is publisher-side, not crawler-side. The CG names Mondadori, Penguin Random House, the STM association, Copyright Clearance Center, Taylor & Francis and the BBC among participants. It records that "Spawning AI has already integrated partially the opt-out solution developed by the TDM Rep CG in their service" — the only named consuming implementer found — https://www.w3.org/community/tdmrep/ (verified 2026-08-21)

**Counter-evidence:** No major AI vendor documents honoring the protocol. OpenAI's crawler documentation describes robots.txt and published IP ranges only, with no mention of TDM signals (https://developers.openai.com/api/docs/bots); Anthropic's crawler article describes robots.txt directives and `Crawl-delay` only (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler); Perplexity's documents robots.txt and WAF allowlisting only (https://docs.perplexity.ai/guides/bots) — all verified 2026-08-21. Standardization momentum has also moved elsewhere. The IETF **AIPREF** working group is chartered to standardize AI-preference expression via "Well-Known URIs ([RFC 8615](https://www.rfc-editor.org/rfc/rfc8615.html)) such as the Robots Exclusion Protocol ([RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html)), and HTTP response header fields", with IESG submission targeted for 31 August 2026. Its charter does not reference TDM-Rep — https://datatracker.ietf.org/wg/aipref/about/ (verified 2026-08-21). Finally, the signal is directionally orthogonal to agent readiness: a reservation value of `1` denies mining, and the audit passes it identically to `0`.

## Implementation deviations

- The audit reads three channels in order: the `tdm-reservation` response header (with `tdm-policy`), `/.well-known/tdmrep.json`, then `<meta name="tdm-reservation">`. The CG report calls the header "currently the preferred technique".
- No declaration is not applicable. Malformed, non-conforming and self-contradictory declarations warn. The audit cannot fail.
- The file is parsed only when its media type is JSON-ish and its body does not start with `<`. An SPA catch-all or an HTML error page reads as no file.
- The file must be an array of objects, each with `location` and `tdm-reservation`. Anything else is non-conforming.
- `1` and `0` are distinct outcomes: rights reserved, or mining permitted. Any other value is reported as undefined by the protocol, at `warn`.
- Meta declarations are collected across every scanned page. Disagreement warns and names both values. A file with different reservations per `location` is legal and warns with that explained.
- The audit issues no request. `/.well-known/tdmrep.json` comes from the orchestrator's root files, so `audit()` is synchronous and needs no `isSafeUrl` gate.
- The copy says no major AI crawler operator documents honouring the protocol. A test pins that wording.
- The audit stays in `access-crawl-control`. Moving category would rename the id. The `experimental` tier and weight 0 keep it off the score.
- `defaultPriority` is `low`. Grade C, tier `experimental`, weight 0.
- Re-check trigger: if AIPREF ratifies and a named crawler documents honouring either protocol, re-examine the grade.
