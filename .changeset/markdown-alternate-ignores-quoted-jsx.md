---
"@forkpoint/agent-lighthouse-core": patch
---

Stops `content-extraction/markdown-alternate` reporting a component tag that the
document only quotes.

The component scan read the raw markdown, so a capitalised tag inside a fenced
example or an inline code span counted as a component the renderer had failed to
resolve. A markdown alternate of a documentation page is the likeliest place to
quote JSX, which meant the audit reported the faithful case as the broken one —
`warn`, score 0.5, with the quoted tag named in `found`.

The scan now runs over the document with fenced blocks and inline code spans
removed. Indented code blocks are deliberately left in place: four leading
spaces is also how a list item continues, and dropping list bodies would hide
real unresolved components in order to fix a rarer false positive.

Sites whose alternate quotes JSX move from `warn`/0.5 to `pass`/1. Nothing else
changes: no evidence, grade, tier or weight moves, and a component tag that is
genuinely unresolved is still reported.
