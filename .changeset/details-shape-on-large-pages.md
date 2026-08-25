---
"@forkpoint/agent-lighthouse-core": patch
---

Four audits no longer error out on the storefronts where they find the most to
report.

`AuditResultSchema.details` admits scalars and bounded string arrays: at most
100 entries of at most 1000 characters. `ghost-clickable-element-ratio` and
`stateful-control-introspectability` attached their own finding objects,
`section-split-risk-profile` emitted one entry per section on pages with more
than 100 of them, and `trust-txt-reciprocity-coherence` quoted remote attribute
values of unbounded length. The runner validates every result and turns a
rejection into a `scan-error` stub, so each of these reported nothing at all on
exactly the pages that tripped it — `ghost-clickable-element-ratio` on 28 of 30
live Shopify stores.

All four now render their findings through a shared helper that applies both
caps, and a contract test runs every registered audit against a deliberately
oversized page and validates the result against the schema, so the failure mode
cannot return unnoticed.
