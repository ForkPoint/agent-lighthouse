---
audit: agent-tools/openapi-ai-instructions
category: agent-tools
audit_id: "5.4"
source_file: packages/core/src/audits/agent-tools/openapi-ai-instructions.ts
slug: openapi-ai-instructions
review_verdict: delete
severity: high
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# openapi-ai-instructions — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned: OpenAPI's `x-` prefix is the spec's sanctioned extension point, and vendors genuinely do define AI-relevant extensions there (OpenAI's x-openai-isConsequential is a real, widely used example). So the claim is plausible on its face: if an agent runtime read info['x-ai-instructions'], a site could hand the model natural-language guidance on workflow ordering, rate limits, and auth that endpoint names alone cannot convey — reducing incorrect API usage. The mechanism only requires one toolchain to read that key.

## What we searched

I checked the authoritative OpenAPI Initiative extensions registry at spec.openapis.org/registry/extension/ to see whether x-ai-instructions is registered and whether any AI-related extensions are registered at all. I then fetched OpenAI's GPT Actions documentation to see which OpenAPI extension fields OpenAI actually documents. To quantify adoption empirically I used the GitHub code-search API for 'x-ai-instructions' and, as a calibrated control, for 'x-openai-isConsequential' — a field that IS vendor-documented — so the two counts could be compared directly. I then grouped the x-ai-instructions matches by repository to see whether the hits represent independent adoption or self-references. I also read the audit source to confirm what it actually checks.

## Best evidence found for the audit

The best evidence is by analogy, not for the field itself: vendor-defined AI extensions in OpenAPI are demonstrably a real pattern — OpenAI's x-openai-isConsequential returns 6,464 GitHub code hits and is genuinely read by GPT Actions to decide whether an action needs user confirmation. But for x-ai-instructions specifically the evidence collapses: only 54 files on all of GitHub contain the string, and of the top 40 matches, 31 belong to a single repository (api-evangelist/done, an API-industry blogger's notes archive) and one belongs to magnifito/website — i.e. this framework's own site, making the audit partly self-referential. The remaining hits are one-off mentions in personal roadmaps, red-team handbooks, and journals. No vendor, spec, or toolchain reads the field.

## Counter-evidence

Positive proof of non-standing: (1) x-ai-instructions is NOT registered in the OpenAPI Initiative's official extensions registry at spec.openapis.org/registry/extension/. That registry lists 36 registered extensions (x-agent-trust, x-codeSamples, x-data-classification, x-jsonld-context, the x-oai-* and x-jsonschema-* families, x-sensitive-data, x-twitter) and contains NO x-ai-* extension of any kind — so the field has no standing even as a registered vendor extension. (2) The adoption gap versus a genuinely documented field is roughly 120x: 54 hits for x-ai-instructions against 6,464 for x-openai-isConsequential. (3) Concentration analysis shows the 54 are not independent adopters — 31/40 sampled come from one blogger's archive and one from this framework's own website. (4) OpenAI's GPT Actions documentation, the most likely consumer, does not mention x-ai-instructions. (5) The audit is also internally inconsistent with its own title: it is titled for 'x-ai-instructions / description fields' but the code only ever checks info['x-ai-instructions'], and it hard-fails any site with no /openapi.json at all — meaning ordinary content sites are scored down for lacking an API.

## Verdict

**confirmed dead — delete** (grade D)

Grade D: an unregistered, vendor-less extension key with no documented consumer and adoption that is essentially self-referential (a single blogger's archive plus this framework's own site). The control comparison is what makes this conclusive — a real vendor-documented AI extension shows 6,464 hits while this shows 54, so the low count reflects invention rather than early-stage adoption. Worth recording for the rewrite backlog: the *underlying need* is real and is served by fields that genuinely are consumed — OpenAPI's native `description`/`summary`, which OpenAI's GPT Actions and MCP tool definitions really do feed to models, and MCP's own `instructions` field in DiscoverResult ('Optional natural-language guidance for LLMs on how to use this server effectively'). An audit checking description quality on real fields would be defensible; this one, keyed to an invented extension and hard-failing sites with no OpenAPI spec, is not.

## Sources

- **[OpenAPI Initiative — Specification Extensions Registry](https://spec.openapis.org/registry/extension/)** — OpenAPI Initiative (spec, URL verified 2026-08-21)
  - Authoritative registry of OpenAPI specification extensions. x-ai-instructions is NOT registered. Of the 36 registered extensions (x-agent-trust, x-codeSamples, x-data-classification, x-jsonld-context/type, x-jsonschema-*, x-oai-*, x-sensitive-data, x-twitter), none use an x-ai-* prefix and none target AI/LLM guidance.
- **[GitHub code search: x-ai-instructions vs x-openai-isConsequential](https://github.com/search?q=%22x-ai-instructions%22&type=code)** — GitHub (code search API) (study, URL verified 2026-08-21)
  - Measured via GitHub REST search/code API. 'x-ai-instructions': total_count=54. Control field 'x-openai-isConsequential' (genuinely documented by OpenAI): total_count=6,464 — a ~120x gap. Grouping the top 40 x-ai-instructions matches by repo: 31 in api-evangelist/done (a blogger's notes archive), 2 in api-evangelist/providers, and 1 in magnifito/website (this framework's own site); the rest are single-file mentions in personal roadmaps and handbooks. No vendor, spec, or toolchain repo appears.
- **[GPT Actions — Introduction (checked for AI OpenAPI extensions)](https://developers.openai.com/api/docs/actions/introduction)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - OpenAI's Actions documentation describes driving actions from an OpenAPI spec via Function Calling but makes no mention of x-ai-instructions. The most plausible vendor consumer does not read the field.
- **[MCP Specification 2026-07-28 — Discovery (DiscoverResult.instructions)](https://modelcontextprotocol.io/specification/2026-07-28/server/discover.md)** — Model Context Protocol (spec, URL verified 2026-08-21)
  - Shows where natural-language model guidance actually lives in a live standard: DiscoverResult carries an `instructions` field, 'Optional natural-language guidance for LLMs on how to use this server effectively.' Demonstrates the audit's underlying intent is legitimate but is served by a real field in a real protocol, not by an unregistered OpenAPI extension.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/agent-tools/openapi-ai-instructions.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

The x-ai-instructions field lets you give natural-language guidance to AI agents about how to use your API. This is your chance to explain business logic, rate limits, authentication flow, and common use cases in plain English.

### Code review findings (2026-08-20, 11-agent pass)

Pure cargo cult. `x-ai-instructions` is an invented vendor extension with zero consumers — no LLM tool-calling stack, SDK, or agent reads it. The audit marks a well-documented, fully compliant OpenAPI spec as FAILING at medium priority for omitting a field nobody parses, and its remediation tells owners to write agent guidance into a key that will be silently dropped instead of into `info.description`, which agents genuinely do read.

**Required fix:** Delete. If the intent (agent-readable API guidance) is worth keeping, fold it into 5.26 openapi-description-quality as a check on `info.description` length/quality, which is a real field real converters pass to the model.

**False-positive risks:**
- Every legitimate, high-quality OpenAPI spec on the internet fails this audit — the false-positive rate is effectively 100% of specs.
- Same JSON-only loader bug: YAML specs report 'No spec' while 5.1 passes.
- Advice is actively harmful: a site that moves its agent guidance from `info.description` (read by every OpenAPI→tool converter) into `info.x-ai-instructions` (read by nothing) makes itself measurably worse for agents while raising its Lighthouse score.
- `typeof info['x-ai-instructions'] === 'string' && info['x-ai-instructions']` accepts a single character, so `"x"` passes — the check cannot distinguish real guidance from a token added to game the audit.

**Test gaps:**
- No test that a spec with rich `info.description` but no x-ai-instructions is treated as adequate (it currently fails)
- No minimum-length or content-quality test — a one-character value passes
- No YAML fixture

**Overlaps with:** `5.26`

### Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/agent-tools/openapi-ai-instructions.md`; that copy removed (one dossier per removed audit, under `sunset/`).
