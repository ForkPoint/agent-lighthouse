---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": patch
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

Plan 5b Wave C: the bot-auth-access, competitor-gap-verify and feeds-indexing
proposals land. Ten graduate as new audits and one folds into another. The
registry grows from 193 to 203 audits.

New in `access-crawl-control`:

- `ai-usage-signal-coherence-across-channels` — reads every channel a site can
  declare AI usage in (robots.txt AI groups, robots.txt `Content-Signal`, the
  `Content-Usage` header, TDM Reservation Protocol, inline RSL) and reports the
  ones that disagree. The `competitor-gap-verify/content-signal-coherence`
  proposal covered the same defect on one channel and folds into this audit;
  the folded dossier is under `docs/evidence/merged/`.
- `aipref-content-usage-declaration-validity` — validates `Content-Usage`
  syntax, category names and scope paths, and reports a declaration made inert
  by the robots.txt rule that decides the same path.
- `rsl-licensing-terms-conformance` — checks Really Simple Licensing documents
  across four discovery channels for a usable permit and payment shape.
- `machine-actionable-402-paid-access` — when an origin answers 402, checks
  that the response is machine-actionable. It never completes a payment and
  never retries with a price.
- `web-bot-auth-request-tolerance` — signs one request with a per-scan
  ephemeral Ed25519 key and reports whether the origin tolerates HTTP Message
  Signatures. It claims nothing about identity and presents no agent.

New in `machine-discovery`:

- `conditional-request-support` — four requests per discovery surface: two
  identical GETs to see whether the validator is stable, then `If-None-Match`
  and `If-Modified-Since`.
- `feed-entry-identity-and-canonical-integrity` — per-entry id and timestamp
  conformance, duplicate ids, and the five newest item URLs compared against
  the `rel="canonical"` of the pages they open.
- `root-text-file-resolution-integrity` — two GETs of random 32-hex `.txt`
  names that must 404, plus `/robots.txt` as the positive control. Emits
  `details.discoveryProbeReliable`.
- `three-way-freshness-lag` — the newest page date against the newest sitemap
  `<lastmod>` and the newest feed entry. Only the freshness half of the
  proposal ships; the orphan half stays with `discovery-index-coverage` rather
  than being scored twice.
- `websub-hub-advertisement` — WebSub discovery-link conformance. Informative
  tier at weight 0; it never fails a scan.

What a scan now sends that it did not before: up to four extra GETs per
discovery surface for the conditional-request probe, five item-page GETs for
the feed canonical comparison, five sitemap-URL GETs for the dead-entry check,
three GETs for the root `.txt` probe, one signed GET for the web-bot-auth
probe, and one HEAD per declared WebSub hub — the only cross-origin request
the wave adds. Every request is a GET or a HEAD, every URL passes the SSRF
gate, and no probe writes anything.

Shared gatherers added: `gatherers/feeds.ts`, `gatherers/conditional.ts`,
`gatherers/structured-fields.ts` and `gatherers/currency.ts`, so the eleven
audits share one fetch per surface.

Also fixes a latent defect in the audit base class: a `fail()` or `warn()`
whose fourth argument is a remediation sentence rather than a priority token
threw a `ZodError` at report time. Thirty-two call sites were affected. The
result now carries `remediation`, and `answer-readiness/section-split-risk-profile`
no longer emits a number array in `details`, which the result schema rejects.
