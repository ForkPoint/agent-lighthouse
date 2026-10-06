---
"@forkpoint/agent-lighthouse-core": patch
---

`answer-readiness/text-fragment-addressability` now groups text by its nearest block ancestor, as the spec does, so an answer beside a heading inside one list item is no longer reported as crossing a block boundary. Text the page does not render is not searched, a card title is no longer joined onto its description, and a FAQ answer that is only in hidden text is reported with that reason.
