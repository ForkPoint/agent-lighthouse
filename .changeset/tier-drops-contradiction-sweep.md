---
"@forkpoint/agent-lighthouse-core": major
---

Two audits drop from grade A scored to grade C informative, because the
project's own evidence research recommended informative for both and the
shipped tier did not follow it.

`access-crawl-control/chatgpt-user` scored the presence of a robots.txt
disallow for ChatGPT-User. OpenAI documents that "because these actions are
initiated by a user, robots.txt rules may not apply", and field measurement
found ChatGPT-User reaching disallowed pages on more sites than any other
bot, so the directive does not predict agent behaviour in either direction.

`agent-interfaces/ai-catalog-exists` scored the presence of
`/.well-known/ai-catalog.json`. The SEP that defines the path is unmerged,
the path is absent from the IANA Well-Known URIs registry, and no shipping
MCP client documents fetching it.

Both remain in the report as informative signals at weight 0. Overall scores
will rise on sites that were failing them and fall on sites that were
passing them.
