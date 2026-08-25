---
"@forkpoint/agent-lighthouse-core": patch
---

`operability-safety/aria-layer-injection-scan` and
`operability-safety/native-control-substitution` no longer error out on a page
whose ids the CSS identifier grammar rejects.

Both resolved an `aria-labelledby`, `aria-describedby` or `aria-controls`
reference by interpolating the id into a `#id` selector. An id is any
non-whitespace string, and React's `useId` emits ids like `:r0:`, which parse
as a pseudo-class: a live storefront killed `aria-layer-injection-scan` with
`Unknown pseudo-class :-tab-0`, and the runner turned the throw into a
`scan-error` stub, so the audit reported nothing for that store. Both now
resolve the reference through an attribute selector, which has no identifier
grammar to violate.
