---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": patch
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

v2 grade-A graduation wave: the registry grows from 148 to 172 audits.

24 checks from the 2026-08-20 research pass move out of the proposed folder
into the live registry. Every one carries evidence grade A — a proven consumer
path, documented in its dossier under `docs/evidence/audits/` — so every one
lands in the scored tier at weight 1.0, except
`structured-data/claimreview-advisory`, which is informative at weight 0
because its honest finding is that fact-check markup is not an AI-readiness
lever.

New in this release, by category:

- **access-crawl-control**: ai-crawler-edge-parity, bot-content-delta-declared,
  robots-ai-group-shadowing
- **content-extraction**: css-hidden-ghost-content, hydration-payload-share
- **machine-discovery**: agent-commerce-feed-parity,
  ai-crawler-surface-reachability, sitemap-lastmod-verifiability
- **answer-readiness**: snippet-gate-coverage, text-fragment-addressability
- **agent-interfaces**: mcp-modern-era-reachability, mcp-oauth-discovery-chain,
  mcp-tool-contract-validity, mcp-tools-list-determinism, mcp-version-downgrade
- **agentic-commerce**: acp-policy-link-surface, agent-ua-commerce-parity,
  checkout-offer-field-mapping, landed-cost-and-returns
- **operability-safety**: aria-layer-injection-scan,
  form-autofill-token-coverage, invisible-instruction-scan,
  native-control-substitution
- **structured-data**: claimreview-advisory

Category evidence mass moves with the audits, so overall scores shift: a site
that scored well on the 148-audit registry is not guaranteed the same number
here. That is the intended effect of adding proven checks, not a regression.

**Breaking: `probeAsBot`, `BotProbeResult` and `BotProbeSignal` are removed**
from `@forkpoint/agent-lighthouse-core`. They collapsed every non-2xx crawler
response into a single "blocked" signal, which cannot distinguish a Cloudflare
challenge from pay-per-crawl, a proof-of-work wall, a rate limit, or an opaque
403 that may be correct impersonation defence. Use `probeUaParity` and the
`UaProbe` block classification instead.

Also fixed: `fetcher` collapsed repeated response headers, so a site sending
two `X-Robots-Tag` lines had one of them silently discarded. Repeated headers
are now joined per RFC 9110 §5.3, which also corrects doubled `nosniff` and
multi-`Link` canonical handling.
