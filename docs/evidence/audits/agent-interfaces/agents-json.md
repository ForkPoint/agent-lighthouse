---
audit: agent-interfaces/agents-json
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/agents-json.ts
slug: agents-json
evidence_grade: C
disposition: "informative, weight 0 (approved 2026-08-21)"
reviewed: 2026-08-24
recommended_tier: scored
tier_rationale: 'Recommended scored on the strength of the published spec; ships informative because the 2026-08-21 redemption pass returned "confirmed dead" for the site-facing signal and no consumer was found (contradiction sweep, 2026-08-24).'
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
finding and is excluded from scoring entirely. When a document _is_ published, the check validates
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

## Evidence

### Signal: agents-json — grade D (agent-action-surfaces)

**Mechanism:** Publishing an agents.json file (the Wildcard AI OpenAPI-derived contract describing flows, links and actions) lets AI agents discover and reliably invoke a site's API workflows.

**Evidence:** agents.json was a genuine 2025 proposal: an open spec layered on OpenAPI, adding flows (chains of calls), links between actions, and agent-facing metadata. It accumulated 1,314 stars and 66 forks. It was not fringe at its peak.

**Counter-evidence:** The project is dead by every measurable signal, checked 2026-08-20. The repository wild-card-ai/agents-json has not been pushed since 2025-08-21 — twelve months stale — and its description field is now empty. Its declared homepage https://agents-json.com fails to resolve entirely (curl exit code 6 / HTTP 000). The documentation host docs.wild-card.ai serves an EXPIRED TLS certificate (valid 2026-01-09 to 2026-04-09, i.e. expired four months ago) so the spec itself is unreachable over HTTPS without an error. The spec version never advanced past 0.1.0. No agent vendor has ever documented consuming it, and there is no IANA registration. Auditing for agents.json would tell site owners to implement a specification whose own documentation site has been broken since April.

### Signal: agent-surface-soft-404-validation — grade A (agent-action-surfaces)

**Mechanism:** A well-known or conventional agent-discovery path that returns HTTP 200 with an HTML body is worse than a 404 — that body is an SPA catch-all rather than a real document. A conforming client follows the standard, fails to parse, and has no recourse. Any audit must therefore validate content-type and parseability, not status code.

**Evidence:** This is a meta-signal about how the other audits must be implemented, and it is the best-evidenced claim in the whole domain. The May 2026 API Evangelist study covered 74 providers. Of the roughly 72 that served no valid catalog, only two returned a clean 404; sixty-eight returned HTTP 200 with an HTML body. The study concluded: 'an agent following the standard would get a 200, try to parse a LinkSet out of the body, fail, and have no useful recourse — an HTML 200 at a well-known path lies, which is worse than a 404.' A probe on 2026-08-20 reproduced that result across a different path set. linear.app returned 200 text/html for /openapi.json; github.com, linear.app, vercel.com and zapier.com returned 200 text/html for /mcp; zapier.com returned 200 text/html for /.well-known/ai-plugin.json. A status-code-only scanner would have reported all of these as adoption. The correct rule is to require a JSON, YAML or linkset content-type, and to require the body to parse. Where a spec names a media type, prefer it: application/ai-catalog+json for AI catalogs, application/linkset+json with the RFC 9727 profile for api-catalog, and application/mcp-server-card+json for card entries. Vercel demonstrates that all of this is achievable in production.

**Counter-evidence:** None found — this is a validation-correctness requirement, not a contested adoption claim. The only nuance is that content negotiation is legitimate. RFC 9727 permits additional formats beyond the mandatory Linkset, so an audit should send an explicit Accept header before concluding a publisher is non-conformant. It should also not penalise a clean 404, which is honest, the way it penalises an HTML 200, which is a lie.

## Implementation deviations

- Absence is `notApplicable`. The audit never returns `fail`; every defect is a `warn` at weight 0.
- The soft-404 case is a body sniff only. A body that begins with `<!doctype html>` or `<html` is reported as the site shell.
- A valid document served as `text/html` gets a separate media-type warning. It is never told its body is HTML.
- `guidance.fix` and `guidance.code` describe a file the site already publishes. `toCheckResult` copies guidance onto `na` rows too, so neither may prescribe adoption.
- `guidance.effort` is required by `AuditGuidance`, so it still ships as `easy` on `na` rows.
- The grade-A soft-404 signal is applied here at weight 0. It is scored once, in `agent-interfaces/openapi-exists`, so it is not scored twice.

## Deferred

- The `## Evidence` section heads the site-facing signal "grade D", while the frontmatter says C. The audit keeps C. A re-grade to D would move the audit to "Rejected — not shipped" under `policy.md`.
