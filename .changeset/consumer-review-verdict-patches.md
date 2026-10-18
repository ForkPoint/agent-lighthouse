---
"@forkpoint/agent-lighthouse-core": minor
---

Verdict fixes from the consumer-evidence review. Minor rather than patch: the scan now reads `/.well-known/ard.json`, and several dossiers gained new sources.

- `agent-interfaces/mcp-endpoint` and `agent-interfaces/search-endpoint` now return not applicable when the site declares no endpoint, instead of failing. A declared but broken endpoint still fails or warns.
- MCP discovery reads the Server Card and connects to its `remotes[].url` (preferring `streamable-http`), instead of sending `initialize` to the card URL. It searches both `/.well-known/ard.json` and `/.well-known/ai-catalog.json` for the card, and resolves relative card and remote URLs. All MCP audits share this, and every one of them is now not applicable on a site that declares no MCP server.
- `agent-interfaces/ai-catalog-exists` requires only `entries`, as the ARD specification does, and reads `/.well-known/ard.json` as well as `/.well-known/ai-catalog.json`. An HTML page answering at either path counts as no catalog, not a broken one. `ai-catalog-metadata` and `ai-catalog-urls` now judge catalogs that carry no `host` or `specVersion`.
- `agent-interfaces/cors-api-routes` and `machine-discovery/cors-ai-files` send a real CORS preflight with an `Origin` header, so servers that answer CORS only to a cross-origin request no longer get a false warning. The `cors-ai-files` message no longer cites retired ChatGPT plugins.
- `machine-discovery/websub-hub-advertisement` is not applicable when no feed advertises a hub, and no longer warns when the `rel=self` URL differs from the fetch URL, which WebSub allows.
- `access-crawl-control/crawl-delay` no longer fails a delay set only for crawlers that document ignoring the directive (Googlebot, Amazonbot, Applebot), and drops an unsourced claim about crawl times.
- MCP audits that probe past the authorization layer (`mcp-version-downgrade` and the three `tools/list` audits) are not applicable when an unauthenticated probe gets HTTP 401 or 403, instead of failing a correctly login-protected server. `mcp-registry-listing-ownership` is not applicable when no registry search gets an answer, instead of reporting "no listing".
