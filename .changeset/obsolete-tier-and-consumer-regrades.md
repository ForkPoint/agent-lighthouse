---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": major
"@forkpoint/agent-lighthouse-mcp": major
"@forkpoint/agent-lighthouse": major
---

Consumer-evidence review: a new `obsolete` tier, re-grades, and checks that say plainly when nothing reads a file.

**New tier.** `AuditTier` gains `obsolete`, for things a consumer withdrew, a vendor documents ignoring, or whose specification is dead. An obsolete audit has grade D and weight 0, is not applicable when the thing is absent, warns when it is present, and never fails. Its `deprecated` notice (now with `kind` and an optional `replacement`) names the retirement source and what to use instead. Every report format shows these in an "Obsolete (not scored)" section, and they no longer count toward category warnings. `conditions.unscored.reasons` gains an `obsolete` key; the MCP summary gains `obsoleteFound`.

**Moved to obsolete:** `agent-interfaces/agents-json`, `agent-interfaces/mcp-discovery` (now only `/.well-known/mcp/servers.json`; the UCP profile moved to `agentic-commerce/ucp-profile`), `agent-interfaces/search-endpoint` (now only WebSite `SearchAction`), `structured-data/howto-schema`, `structured-data/faqpage-schema`, `access-crawl-control/bravebot`, `access-crawl-control/chatgpt-user`, `answer-readiness/meta-author`. `agent-interfaces/ai-plugin-json` returns as an obsolete audit (legacy 5.11).

**No AI vendor reads these:** the five llms.txt audits, `machine-discovery/rss-feed-content`, `machine-discovery/cors-ai-files` and `operability-safety/trust-txt-reciprocity-coherence` stay informative, carry an `unconsumed` notice, and no longer warn or fail. A defect is still named in the message.

**Re-graded:** `machine-discovery/websub-hub-advertisement` C to B (scored); `access-crawl-control/tdm-rep` experimental to informative (now runs by default); `access-crawl-control/https-enabled` A to B; `operability-safety/wikidata-round-trip-verification` B to C (informative). `operability-safety/form-autofill-token-coverage` now judges credential tokens only (A); contact, address and payment tokens move to the new `operability-safety/profile-autofill-token-coverage` (B).

**New audits:** `agent-interfaces/a2a-agent-card` (A2A `/.well-known/agent-card.json`, IANA permanent), `agentic-commerce/ucp-profile`, `operability-safety/change-password-url` (informative).

`operability-safety/synthetic-media-disclosure-validity` now warns instead of failing on bare-token, https and trailing-slash spellings, and reports them in `details.warnings`.
