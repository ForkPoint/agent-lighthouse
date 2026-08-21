---
audit: agent-tools/agents-json
category: agent-tools
status: informative
verdict: dead
evidence_grade: C
reviewed: 2026-08-21
---

# agents-json — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **C**.

## Claimed mechanism (steelmanned)

Steelmanned: agents.json is a real, published open specification (v0.1.0) from Wild Card AI, built on top of OpenAPI, that describes contracts for API/agent interaction and is explicitly designed to be served at /.well-known/agents.json 'so it is easily discoverable by agents accessing web services.' It has genuine GitHub traction (1.3k stars). If any agent runtime, crawler, or registry crawled /.well-known/agents.json to self-configure auth, rate limits, and available endpoints before acting, then serving the file would measurably reduce blind endpoint probing and failed agent interactions — exactly the impact the audit claims.

## What we searched

WebSearch budget for the session was exhausted (200/200) before work began, so I researched entirely via primary sources. I fetched the audit's own docsUrl (agentsjson.org) and the upstream repo homepage (agents-json.com); both failed to resolve/connect, which I independently confirmed with dig and curl. I fetched github.com/wild-card-ai/agents-json to establish spec status, stated file path, and whether any consumer is named. I checked the IANA Well-Known URIs registry for an 'agents.json' registration. I then used the GitHub code-search API to quantify real-world references to '.well-known/agents.json' (878 hits) and grouped the top matching repositories to distinguish genuine consumers from spec forks, awesome-lists, and hobby projects. I also checked repo liveness (last push, archived flag) via the GitHub API.

## Best evidence found for the audit

The strongest evidence for the audit is that agents.json is a genuine published specification, not something invented by this framework: wild-card-ai/agents-json has 1,314 stars, a versioned spec (v0.1.0) built on OpenAPI, a MAINTAINERS.md and LICENSE, and its README explicitly specifies placement at /.well-known/agents.json for agent discoverability. GitHub code search returns 878 files referencing '.well-known/agents.json'. That is real community existence — but on inspection the referencing repos are a long tail of hobby projects, protocol-survey/awesome-list repos (zoe-yyx/Awesome-AIAgent-Protocol, Fewsats/awesome-L402), and competing specs (agent-network-protocol/AgentNetworkProtocol), with no AI vendor among them. No named consumer exists anywhere.

## Counter-evidence

Positive proof of abandonment, not mere absence: (1) The audit's own docsUrl, https://agentsjson.org/, no longer exists — dig returns no A record and curl fails with 'Could not resolve host: agentsjson.org' (NXDOMAIN). (2) The upstream repo's own listed homepage, https://agents-json.com, resolves to 216.92.3.51 but refuses/times out on both HTTPS and HTTP (curl exit 28, http_code=000) — the project has no live website at either domain. (3) The repository has been dormant for exactly 12 months: last push 2025-08-21T22:17:46Z, and the final three commits were housekeeping only ('Update README.md', 'Create MAINTAINERS.md', 'Update LICENSE') — the signature of a project being mothballed, not developed. 12 issues sit open. (4) 'agents.json' is absent from the IANA Well-Known URIs registry, which lists 180+ registered suffixes from acme-challenge to xregistry — so it has no reserved standing at /.well-known/ at all. (5) The README names no vendor or agent that consumes the format; its Stripe/Resend/Google Sheets material is demo code the project authored, not evidence of consumption.

## Verdict

**confirmed dead — delete** (grade C)

Grade C (a real community convention with no documented consumer), and the rubric permits 'dead-but-informative-candidate' for grade C only when adoption is genuinely wide. Adoption here is not wide — it is a long tail of hobby repos and survey lists with zero vendor consumers, and the project is effectively defunct: both of its official domains are offline and the repo has had no substantive commit in 12 months. Critically, the audit does not merely inform, it PENALIZES sites for not serving a file that no shipping agent reads and whose spec has no live homepage; the remediation it prescribes is pure wasted effort. Note also that the audit's docsUrl is a dead domain, so users clicking through get nothing. Not to be confused with AGENTS.md, a separate and genuinely widely adopted convention.

## Sources

- **[wild-card-ai/agents-json — open specification for API/agent contracts](https://github.com/wild-card-ai/agents-json)** — Wild Card AI (repo, URL verified 2026-08-21)
  - Spec v0.1.0 built on OpenAPI; 1,314 stars; explicitly proposes placement at /.well-known/agents.json 'so it is easily discoverable by agents accessing web services'; README names NO vendor or agent that consumes the format (Stripe/Resend/Google Sheets are self-authored demos). GitHub API: archived=false but pushed_at=2025-08-21T22:17:46Z (dormant 12 months), 12 open issues, homepage listed as https://agents-json.com. Last three commits are housekeeping only.
- **[agentsjson.org — audit's docsUrl, domain no longer resolves](https://agentsjson.org/)** — Wild Card AI (defunct) (vendor-doc, NOT verified)
  - (Domain does not resolve — the dead domain IS the evidence.) WebFetch failed with getaddrinfo ENOTFOUND; dig returns no A record; curl returns 'Could not resolve host: agentsjson.org' (http_code=000). This is the exact URL the audit ships as its docsUrl, so users are sent to a dead domain.
- **[agents-json.com — upstream repo's listed homepage, unreachable](https://agents-json.com)** — Wild Card AI (vendor-doc, NOT verified)
  - (Domain does not resolve — the dead domain IS the evidence.) DNS resolves to 216.92.3.51 but both HTTPS and HTTP time out (curl exit 28, http_code=000); WebFetch returned ECONNREFUSED. The project has no live website at either of its two domains.
- **[IANA Well-Known URIs Registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml)** — IANA (spec, URL verified 2026-08-21)
  - Registry lists 180+ registered suffixes (acme-challenge through xregistry) with permanent/provisional/deprecated/obsoleted statuses. 'agents.json' and 'agent' are entirely absent — the path has no reserved standing.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **informative** (kept as informative, weight 0).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
