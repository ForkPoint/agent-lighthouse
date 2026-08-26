---
'@forkpoint/agent-lighthouse-core': minor
---

Audits declare which scan evidence they need, and a scan can act on it.

`AuditMeta` gains `requires`: the classes of evidence an audit needs to say
anything true. An audit that reads the sampled pages — directly or through a
page-fed gatherer — needs all four; one that reads only root files needs the
origin to have answered. Of 215 registered audits, 161 are page-fed.

`scripts/check-requires.mjs` (`pnpm check:requires`, wired into CI) proves each
declaration against what the source actually reads, and fails the build when a
new gatherer is not classified. Audits whose subject *is* the missing evidence —
`server-rendered`, `no-blocking-captcha`, `no-bot-detection` and the
`access-crawl-control` category — are exempt through an allowlist, not through
a missing rule.

The gate itself is off by default. `runScan({ enforceEvidenceGate: true })`
turns it on: an audit the scan cannot feed reports `na` tagged
`skipped:no-evidence`, with the reason attached, and is never constructed.
`AuditTrace.outcome` gains `'gated'` for those.
