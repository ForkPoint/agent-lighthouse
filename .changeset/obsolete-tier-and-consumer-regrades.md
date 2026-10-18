---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": major
"@forkpoint/agent-lighthouse-mcp": major
"@forkpoint/agent-lighthouse": major
---

Consumer-evidence review: a new `obsolete` tier, re-grades, and checks that say plainly when nothing reads a file.

**New tier.** `AuditTier` gains `obsolete`, for things a consumer withdrew, a vendor documents ignoring, whose specification is dead, or that a governing project superseded. An obsolete audit has grade D and weight 0, is not applicable when the thing is absent, warns when it is present, and never fails. Its `deprecated` notice (now with `kind` and an optional `replacement`) names the source and what to use instead. Every report format shows these in an "Obsolete (not scored)" section, separates obsolete checks that did not run from those that found nothing, and leaves them out of category counts. `conditions.unscored.reasons` gains an `obsolete` key; the MCP summary gains `obsoleteFound` and `notices`.

**Moved to obsolete:** `agent-interfaces/agents-json`, `agent-interfaces/mcp-discovery` (superseded by the MCP Server Card; now only `/.well-known/mcp/servers.json`, with the UCP profile moved to `agentic-commerce/ucp-profile`), `agent-interfaces/search-endpoint` (now only WebSite `SearchAction`), `structured-data/howto-schema`, `structured-data/faqpage-schema`, `access-crawl-control/bravebot`. `agent-interfaces/ai-plugin-json` returns as an obsolete audit (legacy 5.11).

**No AI vendor reads these:** the five llms.txt audits, `machine-discovery/rss-feed-content`, `machine-discovery/cors-ai-files`, `operability-safety/trust-txt-reciprocity-coherence`, `answer-readiness/meta-author` and `access-crawl-control/chatgpt-user` are informative, carry an `unconsumed` notice, and never warn or fail. A defect is still named in the message. `meta-author` and `howto-schema` now read every page type.

**Re-graded:**

- `machine-discovery/websub-hub-advertisement` C to B (scored). `http` hub URLs and hubs that refuse the probe with 401, 403 or 429 no longer warn.
- `access-crawl-control/tdm-rep` experimental to informative (now runs by default).
- `access-crawl-control/https-enabled` A to B. The grade rests on Chrome 154's prompt before plain-http sites; a plain-http site now fails at priority high, not critical.
- `operability-safety/wikidata-round-trip-verification` B to C (informative).
- `operability-safety/form-autofill-token-coverage` A to B, and now judges credential tokens only. On a sign-in or sign-up form with a password field and no username field, the first email field counts as the account identifier. Contact, address and payment tokens move to the new `operability-safety/profile-autofill-token-coverage` (C, informative).

**New audits:** `agent-interfaces/a2a-agent-card` (B, scored; A2A `/.well-known/agent-card.json`, IANA permanent), `agentic-commerce/ucp-profile` (B, scored), `operability-safety/change-password-url` (C, informative). A JSON body that lacks the artifact's own keys, such as a catch-all response served at every `/.well-known/` path, counts as no file.

`operability-safety/synthetic-media-disclosure-validity` now warns instead of failing on bare-token, https and trailing-slash spellings, and reports them in `details.warnings`.

The public dossier section "Example failure" is renamed "Example finding".
