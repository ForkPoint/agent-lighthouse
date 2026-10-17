---
"@forkpoint/agent-lighthouse-core": patch
---

A root file that answers HTTP 200 with an HTML page now counts as absent. Many sites redirect `/llms.txt`, `/trust.txt` or `/.well-known/mcp/servers.json` to the homepage, and audits read that homepage as the file: "llms.txt missing markdown heading", a trust.txt with 1,960 attributes, "servers.json has no servers array", and homepage links checked as AI endpoints. One shared check, `isRootArtifact`, now sits beside the root-file read, and the llms.txt, trust.txt, MCP, ai-catalog, tdmrep, OpenAPI and CORS readers use it.

Audits about an optional file's contents now return not applicable when the file is absent, as the repo rule and their dossiers say:

- informative: `machine-discovery/llms-txt-link-descriptions`, `machine-discovery/llms-full-txt`, `machine-discovery/cors-ai-files` and `machine-discovery/rss-feed-content`;
- scored: `machine-discovery/no-broken-ai-endpoints`, when none of ai-catalog.json, llms.txt or navigation.json is published. Sites without those files no longer lose its warn, so their score can rise. A file that is there and lists no URLs still warns.
