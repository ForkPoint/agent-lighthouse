---
"@forkpoint/agent-lighthouse-core": major
---

A false-positive sweep across 44 audits, prompted by two real-site scans. No audit id, grade, tier, weight or result schema changes, but verdicts move on a large share of sites, so scores, saved baselines and dashboards built on 5.x output will shift. Notable moves:

- The 14 crawler audits pass when robots.txt lets a bot inherit the `*` allow, and are not applicable when robots.txt is missing.
- Optional artifacts that are absent (RSS feed, RSL licence, WebMCP attributes, a full sitemap index read) return not applicable instead of failing.
- `operability-safety/contact-form` is not applicable when the sampled pages link to a contact page the scan did not fetch.
- Hidden subtrees (`hidden`, `aria-hidden`, inline `display:none`, closed dialogs) no longer count in fake-headings, semantic-lists, text-fragment and extractor-survival checks.
- `answer-readiness/text-fragment-addressability` now matches over nearest-block-ancestor runs, as the spec does; a FAQ answer that is present only in unrendered text now fails with that reason.

Each audit's own changeset below lists its change.
