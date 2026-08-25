---
"@forkpoint/agent-lighthouse-core": major
---

`content-extraction/image-alt-text` now measures the accessible name rather than
the `alt` attribute alone.

The audit's grade A rests on a standard: accname ranks `aria-labelledby` and
`aria-label` *above* `alt` as text-alternative sources, and HTML-AAM maps
`title` below it. The rule tested only for a non-empty `alt`, so it failed
images that carry an accessible name by the very document the grade cites. An
`<img aria-label="Sales by quarter">` was scored as a missing alternative at
weight 1.0.

Coverage is now computed over `aria-labelledby` (ids resolved against the page),
`aria-label`, `alt` and `title`, in that order. Three further changes, each
asked for by the audit's own recorded review:

- Images marked `aria-hidden="true"` leave the denominator. They are not in the
  accessibility tree, so no snapshot consumer can see them.
- A site with no images needing a name is reported not-applicable instead of
  passing. The old rule handed a free scored 1.0 to image-free pages and to
  every client-rendered site whose served HTML carries no `<img>`.
- Warnings and failures name the worst offending page URLs and carry the worst
  page's URL on the result. Coverage is pooled across pages, so one gallery page
  could sink a site with no indication of where the problem was.

A global ARIA name defeats a decorative marker: `<img alt="" aria-label="…">`
counts as a named image. `title` does not — it names an image that already
counts, but does not pull a decorative one back into the denominator.

The description and failure copy no longer claim that "Most AI agents are
text-only and rely entirely on alt text" or that missing alt text makes content
"invisible to AI systems". The audit's own counter-evidence rejects that: the
grade rests on Google's explicit statement about Google Images plus the
accessibility-tree snapshot consumers, not on a general claim about all AI.

Sites using ARIA naming or `title` stop failing. Image-free and all-decorative
sites leave the category denominator instead of collecting a free full mark.
Grade, tier and weight are unchanged at A, scored, 1.0.

`extractImages` gains three optional fields — `ariaLabel`, `ariaLabelledby` and
`title`. Additive; no existing field changes.
