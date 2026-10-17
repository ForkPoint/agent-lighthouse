---
"@forkpoint/agent-lighthouse-core": patch
---

A homepage that times out or drops the connection is no longer described as "dropped or timed out repeatedly". The scan fetches the homepage once. The reason now says what that attempt saw: "The connection opened, but the homepage sent no response before the timeout", or "The server closed the connection without a response". The verdict is unchanged.
