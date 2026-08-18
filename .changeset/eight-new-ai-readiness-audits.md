---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse": patch
---

Add 8 new AI-readiness audits:
- SVG context bloat — detects inline SVGs bloating agent context (6.18)
- Token-to-content ratio — flags pages where markup tokens dwarf actual content (6.19)
- Fake headings — detects heading-styled elements that skip semantic `<h1>`–`<h6>` tags (6.20)
- Form backend actionability — checks forms expose actionable backends agents can submit to (5.27)
- Product transactional certainty — verifies Product schema carries machine-readable offer/price/availability signals (3.24)
- TDM-Rep data-mining rights — detects declared text-and-data-mining usage rights (2.27)
- AI crawler vs conversational agent separation — checks robots.txt distinguishes training crawlers from user-driven agents (2.28)
- OpenAPI description quality — scores endpoint descriptions for LLM tool-calling usability (5.26)
