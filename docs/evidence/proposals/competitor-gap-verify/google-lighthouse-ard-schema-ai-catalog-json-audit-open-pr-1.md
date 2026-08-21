---
check: google-lighthouse-ard-schema-ai-catalog-json-audit-open-pr-1
title: "Google Lighthouse — ard-schema (ai-catalog.json) audit, OPEN PR #17168"
domain: competitor-gap-verify
status: proposed
evidence_grade: B
uniqueness: partial-overlap
difficulty: static-fetch
scoring_tier: informative (weight 0)
reviewed: 2026-08-20
---

# Google Lighthouse — ard-schema (ai-catalog.json) audit, OPEN PR #17168

> Proposed check. Evidence grade **B** · partial overlap · implementation: `static-fetch`

## What it checks

An open PR (created 2026-08-10, branch agentic-resource-discovery, still unmerged at 2026-08-20) adds core/gather/gatherers/agentic/ard.js + core/audits/agentic/ard-schema.js and vendors the official ARD ConformanceTester into third-party/ard/ard.js. The gatherer implements a discovery precedence chain identical to what an ai-catalog audit would want: robots.txt `Agentmap:` line > `<link rel="ai-catalog">` in the DOM > `Link: <...>; rel=ai-catalog` HTTP header > `/.well-known/ai-catalog.json` fallback. The audit is notApplicable unless an explicit signal exists or the well-known returns 200; it then runs validate_manifest and scores 1 (clean) / 0.5 (warnings only) / 0 (errors), plus a Lighthouse-specific warning for any entry missing representativeQueries.

## Claimed mechanism (falsifiable)

Falsifiable: `gh api repos/GoogleChrome/lighthouse/pulls/17168/files` lists ard.js and ard-schema.js. If this PR merges, every ai-catalog.json existence/discovery/schema-conformance check becomes commodity overnight, including our ai-catalog-exists, ai-catalog-metadata, ai-catalog-urls and meta-tags/ai-catalog-link audits.

## Evidence

- **[Lighthouse PR #17168 — new_audit(ard-schema): add Agent Resource Discovery gatherer and schema audit](https://github.com/GoogleChrome/lighthouse/pull/17168)** — GoogleChrome/lighthouse (repo, URL verified 2026-08-20)
  - OPEN PR (created 2026-08-10, branch agentic-resource-discovery). Adds core/audits/agentic/ard-schema.js + core/gather/gatherers/agentic/ard.js + vendored third-party/ard/ard.js ConformanceTester. Discovery precedence implemented: robots.txt 'Agentmap:' > <link rel="ai-catalog"> > Link: <...>; rel=ai-catalog HTTP header > /.well-known/ai-catalog.json fallback. Scores 1 / 0.5 (warnings) / 0 (errors); adds a Lighthouse-only warning for entries missing representativeQueries. This is the single biggest false-uniqueness risk for any ai-catalog.json check.
- **[Agentic Resource Discovery (ARD) Specification](https://agenticresourcediscovery.org/spec/)** — ARDS Project (draft-spec, URL verified 2026-08-20)
  - v0.9 Draft, status 'Proposal', dated 2026-05-28. Manifest ai-catalog.json requires specVersion, host, entries. Each entry requires identifier (urn:air:<publisher>:<namespace>:<agent-name>), displayName, type, and exactly one of url|data. Four discovery mechanisms: /.well-known/ai-catalog.json, robots.txt 'Agentmap:', <link rel="ai-catalog">, DNS SVCB records.

## Competitor coverage

Google (pending). ARD itself is only a v0.9 Draft/'Proposal' dated 2026-05-28 — a Lighthouse-endorsed draft, so adoption pressure is real but the spec can still move under us.

## Implementation sketch

Track this PR. Our surviving differentiators after a merge are the ones the PR explicitly does NOT do: it never dereferences entry.url to check the target is live and returns the declared media type; it never cross-checks the catalog against robots.txt access rules; it validates only /.well-known/ai-catalog.json or the first signalled URL, never reconciling multiple contradictory discovery signals against each other. Reposition ai-catalog-urls onto liveness + type agreement, and add discovery-signal reconciliation.

## Example failure

Shipping 'ai-catalog.json schema conformance' as a headline unique check and then having Lighthouse merge #17168 the same quarter, with a vendored copy of the same upstream conformance suite.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade B does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
