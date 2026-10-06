---
"@forkpoint/agent-lighthouse-core": patch
---

`operability-safety/ghost-clickable-element-ratio` no longer counts a click-named or cursor-styled wrapper that holds a native control, or an icon or label inside a link or button, as a ghost. An element with its own inline click handler still counts.
