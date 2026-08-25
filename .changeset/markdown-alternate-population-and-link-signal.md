---
"@forkpoint/agent-lighthouse-core": major
---

`content-extraction/markdown-alternate` no longer fails a site that serves no
markdown alternate, and the `<link rel="alternate">` declaration can no longer
decide the result on its own.

The audit's grade-A evidence is explicit that the grade "applies to interactive
coding agents, NOT to search crawlers or consumer chat". What the sources
document is consumption when a markdown alternate is served; none measures a
cost to a site that serves none, and three point the other way — ChatGPT-User
takes markdown on 0.1% of fetches, a 14-day controlled test found 0 crawler
visits and 0 citations for `.md` against 137 to matched HTML, and Google states
markdown is not needed for Search or its AI features. Absence now returns
not-applicable and leaves the score denominator. Every site that was failing
this check for having no markdown alternate gains the weight back; no site that
serves one sees its result change for that reason.

The audit bundled two separately graded signals and let the weaker one decide.
The link relations carry `Recommended tier: experimental` — one single-sourced
consumer for `rel="alternate"`, none known for `rel="describedby"` — while the
markdown representation reached by a `.md` URL or `Accept: text/markdown`
carries `Recommended tier: scored`. A declared link whose document could not be
read used to return a full pass at weight 1.0, and a declared link that 404'd a
full fail. Both are gone: the declaration is a discovery route and a reported
detail, never an outcome.

Two supporting changes. Probing no longer stops at a declared document that
fails the fidelity floors, so a site-wide `index.md` declared from every page
cannot fail a site for the per-page alternate it actually serves. And "this is
the HTML page again" is decided from the body rather than the content type, so a
`.md` URL answering with the HTML document is not an alternate, while a markdown
document served as `text/html` or `text/plain` still fails under RFC 7763.

Page selection now prefers a page that declares an alternate, then any
non-homepage, closing a long-recorded homepage bias: a marketing homepage almost
never has a markdown twin even on sites where every content page does.

Grade, tier and weight are unchanged at A, scored, 1.0. The scored population is
now the one the evidence covers.
