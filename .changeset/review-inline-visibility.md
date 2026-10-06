---
"@forkpoint/agent-lighthouse-core": patch
---

Resolve inline display and visibility declaration order and !important before hiding answer spans or content. Invalid values are dropped as a browser drops them, a visibility:visible descendant of a visibility:hidden block counts as rendered for text fragments, and CSS-hidden ghost content uses the same resolver for inline markers and stylesheet display rules.
