---
"@forkpoint/agent-lighthouse-core": minor
---

Browser view: 14 more audits run on a supplied browser snapshot, 21 in all. Landmark, form and accessibility-tree checks whose dossier grade rests on a browser-agent tool now judge the DOM such an agent reads on gated and JS-rendered pages. The findings appear in `browserAssessment` only: informative, weight 0, no browser score. The crawler score, every audit id, tier, grade and weight are unchanged. Accessibility-rule audits get the same jsdom rule pass on the capture as on HTTP pages, with page scripts off; a pass that yields nothing records missing evidence instead of "not applicable". `stripStyles`, which runs before every jsdom pass, is now linear-time on unclosed `<style>` and `<link>` tags.
