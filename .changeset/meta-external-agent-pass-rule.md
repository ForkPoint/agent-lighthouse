---
"@forkpoint/agent-lighthouse-core": major
---

`access-crawl-control/meta-external-agent` no longer scores a site down for
failing to name Meta-ExternalAgent in robots.txt.

The audit inherited a rule that passed only when a named
`User-agent: Meta-ExternalAgent` group allowed `/`, and warned at score 0.5 on
everything else that was nonetheless allowed. A robots.txt reading
`User-agent: *` / `Allow: /` — every crawler welcome, nothing blocked — scored
half marks at weight 1.0. Its own dossier calls that criterion "the cargo-cult
'explicit Allow: /'", and RFC 9309 §2.2.1 contradicts it: a crawler obeys the
group matching its product token and falls back to `*` only when no such group
exists, so an open catch-all grants exactly the access a named group would.

The audit now asks whether the rules that apply to the token permit `/`.
Allowed by its own group, allowed through the catch-all, and allowed because no
group applies all pass. A disallow that reaches the token still fails. The warn
band is gone. An unreadable robots.txt — missing, non-200, empty, or a 200 that
parses to no rules at all — is not applicable rather than a warn.

The failure text no longer claims that blocking this agent "prevents your
content from appearing in AI-powered search results and answers". The dossier
assigns that role to Meta-WebIndexer; Meta-ExternalAgent is the training-side
token. The failure now states the effect the sources support — exclusion from
Meta's training corpus and from direct product indexing — and its priority drops
from high to medium accordingly.

Sites allowed only through a wildcard move from 0.5 to 1.0 on this check. Sites
with no robots.txt leave the denominator instead of scoring 0.5. Grade, tier and
weight are unchanged at A, scored, 1.0.

The change is confined to this audit. The twenty sibling `CrawlerBotAudit`
checks keep the inherited rule, so the robots differential baseline is
unaffected.
