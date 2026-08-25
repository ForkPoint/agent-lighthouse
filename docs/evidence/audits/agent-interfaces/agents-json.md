---
audit: agent-interfaces/agents-json
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/agents-json.ts
slug: agents-json
evidence_grade: C
disposition: "informative, weight 0 (approved 2026-08-21)"
reviewed: 2026-08-24
recommended_tier: scored
tier_rationale: "Recommended scored on the strength of the published spec; ships informative because the 2026-08-21 redemption pass returned \"confirmed dead\" for the site-facing signal and no consumer was found (contradiction sweep, 2026-08-24)."
consumers:
  - all clients following RFC 8615 well-known conventions
signals:
  - name: agents-json
    grade: D
    domain: agent-action-surfaces
  - name: agent-surface-soft-404-validation
    grade: A
    domain: agent-action-surfaces
sources:
  - agents-json-com-dead
  - wildcard-agents-json-repo
  - iana-well-known-uris
  - apievangelist-api-catalog-adoption
  - rfc-9727
  - mcp-ext-server-card-discovery
  - probe-vercel-api-catalog
  - probe-vercel-ai-catalog
  - probe-zapier-api-catalog
---

# agents-json (`5.10`)

> agent-tools · source `agents-json.ts` · review verdict **delete** · evidence grade **C** · disposition: **informative, weight 0 (approved 2026-08-21)**

## What it checks

Whether anything is published at `/.well-known/agents.json`, and if so whether what is
published there is a real agents.json document.

The check never asks a site to publish the file. A site that serves nothing at that path is
reported as **not applicable**: the convention has no documented consumer, so its absence is not a
finding and is excluded from scoring entirely. When a document *is* published, the check validates
the shape the agents.json v0.1.0 specification actually defines — an `info` object alongside a
`sources` array (each entry pointing at an OpenAPI document) or a `flows` array — and reports a
warning, at weight 0, when what is served is something else:

- an HTTP 200 carrying the site's HTML shell (a soft 404 at a well-known path);
- a body that does not parse as JSON;
- JSON that is not an agents.json document, including `[]` and `{}`;
- a valid document served with a `text/html` content type, which a client dispatching on media
  type will not read as a document.

The check never returns a failure. Its evidence grade is **C**, so it carries weight 0 and cannot
move a score in any direction.

## Code review findings (2026-08-20, 11-agent pass)

Checks a real-but-stillborn convention, and checks it wrong: it validates nothing beyond 'is parseable JSON', while the remediation prescribes a schema that is not the actual agents.json schema. Any JSON file at that path passes, and anyone following the fix produces a file the real agents.json tooling cannot read.

**Required fix:** Delete. If retained despite near-zero adoption, it must at minimum (a) validate the real schema — `info` object plus a `sources` or `flows` array — instead of accepting any JSON, (b) correct `guidance.code` to the actual spec shape, and (c) become `informative`/`na` rather than a scored failure.

**False-positive risks:**
- Validation is `isObject(parsed) || Array.isArray(parsed)` — literally any parseable JSON passes. `[]`, `{}`, `null`-free garbage, or an unrelated config file at that path all yield 'agents.json found with valid JSON content'. This is a vacuous pass with no signal.
- The prescribed shape in `guidance.code` (`protocols`, `authentication`, `rate_limits`, `endpoints`) is invented. The actual agents.json spec is built around `$schema`, `info`, `sources` (pointing at OpenAPI documents) and `flows`. A user who follows this remediation writes a file no agents.json consumer can parse — actively harmful advice.
- Hard `fail` at medium priority for every site, since adoption is negligible.
- SPA catch-all HTML → 'agents.json is not valid JSON' rather than 'not present'.

**Test gaps:**
- No test that `[]` or `{}` passes (it does — the vacuous-pass hole is untested and unnoticed)
- No test validating against the real agents.json schema (`info`/`sources`/`flows`)
- No HTML-soft-404 fixture

**Overlaps with:** `5.7`, `5.11`, `5.12`

## Evidence

### Signal: agents-json — grade D (agent-action-surfaces)

**Mechanism:** Publishing an agents.json file (the Wildcard AI OpenAPI-derived contract describing flows, links and actions) lets AI agents discover and reliably invoke a site's API workflows.

**Evidence:** agents.json was a genuine 2025 proposal — an open spec layered on OpenAPI adding flows (chains of calls), links between actions, and agent-facing metadata — and it accumulated 1,314 stars and 66 forks, so it was not fringe at its peak.

**Counter-evidence:** The project is dead by every measurable signal, checked 2026-08-20. The repository wild-card-ai/agents-json has not been pushed since 2025-08-21 — twelve months stale — and its description field is now empty. Its declared homepage https://agents-json.com fails to resolve entirely (curl exit code 6 / HTTP 000). The documentation host docs.wild-card.ai serves an EXPIRED TLS certificate (valid 2026-01-09 to 2026-04-09, i.e. expired four months ago) so the spec itself is unreachable over HTTPS without an error. The spec version never advanced past 0.1.0. No agent vendor has ever documented consuming it, and there is no IANA registration. Auditing for agents.json would tell site owners to implement a specification whose own documentation site has been broken since April.

### Signal: agent-surface-soft-404-validation — grade A (agent-action-surfaces)

**Mechanism:** A well-known or conventional agent-discovery path that returns HTTP 200 with an HTML body (an SPA catch-all rather than a real document) is worse than a 404, because a conforming client follows the standard, fails to parse, and has no recourse — so any audit must validate content-type and parseability, not status code.

**Evidence:** This is a meta-signal about how the other audits must be implemented, and it is the best-evidenced claim in the whole domain. The May 2026 API Evangelist study of 74 providers found that of the ~72 that did not serve a valid catalog, only TWO returned a clean 404 while SIXTY-EIGHT returned HTTP 200 with an HTML body, and concluded: 'an agent following the standard would get a 200, try to parse a LinkSet out of the body, fail, and have no useful recourse — an HTML 200 at a well-known path lies, which is worse than a 404.' My own probe on 2026-08-20 reproduced this independently across a different path set: linear.app returned 200 text/html for /openapi.json; github.com, linear.app, vercel.com and zapier.com returned 200 text/html for /mcp; zapier.com returned 200 text/html for /.well-known/ai-plugin.json. A status-code-only scanner would have reported all of these as adoption. Correct rule: require a JSON/YAML/linkset content-type, require the body to parse, and where a spec names a media type prefer it (application/ai-catalog+json for AI catalogs, application/linkset+json with the RFC 9727 profile for api-catalog, application/mcp-server-card+json for card entries) — Vercel demonstrates all of this is achievable in production.

**Counter-evidence:** None found — this is a validation-correctness requirement, not a contested adoption claim. The only nuance is that content negotiation is legitimate: RFC 9727 permits additional formats beyond the mandatory Linkset, so an audit should send an explicit Accept header before concluding a publisher is non-conformant, and should not penalise a clean 404 (which is honest) the way it penalises an HTML 200 (which is a lie).

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/agents-json.md](../../deletions/agent-tools/agents-json.md). Outcome: **dead**, grade C.

## Pass-rule correction and tier confirmation (contradiction sweep, 2026-08-24)

This dossier records two researched signals, and the shipped audit honoured neither of them.

### What contradicted what

The site-facing signal closes with `**Consumers:** none-known · **Recommended tier:** delete`, and
the 2026-08-21 adversarial redemption pass returned "confirmed dead". The audit nonetheless hard
`fail`ed every site that did not serve `/.well-known/agents.json`, at medium priority — the exact
risk this dossier's own code review had already written down as "Hard `fail` at medium priority for
every site, since adoption is negligible". It then handed those sites a remediation snippet built
on `protocols`, `authentication`, `rate_limits` and `endpoints`, a schema the same review calls
invented: "A user who follows this remediation writes a file no agents.json consumer can parse —
actively harmful advice." The `docsUrl` it pointed at, `https://agentsjson.org/`, was confirmed
NXDOMAIN by the redemption research.

The second signal, `agent-surface-soft-404-validation` (grade A), was absent from the
implementation. The rule was an HTTP status check plus `JSON.parse`, so an SPA catch-all answering
HTTP 200 with `text/html` was reported as "agents.json is not valid JSON" — naming the wrong
defect — while `isObject(parsed) || Array.isArray(parsed)` reported `[]`, `{}` or any unrelated
config file at that path as adoption. The audit penalised the honest 404 and misread the dishonest
200, which is the inversion of what the grade-A signal prescribes.

### What changed

The audit is narrowed to what its evidence supports and stops acting on sites that have not
adopted the convention.

- **Absence is `notApplicable`, never a failure.** A site that publishes nothing at the path has
  withheld nothing any documented agent wants. `notApplicable` leaves the result out of scoring
  rather than rewarding absence with a vacuous pass.
- **`fail` no longer appears anywhere in the audit.** Every defect it can still report is a `warn`
  at weight 0. A `warn` was chosen over the `fail`-for-broken-documents shape that
  `agent-interfaces/mcp-discovery` uses, because this dossier's own required fix asks the audit to
  "become `informative`/`na` rather than a scored failure", and because a convention its research
  recommends deleting should not present as a failure row on a site that made a good-faith attempt
  to publish it.
- **The vacuous pass is closed.** A published document is validated against the real v0.1.0 shape
  — an `info` object plus a `sources` or `flows` array — so `[]`, `{}`, an array of objects and
  unrelated config files now warn instead of passing. Either member satisfies the check: a document
  may describe sources without flows, or the reverse.
- **The soft-404 case is named correctly.** An HTTP 200 whose body begins with `<!doctype html>` or
  `<html` is reported as a well-known path returning the site shell, and the message says
  explicitly that a clean 404 is the honest answer and is not a finding here. This is the
  grade-A signal's own nuance: an audit "should not penalise a clean 404 (which is honest) the way
  it penalises an HTML 200 (which is a lie)".
- **The content-type check cannot make a false accusation.** The HTML branch is a body sniff and
  nothing else. A genuine agents.json document served with a misconfigured `Content-Type:
  text/html` gets its own, separate warning naming the media-type mismatch — it is never told its
  body begins with HTML, because it does not. A test pins that distinction in both directions.
- **Titles read true on every status the audit can return.** `title` renders on `pass` and on `na`,
  `failureTitle` on the warnings, so the title became the neutral `agents.json at
  /.well-known/agents.json` and the failure title became "agents.json is published but not served
  as a usable document" — true of every warning branch and of nothing else.
- **The guidance stops prescribing.** `guidance.fix` and `guidance.code` are non-imperative: they
  describe the shape a file the site has *already chosen to publish* should have, and open by
  saying there is nothing to do if the site does not publish one. This matters because
  `toCheckResult` copies `guidance.fix`, `guidance.code` and `guidance.effort` onto every result
  including `na`; without the rewrite, a non-adopting site would still be handed a to-do and a
  snippet for a dead convention. `guidance.effort` is a required field on `AuditGuidance` and
  therefore still ships as `easy` on `na` rows; it now describes correcting an existing file rather
  than creating one.
- **The dead link is replaced.** `docsUrl` moves from `https://agentsjson.org/` (NXDOMAIN, verified
  2026-08-21) to the upstream repository, the only primary source for the spec that still resolves.
- **`defaultPriority` drops from `medium` to `low`,** and the frontmatter `severity` with it.

### Why the tier was not raised

The mechanical reason comes first, because it is decisive on its own. `scripts/check-dossiers.mjs`
pins `meta.evidenceGrade` to this dossier's frontmatter `evidence_grade: C`. `weightForGrade('C',
'scored')` returns 0, and `packages/core/src/audits/sunset.test.ts` asserts that tier and weight
move in lockstep — "keeps tier !== scored and weight === 0 in lockstep". A grade-C audit therefore
cannot be scored at all. Scoring the grade-A signal would require a *new* grade-A audit with its
own dossier, which is a different piece of work and not something this audit can absorb.

That work has already been done elsewhere, which is the second reason. The decision recorded in
[`mcp-discovery.md`](./mcp-discovery.md) on 2026-08-24 established that
`agent-surface-soft-404-validation` — "a meta-signal about how the other audits must be
implemented", by its own text — is discharged by implementing it once, in the audit that owns a
path with a ratified standard behind it. `agent-interfaces/openapi-exists` does exactly that at
`/.well-known/api-catalog`: it rejects a `text/html` body, requires the linkset to parse, and pins
the HTML-200 case in its tests. Building a second scored audit from this dossier's copy of the same
signal block would score one signal twice. The identical block is recorded in three live dossiers
(`mcp-discovery`, `webmcp-registered-tools` and the sunset dossier for `ai-plugin-json`), so this
is not a hypothetical.

The signal is not discarded here. It is implemented in this audit, at the tier this path can
honestly carry: an unscored, weight-0 description of what is actually served at
`/.well-known/agents.json`.

### Why the audit still ships

The retirement review that ran alongside this sweep considered exactly this question and answered
it on 2026-08-24 in [`RETIREMENT-SHORTLIST.md`](../../RETIREMENT-SHORTLIST.md): the narrow bar
applies, six audits retire on a policy-conflict test, and `agent-interfaces/agents-json` is not one
of them. The 39 grade-C informative audits stay, on the reasoning that "they already carry weight 0,
so no scanned site's score depends on them, and a cheap observation a site owner may still want
reported is not the same defect as a scored weight with no consumer behind it."

No deprecation notice was attached, and the frontmatter was not marked `deprecated`. `POLICY.md`'s
deprecation process starts by changing the dossier's status to `deprecated` with the evidence for
removal cited, and ends with removal in the next major release. Starting that process here would
contradict a decision taken the same day to keep the audit. It would also have been ineffective for
the population it aims at: `packages/report/src/view-model.ts` splits `na` checks out of the
rendered check list, so on the sites the notice would explain — the ones that publish no
agents.json — nothing would render at all.

### Left unresolved

The `## Evidence` section heads the site-facing signal "grade D", while the frontmatter, the
recorded disposition and the adversarial verdict all say grade C. The audit keeps **C**, which is
the grade the 2026-08-21 decision approved and the one `check-dossiers` asserts against the
frontmatter. Resolving the discrepancy is a re-grade, not a pass-rule fix, and it belongs to the
retirement stream: if the signal is re-graded to D, `POLICY.md` puts the audit in the "Rejected —
not shipped" row and it is removed rather than re-tiered.

### Registry effect

None. No audit is added or removed; the count stays at 215 audits and 215 dossiers, and the scored
set is unchanged — this audit was already weight 0. What moves is what a report says: every scanned
site without the file loses a failure row, and sites publishing placeholder JSON at that path lose
a pass.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
- 2026-08-24 — contradiction sweep: absence becomes `notApplicable`, the vacuous JSON pass is closed against the real v0.1.0 shape, the HTML-200 soft-404 case is named correctly, `fail` is removed, and the invented remediation and dead `agentsjson.org` link are replaced. Grade C / informative / weight 0 confirmed, not raised.
