---
"@forkpoint/agent-lighthouse-core": major
---

`agent-interfaces/mcp-discovery` drops from grade A / scored / weight 1.0 to
grade C / informative / weight 0, and stops failing sites that publish nothing.

Four of the audit's five researched signals record `Consumers: none-known` and
recommend `informative` or `delete`. Neither `/.well-known/mcp/servers.json` nor
`/.well-known/ucp` is a registered or specified discovery path, and no shipping
MCP client is documented as fetching either. The audit nonetheless failed every
site without one at weight 1.0 — including every site running a real MCP server
at `/mcp`, through the registry, or via `/.well-known/oauth-protected-resource`.
Its own code review calls that "a false FAIL on precisely the sites that are
most agent-ready". Publishing no MCP discovery document is now not-applicable.

The fifth signal — the one recommending `scored` — is not split into a new
audit, because it is already implemented. It describes itself as "a meta-signal
about how the other audits must be implemented": do not read an HTTP 200
carrying HTML as evidence of a document. `agent-interfaces/openapi-exists`
enforces exactly that at the ratified path, rejecting a `text/html` body at
`/.well-known/api-catalog` and requiring the linkset to parse. A second audit
would have duplicated it, contradicted the tier `openapi-exists` deliberately
carries, and needed a pass condition under which serving `{}` at a well-known
path bought a weight-1.0 win.

Two vacuous passes are also gone. `{}` at `/.well-known/ucp` returned a
confident pass reading "0 services and 0 capabilities"; `{"servers": []}`
returned a pass for a discovery file that discovers nothing. Both now fail — a
document that is published and says nothing is a defect, unlike a document that
was never published.

Every site previously failing this check gains weight 1.0 back in the Agent
Interfaces category. The scored set drops from 167 audits to 166 and the total
evidence mass from 137.4 to 136.4; `docs/SCORING.md` is refreshed to match. No
audit is added or removed — the registry stays at 215.
