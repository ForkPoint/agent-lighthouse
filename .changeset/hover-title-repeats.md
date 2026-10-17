---
"@forkpoint/agent-lighthouse-core": patch
---

`operability-safety/hover-only-content-and-navigation` no longer counts a `title` attribute that repeats what the element already says. The comparison now ignores letter case and covers the `aria-label`, the `aria-labelledby` text and an image's `alt`, and a title whose content words all appear in those names also counts as a repeat. On one homepage the title-only count fell from 51 to 13. A site whose only finding was such titles now passes, so its score can rise.
