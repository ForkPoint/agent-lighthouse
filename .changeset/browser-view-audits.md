---
"@forkpoint/agent-lighthouse-core": minor
---

Browser view: 26 more audits run on a supplied browser snapshot. Landmark, heading, table, form and accessibility-tree checks now judge the DOM a browser agent reads on gated and JS-rendered pages. The findings appear in `browserAssessment` only: informative, weight 0, no browser score. The crawler score, every audit id, tier, grade and weight are unchanged. Accessibility-rule audits get the same jsdom rule pass on the capture as on HTTP pages, with page scripts off; a pass that yields nothing records missing evidence instead of "not applicable".
