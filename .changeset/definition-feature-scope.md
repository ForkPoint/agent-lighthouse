---
"@forkpoint/agent-lighthouse-core": patch
---

Apply `answer-readiness/direct-definitions` to definitional content on every page type. Select pages through explicit `dfn` markup or definitional titles/headings, not a generic description list: product specification lists no longer create definition findings. Hidden headings, headings in site chrome or asides, and picture-quality phrases such as "high definition" do not establish intent. Keep grade C, informative display, weight 0, and the existing definition coverage verdicts. Mixed samples exclude unrelated and unread pages from the definition ratio.

Exclude trailing display-quality adjectives and hi-definition headings from definitional intent. Respect headers inside explicit sectioning ARIA roles. "HD", "UHD" and "4K" next to "definition" also do not establish intent.
