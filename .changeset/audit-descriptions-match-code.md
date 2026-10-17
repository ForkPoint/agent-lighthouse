---
"@forkpoint/agent-lighthouse-core": patch
---

Three audit descriptions now say what the audit measures. `native-control-substitution` reports a weighted substitution index, not an agent-action count. `form-autofill-token-coverage` checks autocomplete tokens, a name or id and the input type across all scanned forms; it does not check constraints or `aria-invalid`. `drag-and-slider-dependency` limits only its reorder check to transaction paths.
