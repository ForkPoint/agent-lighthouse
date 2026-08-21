---
audit: technical-readiness/security-txt
category: technical-readiness
status: informative
verdict: dead-but-informative-candidate
evidence_grade: C
reviewed: 2026-08-21
---

# security-txt — dead as scored audit — informative candidate (weight 0)

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **C**.

## Claimed mechanism (steelmanned)

Steelmanned: `/.well-known/security.txt` is a ratified IETF standard (RFC 9116) with genuinely wide deployment among serious operators. If any answer engine, agent platform, or agent-transaction protocol treats the `.well-known` surface as a maturity/legitimacy signal — or if an agent that is about to transact with a site wants a verifiable human escalation contact — then publishing security.txt would raise the site's standing with AI systems, either directly (a scorer reads it) or indirectly (it correlates with operators who also do the things AI systems actually reward).

## What we searched

All research by WebFetch. Angles: (1) the primary source — RFC 9116 itself, to establish the spec's stated purpose and named consumers; (2) Brave query `"security.txt" "AI visibility" OR "answer engine" OR "LLM" trust signal crawler`; (3) Brave query `".well-known" AI agent discovery "security.txt" agentic web standard`, which surfaced the two most on-point community artefacts — agents-txt.com/spec and agentswelcome.dev — both of which I then fetched in full; (4) the four first-party AI-crawler docs (OpenAI, Google, Anthropic, Perplexity) checked specifically for security.txt; (5) the empirical GEO literature (arXiv 2311.09735) and AI-citation correlation studies for any file-presence or trust-file factor. The only hits linking security.txt to agents at all are community-authored, unadopted documents.

## Best evidence found for the audit

One genuine, if weak, community-convention data point: the agents.txt community spec (https://agents-txt.com/spec/) explicitly positions security.txt in the agent stack — "security.txt is a human-readable vulnerability disclosure channel published at /.well-known/security.txt; agents.txt is a machine-readable capability declaration. Sites that take agent payments or authentication SHOULD publish both." A second artefact, agentswelcome.dev, an agent-first demo site, lists security.txt as part of its "complete machine-discovery surface" alongside sitemap.xml and Atom feeds. Note that even the friendly source calls security.txt *human-readable* and assigns the machine-facing role to agents.json — i.e. it is recommended as an escalation contact for humans behind an agent transaction, not as something an agent parses. Separately, security.txt is unambiguously grade-A as a standard in its own right: RFC 9116 is ratified (April 2022) with real consumers — security researchers and automated vulnerability scanners — and wide deployment. That grade simply does not transfer to the AI claim the audit makes.

## Counter-evidence

RFC 9116 itself is the counter-evidence, and it is explicit about scope. The abstract: "This document defines a machine-parsable format ('security.txt') to help organizations describe their vulnerability disclosure practices to make it easier for researchers to report vulnerabilities." Section 1.1 frames the problem entirely in terms of "security researchers encounter situations where they are unable to report security vulnerabilities". The RFC nowhere mentions search engines, web crawlers, indexing services, or automated agents other than researchers' own vulnerability scanners (Section 5.8's caution about "reports being sent in an automated fashion and/or as a result of automated scans"). So the named consumer set is closed and does not include AI systems. Beyond the spec: none of OpenAI's, Google's, Anthropic's or Perplexity's crawler documentation mentions security.txt; the GEO paper's tested levers are entirely content-level; AI-citation correlation studies surface authority, expert quotes, URL slug length and engagement, never trust-file presence. A Brave search specifically pairing security.txt with AI visibility returned, verbatim, "No source mentions security.txt in relation to AI visibility or LLM crawling" — the results were all about llms.txt instead, and even those reported near-zero bot pickup. The audit's assertion of "enterprise AI frameworks that evaluate site maturity before recommending it in answers" names no framework and matches nothing findable.

## Verdict

**dead as scored audit — informative candidate (weight 0)** (grade C)

Grade C, and the adoption test is met — but only for the file, never for the claim. RFC 9116 is a ratified standard with genuinely wide deployment (it is standard practice at major operators and is mandated by several compliance regimes), and one agent-oriented community spec does recommend it for sites that transact with agents. That is enough to keep it as a non-scoring informational item, and it is the only one of these four where a rewrite is defensible. What must go is the fabricated causal story: there is no "AI trust-scoring system" and no "enterprise AI framework" that reads security.txt before recommending a site in answers, and the description, impact and failure-description strings all state that as fact. If retained, demote it to informational/zero-weight, reframe it honestly as operational hygiene and a human escalation contact for agent-transacting sites (citing RFC 9116 and agents.txt), and stop claiming it moves AI answer visibility. If the project has no informational tier, delete it — as a scored AI-readiness signal it is not defensible.

## Sources

- **[RFC 9116: A File Format to Aid in Security Vulnerability Disclosure](https://www.rfc-editor.org/rfc/rfc9116.html)** — IETF (spec, URL verified 2026-08-21)
  - Abstract scopes the format to helping "researchers to report vulnerabilities". Section 1.1 frames the problem as researchers lacking reporting channels. The RFC does not mention search engines, crawlers, indexing services, or automated agents beyond security scanners (Section 5.8). Named consumer set excludes AI systems entirely.
- **[agents.txt specification](https://agents-txt.com/spec/)** — agents-txt.com (community) (spec, URL verified 2026-08-21)
  - Only found source placing security.txt in an agent context: "security.txt is a human-readable vulnerability disclosure channel published at /.well-known/security.txt; agents.txt is a machine-readable capability declaration. Sites that take agent payments or authentication SHOULD publish both." Does not reference Referrer-Policy, Permissions-Policy or preconnect. Community-maintained, no vendor adoption.
- **[AGENTS WELCOME](https://agentswelcome.dev/)** — agentswelcome.dev (demo site) (article, URL verified 2026-08-21)
  - Agent-first demo site listing security.txt as part of a "complete machine-discovery surface" alongside sitemap.xml and Atom feeds, while assigning the authoritative machine-readable role to /.well-known/agents.json. Self-describes as a demonstration, not a standard. No claim that agents parse security.txt.
- **[PerplexityBot and Perplexity-User](https://docs.perplexity.ai/guides/bots)** — Perplexity (vendor-doc, URL verified 2026-08-21)
  - Explicitly does not address security.txt files, trust scoring mechanisms, or HTTP response headers; scope is user-agent identification, IP whitelisting and WAF configuration.
- **[Google crawlers (user agents) overview](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers)** — Google (vendor-doc, URL verified 2026-08-21)
  - No mention of security.txt being read by Google-Extended, Google-CloudVertexBot or any Google crawler.
- **[GEO: Generative Engine Optimization](https://arxiv.org/html/2311.09735v3)** — arXiv (Aggarwal et al., KDD 2024) (study, URL verified 2026-08-21)
  - All nine tested visibility levers are content-level; no trust-file, well-known-path, or infrastructure factor was tested.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **informative** (kept as informative, weight 0).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
