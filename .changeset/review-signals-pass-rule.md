---
"@forkpoint/agent-lighthouse-core": major
---

`answer-readiness/review-signals` no longer accepts the review vocabulary as
proof of reviews, and no longer lets out-of-scope pages decide a commerce
verdict.

Four narrowings, each grounded in the audit's own recorded evidence.

**Hollow markup stops counting.** Google prohibits review markup that is not
"sourced directly from users", so the dossier records that "the existence of
review markup is not itself evidence of social proof". The audit already
rejected `"review": []` and a zero `reviewCount` on that reasoning but stopped
there, so `"aggregateRating": {}`, `"aggregateRating": true`, a bare
`{"@type":"Review"}` and `[{"@type":"Review"}]` all passed. A rating node now
needs a rating value or a positive count; a review node needs a body, a named
author, or a rating.

**The commerce branches now respect the commerce scope.** The audit declared
`applicablePageTypes: ['homepage', 'product']` but looped over every scanned
page, so in a mixed scan a blog post's `star-rating` div could satisfy it. The
review vocabulary, the widget fallback and the "N reviews" text are read only
from homepage and product pages — the population Google's review rich results
and OpenAI's `review_count`/`star_rating` cover. The quotation branch keeps its
wider scope: its evidence is a GEO measurement of generative-answer citation,
not a commerce one.

**An unattributed pull-quote sets no status.** It was a scored warn. The
dossier states that "nothing in any source supports counting an unattributed
blockquote as a review signal". It is now reported in `found` and nothing more,
so an editorial pull-quote alone fails where it used to warn, and the warn copy
no longer claims review signals were found on a page that has none.

**Attribution has to name someone.** Any `cite` attribute counted, including
prose like `cite="see our press page"`, and an empty `<cite></cite>` counted. A
`cite` value must now name a document — relative references count — and the
attribution elements must carry text.

Two supporting fixes: the "N reviews" test runs against text with `script`,
`style`, `noscript` and `template` stripped, so an inline JSON payload reading
`"1234 reviews"` no longer counts as visible review UI; and a widget element
must carry text or children, so an empty `star-rating` placeholder that may
never populate is not review UI.

`findReviewNodes` is exported and `answer-readiness/trust-signals` defers its
social-proof factor to it, so that audit stops deferring on hollow markup —
which moves its denominator and its pass bar. Intended, and pinned by a test.

Grade, tier and weight are unchanged at B, scored, 0.6.
