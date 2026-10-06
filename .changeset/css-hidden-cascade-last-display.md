---
"@forkpoint/agent-lighthouse-core": patch
---

`content-extraction/css-hidden-ghost-content` no longer counts text a stylesheet shows again. Within a rule the last `display` declaration wins, and a later rule for the same selector, or an `!important` one, overrides an earlier `display:none`.
