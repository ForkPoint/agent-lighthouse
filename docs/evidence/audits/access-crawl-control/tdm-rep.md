---
audit: access-crawl-control/tdm-rep
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/tdm-rep.ts
slug: tdm-rep
evidence_grade: C
tier: informative
disposition: "kept — internal incoherence fixed, moved to experimental 2026-08-22 (Plan 4, Task 16); tier experimental to informative 2026-10-18: policy has no C/experimental state"
reviewed: 2026-10-18
sources:
  - tdmrep-cg-final
  - tdmrep-community-group
  - s18
  - anthropic-crawlers
  - perplexity-bots-docs
  - rfc-8615
  - rfc9309
  - ietf-aipref-wg
  - iana-well-known-tdmrep
  - spawning-datadiligence-tdmrep
---

# tdm-rep (`2.27`)

> access-crawl-control · source `tdm-rep.ts` · evidence grade **C** · tier **informative** (weight 0) · rewritten so the two reservation directions are distinct outcomes, absence is `na`, and the file is validated against the spec shape — see below

## What it checks

Whether your site publishes a **TDM-Rep** declaration — a machine-readable
text-and-data-mining reservation — and, if so, in which direction it points.

The audit reads three channels, in this order, and reports the first one that
carries a declaration:

1. a `tdm-reservation` response header (with `tdm-policy`), which the
   specification calls "currently the preferred technique";
2. a `/.well-known/tdmrep.json` policy file, validated against the shape the
   specification defines: an array of objects, each carrying `location` and
   `tdm-reservation`, optionally `tdm-policy`;
3. a `<meta name="tdm-reservation">` tag, collected across every scanned page.

The file is read only when it is served as JSON or plain text and does not
start with `<`, so an HTML catch-all page is not mistaken for a policy.

The two directions are reported as distinct outcomes, never as the same one:
`tdm-reservation="1"` reserves your mining rights, `"0"` permits mining. Any
other value is a protocol error and warns. A file that does not parse, a file
with the wrong shape, pages that disagree, and a file with different
reservations per `location` also warn. The audit never fails. A site that
publishes no declaration is **not applicable**, not a failure — nothing is
documented to read it, so its absence is not a defect.

Nothing here changes your score. TDM-Rep is a W3C Community Group Final Report,
explicitly not a W3C Standard, and its value is legal evidence of an opt-out
rather than a change in any agent's behaviour.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** An AI crawler fetches `/.well-known/tdmrep.json` or reads `<meta name="tdm-reservation">` and changes whether it collects or uses the page's content as a result.

**Grade: C** — TDM-Rep is a genuinely published specification with real publisher-side participation and one named partial implementer, but no major crawler operator documents consuming it, so the causal claim about agent behavior is plausible and unproven rather than demonstrated.

**Evidence:**

- W3C TDM Reservation Protocol, Community Group Final Report (10 May 2024). Its own status section says: "It is not a W3C Standard nor is it on the W3C Standards Track." It defines exactly the three signalling methods the audit looks for. A `/.well-known/tdmrep.json` well-known file. A `tdm-reservation` HTTP response header, described in the report as "currently the preferred technique". And `<meta name="tdm-reservation">` or `<meta name="tdm-policy">` in HTML — https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240510/ (verified 2026-10-17)
- Spec-defined file shape: "This file contains an array of JSON objects". Each object requires `location` and `tdm-reservation`, and `tdm-policy` is optional. The array is required even for a single rule. For `tdm-reservation`, `1` reserves the rights, `0` does not, and "Other values are considered protocol errors". The audit validates the file against this shape and warns on anything else (same URL, verified 2026-10-17)
- IANA lists `tdmrep.json` in the Well-Known URIs registry, status **provisional**, change controller W3C, registered 2024-02-15 — https://www.iana.org/assignments/well-known-uris/well-known-uris-1.csv (verified 2026-10-18). Registration reserves the path; it does not make anyone read it.
- One consumer reads the header. Spawning's `datadiligence` library ("Respect generative AI opt-outs in your ML training pipeline") reads the `tdm-reservation` HTTP header only and treats `1` as disallowed; it does not read the file or the meta tag — https://github.com/Spawning-Inc/datadiligence/blob/ea09739a0589dbeab7a0e56d195f91512f49ea25/src/datadiligence/rules/http.py#L90-L140 (verified 2026-10-18)
- Adoption is publisher-side, not crawler-side. The CG names Mondadori, Penguin Random House, the STM association, Copyright Clearance Center, Taylor & Francis and the BBC among participants. It records that "Spawning AI has already integrated partially the opt-out solution developed by the TDM Rep CG in their service" — the only named consuming implementer found — https://www.w3.org/community/tdmrep/ (verified 2026-08-21)

**Counter-evidence:** No major AI vendor documents honoring the protocol. OpenAI's crawler documentation describes robots.txt and published IP ranges only, with no mention of TDM signals (https://developers.openai.com/api/docs/bots); Anthropic's crawler article describes robots.txt directives and `Crawl-delay` only (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler); Perplexity's documents robots.txt and WAF allowlisting only (https://docs.perplexity.ai/guides/bots) — all verified 2026-08-21. Standardization momentum has also moved elsewhere. The IETF **AIPREF** working group is chartered to standardize AI-preference expression via "Well-Known URIs ([RFC 8615](https://www.rfc-editor.org/rfc/rfc8615.html)) such as the Robots Exclusion Protocol ([RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html)), and HTTP response header fields", with IESG submission targeted for 31 August 2026. Its charter does not reference TDM-Rep — https://datatracker.ietf.org/wg/aipref/about/ (verified 2026-08-21). Finally, the signal is directionally orthogonal to agent readiness: a reservation value of `1` denies mining and `0` permits it. The audit names the direction in its message and scores neither.

## Implementation deviations

- The audit reads three channels in order: the `tdm-reservation` response header (with `tdm-policy`), `/.well-known/tdmrep.json`, then `<meta name="tdm-reservation">`. The CG report calls the header "currently the preferred technique".
- No declaration is not applicable. Malformed, non-conforming and self-contradictory declarations warn. The audit cannot fail.
- The file is parsed only when its media type is JSON-ish and its body does not start with `<`. An SPA catch-all or an HTML error page reads as no file.
- The file must be an array of objects, each with `location` and `tdm-reservation`. Anything else is non-conforming.
- `1` and `0` are distinct outcomes: rights reserved, or mining permitted. Any other value is reported as undefined by the protocol, at `warn`.
- Meta declarations are collected across every scanned page. Disagreement warns and names both values. A file with different reservations per `location` is legal and warns with that explained.
- The audit issues no request. `/.well-known/tdmrep.json` comes from the orchestrator's root files, so `audit()` is synchronous and needs no `isSafeUrl` gate.
- The copy says no major AI crawler operator documents honouring the protocol. A test pins that wording.
- The audit stays in `access-crawl-control`. Moving category would rename the id. The `informative` tier and weight 0 keep it off the score.
- `defaultPriority` is `low`. Grade C, tier `informative`, weight 0.
- **Tier moved from `experimental` to `informative` on 2026-10-18.** Policy pairs `experimental` only with grade D on an active draft-spec trajectory; grade C maps to informative. Informative audits run by default, so the audit now runs on every scan. It issues no request of its own: the file comes from the orchestrator's root files.
- Re-check trigger: if AIPREF ratifies and a named crawler documents honouring either protocol, re-examine the grade.
