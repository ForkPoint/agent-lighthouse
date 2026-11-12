---
"@forkpoint/agent-lighthouse-core": patch
---

Prepare cursor-pointer selectors once per page survey in the ghost-clickable and stateful-control audits. Preserve per-element selector semantics and all evidence checks while avoiding repeated stylesheet declaration scans that block the event loop.

Use per-run exact-ID and explicit-label indexes in accessibility checks. Preserve label order, duplicate related nodes, unusual-ID selector behavior and all rule results while avoiding repeated full-document searches that block other requests.

Index document-wide explicit form labels once per fixed-DOM pass in form extraction and form actionability. Preserve first-label audit semantics, combined-label parser output, unusual-ID escaping and every field check.
